import { describe, expect, it } from 'vitest';
import { convertMarkdown, LinkTarget, referencedLinkpaths } from '../../src/convert';
import { calloutKind, Dialect, v2Dialect, v3Dialect } from '../../src/convert/dialect';
import { brokenLink, headingText } from '../../src/convert/inline';

const targets: Record<string, LinkTarget> = {
	'Other note': { kind: 'page', path: 'notes/other-note' },
	'Folder/Deep note.md': { kind: 'page', path: 'notes/deep-note' },
	'image.png': { kind: 'file', url: '/_files/attachments/image.png', image: true },
	'my image.png': { kind: 'file', url: '/_files/attachments/my-image.png', image: true },
	'doc.pdf': { kind: 'file', url: '/_files/attachments/doc.pdf', image: false },
};

function convert(markdown: string, dialect: Dialect = v3Dialect) {
	return convertMarkdown(markdown, { dialect, resolve: (path) => targets[path] });
}

describe('wikilinks', () => {
	it.each([
		['[[Other note]]', '[Other note](/notes/other-note)'],
		['[[Other note|the other]]', '[the other](/notes/other-note)'],
		['[[Other note#My Heading]]', '[Other note > My Heading](/notes/other-note#my-heading)'],
		['[[Other note#Parent#Child|x]]', '[x](/notes/other-note#child)'],
		['[[Other note#^block-1]]', '[Other note](/notes/other-note)'],
		['[[#Local heading]]', '[Local heading](#local-heading)'],
		['[[Folder/Deep note.md]]', '[Deep note](/notes/deep-note)'],
		['[[Unpublished note]]', brokenLink('Unpublished note')],
		['[[Unpublished note|alias]]', brokenLink('alias')],
		['| [[Other note\\|cell]] |', '| [cell](/notes/other-note) |'],
		['[[doc.pdf]]', '[doc.pdf](/_files/attachments/doc.pdf)'],
	])('%s → %s', (input, output) => {
		expect(convert(input).content).toBe(output);
	});

	it('uses each version heading ids', () => {
		expect(convert('[[#2. Café_bar]]', v2Dialect).content).toBe('[2. Café_bar](#h-2-café_bar)');
		expect(convert('[[#2. Café_bar]]', v3Dialect).content).toBe('[2. Café_bar](#2-cafébar)');
	});
});

describe('embeds', () => {
	it.each([
		['![[image.png]]', '![image.png](/_files/attachments/image.png)'],
		['![[image.png|300]]', '![image.png](/_files/attachments/image.png =300x)'],
		['![[image.png|300x200]]', '![image.png](/_files/attachments/image.png =300x200)'],
		['![[image.png|A cat]]', '![A cat](/_files/attachments/image.png)'],
		['![[doc.pdf]]', '[doc.pdf](/_files/attachments/doc.pdf)'],
		['![[Other note]]', '[Other note](/notes/other-note)'],
		['![[missing.png]]', brokenLink('missing.png')],
	])('%s → %s', (input, output) => {
		expect(convert(input).content).toBe(output);
	});
});

describe('Markdown links', () => {
	it.each([
		['[see](Other%20note)', '[see](/notes/other-note)'],
		['[see](<Folder/Deep note.md#Some heading>)', '[see](/notes/deep-note#some-heading)'],
		['![cat](my%20image.png)', '![cat](/_files/attachments/my-image.png)'],
		['![cat|250](image.png)', '![cat](/_files/attachments/image.png =250x)'],
		['[top](#Local%20heading)', '[top](#local-heading)'],
		['[site](https://example.com/#frag)', '[site](https://example.com/#frag)'],
		['[abs](/some/page)', '[abs](/some/page)'],
		['[gone](Unpublished.md)', brokenLink('gone')],
		['![gone](missing.png)', brokenLink('gone')],
		['![](missing.png)', brokenLink('missing.png')],
	])('%s → %s', (input, output) => {
		expect(convert(input).content).toBe(output);
	});
});

