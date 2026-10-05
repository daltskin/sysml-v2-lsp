import { describe, expect, it } from 'vitest';
import { canonicalUri, isInFolder, isSameDocumentUri } from '../../server/src/utils/documentUri.js';

describe('canonicalUri', () => {
    it('maps an encoded-colon and a plain-colon Windows URI to the same key', () => {
        expect(canonicalUri('file:///c%3A/Users/a/b.sysml')).toBe('file:///c:/Users/a/b.sysml');
        expect(canonicalUri('file:///c%3a/Users/a/b.sysml')).toBe('file:///c:/Users/a/b.sysml');
        expect(canonicalUri('file:///C:/Users/a/b.sysml')).toBe('file:///c:/Users/a/b.sysml');
    });

    it('preserves the case of the path after the drive letter', () => {
        expect(canonicalUri('file:///D:/Models/Vehicle.SysML')).toBe('file:///d:/Models/Vehicle.SysML');
        expect(canonicalUri('file:///home/a/Users.sysml')).toBe('file:///home/a/Users.sysml');
    });

    it('leaves other percent-encoding and colons unchanged', () => {
        expect(canonicalUri('file:///home/a/my%20model.sysml')).toBe('file:///home/a/my%20model.sysml');
        expect(canonicalUri('file:///home/c%3A/a.sysml')).toBe('file:///home/c%3A/a.sysml');
        expect(canonicalUri('file:///cd%3A/a.sysml')).toBe('file:///cd%3A/a.sysml');
    });

    it('leaves non-file URIs unchanged', () => {
        expect(canonicalUri('https://example.com/Models/Vehicle.sysml')).toBe('https://example.com/Models/Vehicle.sysml');
        expect(canonicalUri('untitled:C:/a.sysml')).toBe('untitled:C:/a.sysml');
    });
});

describe('isSameDocumentUri', () => {
    it('treats the client and pathToFileURL spellings of one Windows file as the same document', () => {
        expect(isSameDocumentUri(
            'file:///c%3A/Users/me/project/Definitions/Users.sysml',
            'file:///C:/Users/me/project/Definitions/Users.sysml',
        )).toBe(true);
    });

    it('distinguishes documents whose paths differ only in case', () => {
        expect(isSameDocumentUri('file:///home/a/Users.sysml', 'file:///home/a/users.sysml')).toBe(false);
        expect(isSameDocumentUri('file:///c:/a/Users.sysml', 'file:///C:/a/users.sysml')).toBe(false);
        expect(isSameDocumentUri('https://example.com/Users.sysml', 'https://example.com/users.sysml')).toBe(false);
    });

    it('distinguishes different documents', () => {
        expect(isSameDocumentUri('file:///c:/a/x.sysml', 'file:///c:/a/y.sysml')).toBe(false);
        expect(isSameDocumentUri('file:///c:/a/x.sysml', 'https://example.com/c:/a/x.sysml')).toBe(false);
    });
});

describe('isInFolder', () => {
    it('contains the documents below a folder, with or without its trailing slash', () => {
        expect(isInFolder('file:///w/a/x.sysml', 'file:///w/a')).toBe(true);
        expect(isInFolder('file:///w/a/sub/x.sysml', 'file:///w/a/')).toBe(true);
    });

    it('matches whole folder names only', () => {
        expect(isInFolder('file:///w/ab/x.sysml', 'file:///w/a')).toBe(false);
        expect(isInFolder('file:///w/x.sysml', 'file:///w/a')).toBe(false);
    });

    it('matches the spellings of one Windows folder', () => {
        expect(isInFolder('file:///c%3A/w/x.sysml', 'file:///C:/w')).toBe(true);
    });
});
