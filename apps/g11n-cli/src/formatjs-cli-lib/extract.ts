/**
 * This file is copied from formatjs-cli and modified.
 *
 * The fork started from this issue:
 * https://github.com/formatjs/formatjs/issues/4404
 */

import stringify from 'json-stable-stringify';
import type { Comparator } from 'json-stable-stringify'
import {
    MessageDescriptor,
    Opts,
    interpolateName,
    transformWithTs,
} from '@formatjs/ts-transformer';
import { outputFile, readFile } from 'fs-extra';
import { parse } from '@formatjs/icu-messageformat-parser';
import { printAST } from '@formatjs/icu-messageformat-parser/printer';
import { hoistSelectors } from '@formatjs/icu-messageformat-parser/manipulator';
import ts from 'typescript';

export type FormatFn<T = Record<string, MessageDescriptor>> = (
    msgs: Record<string, MessageDescriptor>
) => T

export type CompileFn<T = Record<string, MessageDescriptor>> = (
    msgs: T
) => Record<string, string>

export type SerializeFn<T = Record<string, MessageDescriptor>> = (
    msgs: T
) => string

export const format: FormatFn = msgs => msgs

export const compile: CompileFn = msgs => {
    const results: Record<string, string> = {}
    for (const k in msgs) {
        results[k] = msgs[k].defaultMessage!
    }
    return results
}


export interface Formatter {
    serialize?: SerializeFn
    format: FormatFn
    compile: CompileFn
    compareMessages?: Comparator
}


export interface ExtractionResult<M = Record<string, string>> {
    /**
     * List of extracted messages
     */
    messages: MessageDescriptor[]
    /**
     * Metadata extracted w/ `pragma`
     */
    meta?: M
}


export type ExtractOpts = Opts & {
    /**
     * Whether to throw an error if we had any issues with
     * 1 of the source files
     */
    throws?: boolean
    /**
     * Message ID interpolation pattern
     */
    idInterpolationPattern?: string
    /**
     * Path to a formatter file that controls the shape of JSON file from `outFile`.
     */
    format?: string | Formatter
    /**
     * Whether to hoist selectors & flatten sentences
     */
    flatten?: boolean
} & Pick<Opts, 'onMsgExtracted' | 'onMetaExtracted'>


export type ExtractCLIOptions = Omit<
    ExtractOpts,
    'overrideIdFn' | 'onMsgExtracted' | 'onMetaExtracted'
> & {
    /**
     * Output File
     */
    outFile?: string
    /**
     * Ignore file glob pattern
     */
    ignore?: string[]
}

export interface ExtractedMessageDescriptor extends MessageDescriptor {
    /**
     * Line number
     */
    line?: number
    /**
     * Column number
     */
    col?: number
    /**
     * Metadata extracted from pragma
     */
    meta?: Record<string, string>
}
/**
 * Invoid TypeScript module transpilation with our TS transformer
 * @param opts Formatjs TS Transformer opt
 * @param fn filename
 */
export function parseScript(opts: Opts, fn?: string) {
    return (source: string) => {
        let output
        try {
            console.debug('Using TS compiler to process file', fn)
            output = ts.transpileModule(source, {
                compilerOptions: {
                    allowJs: true,
                    target: ts.ScriptTarget.ESNext,
                    noEmit: true,
                    experimentalDecorators: true,
                },
                reportDiagnostics: true,
                fileName: fn,
                transformers: {
                    before: [transformWithTs(ts, opts)],
                },
            })
        } catch (e) {
            if (e instanceof Error) {
                e.message = `Error processing file ${fn}
  ${e.message || ''}`
            }
            throw e
        }
        if (output.diagnostics) {
            const errs = output.diagnostics.filter(
                d => d.category === ts.DiagnosticCategory.Error
            )
            if (errs.length) {
                throw new Error(
                    ts.formatDiagnosticsWithColorAndContext(errs, {
                        getCanonicalFileName: fileName => fileName,
                        getCurrentDirectory: () => process.cwd(),
                        getNewLine: () => ts.sys.newLine,
                    })
                )
            }
        }
    }
}

function calculateLineColFromOffset(
    text: string,
    start?: number
): Pick<ExtractedMessageDescriptor, 'line' | 'col'> {
    if (!start) {
        return { line: 1, col: 1 }
    }
    const chunk = text.slice(0, start)
    const lines = chunk.split('\n')
    const lastLine = lines[lines.length - 1]
    return { line: lines.length, col: lastLine.length }
}

