import { Dialect } from './dialect';

/** Where a link points on the wiki, as resolved by the caller. */
export type LinkTarget = { kind: 'page'; path: string } | { kind: 'file'; url: string; image: boolean };

export interface InlineContext {
	dialect: Dialect;
	/** Wiki target of a vault link path (as written in the note), or undefined if it can't be linked to. */
	resolve(linkpath: string): LinkTarget | undefined;
}

const INLINE = new RegExp(
	[
		// [[target#sub|alias]] and ![[embed]]
		String.raw`(?<embed>!?)\[\[(?<wikilink>[^[\]\n]+)\]\]`,
		// [text](target "title"), ![alt](target), [text](<target with spaces>)
		String.raw`(?<image>!?)\[(?<text>[^[\]\n]*)\]\((?:<(?<angle>[^>\n]+)>|(?<url>[^()\s]+))(?<title>\s+"[^"\n]*")?\)`,
		// #tag: after a space or at the start of a line, and not only digits (no lookbehind: iOS < 16.4)
		String.raw`(?<before>^|\s)#(?<tag>[\p{L}\p{N}_/-]*[\p{L}_/-][\p{L}\p{N}_/-]*)`,
		String.raw`==(?<highlight>[^=\n](?:[^\n]*?[^=\n])?)==`,
		// Block id at the end of a line
		String.raw`[ \t]+\^(?<block>[\w-]+)$`,
	].join('|'),
	'gmu',
);

const SCHEME = /^[a-z][a-z\d+.-]*:/i;
const IMAGE_SIZE = /^(\d+)(?:x(\d+))?$/;

interface LinkParts {
	/** Vault link path, empty for the current note. */
	path: string;
	/** Heading (`Heading`, `Parent#Child`) or block (`^id`) after the `#`. */
	subpath?: string;
	alias?: string;
}

/** Converts Obsidian inline syntax in a text segment (no code in it). Inline tags are added to `tags`. */
export function convertInline(text: string, ctx: InlineContext, tags: Set<string>): string {
	return text.replace(INLINE, (match: string, ...args: unknown[]) => {
		const groups = args[args.length - 1] as Record<string, string | undefined>;
		if (groups.wikilink !== undefined) return convertWikilink(parseWikilink(groups.wikilink), groups.embed === '!', ctx);
		if (groups.text !== undefined) {
			return convertMarkdownLink(match, groups.image === '!', groups.text, groups.angle ?? groups.url!, ctx);
		}
		if (groups.tag !== undefined) {
			tags.add(groups.tag);
			return `${groups.before ?? ''}[#${groups.tag}](${ctx.dialect.tagUrl(groups.tag)})`;
		}
		if (groups.highlight !== undefined) return ctx.dialect.highlight(convertInline(groups.highlight, ctx, tags));
		// Block id
		return '';
	});
}

/** Vault link paths referenced by links and embeds in a text segment, for the caller to resolve. */
export function collectLinkpaths(text: string, into: Set<string>): void {
	for (const match of text.matchAll(INLINE)) {
		const groups = match.groups!;
		const parts =
			groups.wikilink !== undefined
				? parseWikilink(groups.wikilink)
				: groups.text !== undefined
					? parseUrl(groups.angle ?? groups.url!)
					: undefined;
		if (parts?.path) into.add(parts.path);
	}
}

function convertWikilink(link: LinkParts, embed: boolean, ctx: InlineContext): string {
	const target = link.path === '' ? undefined : ctx.resolve(link.path);
	if (embed && target?.kind === 'file' && target.image) {
		const size = link.alias === undefined ? null : IMAGE_SIZE.exec(link.alias);
		const alt = size ? baseName(link.path) : (link.alias ?? baseName(link.path));
		return image(alt, target.url, size);
	}
	const text = link.alias ?? displayName(link);
	if (link.path === '') return link.subpath ? `[${text}](${anchor(link.subpath, ctx)})` : text;
	if (!target) return text;
	return target.kind === 'page' ? `[${text}](/${target.path}${anchor(link.subpath, ctx)})` : `[${text}](${target.url})`;
}

