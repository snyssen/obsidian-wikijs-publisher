import { WikiVersion } from '../../src/wiki/types';

/**
 * The HTML a wiki rendered for a page. v3 renders in a background job, so this waits until the
 * render holds `expected` (some text of the latest content).
 */
export async function renderedHtml(
	version: WikiVersion,
	url: string,
	token: string,
	pageId: string,
	expected: string,
): Promise<string> {
	const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
	if (version === 'v2') {
		const response = await fetch(`${url}/graphql`, {
			method: 'POST',
			headers,
			body: JSON.stringify({ query: `{ pages { single(id: ${Number(pageId)}) { render } } }` }),
		});
		const result = (await response.json()) as { data: { pages: { single: { render: string } } } };
		return result.data.pages.single.render;
	}

	const site = (await (await fetch(`${url}/_api/sites/current`)).json()) as { id: string };
	for (let attempt = 0; attempt < 30; attempt++) {
		const response = await fetch(`${url}/_api/sites/${site.id}/pages/${pageId}`, { headers: { Authorization: headers.Authorization } });
		const page = (await response.json()) as { render?: string };
		if (page.render?.includes(expected)) return page.render;
		await new Promise((resolve) => setTimeout(resolve, 500));
	}
	throw new Error(`Page ${pageId} was not rendered with its latest content in time`);
}
