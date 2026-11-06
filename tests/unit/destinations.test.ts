import { describe, expect, it } from 'vitest';
import { folderDestination, formatDestination, movedDestination, parseDestination } from '../../src/publish/destinations';

describe('parseDestination', () => {
	it.each([false, 'false', ' FALSE '])('%j excludes the note', (value) => {
		expect(parseDestination(value)).toEqual({ kind: 'excluded' });
	});

	it.each([true, null, '', '  ', 1])('%j uses the default destination', (value) => {
		expect(parseDestination(value)).toEqual({ kind: 'default' });
	});

	it('warns about a value without a leading slash', () => {
		expect(parseDestination('some/path')).toMatchObject({ kind: 'default', warning: expect.stringContaining('/') as unknown });
	});

	it.each([
		['/', ''],
		['/my-campaign/partie-0', 'my-campaign/partie-0'],
		['/my-campaign/', 'my-campaign'],
	])('%s is an explicit destination', (value, destination) => {
		expect(parseDestination(value)).toEqual({ kind: 'explicit', destination });
	});

	it('slugifies hand-written values, with a warning', () => {
		expect(parseDestination('/My Campaign/Partie 0')).toEqual({
			kind: 'explicit',
			destination: 'my-campaign/partie-0',
			warning: '"/My Campaign/Partie 0" is not a valid wiki path, /my-campaign/partie-0 was used',
		});
	});

	it('leaves an absent property unmarked', () => {
		expect(parseDestination(undefined)).toBeUndefined();
	});
});

describe('formatDestination', () => {
	it.each([
		['', '/'],
		['My Campaign', '/my-campaign'],
		['/a//b/', '/a/b'],
	])('%s → %s', (destination, value) => {
		expect(formatDestination(destination)).toBe(value);
	});
});

describe('folderDestination', () => {
	it.each([
		['Events/Events.md', '/my-ttrpg-campaign'],
		['Events/Partie 0/0 - Rencontre des joueurs.md', '/my-ttrpg-campaign/partie-0'],
		['Events/Partie 0/Other events/x.md', '/my-ttrpg-campaign/partie-0/other-events'],
	])('%s → %s', (notePath, value) => {
		expect(folderDestination('Events', notePath, '/my-ttrpg-campaign')).toBe(value);
	});

	it('handles the vault root and an empty destination', () => {
		expect(folderDestination('/', 'Guides/Getting started.md', '')).toBe('/guides');
		expect(folderDestination('Events', 'Events/Events.md', '')).toBe('/');
	});
});

describe('movedDestination', () => {
	it.each([
		// Moved to a sibling folder
		['/campaign/partie-0', 'Events/Partie 0', 'Events/Partie 1', '/campaign/partie-1'],
		// Moved deeper, and back up
		['/campaign', 'Events', 'Events/Partie 0', '/campaign/partie-0'],
		['/campaign/partie-0/other-events', 'Events/Partie 0/Other events', 'Events', '/campaign'],
		// Destination set on the vault root folder: every folder is part of it
		['/wiki/events/partie-0', 'Events/Partie 0', 'Characters', '/wiki/characters'],
	])('%s: %s → %s gives %s', (value, oldParent, newParent, expected) => {
		expect(movedDestination(value, oldParent, newParent)).toBe(expected);
	});

	it.each([
		// Moved out of the folder the destination was set on
		['/campaign/partie-0', 'Events/Partie 0', 'Characters'],
		// A value that doesn't follow the folders
		['/somewhere/else', 'Events/Partie 0', 'Events/Partie 1'],
	])('leaves %s alone when moved from %s to %s', (value, oldParent, newParent) => {
		expect(movedDestination(value, oldParent, newParent)).toBeUndefined();
	});
});
