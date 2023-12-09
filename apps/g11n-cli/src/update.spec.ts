import {
    mkdtempSync, existsSync, rmSync, writeFileSync,
    readFileSync, mkdirSync
} from "fs";
import { join } from "path";
import { tmpdir } from "os";

import {
    flatten,
    compile,
    format,
    readJsonOrDefault,
    performUpdate,
} from "./update";

const extractedFileName = "extracted.json";

describe("performUpdate", () => {
    let tmpDir: string;
    beforeEach(() => {
        tmpDir = mkdtempSync(join(tmpdir(), "g11n-cli-"));
    });
    afterEach(() => {
        if (existsSync(tmpDir)) {
            rmSync(tmpDir, { recursive: true, force: true });
        }
    });
    it("should return false if there is no file", () => {
        expect(performUpdate(tmpDir, tmpDir, [], {
            sourceExt: "ts,tsx",
            extractedFileName
        })).toBeTruthy();
        expect(existsSync(join(tmpDir, extractedFileName))).toBeFalsy();
    });
    it("should create extracted file even if there's no message", async () => {
        const i18nDir: string = join(tmpDir, "i18n");
        mkdirSync(i18nDir, { recursive: true });
        const srcDir: string = join(tmpDir, "src");
        mkdirSync(srcDir, { recursive: true });
        const aSrcFile = join(srcDir, "a.tsx");
        writeFileSync(aSrcFile, "");
        const fullExtracted = join(i18nDir, extractedFileName);

        expect(await performUpdate(srcDir, i18nDir, [], {
            sourceExt: "tsx,ts",
            extractedFileName
        })).toBeTruthy();

        expect(existsSync(fullExtracted)).toBeTruthy();
        const content = readFileSync(fullExtracted, "utf8");
        expect(JSON.parse(content)).toEqual({});
    });
    it("should extract the message from file", async () => {
        const i18nDir: string = join(tmpDir, "i18n");
        mkdirSync(i18nDir, { recursive: true });
        const localeFile: string = join(i18nDir, "ab.json");
        writeFileSync(localeFile, "");
        const srcDir: string = join(tmpDir, "src");
        mkdirSync(srcDir, { recursive: true });
        const aSrcFile = join(srcDir, "a.tsx");
        writeFileSync(
            aSrcFile,
            "<FormattedMessage\n" +
            "  id=\"lorem.ipsum\"\n" +
            "  defaultMessage=\"dolor sit amet\"\n" +
            "/>"
        );
        const fullExtracted = join(i18nDir, extractedFileName);

        expect(await performUpdate(srcDir, i18nDir, [], {
            sourceExt: "tsx,ts",
            extractedFileName,
            extractSourceLocation: true
        })).toBeTruthy();

        expect(existsSync(fullExtracted)).toBeTruthy();
        const contentExtracted = readFileSync(fullExtracted, "utf8");
        expect(JSON.parse(contentExtracted)).toEqual({
            "lorem": {
                "ipsum": {
                    "__id__": "lorem.ipsum",
                    "col": 1,
                    "defaultMessage": "dolor sit amet",
                    "end": 73,
                    "file": expect.stringMatching("src/a.tsx"),
                    "line": 1,
                    "start": 0,
                },
            },
        });
        const contentLocale = readFileSync(localeFile, "utf8");
        expect(JSON.parse(contentLocale)).toEqual({
            "lorem.ipsum": "dolor sit amet"
        });
    });
});


describe("readJsonOrDefault", () => {
    let tmpDir: string;
    beforeEach(() => {
        tmpDir = mkdtempSync(join(tmpdir(), "g11n-cli-"));
    });
    afterEach(() => {
        if (existsSync(tmpDir)) {
            rmSync(tmpDir, { recursive: true, force: true });
        }
    });
    it("should return default if the file is missing", () => {
        const filePath = join(tmpDir, "a.json");
        expect(readJsonOrDefault(filePath, {
            "lorem.ipsum": "dolor sit amet",
        })).toEqual({
            "lorem.ipsum": "dolor sit amet",
        });
    });
    it("should return default if the file is empty", () => {
        const filePath = join(tmpDir, "a.json");
        writeFileSync(filePath, "");
        expect(readJsonOrDefault(filePath, {
            "lorem.ipsum": "dolor sit amet",
        })).toEqual({
            "lorem.ipsum": "dolor sit amet",
        });
    });
    it("should throw if the content is not JSON", () => {
        const filePath = join(tmpDir, "a.json");
        writeFileSync(filePath, "1+2=3");
        expect(() => readJsonOrDefault(filePath, {
            "lorem.ipsum": "dolor sit amet",
        })).toThrow();
    });
    it("should return the parsed JSON", () => {
        const filePath = join(tmpDir, "a.json");
        writeFileSync(filePath, JSON.stringify({
            "lorem.ipsum": "labore et dolore magna aliqua",
            "dolor.sit.amet": "consectetur adipiscing elit",
        }));
        expect(readJsonOrDefault(filePath, {
            "lorem.ipsum": "dolor sit amet",
        })).toEqual({
            "lorem.ipsum": "labore et dolore magna aliqua",
            "dolor.sit.amet": "consectetur adipiscing elit",
        });
    });
});


