// Transport-agnostic HTTP layer: the plugin uses Obsidian's requestUrl (see obsidian-http.ts),
// tests can plug in fetch. Must not import 'obsidian' so it stays usable outside the app.

export interface HttpRequest {
	url: string;
	method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
	headers?: Record<string, string>;
	body?: string | ArrayBuffer;
}

export interface HttpResponse {
	status: number;
	text: string;
}

/** Performs a request. Resolves for every HTTP status; rejects only when the server can't be reached. */
export type HttpFn = (request: HttpRequest) => Promise<HttpResponse>;

/** Error for an upload the wiki refused for its size (each wiki has a configurable limit). */
export function fileTooLarge(status: number): WikiApiError {
	return new WikiApiError("the file is larger than the wiki's maximum upload size, which can be raised in its administration settings", status);
}

export class WikiApiError extends Error {
	constructor(
		message: string,
		readonly status?: number,
	) {
		super(message);
		this.name = 'WikiApiError';
	}
}

export function parseJson(response: HttpResponse): unknown {
	try {
		return JSON.parse(response.text) as unknown;
	} catch {
		return undefined;
	}
}

export function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Calls `http`, turning network failures into a WikiApiError. */
export async function send(http: HttpFn, request: HttpRequest): Promise<HttpResponse> {
	try {
		return await http(request);
	} catch (error) {
		const reason = error instanceof Error ? error.message : String(error);
		throw new WikiApiError(`Could not reach ${new URL(request.url).origin}: ${reason}`);
	}
}

export function joinUrl(baseUrl: string, path: string): string {
	return baseUrl.replace(/\/+$/, '') + path;
}
