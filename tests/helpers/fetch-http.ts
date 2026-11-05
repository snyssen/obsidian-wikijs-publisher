import { HttpFn } from '../../src/wiki/http';

/** HttpFn over Node's fetch, standing in for Obsidian's requestUrl outside the app. */
export const fetchHttp: HttpFn = async ({ url, method, headers, body }) => {
	const response = await fetch(url, { method, headers, body, redirect: 'manual' });
	return { status: response.status, text: await response.text() };
};
