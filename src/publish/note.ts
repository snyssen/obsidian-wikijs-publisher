// No Obsidian import: the vault-facing side (reading the file, parsing the YAML) lives in the commands
import { toWikiPath } from '../wiki/paths';
import { PageInput } from '../wiki/types';

export interface Note {
	/** File name without the `.md` extension. */
	basename: string;
	/** Parsed frontmatter, if the note has any. */
	frontmatter?: unknown;
	/** Markdown content, without the frontmatter block. */
	body: string;
	/** Tags found in the body, added to the frontmatter ones. */
	inlineTags?: string[];
}

/** Wiki path of a single note pushed to `destination`: `Some/Path` + `My note.md` → `some/path/my-note`. */
export function notePagePath(destination: string, basename: string): string {
	return toWikiPath(`${destination}/${basename}`);
}

export function toPageInput(note: Note, destination: string): PageInput {
	const path = notePagePath(destination, note.basename);
	if (path === '') {
		throw new Error(`"${note.basename}" has no letters or digits to build a wiki path from`);
	}
	const frontmatter = isRecord(note.frontmatter) ? note.frontmatter : {};
	return {
		path,
		title: nonEmptyString(frontmatter.title) ?? note.basename,
		description: nonEmptyString(frontmatter.description) ?? '',
		tags: [...new Set([...parseTags(frontmatter.tags), ...(note.inlineTags ?? [])])],
		content: note.body,
	};
}

/**
 * Tags from the frontmatter `tags` property, as Obsidian accepts them: a list, or a string separated by
 * commas or spaces. Leading `#` are dropped and duplicates removed.
 */
export function parseTags(value: unknown): string[] {
	const raw = Array.isArray(value) ? value : typeof value === 'string' ? value.split(/[,\s]+/) : [];
	const tags = raw
		.filter((tag): tag is string | number => typeof tag === 'string' || typeof tag === 'number')
		.map((tag) => String(tag).trim().replace(/^#+/, ''))
		.filter((tag) => tag !== '');
	return [...new Set(tags)];
}

function nonEmptyString(value: unknown): string | undefined {
	return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}
