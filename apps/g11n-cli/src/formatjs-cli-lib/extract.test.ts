import { processFile, calculateLineColFromOffset } from './extract';
import ts from 'typescript';

describe('processFile', () => {
    it(
        'should return empty messages and undefined meta when no ' +
            'extraction callbacks are triggered',
        async () => {
            const source = 'const a = 1;';
            const filename = 'dummy.ts';
            const opts = {
                extractSourceLocation: true,
                // These callbacks are provided but no messages will be added
                // by the transformer.
                onMsgExtracted: jest.fn(),
                onMetaExtracted: jest.fn(),
            };

            const result = await processFile(source, filename, opts);
            expect(result.messages).toEqual([]);
            expect(result.meta).toBeUndefined();
        },
    );

    it(
        'should extract messages and meta when extraction callbacks ' +
            'are triggered',
        async () => {
            for (const [source, start, end] of [
                ['intl.formatMessage({ id: "msg-id" });', 19, 35],
                ['t.formatMessage({ id: "msg-id" })', 16, 32],
                ['formatMessage({ id: "msg-id" })', 14, 30],
            ]) {
                const filename = 'dummy.ts';
                const opts = {
                    extractSourceLocation: true,
                    onMsgExtracted: jest.fn(),
                    onMetaExtracted: jest.fn(),
                };

                const result = await processFile(
                    source as string,
                    filename,
                    opts,
                );
                expect(result.messages).toEqual([
                    {
                        col: start,
                        start: start,
                        end: end,
                        file: 'dummy.ts',
                        id: 'msg-id',
                        line: 1,
                    },
                ]);
                expect(result.meta).toBeUndefined();
            }
        },
    );
    it(
        'should extract messages from custom functions',
        async () => {
            for (const [source, start, end] of [
                ['intl.xyz({ id: "msg-id" });', 9, 25],
                ['t.xyz({ id: "msg-id" })', 6, 22],
                ['xyz({ id: "msg-id" })', 4, 20],
            ]) {
                const filename = 'dummy.ts';
                const opts = {
                    extractSourceLocation: true,
                    onMsgExtracted: jest.fn(),
                    onMetaExtracted: jest.fn(),
                    additionalFunctionNames: ['xyz'],
                };

                const result = await processFile(
                    source as string,
                    filename,
                    opts,
                );
                expect(result.messages).toEqual([
                    {
                        col: start,
                        start: start,
                        end: end,
                        file: 'dummy.ts',
                        id: 'msg-id',
                        line: 1,
                    },
                ]);
                expect(result.meta).toBeUndefined();
            }
        },
    );
    it(
        'should extract messages from string argument',
        async () => {
            for (const [source, start, end] of [
                ['intl.xyz("msg-id");', 9, 17],
                ['t.xyz("msg-id")', 6, 14],
                ['xyz("msg-id")', 4, 12],
                ['xyz("msg-id", {a: "1"})', 4, 12],
            ]) {
                const filename = 'dummy.ts';
                const opts = {
                    extractSourceLocation: true,
                    onMsgExtracted: jest.fn(),
                    onMetaExtracted: jest.fn(),
                    additionalFunctionNames: ['xyz'],
                };

                const result = await processFile(
                    source as string,
                    filename,
                    opts,
                );
                expect(result.messages).toEqual([
                    {
                        col: start,
                        start: start,
                        end: end,
                        file: 'dummy.ts',
                        defaultMessage: "msg-id",
                        id: 'msg-id',
                        line: 1,
                    },
                ]);
                expect(result.meta).toBeUndefined();
            }
        },
    );
});

describe('calculateLineColFromOffset', () => {
    it('should return line 1 and col 1 when no offset is provided', () => {
        const result = calculateLineColFromOffset('some text', undefined);
        expect(result).toEqual({ line: 1, col: 1 });
    });

    it('should calculate correct line and column for a given offset', () => {
        const text = 'first line\nsecond line\nthird line';
        // Calculate offset inside the second line:
        const offset = 'first line\nsecond '.length;
        const result = calculateLineColFromOffset(text, offset);
        // There are two lines before third line, and the column is determined by the length of "second "
        expect(result).toEqual({ line: 2, col: 'second '.length });
    });
});
