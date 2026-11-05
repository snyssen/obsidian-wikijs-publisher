import { Dialect } from './dialect';

const MERMAID_FENCE = /^([\s>]*)(`{3,}|~{3,})\s*mermaid\s*$/;
const FENCE = /^[\s>]*(`{3,}|~{3,})(.*)$/;

/** Wraps Mermaid code blocks for wikis that only draw them inside a block (v3's `::block-diagram`). */
export function wrapDiagrams(lines: string[], dialect: Dialect): string[] {
	const wrapper = dialect.diagramWrapper;
	if (!wrapper) return lines;

	const out: string[] = [];
	// Fence being skipped, and the prefix to close it with if it is a diagram
	let fence: { marker: string; diagramPrefix?: string } | undefined;
	for (const line of lines) {
		if (fence) {
			out.push(line);
			const close = FENCE.exec(line);
			if (close && close[1]![0] === fence.marker[0] && close[1]!.length >= fence.marker.length && close[2]!.trim() === '') {
				if (fence.diagramPrefix !== undefined) out.push(`${fence.diagramPrefix}${wrapper.after}`);
				fence = undefined;
			}
			continue;
		}
		const diagram = MERMAID_FENCE.exec(line);
		if (diagram) {
			out.push(`${diagram[1]}${wrapper.before}`, line);
			fence = { marker: diagram[2]!, diagramPrefix: diagram[1] };
			continue;
		}
		const open = FENCE.exec(line);
		if (open) fence = { marker: open[1]! };
		out.push(line);
	}
	return out;
}
