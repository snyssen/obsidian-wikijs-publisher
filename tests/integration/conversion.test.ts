// Checks that converted Markdown renders as intended on the throwaway instances started by `just wiki-up`.
import { readFileSync } from 'node:fs';
import { afterAll, describe, expect, it } from 'vitest';
import { convertMarkdown, dialectFor } from '../../src/convert';
import { headingText } from '../../src/convert/inline';
import { createClient } from '../../src/wiki/factory';
import { WikiVersion } from '../../src/wiki/types';
import { deleteV3RootFolder } from '../helpers/cleanup';
import { fetchHttp } from '../helpers/fetch-http';
import { renderedHtml } from '../helpers/render';

const instances: { version: WikiVersion; url: string }[] = [
	{ version: 'v2', url: process.env.WIKI_V2_URL ?? 'http://localhost:3080' },
	{ version: 'v3', url: process.env.WIKI_V3_URL ?? 'http://localhost:3081' },
];

const headings = [
	'Simple heading',
	'With Spaces & Ünïcode!',
	'snake_case and ~sub~ *em* **strong** `code` [link](https://x.org)',
	'42 starts with a digit',
	'Trim -- me',
];

const markdown = [
	...headings.map((heading) => `## ${heading}\n`),
	'Some ==highlighted [[#Simple heading|link]]== text with #inline-tag and a [[Missing note]].',
	'',
	'> [!warning] Careful',
	'> Watch out.',
	'> ```js',
	'> const x = 1;',
	'> ```',
	'',
	'> [!tip]',
	'> > [!bug] Nested',
	'> > Inner',
	'',
	'> [!question]',
	'> Ends with a list',
	'> - item',
	'Lazy line after the callout',
	'',
	'Inline math $e^{i\\pi} + 1 = 0$ here.',
	'',
	'$$',
	'\\int_0^1 x\\,dx',
	'$$',
	'',
	'```mermaid',
	'graph TD',
	'  A --> B',
	'```',
].join('\n');

describe.each(instances)('Converted Markdown on Wiki.js $version', ({ version, url }) => {
	const token = readFileSync(new URL(`../../dev/wikijs/.api-key-${version}`, import.meta.url), 'utf8').trim();
	const dialect = dialectFor(version);
	const path = `integration-tests/conversion-${Date.now().toString(36)}`;

	afterAll(async () => {
		if (version === 'v3') await deleteV3RootFolder(url, token, 'integration-tests');
	});

	it('renders as intended', async () => {
		const client = await createClient(fetchHttp, { url, token, version: 'auto', locale: '' });
		const { content } = convertMarkdown(markdown, { dialect, resolve: () => undefined });
		const page = await client.upsertPage({ path, title: 'Conversion', content });
		const html = await renderedHtml(version, url, token, page.id, 'Lazy line');

		try {
			// Heading ids are computed like the wiki does, for links to headings
			for (const heading of headings) {
				expect(html).toContain(`id="${dialect.headingId(headingText(heading))}"`);
			}
			expect(html).toContain(`href="#${dialect.headingId('Simple heading')}"`);
			expect(html).toMatch(/<mark>highlighted <a[^>]*>link<\/a><\/mark>/);
			expect(html).toContain(`href="${dialect.tagUrl('inline-tag')}"`.replace('&', '&amp;'));
			expect(html).toMatch(/Missing note<sup title="[^"]+">⛓️‍💥 broken link<\/sup>/);

			// Callouts: styled, titled, code and nesting kept, nothing leaking as text
			expect(html).toMatch(/<blockquote class="is-warning">[\s\S]*Careful[\s\S]*<code class="language-js">/);
			expect(html).toMatch(/<blockquote class="is-success">[\s\S]*<blockquote class="is-danger">[\s\S]*Nested/);
			expect(html).toMatch(/<blockquote class="is-warning">[\s\S]*Question[\s\S]*<li>item<\/li>/);
			expect(html).not.toContain('[!');
			expect(html).not.toContain('{.is-');

			// Math: rendered by KaTeX on v2; on v3, as the elements its editor produces (drawn in the browser)
			if (version === 'v2') {
				expect(html.match(/class="katex"/g)).toHaveLength(2);
			} else {
				expect(html).toContain('<block-katex inline="true">e^{i\\pi} + 1 = 0</block-katex>');
				expect(html).toMatch(/<block-katex>\s*<pre[^>]*><code class="language-latex">/);
			}

			// Mermaid: drawn in the browser, from these elements
			expect(html).toMatch(version === 'v2' ? /<div class="mermaid">graph TD/ : /<block-diagram>\s*<pre class="codeblock-mermaid">/);
		} finally {
			await client.deletePage(page.id);
		}
	});
});
