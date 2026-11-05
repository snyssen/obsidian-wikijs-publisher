import { calloutKind, Dialect } from './dialect';

const QUOTE_PREFIX = /^ {0,3}> ?/;
const CALLOUT_HEADER = /^\[!([^\]\s]+)\][+-]?(?:\s+(.*))?$/;
const FENCE = /^\s*(`{3,}|~{3,})/;

/**
 * Rewrites Obsidian callouts (`> [!type] Title`) for the wiki, at any quote depth. Other quotes are kept;
 * fenced code blocks are left alone.
 */
export function convertCallouts(lines: string[], dialect: Dialect): string[] {
	const out: string[] = [];
	let fence: string | undefined;
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i]!;
		if (fence !== undefined) {
			out.push(line);
			if (isFenceClose(line, fence)) fence = undefined;
			continue;
		}
		const open = FENCE.exec(line);
		if (open) {
			fence = open[1];
			out.push(line);
			continue;
		}
		if (!QUOTE_PREFIX.test(line)) {
			out.push(line);
			continue;
		}

		// A quote runs over the following lines that start with `>`
		const inner: string[] = [];
		for (; i < lines.length && QUOTE_PREFIX.test(lines[i]!); i++) inner.push(lines[i]!.replace(QUOTE_PREFIX, ''));
		i--;

		const header = CALLOUT_HEADER.exec(inner[0]!.trim());
		if (!header) {
			out.push(...convertCallouts(inner, dialect).map((l) => (l === '' ? '>' : `> ${l}`)));
			continue;
		}
		const type = header[1]!;
		const title = header[2];
		const body = convertCallouts(inner.slice(1), dialect);
		out.push(...dialect.callout({ kind: calloutKind(type), title: title?.trim() || capitalize(type) }, body));
		// Keep a following line from being swallowed by the callout (e.g. into v2's HTML block)
		if (i + 1 < lines.length && lines[i + 1]!.trim() !== '') out.push('');
	}
	return out;
}

function isFenceClose(line: string, fence: string): boolean {
	const match = FENCE.exec(line);
	return match !== null && match[1]![0] === fence[0] && match[1]!.length >= fence.length && line.trim() === match[1];
}

function capitalize(value: string): string {
	return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}