describe('tags', () => {
	it('links inline tags to the tag search and collects them', () => {
		const result = convert('#start then #nested/tag-1, and #a #b', v2Dialect);
		expect(result.content).toBe(
			'[#start](/t/start?sort=title) then [#nested/tag-1](/t/nested/tag-1?sort=title), and [#a](/t/a?sort=title) [#b](/t/b?sort=title)',
		);
		expect(result.tags).toEqual(['start', 'nested/tag-1', 'a', 'b']);
	});

	it('uses the v3 tag search', () => {
		expect(convert('A #tag').content).toBe('A [#tag](/_tags?t=tag)');
	});

	it.each(['# Heading', 'issue#12', 'only #2026', 'a [link](#anchor)', 'https://x.org/#frag', '\\#escaped'])(
		'leaves %s alone',
		(input) => {
			const result = convert(input);
			expect(result.tags).toEqual([]);
			expect(result.content).not.toContain('_tags');
		},
	);
});

describe('highlights, comments and block ids', () => {
	it('highlights per version', () => {
		expect(convert('A ==big [[Other note]]== deal', v2Dialect).content).toBe(
			'A <mark>big [Other note](/notes/other-note)</mark> deal',
		);
		expect(convert('A ==big== deal').content).toBe('A ==big== deal');
	});

	it('removes comments, inline or over several lines', () => {
		expect(convert('Keep %%hidden%% this').content).toBe('Keep  this');
		expect(convert('Before\n%%\nhidden [[Other note]]\n%%\nAfter').content).toBe('Before\n\nAfter');
	});

	it('removes block ids', () => {
		expect(convert('A paragraph ^abc-123\nNext').content).toBe('A paragraph\nNext');
	});
});

describe('code', () => {
	it('leaves fenced and inline code alone', () => {
		const input = [
			'Run `[[Other note]] #tag ==x==` here',
			'```md',
			'[[Other note]] #tag %%not a comment%%',
			'> [!note]',
			'```',
			'``a ` b`` and [[Other note]]',
		].join('\n');
		expect(convert(input).content).toBe(
			[
				'Run `[[Other note]] #tag ==x==` here',
				'```md',
				'[[Other note]] #tag %%not a comment%%',
				'> [!note]',
				'```',
				'``a ` b`` and [Other note](/notes/other-note)',
			].join('\n'),
		);
	});
});

describe('callouts', () => {
	it('maps Obsidian types', () => {
		expect(['note', 'TIP', 'done', 'important', 'faq', 'bug', 'custom'].map(calloutKind)).toEqual([
			'info',
			'success',
			'success',
			'important',
			'warning',
			'danger',
			'info',
		]);
	});

	it('writes v3 alerts, keeping titles', () => {
		const input = '> [!note]\n> Body\n\n> [!bug]- Broken *thing*\n> Details\n>\n> More';
		expect(convert(input).content).toBe(
			'> [!NOTE]\n> Body\n\n> [!CAUTION] Broken *thing*\n> Details\n>\n> More',
		);
	});

	it('writes v2 class blocks', () => {
		const input = '> [!warning] Careful\n> Body with [[Other note]]\n> ```js\n> x = 1\n> ```\nAfter';
		expect(convert(input, v2Dialect).content).toBe(
			[
				'<blockquote class="is-warning">',
				'',
				'**Careful**',
				'',
				'Body with [Other note](/notes/other-note)',
				'```js',
				'x = 1',
				'```',
				'',
				'</blockquote>',
				'',
				'After',
			].join('\n'),
		);
	});

	it('handles nested callouts and plain quotes', () => {
		const input = '> Plain quote\n> > [!tip]\n> > Inner';
		expect(convert(input).content).toBe('> Plain quote\n> > [!TIP]\n> > Inner');
		expect(convert(input, v2Dialect).content).toBe(
			'> Plain quote\n> <blockquote class="is-success">\n>\n> **Tip**\n>\n> Inner\n>\n> </blockquote>',
		);
	});

	it('leaves callout syntax inside code alone', () => {
		expect(convert('```\n> [!note]\n```').content).toBe('```\n> [!note]\n```');
	});
});

describe('referencedLinkpaths', () => {
	it('lists link and embed targets outside code', () => {
		const input = '[[Other note#H]] ![[image.png|300]] [x](my%20image.png) [[#Local]] `[[In code]]` [w](https://x.org)';
		expect(referencedLinkpaths(input)).toEqual(['Other note', 'image.png', 'my image.png']);
	});
});

