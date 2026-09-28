import { describe, expect, it } from 'vitest';
import { canonicalFileUri, isSameFileUri } from '../../server/src/utils/fileUri.js';

describe('canonicalFileUri', () => {
    it('maps an encoded-colon and a plain-colon Windows URI to the same key', () => {
        expect(canonicalFileUri('file:///c%3A/Users/a/b.sysml')).toBe('file:///c:/Users/a/b.sysml');
        expect(canonicalFileUri('file:///C:/Users/a/b.sysml')).toBe('file:///c:/Users/a/b.sysml');
    });

    it('decodes percent-encoded path characters', () => {
        expect(canonicalFileUri('file:///home/a/my%20model.sysml')).toBe('file:///home/a/my model.sysml');
    });

    it('keeps path segment case, lowercasing only the drive letter', () => {
        expect(canonicalFileUri('file:///D:/Models/Vehicle.sysml')).toBe('file:///d:/Models/Vehicle.sysml');
    });

    it('returns non-file and malformed URIs unchanged', () => {
        expect(canonicalFileUri('untitled:Untitled-1')).toBe('untitled:Untitled-1');
        expect(canonicalFileUri('file:///bad%E0%A4%A')).toBe('file:///bad%E0%A4%A');
    });
});

describe('isSameFileUri', () => {
    it('treats the client and pathToFileURL spellings of one Windows file as the same file', () => {
        expect(isSameFileUri(
            'file:///c%3A/Users/me/project/Definitions/Users.sysml',
            'file:///C:/Users/me/project/Definitions/Users.sysml',
        )).toBe(true);
    });

    it('distinguishes different files', () => {
        expect(isSameFileUri('file:///c:/a/x.sysml', 'file:///c:/a/y.sysml')).toBe(false);
    });
});
