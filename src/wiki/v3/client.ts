import { HttpFn, HttpRequest, isRecord, joinUrl, parseJson, send, WikiApiError } from '../http';
import { ConnectionInfo, WikiClient } from '../types';

interface Site {
	id: string;
	title: string;
}

/** Wiki.js 3.x client, over its REST API (`/_api`, OpenAPI spec at `/_api/json`). */
export class V3Client implements WikiClient {
	readonly version = 'v3';
	private site?: Promise<Site>;

	constructor(
		private readonly http: HttpFn,
		private readonly baseUrl: string,
		private readonly token: string,
	) {}

	async checkConnection(): Promise<ConnectionInfo> {
		const site = await this.getSite();
		// Cheapest route that requires a valid token with the `pages` scope
		await this.request('GET', `/sites/${site.id}/pages/search?limit=1`);
		return { version: 'v3', site: site.title };
	}

	/** The site served at the configured URL (Wiki.js resolves it from the hostname). */
	private getSite(): Promise<Site> {
		this.site ??= this.request('GET', '/sites/current').then((site) => site as Site);
		return this.site;
	}

	private async request(method: HttpRequest['method'], path: string, body?: unknown): Promise<unknown> {
		const response = await send(this.http, {
			url: joinUrl(this.baseUrl, `/_api${path}`),
			method,
			headers: {
				Authorization: `Bearer ${this.token}`,
				// Fastify rejects a JSON content type with an empty body
				...(body !== undefined && { 'Content-Type': 'application/json' }),
			},
			body: body !== undefined ? JSON.stringify(body) : undefined,
		});
		const result = parseJson(response);
		if (response.status < 400) return result;

		const reason = isRecord(result) && typeof result.message === 'string' ? result.message : `HTTP ${response.status}`;
		switch (response.status) {
			case 401:
				throw new WikiApiError(`Wiki.js rejected the token: ${reason}`, 401);
			case 403:
				throw new WikiApiError(
					`The token is missing a scope or permission (it needs pages:write and assets:write): ${reason}`,
					403,
				);
			default:
				throw new WikiApiError(`Wiki.js error: ${reason}`, response.status);
		}
	}
}
