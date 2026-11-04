import { requestUrl } from 'obsidian';
import { HttpFn } from './http';

// requestUrl bypasses CORS and works on mobile, unlike fetch
export const obsidianHttp: HttpFn = async ({ url, method, headers, body }) => {
	const response = await requestUrl({ url, method, headers, body, throw: false });
	return { status: response.status, text: response.text };
};
