// Obsidian Markdown → Wiki.js Markdown. No Obsidian import: link targets are resolved by the caller.
import { convertCallouts } from './callouts';
import { wrapDiagrams } from './diagrams';
import { Dialect } from './dialect';
import { collectLinkpaths, convertInline, LinkTarget } from './inline';
import { splitSegments } from './segments';

export { dialectFor } from './dialect';
export type { Dialect } from './dialect';
export type { LinkTarget } from './inline';

export interface ConvertContext {
	dialect: Dialect;
	/** Wiki target of a vault link path (as written in the note), or undefined if it can't be linked to. */
	resolve(linkpath: string): LinkTarget | undefined;
}

export interface Converted {
	content: string;
	/** Inline tags found in the body, without `#`. */
	tags: string[];
}

export function convertMarkdown(markdown: string, ctx: ConvertContext): Converted {
	const withCallouts = wrapDiagrams(convertCallouts(markdown.split('\n'), ctx.dialect), ctx.dialect).join('\n');
	const tags = new Set<string>();
	const content = splitSegments(withCallouts)
		.map((segment) => {
			if (segment.kind === 'math') return ctx.dialect.math(segment);
			return segment.kind === 'code' ? segment.text : convertInline(segment.text, ctx, tags);
		})
		.join('');
	return { content, tags: [...tags] };
}

/** Link paths the note refers to (links, embeds), to resolve before calling `convertMarkdown`. */
export function referencedLinkpaths(markdown: string): string[] {
	const paths = new Set<string>();
	for (const segment of splitSegments(markdown)) {
		if (segment.kind === 'text') collectLinkpaths(segment.text, paths);
	}
	return [...paths];
}