async function processFile(
    source: string,
    fn: string,
    { idInterpolationPattern, ...opts }: Opts & { idInterpolationPattern?: string }
) {
    let messages: ExtractedMessageDescriptor[] = []
    let meta: Record<string, string> | undefined

    const onMsgExtracted = opts.onMsgExtracted
    const onMetaExtracted = opts.onMetaExtracted

    opts = {
        ...opts,
        additionalComponentNames: [
            '$formatMessage',
            ...(opts.additionalComponentNames || []),
        ],
        onMsgExtracted(filePath: string, msgs: MessageDescriptor[]) {
            if (opts.extractSourceLocation) {
                msgs = msgs.map(msg => ({
                    ...msg,
                    ...calculateLineColFromOffset(source, msg.start),
                }))
            }
            messages = messages.concat(msgs)

            if (onMsgExtracted) {
                onMsgExtracted(filePath, msgs)
            }
        },
        onMetaExtracted(filePath, m) {
            meta = m

            if (onMetaExtracted) {
                onMetaExtracted(filePath, m)
            }
        },
    }

    if (!opts.overrideIdFn && idInterpolationPattern) {
        opts = {
            ...opts,
            overrideIdFn: (id, defaultMessage, description, fileName) =>
                id ||
                interpolateName(
                    {
                        resourcePath: fileName,
                    } as any,
                    idInterpolationPattern,
                    {
                        content: description
                            ? `${defaultMessage}#${typeof description === 'string'
                                ? description
                                : stringify(description)
                            }`
                            : defaultMessage,
                    }
                ),
        }
    }

    console.debug('Processing opts for %s: %s', fn, opts)

    const scriptParseFn = parseScript(opts, fn)
    console.debug('Processing %s using typescript extractor', fn)
    scriptParseFn(source)

    console.debug('Done extracting %s messages: %s', fn, messages)
    if (meta) {
        console.debug('Extracted meta:', meta)
        messages.forEach(m => (m.meta = meta))
    }
    return { messages, meta }
}

/**
 * Extract strings from source files
 * @param files list of files
 * @param extractOpts extract options
 * @returns messages serialized as JSON string since key order
 * matters for some `format`
 */
export async function extract(
    files: readonly string[],
    extractOpts: ExtractOpts
) {
    const { throws, flatten, ...opts } = extractOpts
    let rawResults: Array<ExtractionResult | undefined>

    rawResults = await Promise.all(
        files.map(async fn => {
            console.debug('Extracting file:', fn)
            try {
                const source = await readFile(fn, 'utf8')
                return Promise.resolve(await processFile(source, fn, opts));
            } catch (e) {
                if (throws) {
                    throw e
                } else {
                    console.warn(String(e));
                }
            }
        })
    )

    // We always pass a custom formatter.
    const formatter = opts.format as Formatter;
    const extractionResults = rawResults.filter((r): r is ExtractionResult => !!r)

    const extractedMessages = new Map<string, MessageDescriptor>()

    for (const { messages } of extractionResults) {
        for (const message of messages) {
            const { id, description, defaultMessage } = message
            if (!id) {
                const error = new Error(
                    `[FormatJS CLI] Missing message id for message:
${JSON.stringify(message, undefined, 2)}`
                )
                if (throws) {
                    throw error
                } else {
                    console.warn(error.message)
                }
                continue
            }

            if (extractedMessages.has(id)) {
                const existing = extractedMessages.get(id)!
                if (
                    stringify(description) !== stringify(existing.description) ||
                    defaultMessage !== existing.defaultMessage
                ) {
                    const error = new Error(
                        `[FormatJS CLI] Duplicate message id: "${id}", but ` +
                        'the `description` and/or `defaultMessage` are different.'
                    )
                    if (throws) {
                        throw error
                    } else {
                        console.warn(error.message)
                    }
                }
            }
            extractedMessages.set(id, message)
        }
    }
    const results: Record<string, Omit<MessageDescriptor, 'id'>> = {}
    const messages = Array.from(extractedMessages.values())
    for (const { id, ...msg } of messages) {
        if (flatten && msg.defaultMessage) {
            msg.defaultMessage = printAST(hoistSelectors(
                parse(msg.defaultMessage)
            ))
        }
        results[id] = msg
    }
    if (typeof formatter.serialize === 'function') {
        return formatter.serialize(formatter.format(results as any))
    }
    return stringify(formatter.format(results as any), {
        space: 2,
        cmp: formatter.compareMessages || undefined,
    })
}


/**
 * Extract strings from source files, also writes to a file.
 * @param files list of files
 * @param extractOpts extract options
 * @returns A Promise that resolves if output file was written successfully
 */
export async function extractAndWrite(
    files: readonly string[],
    extractOpts: ExtractCLIOptions
) {
    const { outFile, ...opts } = extractOpts
    const serializedResult = (await extract(files, opts)) + '\n'
    console.log('Writing output file:', outFile);
    return outputFile(outFile, serializedResult);
}