describe('heading ids', () => {
	it.each([
		['Heading with Spaces & Ünïcode!', 'heading-with-spaces-ünïcode', 'heading-with-spaces-ünïcode'],
		['snake_case and ~tilde~', 'snake_case-and-~tilde~', 'snakecase-and-tilde'],
		['  Trim -- me  ', 'trim-me', 'trim-me'],
		['42 is the answer', 'h-42-is-the-answer', '42-is-the-answer'],
		['!!!', '', 'section'],
	])('%s', (heading, v2, v3) => {
		expect(v2Dialect.headingId(heading)).toBe(v2);
		expect(v3Dialect.headingId(heading)).toBe(v3);
	});
});

describe('headingText', () => {
	it.each([
		['snake_case and ~sub~ ^sup^', 'snake_case and sub sup'],
		['*em* **strong** _em_ __strong__ ==mark== ~~del~~', 'em strong em strong mark del'],
		['`code` and [link](https://x.org) and ![img](a.png)', 'code and link and img'],
		['2 * 3 * 4', '2 * 3 * 4'],
	])('%s → %s', (heading, text) => {
		expect(headingText(heading)).toBe(text);
	});

	it('is used for heading links', () => {
		expect(convert('[[Other note#Use `npm` *now*]]').content).toBe('[Other note > Use `npm` *now*](/notes/other-note#use-npm-now)');
	});
});

describe('math', () => {
	const display = ['Before', '', '$$', 'x = \\frac{1}{2}', '$$', '', 'After'].join('\n');

	it('is left as is on v2', () => {
		const input = `Inline $e^{i\\pi}$ and #tag\n\n${display}`;
		expect(convert(input, v2Dialect).content).toBe(input.replace('#tag', '[#tag](/t/tag?sort=title)'));
	});

	it('uses the v3 syntax', () => {
		expect(convert('Inline $e^{i\\pi} = -1$ math').content).toBe('Inline $`e^{i\\pi} = -1`$ math');
		expect(convert('Ticks $a`b$').content).toBe('Ticks $``a`b``$');
		expect(convert(display).content).toBe(
			['Before', '', '::block-katex', '```latex', 'x = \\frac{1}{2}', '```', '::', '', 'After'].join('\n'),
		);
		expect(convert('$$x^2$$').content).toBe('::block-katex\n```latex\nx^2\n```\n::');
	});

	it('keeps display math inside a paragraph inline on v3', () => {
		expect(convert('Text $$x^2$$ text').content).toBe('Text $`x^2`$ text');
	});

	it('repeats quote markers on v3 display math in a callout', () => {
		expect(convert('> [!note]\n> $$\n> x^2\n> $$').content).toBe(
			'> [!NOTE]\n> ::block-katex\n> ```latex\n> x^2\n> ```\n> ::',
		);
	});

	it('protects math from the other rules', () => {
		expect(convert('$a == b \\# c$ and ==mark==', v2Dialect).content).toBe('$a == b \\# c$ and <mark>mark</mark>');
	});

	it.each(['costs $5 and $10', 'a $ b $ c', 'escaped \\$x$', 'unclosed $$ display'])('leaves %s alone', (input) => {
		expect(convert(input).content).toBe(input);
	});
});

describe('Mermaid diagrams', () => {
	const diagram = ['```mermaid', 'graph TD', 'A --> B', '```'];

	it('are wrapped in a diagram block on v3', () => {
		expect(convert(['Before', ...diagram, 'After'].join('\n')).content).toBe(
			['Before', '::block-diagram', ...diagram, '::', 'After'].join('\n'),
		);
	});

	it('keep the quote prefix in a callout', () => {
		expect(convert(['> [!note]', ...diagram.map((l) => `> ${l}`)].join('\n')).content).toBe(
			['> [!NOTE]', '> ::block-diagram', ...diagram.map((l) => `> ${l}`), '> ::'].join('\n'),
		);
	});

	it('are left as is on v2, and other code blocks everywhere', () => {
		expect(convert(diagram.join('\n'), v2Dialect).content).toBe(diagram.join('\n'));
		const code = '````md\n```mermaid\nnot a diagram\n```\n````';
		expect(convert(code).content).toBe(code);
	});
});
