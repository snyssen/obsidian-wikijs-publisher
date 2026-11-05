export interface MathSegment {
	kind: 'math';
	/** Source, delimiters included. */
	text: string;
	/** TeX between the delimiters. */
	tex: string;
	/** `$$…$$` rather than `$…$`. */
	display: boolean;
	/** Display math on lines of its own, rather than inside a paragraph. */
	standalone: boolean;
	/** Quote markers or indentation before the opening `$$`, repeated on its other lines. */
	prefix: string;
}

export type Segment =
	/** Text to convert, or code (fenced block or inline span) to leave untouched. */
	{ kind: 'text' | 'code'; text: string } | MathSegment;

const FENCE = /^[\s>]*(`{3,}|~{3,})/;
const PREFIX = /^[\s>]*$/;

/** Display math opened on a previous line. */
interface OpenMath {
	text: string;
	tex: string[];
	prefix: string;
	standalone: boolean;
}

/**
 * Splits Markdown into text, code and math segments, dropping `%%comments%%` (inline or over several lines).
 * Joining the segments' text gives back the Markdown without its comments.
 */
export function splitSegments(markdown: string): Segment[] {
	const segments: Segment[] = [];
	const push = (kind: 'text' | 'code', text: string) => {
		if (text === '') return;
		const last = segments[segments.length - 1];
		if (last?.kind === kind) last.text += text;
		else segments.push({ kind, text });
	};

	let fence: string | undefined;
	let inComment = false;
	let math: OpenMath | undefined;
	// Lines keep their line break, so nothing is lost when joining
	for (const line of markdown.match(/[^\n]*\n|[^\n]+$/g) ?? []) {
		if (fence !== undefined) {
			push('code', line);
			if (closesFence(line, fence)) fence = undefined;
			continue;
		}
		const open = inComment || math ? null : FENCE.exec(line);
		if (open) {
			fence = open[1];
			push('code', line);
			continue;
		}

		let text = '';
		let i = 0;
		if (math) {
			const end = line.indexOf('$$');
			const content = line.startsWith(math.prefix) ? line.slice(math.prefix.length) : line;
			if (end === -1) {
				math.text += line;
				math.tex.push(content.replace(/\n$/, ''));
				continue;
			}
			const last = content.slice(0, end - (line.length - content.length));
			if (last.trim() !== '') math.tex.push(last);
			segments.push({
				kind: 'math',
				text: math.text + line.slice(0, end + 2),
				tex: math.tex.join('\n').replace(/^\s*\n|\n\s*$/g, ''),
				display: true,
				standalone: math.standalone && line.slice(end + 2).trim() === '',
				prefix: math.prefix,
			});
			math = undefined;
			i = end + 2;
		}

		while (i < line.length) {
			if (inComment) {
				const end = line.indexOf('%%', i);
				if (end === -1) break;
				inComment = false;
				i = end + 2;
			} else if (line.startsWith('%%', i)) {
				inComment = true;
				i += 2;
			} else if (line.startsWith('[[', i) && line.indexOf(']]', i + 2) !== -1) {
				// A wikilink is kept whole: it can hold backticks, e.g. a link to a heading with code in it
				const end = line.indexOf(']]', i + 2) + 2;
				text += line.slice(i, end);
				i = end;
			} else if (line[i] === '`') {
				const run = /^`+/.exec(line.slice(i))![0];
				const end = findRun(line, run, i + run.length);
				if (end === -1) {
					text += run;
					i += run.length;
				} else {
					push('text', text);
					text = '';
					push('code', line.slice(i, end + run.length));
					i = end + run.length;
				}
			} else if (line.startsWith('$$', i) && line[i - 1] !== '\\') {
				push('text', text);
				text = '';
				const before = line.slice(0, i);
				const end = line.indexOf('$$', i + 2);
				if (end === -1) {
					// Runs over the next lines
					const prefix = PREFIX.test(before) ? before : '';
					math = { text: line.slice(i), tex: [line.slice(i + 2).replace(/\n$/, '')], prefix, standalone: prefix === before };
					break;
				}
				segments.push({
					kind: 'math',
					text: line.slice(i, end + 2),
					tex: line.slice(i + 2, end).trim(),
					display: true,
					standalone: PREFIX.test(before) && line.slice(end + 2).trim() === '',
					prefix: PREFIX.test(before) ? before : '',
				});
				i = end + 2;
			} else if (line[i] === '$' && line[i - 1] !== '\\' && isInlineMathStart(line, i)) {
				const end = findInlineMathEnd(line, i);
				if (end === -1) {
					text += '$';
					i++;
				} else {
					push('text', text);
					text = '';
					segments.push({ kind: 'math', text: line.slice(i, end + 1), tex: line.slice(i + 1, end), display: false, standalone: false, prefix: '' });
					i = end + 1;
				}
			} else {
				text += line[i];
				i++;
			}
		}
		push('text', text);
	}
	// Unclosed display math is not math: keep it as text
	if (math) push('text', math.text);
	return segments;
}

/** Obsidian's inline math: `$` followed by a non-space. */
function isInlineMathStart(line: string, i: number): boolean {
	const next = line[i + 1];
	return next !== undefined && !/[\s$]/.test(next);
}

/** Closing `$` of inline math on the same line: after a non-space, and not followed by a digit (`$5 and $10`). */
function findInlineMathEnd(line: string, start: number): number {
	for (let i = line.indexOf('$', start + 2); i !== -1; i = line.indexOf('$', i + 1)) {
		const before = line[i - 1]!;
		if (/\s/.test(before) || before === '\\') continue;
		if (/\d/.test(line[i + 1] ?? '')) continue;
		return i;
	}
	return -1;
}

/** Index of the next backtick run exactly as long as `run`, or -1. */
function findRun(line: string, run: string, from: number): number {
	for (let i = line.indexOf(run, from); i !== -1; i = line.indexOf(run, i + 1)) {
		const before = line[i - 1];
		const after = line[i + run.length];
		if (before !== '`' && after !== '`') return i;
	}
	return -1;
}

function closesFence(line: string, fence: string): boolean {
	const match = FENCE.exec(line);
	return match !== null && match[1]![0] === fence[0] && match[1]!.length >= fence.length && line.slice(match[0].length).trim() === '';
}
