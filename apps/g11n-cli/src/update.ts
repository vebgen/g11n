import { Command } from 'commander';
import { extractAndWrite, compileAndWrite } from '@formatjs/cli-lib';
import { sync as globSync } from 'fast-glob';
import type { ExtractCLIOptions, MessageDescriptor } from '@formatjs/cli-lib';
import type { Formatter } from '@formatjs/cli-lib/src/formatters';
import { join, basename } from 'path';
import { readFileSync, existsSync } from "fs";


/**
 * The options for the update command.
 */
export interface UpdateCLIOptions extends
    Omit<ExtractCLIOptions, "format" | "outFile" | ""> {

    /**
     * Extensions to include. Used to construct the glob pattern for
     * locating source files.
     * @default "ts,tsx,js,jsx"
     */
    sourceExt: string;

    /**
     * The name of the intermediate file with detailed information
     * about the messages, including all their translations.
     * @default "extracted-messages.json"
     */
    extractedFileName: string;
};


// The key that we insert in the message descriptor to store the message id.
const idKey = '__id__';


/**
 * The function is used to perform the update command.
 *
 * @param inPath - The source code path.
 * @param outPath - The language files path.
 * @param extra - The extra files to include.
 * @param cmdObj - The command options.
 */
export async function performUpdate(
    inPath: string, outPath: string, extra: string[],
    {
        sourceExt,
        extractedFileName,
        ...cmdObj
    }: UpdateCLIOptions
): Promise<boolean> {
    // Will be populated by the format function.
    const locales: string[] = [];

    // Our custom formatter.
    const formatter: Formatter = {
        serialize: (msgs) => JSON.stringify(msgs, null, 2),
        format: (msgs) => format(
            outPath, msgs, locales, extractedFileName
        ),
        compile: undefined,

        // https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/types/json-stable-stringify/index.d.ts
        // compareMessages?: (a: Element, b: Element) => number;
    };

    // Get the list of files to extract the data from.
    // fast-glob always uses forward slashes, so we need to replace
    // backslashes with forward slashes in the pattern for Windows
    // compatibility.
    const pattern = join(
        inPath, "**", `*.{${sourceExt}}`
    ).replace(/\\/g, "/");
    const files = globSync(pattern, { ignore: cmdObj.ignore, });
    if (files.length === 0) {
        console.error(
            `No files found for pattern ${pattern}; ignored: %O.`,
            cmdObj.ignore
        );
        return false;
    }
    // console.log(`Extracting messages from ${files.length} files...`)

    // Compute the output file path.
    const outFile = join(outPath, extractedFileName);
    // console.log(`Writing messages to ${outFile}...`);

    // Collect all files into a single one.
    await extractAndWrite(files, {
        outFile: outFile,
        idInterpolationPattern: (
            cmdObj.idInterpolationPattern ||
            '[sha1:contenthash:base64:6]'
        ),
        extractSourceLocation: cmdObj.extractSourceLocation,
        removeDefaultMessage: cmdObj.removeDefaultMessage,
        additionalComponentNames: cmdObj.additionalComponentNames,
        additionalFunctionNames: cmdObj.additionalFunctionNames,
        throws: cmdObj.throws,
        pragma: cmdObj.pragma,
        format: formatter,
        readFromStdin: false,
        preserveWhitespace: cmdObj.preserveWhitespace,
        flatten: cmdObj.flatten,
    });

    // Collect extra sources.
    let extraSources: string[] = [];
    extra.forEach((file) => {
        if (existsSync(file)) {
            extraSources.push(file);
        } else {
            const foundSources = globSync(file);
            if (foundSources.length === 0) {
                console.warn(
                    `No files found for pattern ${file}.`
                );
            }
            extraSources = extraSources.concat(foundSources);
        }
    });

    // Compile the extracted messages into separate JSON files.
    // console.log(`Compiling messages from %s...`, outFile);
    await Promise.all(locales.map(async (locale) => {
        // console.log(`Compiling ${locale}...`);
        formatter.compile = (msgs) => compile(msgs, locale);
        await compileAndWrite([outFile, ...extraSources], {
            outFile: join(outPath, `${locale}.json`),
            ast: false,
            skipErrors: false,
            format: formatter,
        })
    }));

    return true;
}


/**
 * The function is used to read a JSON file.
 *
 * If the file does not exist or it is empty, it returns an empty object.
 *
 * @param file - The file to read.
 * @param defaultValue - The default value to return if the file
 *  does not exist.
 * @returns The parsed content of the file.
 */
