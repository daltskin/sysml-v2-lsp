import { describe, expect, it } from 'vitest';
import { canonicalUri, isSameDocumentUri } from '../../server/src/utils/documentUri.js';

describe('canonicalUri', () => {
    it('maps an encoded-colon and a plain-colon Windows URI to the same key', () => {
        expect(canonicalUri('file:///c%3A/Users/a/b.sysml')).toBe('file:///c:/users/a/b.sysml');
        expect(canonicalUri('file:///C:/Users/a/b.sysml')).toBe('file:///c:/users/a/b.sysml');
    });

    it('decodes percent-encoded path characters of file URIs', () => {
        expect(canonicalUri('file:///home/a/my%20model.sysml')).toBe('file:///home/a/my model.sysml');
    });

    it('ignores case in file names and folders', () => {
        expect(canonicalUri('file:///D:/Models/Vehicle.SysML')).toBe('file:///d:/models/vehicle.sysml');
    });

    it('ignores case in https URIs, without decoding them', () => {
        expect(canonicalUri('HTTPS://Example.com/Models/Vehicle.sysml')).toBe('https://example.com/models/vehicle.sysml');
        expect(canonicalUri('https://example.com/a%2Fb.sysml')).toBe('https://example.com/a%2fb.sysml');
    });

    it('only lowercases malformed file URIs', () => {
        expect(canonicalUri('file:///Bad%E0%A4%A')).toBe('file:///bad%e0%a4%a');
    });
});

describe('isSameDocumentUri', () => {
    it('treats the client and pathToFileURL spellings of one Windows file as the same document', () => {
        expect(isSameDocumentUri(
            'file:///c%3A/Users/me/project/Definitions/Users.sysml',
            'file:///C:/Users/me/project/Definitions/Users.sysml',
        )).toBe(true);
    });

    it('treats file names differing only in case as the same document', () => {
        expect(isSameDocumentUri('file:///home/a/Users.sysml', 'file:///home/a/users.sysml')).toBe(true);
        expect(isSameDocumentUri('https://example.com/Users.sysml', 'https://example.com/users.sysml')).toBe(true);
    });

    it('distinguishes different documents', () => {
        expect(isSameDocumentUri('file:///c:/a/x.sysml', 'file:///c:/a/y.sysml')).toBe(false);
        expect(isSameDocumentUri('file:///c:/a/x.sysml', 'https://example.com/c:/a/x.sysml')).toBe(false);
    });
});