function convertMarkdownLink(match: string, isImage: boolean, text: string, url: string, ctx: InlineContext): string {
	const link = parseUrl(url);
	if (!link) return match;
	if (link.path === '') return link.subpath ? `[${text}](${anchor(link.subpath, ctx)})` : match;

	const target = ctx.resolve(link.path);
	if (!target) return isImage ? match : text;
	if (isImage && target.kind === 'file') {
		// Obsidian takes a size after a pipe in the alt text: ![alt|300](image.png)
		const pipe = text.lastIndexOf('|');
		const size = pipe === -1 ? null : IMAGE_SIZE.exec(text.slice(pipe + 1));
		return image(size ? text.slice(0, pipe) : text, target.url, size);
	}
	return target.kind === 'page' ? `[${text}](/${target.path}${anchor(link.subpath, ctx)})` : `[${text}](${target.url})`;
}

function parseWikilink(raw: string): LinkParts {
	// In tables, the alias pipe is escaped: [[Note\|alias]]
	const pipe = raw.search(/\\?\|/);
	const target = pipe === -1 ? raw : raw.slice(0, pipe);
	const alias = pipe === -1 ? undefined : raw.slice(pipe).replace(/^\\?\|/, '');
	const hash = target.indexOf('#');
	return {
		path: (hash === -1 ? target : target.slice(0, hash)).trim(),
		subpath: hash === -1 ? undefined : target.slice(hash + 1).trim() || undefined,
		alias: alias?.trim() || undefined,
	};
}

/** Parts of a local Markdown link target, or undefined for URLs and absolute paths (left alone). */
function parseUrl(url: string): LinkParts | undefined {
	if (SCHEME.test(url) || url.startsWith('/')) return undefined;
	let decoded = url;
	try {
		decoded = decodeURIComponent(url);
	} catch {
		// Not percent-encoded: keep as is
	}
	const hash = decoded.indexOf('#');
	return {
		path: hash === -1 ? decoded : decoded.slice(0, hash),
		subpath: hash === -1 ? undefined : decoded.slice(hash + 1) || undefined,
	};
}

/** `#anchor` of a heading on the target page; block references link to the page itself. */
function anchor(subpath: string | undefined, ctx: InlineContext): string {
	if (!subpath || subpath.startsWith('^')) return '';
	// Obsidian chains headings (`Parent#Child`); the wiki only knows the last one
	return `#${ctx.dialect.headingId(headingText(subpath.split('#').pop()!))}`;
}

/** Text of a heading as the wiki renders it, which its id is computed from: inline Markdown removed. */
export function headingText(heading: string): string {
	return heading
		.replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
		.replace(/`([^`]*)`/g, '$1')
		.replace(/(\*\*|~~|==|\*|~|\^)(\S|\S.*?\S)\1/g, '$2')
		.replace(/(^|\W)(__?)(\S|\S.*?\S)\2(?=\W|$)/g, '$1$3');
}

/** What Obsidian shows for a link without alias: `Note`, `Note > Heading`, or `Heading` in the same note. */
function displayName(link: LinkParts): string {
	const heading = link.subpath && !link.subpath.startsWith('^') ? link.subpath.split('#').join(' > ') : undefined;
	if (link.path === '') return heading ?? '';
	return heading ? `${baseName(link.path)} > ${heading}` : baseName(link.path);
}

function baseName(path: string): string {
	return path.split('/').pop()!.replace(/\.md$/i, '');
}

function image(alt: string, url: string, size: RegExpExecArray | null): string {
	// `=WxH` sizes are understood by both versions (markdown-it-imsize)
	const suffix = size ? ` =${size[1]}x${size[2] ?? ''}` : '';
	return `![${alt}](${url}${suffix})`;
}