export function readJsonOrDefault(
    file: string,
    defaultValue = {}
): Record<string, any> {
    let data = defaultValue;
    if (existsSync(file)) {
        const json = readFileSync(file, "utf8");
        if (json) {
            data = JSON.parse(json);
        }
    }
    return data;
}


/**
 * The message has an id and all its translations.
 */
export interface G11nMessageDescriptor extends MessageDescriptor {
    /**
     * The full ID of the message as extracted from file.
     */
    __id__: string;

    /**
     * The translations of this message.
     */
    [key: string]: any;
}


/**
 * This function is called by the formatjs library to format extracted messages.
 *
 * The result is a tree of objects consisting of nodes and leaves, with the
 * leaves being the message descriptors and having a `__id__` key.
 *
 * @param langPath - The path to the language files (will be scanned for
 *  JSON locale files).
 * @param msgs - The messages extracted from source code.
 * @param locales - The detected locales will be deposited here.
 * @param extractedFileName - The name of the intermediate file with detailed
 *  information about the messages, including all their translations.
 */
export function format(
    langPath: string,
    msgs: Record<string, MessageDescriptor>,
    locales: string[],
    extractedFileName: string
) {
    // Locate previous translations.
    const pattern = join(langPath, "*.json").replace(/\\/g, "/");
    const files = globSync(pattern, {
        ignore: [`**/${extractedFileName}`],
    });
    // console.log(`Found ${files.length} translation files: %O.`, files);

    // Load previous translations.
    const oldLocaleData = files.reduce((acc, itr) => {
        const locale = basename(itr).split(".").shift()!;
        locales.push(locale);
        acc[locale] = readJsonOrDefault(itr);
        return acc;
    }, {});

    // For each message in the source code, see if we have an existing
    // translation.
    const result: Record<string, MessageDescriptor> = {};
    for (const key of Object.keys(msgs).sort()) {
        // console.log(`Processing message ${key}...`);

        // This is the record provided by formatjs.
        const value = msgs[key];

        // This is the record that we will write to the output file.
        const newData: G11nMessageDescriptor = {
            __id__: key,
            ...value
        };

        // If there are existing translations, copy them over.
        for (const locale of locales) {
            const existing = oldLocaleData[locale][key];
            // But ignore those that have a default message equal to the key.
            if (existing && existing !== key) {
                newData[locale] = existing;
            }
        }

        // Split the ID of the message into parts
        // (e.g. "foo.bar.baz" => ["foo", "bar", "baz"])
        const parts = key.split('.');

        // Start from the root of the tree.
        let obj = result;

        // And follow the path to the leaf.
        for (let i = 0; i < parts.length - 1; i++) {
            // If a node has not been created...
            if (!obj[parts[i]]) {
                // ...create it now...
                obj[parts[i]] = {} as any;
            }

            // ...and move to the next node.
            obj = obj[parts[i]] as any;
        }

        // Finally, add the new data as the leaf.
        obj[parts[parts.length - 1]] = newData;
    }

    return result;
}


/**
 * The function is used to flatten the messages object.
 *
 * It uses the __id__ property to identify the leaf nodes.
 *
 * For example, the following object:
 *
 * {
 *  "a": {
 *     "b": {
 *        "c": "value",
 *        "__id__": "a.b.c"
 *    }
 * }
 *
 * will be transformed into:
 *
 * {
 *   "a.b": {
 *     "c": "value",
 *     "__id__": "a.b.c"
 *   }
 * }
 *
 * @param obj - The object to flatten.
 * @param result - The result object (used internally).
 * @param prefix - The prefix to use for the keys (used internally).
 *
 * @returns The flattened object.
 */
export function flatten(
    obj: any,
    result: Record<string, MessageDescriptor> = {},
    prefix = ''
) {
    if (typeof obj !== 'object') {
        throw new Error('flatten() called on non-object');
    }
    if (obj[idKey]) {
        result[prefix] = obj;
    } else {
        for (const [key, value] of Object.entries(obj)) {
            flatten(value, result, prefix ? prefix + '.' + key : key);
        }
    }
    return result;
}


/**
 * This function is called by the formatjs library to compile the extracted
 * messages into separate JSON files.
 *
 * @param msgs - The messages to compile.
 * @param locale - The locale to compile for.
 * @returns The compiled messages.
 */
