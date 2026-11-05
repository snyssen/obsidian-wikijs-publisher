import { describe, expect, it } from 'vitest';
import { isValidWikiPath, slugify, toAssetFileName, toWikiPath } from '../../src/wiki/paths';

describe('slugify', () => {
	it.each([
		['Read me', 'read-me'],
		['test.md', 'test-md'],
		['  Spaces   everywhere ', 'spaces-everywhere'],
		["What's new? (2026)", 'whats-new-2026'],
		['Café Crème', 'café-crème'],
		['snake_case', 'snake_case'],
		['--dashes--', 'dashes'],
		['!!!', ''],
	])('%s → %s', (value, slug) => {
		expect(slugify(value)).toBe(slug);
	});
});

describe('toWikiPath', () => {
	it('slugifies each segment and trims slashes', () => {
		expect(toWikiPath('/My Notes//Guides/First steps/')).toBe('my-notes/guides/first-steps');
	});

	it('drops segments that slugify to nothing', () => {
		expect(toWikiPath('notes/???/page')).toBe('notes/page');
	});

	it('produces valid wiki paths', () => {
		expect(isValidWikiPath(toWikiPath('Some/Weird.Path/With (parens)'))).toBe(true);
	});
});

describe('toAssetFileName', () => {
	it.each([
		['My Image_1.PNG', 'my-image_1.png'],
		['diagram.v2.svg', 'diagram-v2.svg'],
		['README', 'readme'],
		['.hidden', 'hidden'],
		['???.png', 'file.png'],
	])('%s → %s', (name, expected) => {
		expect(toAssetFileName(name)).toBe(expected);
	});
});

describe('isValidWikiPath', () => {
	it.each(['', 'home', '/some/path', 'with space/and_underscore', 'café'])('accepts %s', (path) => {
		expect(isValidWikiPath(path)).toBe(true);
	});

	it.each(['test.md', 'what?', 'a'.repeat(256)])('rejects %s', (path) => {
		expect(isValidWikiPath(path)).toBe(false);
	});
});