describe("format", () => {
    let tmpDir: string;
    beforeEach(() => {
        tmpDir = mkdtempSync(join(tmpdir(), "g11n-cli-"));
    });
    afterEach(() => {
        if (existsSync(tmpDir)) {
            rmSync(tmpDir, { recursive: true, force: true });
        }
    });
    it("should work with an empty directory", () => {
        expect(format(tmpDir, {}, [], extractedFileName)).toEqual({});
    });
    it("should ignore extra messages in locale file", () => {
        const filePath = join(tmpDir, "a.json");
        const locales: string[] = [];
        writeFileSync(filePath, JSON.stringify({
            "lorem.ipsum": "dolor sit amet",
        }));
        expect(format(tmpDir, {}, locales, extractedFileName)).toEqual({});
    });
    it("should save extracted messages", () => {
        const locales: string[] = [];
        expect(format(tmpDir, {
            "lorem.ipsum": {
                id: "dolor.sit.amet",
                defaultMessage: "consectetur adipiscing elit",
                file: "some/file.tsx",
                start: 123,
                end: 456
            },
            "lorem.incididunt": {
                id: "quis.nostrud.exercitation",
                defaultMessage: "Duis aute irure dolor in reprehenderit",
                file: "other/file.tsx",
                start: 987,
                end: 643
            }
        }, locales, extractedFileName)).toEqual({
            "lorem": {
                "ipsum": {
                    __id__: "lorem.ipsum",
                    id: "dolor.sit.amet",
                    defaultMessage: "consectetur adipiscing elit",
                    file: "some/file.tsx",
                    start: 123,
                    end: 456
                },
                "incididunt": {
                    __id__: "lorem.incididunt",
                    id: "quis.nostrud.exercitation",
                    defaultMessage: "Duis aute irure dolor in reprehenderit",
                    file: "other/file.tsx",
                    start: 987,
                    end: 643
                }
            }
        });
    });
    it("should add existing translation to messages", () => {
        const filePath = join(tmpDir, "a.json");
        const locales: string[] = [];
        writeFileSync(filePath, JSON.stringify({
            "lorem.ipsum": "cillum dolore eu fugiat",
        }));
        expect(format(tmpDir, {
            "lorem.ipsum": {
                id: "dolor.sit.amet",
                defaultMessage: "consectetur adipiscing elit",
                file: "some/file.tsx",
                start: 123,
                end: 456
            },
            "incididunt": {
                id: "quis.nostrud.exercitation",
                defaultMessage: "Duis aute irure dolor in reprehenderit",
                file: "other/file.tsx",
                start: 987,
                end: 643
            }
        }, locales, extractedFileName)).toEqual({
            "lorem": {
                "ipsum": {
                    __id__: "lorem.ipsum",
                    id: "dolor.sit.amet",
                    defaultMessage: "consectetur adipiscing elit",
                    file: "some/file.tsx",
                    start: 123,
                    end: 456,
                    "a": "cillum dolore eu fugiat",
                }
            },
            "incididunt": {
                __id__: "incididunt",
                id: "quis.nostrud.exercitation",
                defaultMessage: "Duis aute irure dolor in reprehenderit",
                file: "other/file.tsx",
                start: 987,
                end: 643
            }
        });
    });
});


describe("flatten", () => {
    it("should throw an error if the input is not an object", () => {
        const result = {};
        expect(() => flatten("", result)).toThrow();
        expect(() => flatten(1, result)).toThrow();
        expect(() => flatten(true, result)).toThrow();
        expect(() => flatten(null, result)).toThrow();
        expect(() => flatten(undefined, result)).toThrow();
        expect(result).toEqual({});
    });
    it("should deal with a leaf object", () => {
        const input = {
            __id__: "a",
            en: "b",
        };
        expect(flatten(input, {})).toEqual({
            "": {
                __id__: "a",
                en: "b",
            },
        });
        expect(flatten(input, {}, "x.y.z")).toEqual({
            "x.y.z": {
                __id__: "a",
                en: "b",
            },
        });
    });
    it("should deal with a nested object", () => {
        const input = {
            "lorem": {
                "ipsum": {
                    __id__: "b",
                    en: "c",
                },
            },
            "dolor": {
                __id__: "e",
                en: "f",
            },
        };
        expect(flatten(input, {})).toEqual({
            "lorem.ipsum": {
                __id__: "b",
                en: "c",
            },
            "dolor": {
                __id__: "e",
                en: "f",
            },
        });
    });
});


describe("compile", () => {
    it("should throw an error if the input is not an object", () => {
        expect(() => compile("" as any, "xy")).toThrow();
        expect(() => compile(1 as any, "xy")).toThrow();
        expect(() => compile(true as any, "xy")).toThrow();
        expect(() => compile(null as any, "xy")).toThrow();
        expect(() => compile(undefined as any, "xy")).toThrow();
    });
    it("should deal with an empty list", () => {
        expect(compile({}, "xy")).toEqual({});
    });
    it("should use the locale if available", () => {
        expect(compile({
            "lorem": {
                "ipsum": {
                    __id__: "b",
                    xy: "c",
                    defaultMessage: "d",
                },
            },
        }, "xy")).toEqual({
            "lorem.ipsum": "c",
        });
    });
    it("should use the default message if available", () => {
        expect(compile({
            "lorem": {
                "ipsum": {
                    __id__: "b",
                    defaultMessage: "d",
                },
            },
        }, "xy")).toEqual({
            "lorem.ipsum": "d",
        });
    });
    it("should use the key if no message is available", () => {
        expect(compile({
            "lorem": {
                "ipsum": {
                    __id__: "b",
                },
            },
        }, "xy")).toEqual({
            "lorem.ipsum": "lorem.ipsum",
        });
    });
});
