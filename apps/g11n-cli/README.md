# g11n-cli

This is a command line tool for g11n. It should be installed as a
development dependency of your project and run as part of your build
process.

It's purpose is to scan your source code for strings that need to be
translated and generate a set of JSON files. These JSON files are then used by
the g11n library to provide translations.

[formatjs cli](https://formatjs.io/docs/tooling/cli/) offers two commands:
`extract` and `compile`. `extract` scans your source code and generates a set
of JSON files. `compile` takes these JSON files and generates a set of
JavaScript files that can be imported by your application. This is the
right way if you have a large application.

`g11n-cli` is a wrapper around `formatjs cli` that offers a single command
which does both `extract` and `compile` in one step, while merging in
translations from a previous run.

## How do I

- ...add a new language? Simply create a new file in `<lang-dir>` with the
  language code as the name (e.g. `en.json`), then run `g11n-cli update`. The
  file will be populated with all the strings that need to be translated.
- ...edit translation? Edit the language file in `<lang-dir>` and change the
  value of the string you want to translate. Then run `g11n-cli update` again
  so that message is also updated in `extracted-messages.json`.
- ...remove a message? Make sure that the message is not used anywhere
  in your source code. Then run `g11n-cli update` again. This will remove it
  from `extracted-messages.json` and all language files.
- ...add a message that is not in source code? You cannot do that. If you try
  to add it manually to any of the files it will be deleted in the next
  iteration. Create a source file for this purpose and make sure it is
  included in the your library or application. Your toolset should take
  care of the rest.
- ...collect strings from libraries? The program cannot scan multiple
  directories but it can include multiple `extracted-messages.json` files.
  The resulted language files are going to contain all the strings from all
  the libraries.
- ...use translation files with other libraries? The generated JSON files
  are simple `"explicit.id.delimited.by.dots": "translation"` pairs. You
  can use them with any library that supports this format. The command
  line allows you tu customize the patterns that are used to extract
  strings from source code.
- ...use translation files from other sources? You will have to create a
  `extracted-messages.json` yourself and point `g11n-cli` to it using the
  `<extra...>` argument. The file will be merged into the result.

## Arguments and Options

```bash
# g11n-cli --help
g11n-cli update [options] <source-dir> <lang-dir> <extra...>
```

- `--source-ext <ext1,ext2,ext3>`> Extensions to include. Used to construct
  the glob pattern for locating source files. (default: "js,jsx,ts,tsx,mjs")
- `source-dir`: this is the path that will be scanned for strings marked for
  translation; it should be the root of your source code for the current
  library or application (e.g. `src`).
- `lang-dir`: this is the path where json language files are located; we
  will read existing files from this directory, merge in new translations
  and write the result back to this directory.
- `extra...`: additional content to include in the generated JSON files.
  This is useful if you want to collect strings from multiple libraries
  into a single set of JSON files. Each argument can be a glob pattern (e.g.
  `lib/**/i18n/extracted-messages.json`) or a path to a
  `extracted-messages.json` file.
- `--id-interpolation-pattern <pattern>`: If certain message descriptors don't
  have id, this `pattern` will be used to automatically generate IDs for them.
  Default to `[sha512:contenthash:base64:6]` where `contenthash` is the hash of
  `defaultMessage` and `description`. See
  [webpack docs](https://github.com/webpack/loader-utils#interpolatename)
  for sample patterns (default: "[sha512:contenthash:base64:6]")
- `--extract-source-location`: Whether the metadata about the location of the
  message in the source file should be extracted. If `true`, then `file`,
  `start`, and `end` fields will exist for each extracted message descriptors.
  (default: false)
- `--remove-default-message`> Remove `defaultMessage` field in generated file
  after extraction (default: false)
- `--additional-component-names <comma,separated,names>`  Additional component
  names to extract messages from, e.g: `FormattedFooBarMessage`. **NOTE**: By
  default we check for the fact that `FormattedMessage` is imported from
  `moduleSourceName` to make sure variable alias works. This option does not do
  that so it's less safe.
- `--additional-function-names <comma,separated,names>` Additional function
  names to extract messages from, e.g: `$t`.
- `--ignore <files...>` List of glob paths to **not** extract translations
  from. See [fast-glob docs](https://www.npmjs.com/package/fast-glob) for
  supported patterns.
- `--throws` Whether to throw an exception when we fail to process any file
  in the batch. (default: false)
- `--pragma <pragma>` parse specific additional custom pragma.
  This allows you to tag certain file with metadata such as `project`.
  For example with this file:
  
  ```js
  // @intl-meta project:my-custom-project import
  {FormattedMessage} from 'react-intl';

  <FormattedMessage defaultMessage="foo" id="bar" />;
  ```

  and with option `{pragma: "intl-meta"}`, we'll parse out
  `// @intl-meta project:my-custom-project` into
  `{project: 'my-custom-project'}` in the result file.
- `--preserve-whitespace`: Whether to preserve whitespace and newlines.
  (default: false)
- `--flatten`: Whether to hoist selectors & flatten sentences as much as
  possible. E.g: "I have {count, plural, one{a dog} other{many dogs}}" becomes
  "{count, plural, one{I have a dog} other{I have many dogs}}". The goal is to
  provide as many full sentences as possible since fragmented sentences are not
  translator-friendly. (default: false)
- `--extracted-file-name <file>`: The name of the intermediate file with
  detailed information about the messages, including all their translations.
  (default: extracted-messages.json)
- `-h, --help`: display help for the command.

## Update Algorithm

Some of the results that you get may seem weird at first, but they are
actually the result of a very simple algorithm that is designed to make
translations easier. It goes like this:

1. You provide the path that shall be searched for source code files
   in `<source-dir>` argument. By default we use a `ts,tsx,js,jsx` glob
   pattern to find all files that should be scanned.
2. `formatjs` scans these files for strings that need to be translated
   in `FormattedMessage` components.
3. At this point we read all existing JSON files from `<lang-dir>` and
   merge them into a single object for each message. This content
   is written to `extracted-messages.json`.
4. For each locale file in `<lang-dir>` we now recreate the content. The values
   are determines as follows:
   1. If there is a translation (collected from the same locale file) then that
      will be used.
   2. If there is no translation, we use the default message (collected from the
      source code).
   3. Otherwise we use the ID of the message.

## Extracted Messages File Format

The `extracted-messages.json` file contains a tree of objects. Each object
is either a node or a leaf. Nodes are objects that can contain other nodes
and/or leafs. A leaf is an object that contains a `__id__` key and includes:

- `__id__`: the ID of the message;
- `description` (optional): the description of the message extracted from the
  source code;
- `defaultMessage` (optional): the default value extracted from the
  source code;
- `file` (optional): the path to the source file where the message was
  extracted from; this is only present if `--extract-source-location` option is
  used;
- `start` (optional): the location in the source file where the message was
  extracted from; this is only present if `--extract-source-location` option is
  used;
- `end` (optional): like `start` but for the end of the message; this is only
  present if `--extract-source-location` option is used;
- `<locale>`: the translation for the message in the given locale.

Example:

```jsx
<FormattedMessage
  defaultMessage="Hello {name}"
  description="Greeting"
  id="season.s.greetings.to.all"
/>
```

will generate the following entry in `extracted-messages.json`:

```json
{
  "season": {
    "s": {
      "greetings": {
        "to": {
          "all": {
            "__id__": "season.s.greetings.to.all",
            "description": "Greeting",
            "defaultMessage": "Hello {name}"
          }
        }
      }
    }
  }
}
```
