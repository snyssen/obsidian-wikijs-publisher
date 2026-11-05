import { describe, expect, it } from 'vitest';
import { notePagePath, parseTags, toPageInput } from '../../src/publish/note';

describe('notePagePath', () => {
	it.each([
		['some/path', 'test', 'some/path/test'],
		['', 'My note', 'my-note'],
		['/Some Path/', 'Read me', 'some-path/read-me'],
	])('%s + %s → %s', (destination, basename, path) => {
		expect(notePagePath(destination, basename)).toBe(path);
	});
});

describe('toPageInput', () => {
	it('defaults the title to the file name', () => {
		expect(toPageInput({ basename: 'My note', body: '# Hi' }, 'notes')).toEqual({
			path: 'notes/my-note',
			title: 'My note',
			description: '',
			tags: [],
			content: '# Hi',
		});
	});

	it('reads the title, description and tags from the frontmatter', () => {
		const frontmatter = { title: ' Custom title ', description: 'About it', tags: ['a', '#b'] };
		expect(toPageInput({ basename: 'note', frontmatter, body: '' }, '')).toMatchObject({
			title: 'Custom title',
			description: 'About it',
			tags: ['a', 'b'],
		});
	});

	it('ignores unusable frontmatter values', () => {
		const frontmatter = { title: '  ', description: 42, tags: { not: 'a list' } };
		expect(toPageInput({ basename: 'note', frontmatter, body: '' }, '')).toMatchObject({
			title: 'note',
			description: '',
			tags: [],
		});
	});

	it('ignores frontmatter that is not a mapping', () => {
		expect(toPageInput({ basename: 'note', frontmatter: ['a'], body: '' }, '').title).toBe('note');
	});

	it('rejects a note whose name gives an empty path', () => {
		expect(() => toPageInput({ basename: '???', body: '' }, '')).toThrow(/wiki path/);
	});
});

describe('parseTags', () => {
	it.each([
		[['one', 'two'], ['one', 'two']],
		['one, two three', ['one', 'two', 'three']],
		[['#nested/tag', 'nested/tag', 2026], ['nested/tag', '2026']],
		[['', null, '#'], []],
		[undefined, []],
	])('%j → %j', (value, tags) => {
		expect(parseTags(value)).toEqual(tags);
	});
});
