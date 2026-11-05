import { WikiVersion } from '../wiki/types';
import { MathSegment } from './segments';

/** The callout colours both wikis can show. */
export type CalloutKind = 'info' | 'success' | 'important' | 'warning' | 'danger';

export interface Callout {
	kind: CalloutKind;
	/** Title shown by Obsidian: the custom one, or the type name. */
	title: string;
}

/** What differs between Wiki.js versions when writing Markdown for them. */
export interface Dialect {
	readonly version: WikiVersion;
	/** Id the wiki gives a heading with this text, for `#anchor` links. */
	headingId(heading: string): string;
	/** Root-relative URL of the wiki's search for a tag. */
	tagUrl(tag: string): string;
	highlight(markdown: string): string;
	/** Lines of a callout holding `body` (already converted, without the quote prefix). */
	callout(callout: Callout, body: string[]): string[];
	/** Math written as Obsidian does (`$…$`, `$$…$$`). */
	math(math: MathSegment): string;
	/** Lines to put around a Mermaid code block, if the wiki needs any to draw it. */
	readonly diagramWrapper?: { before: string; after: string };
}

// Obsidian's callout types and aliases (https://help.obsidian.md/callouts); anything else is info
const CALLOUT_KINDS: Record<string, CalloutKind> = {
	tip: 'success',
	hint: 'success',
	success: 'success',
	check: 'success',
	done: 'success',
	important: 'important',
	warning: 'warning',
	caution: 'warning',
	attention: 'warning',
	question: 'warning',
	help: 'warning',
	faq: 'warning',
	failure: 'danger',
	fail: 'danger',
	missing: 'danger',
	danger: 'danger',
	error: 'danger',
	bug: 'danger',
};

export function calloutKind(type: string): CalloutKind {
	return CALLOUT_KINDS[type.toLowerCase()] ?? 'info';
}

const V3_ALERTS: Record<CalloutKind, { type: string; label: string }> = {
	info: { type: 'NOTE', label: 'Note' },
	success: { type: 'TIP', label: 'Tip' },
	important: { type: 'IMPORTANT', label: 'Important' },
	warning: { type: 'WARNING', label: 'Warning' },
	danger: { type: 'CAUTION', label: 'Caution' },
};

const V2_CLASSES: Record<CalloutKind, string> = {
	info: 'is-info',
	success: 'is-success',
	// v2 has no "important" style
	important: 'is-info',
	warning: 'is-warning',
	danger: 'is-danger',
};

/** Wiki.js 3: GitHub alerts, which take a title. */
export const v3Dialect: Dialect = {
	version: 'v3',
	// Port of `slugifyHeading` (backend/models/rendering.ts)
	headingId: (heading) =>
		heading
			.toLowerCase()
			.trim()
			.replace(/[^\p{L}\p{N}\s-]/gu, '')
			.replace(/\s+/g, '-')
			.replace(/-{2,}/g, '-')
			.replace(/^-+|-+$/g, '')
			.slice(0, 100) || 'section',
	tagUrl: (tag) => `/_tags?t=${encodeURIComponent(tag)}`,
	highlight: (markdown) => `==${markdown}==`,
	callout: ({ kind, title }, body) => {
		const alert = V3_ALERTS[kind];
		// The alert shows its own label when no title is given
		const header = title === alert.label ? `[!${alert.type}]` : `[!${alert.type}] ${title}`;
		return [header, ...body].map(quoteLine);
	},
	// `$`…`$` inline, and a KaTeX block around a `latex` fence for display math (see the v3 sample content).
	// Rendered with KaTeX or MathJax depending on the site's Markdown settings.
	diagramWrapper: { before: '::block-diagram', after: '::' },
	math: ({ tex, standalone, prefix }) => {
		if (!standalone) {
			const ticks = '`'.repeat(longestBacktickRun(tex) + 1);
			const pad = tex.startsWith('`') || tex.endsWith('`') ? ' ' : '';
			return `$${ticks}${pad}${tex.replace(/\s*\n\s*/g, ' ')}${pad}${ticks}$`;
		}
		const fence = '`'.repeat(Math.max(3, longestBacktickRun(tex) + 1));
		// The prefix before the opening `$$` is already written: only the following lines need it
		return ['::block-katex', `${fence}latex`, ...tex.split('\n'), fence, '::'].join(`\n${prefix}`);
	},
};

/** Wiki.js 2: no alerts, blockquotes take a class instead. */
export const v2Dialect: Dialect = {
	version: 'v2',
	// Port of `uslug` (used by server/modules/rendering/html-core/renderer.js), plus the renderer's `h-` prefix
	headingId: (heading) => {
		const slug = heading
			.normalize('NFKC')
			.replace(/\p{Z}/gu, ' ')
			.replace(/[^\p{L}\p{N}\p{M}\-_~ ]/gu, '')
			.trim()
			.replace(/[\s-]+/g, '-')
			.toLowerCase();
		return /^\d/.test(slug) ? `h-${slug}` : slug;
	},
	// Slashes stay as is: the tag page splits its path into tags and finds `nested/tag` from its parts
	tagUrl: (tag) => `/t/${tag.split('/').map(encodeURIComponent).join('/')}?sort=title`,
	highlight: (markdown) => `<mark>${markdown}</mark>`,
	// HTML wrapper: a `{.is-x}` line after the quote is lost when the quote ends with code or a nested quote.
	// The Markdown inside is still parsed thanks to the blank lines around it.
	callout: ({ kind, title }, body) => [
		`<blockquote class="${V2_CLASSES[kind]}">`,
		'',
		`**${title}**`,
		'',
		...body,
		'',
		'</blockquote>',
	],
	// v2 renders Obsidian's syntax as is
	math: ({ text }) => text,
};

export function dialectFor(version: WikiVersion): Dialect {
	return version === 'v2' ? v2Dialect : v3Dialect;
}

function longestBacktickRun(text: string): number {
	return Math.max(0, ...(text.match(/`+/g) ?? []).map((run) => run.length));
}

function quoteLine(line: string): string {
	return line === '' ? '>' : `> ${line}`;
}