export function compile(
    msgs: Record<string, MessageDescriptor|any>,
    locale: string
) {
    // console.log(`compile called for ${locale}...`);
    const result = {};

    // Go through leafs only.
    for (const [key, value] of Object.entries(flatten(msgs))) {
        // For each leaf key (e.g. "foo.bar.baz") the value is:
        // - the translated message if it exists
        // - the default message if it exists
        // - the message id if it exists
        // - the leaf key itself otherwise
        result[key] = value[locale] || value.defaultMessage || value.id || key;
    }
    return result;
}


/**
 * Implementation of the update command.
 */
export const updateCommand = () => {
    const command = new Command('update');
    command
        .description('update translation files')
        .argument('<source-dir>', 'the source code path')
        .argument('<lang-dir>', 'the language files path')
        .argument('<extra...>')
        .option(
            '--source-ext <ext1,ext2,ext3>',
            "Extensions to include. Used to construct the glob pattern for " +
            "locating source files.",
            "ts,tsx,js,jsx"
        )
        .option(
            '--id-interpolation-pattern <pattern>',
            "If certain message descriptors don't have id, this \`pattern\` " +
            "will be used to automatically generate IDs for them. " +
            "Default to \`[sha512:contenthash:base64:6]\` where \`contenthash\` " +
            "is the hash of \`defaultMessage\` and \`description\`. " +
            "See https://github.com/webpack/loader-utils#interpolatename for " +
            "sample patterns",
            '[sha512:contenthash:base64:6]'
        )
        .option(
            '--extract-source-location',
            "Whether the metadata about the location of the message in the " +
            "source file should be extracted. " +
            "If \`true\`, then \`file\`, \`start\`, and \`end\` fields will " +
            "exist for each extracted message descriptors.",
            false
        )
        .option(
            '--remove-default-message',
            'Remove `defaultMessage` field in generated file after extraction',
            false
        )
        .option(
            '--additional-component-names <comma,separated,names>',
            "Additional component names to extract messages from, e.g: " +
            "`FormattedFooBarMessage`.\n" +
            "**NOTE**: By default we check for the fact that `FormattedMessage` " +
            "is imported from `moduleSourceName` to make sure variable alias " +
            "works. This option does not do that so it's less safe.",
            (val: string) => val.split(',')
        )
        .option(
            '--additional-function-names <comma,separated,names>',
            "Additional function names to extract messages from, e.g: `$t`.",
            (val: string) => val.split(',')
        )
        .option(
            '--ignore <files...>',
            "List of glob paths to **not** extract translations from. " +
            "See https://www.npmjs.com/package/fast-glob for supported " +
            "patterns."
        )
        .option(
            '--throws',
            "Whether to throw an exception when we fail to process any " +
            "file in the batch.",
            false
        )
        .option(
            '--pragma <pragma>',
            "parse specific additional custom pragma. This allows you to tag " +
            "certain file with metadata such as `project`. " +
            "For example with this file:\n" +
            "```\n" +
            "// @intl-meta project:my-custom-project\n" +
            "import {FormattedMessage} from 'react-intl';\n" +
            "\n" +
            '<FormattedMessage defaultMessage="foo" id="bar" />;\n' +
            "```\n" +
            "and with option `{pragma: \"intl-meta\"}`, we'll parse out " +
            "`// @intl-meta project:my-custom-project` into " +
            "`{project: 'my-custom-project'}\` in the result file."
        )
        .option(
            '--preserve-whitespace',
            'Whether to preserve whitespace and newlines.',
            false
        )
        .option(
            '--flatten',
            "Whether to hoist selectors & flatten sentences as much as " +
            "possible. E.g: \"I have {count, plural, one{a dog} " +
            "other{many dogs}}\" becomes \"{count, plural, one{I have a " +
            "dog} other{I have many dogs}}\".The goal is to provide as many " +
            "full sentences as possible since fragmented sentences are not " +
            "translator-friendly.",
            false
        )
        .option(
            '--extracted-file-name <file>',
            "The name of the intermediate file with detailed information " +
            "about the messages, including all their translations.",
            "extracted-messages.json"
        )
        .action(async (
            inPath: string,
            outPath: string,
            extra: string[],
            cmdObj: UpdateCLIOptions
        ) => {
            if (await performUpdate(inPath, outPath, extra, cmdObj)) {
                // console.log("Done.");
                process.exit(0);
            } else {
                process.exit(1);
            }
        });
    return command;
}
