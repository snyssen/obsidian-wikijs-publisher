import { HttpFn, isRecord, joinUrl, parseJson, send, WikiApiError } from '../http';
import { ConnectionInfo, WikiClient } from '../types';

/** Wiki.js 2.x client, over its GraphQL API. */
export class V2Client implements WikiClient {
	readonly version = 'v2';

	constructor(
		private readonly http: HttpFn,
		private readonly baseUrl: string,
		private readonly token: string,
	) {}

	async checkConnection(): Promise<ConnectionInfo> {
		// Admin-only query: also confirms the key has the full access the plugin needs
		const data = await this.graphql('{ system { info { currentVersion } } }');
		const version = (data as { system?: { info?: { currentVersion?: string } } }).system?.info
			?.currentVersion;
		return { version: 'v2', serverVersion: version };
	}

	private async graphql(query: string, variables: Record<string, unknown> = {}): Promise<unknown> {
		const response = await send(this.http, {
			url: joinUrl(this.baseUrl, '/graphql'),
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${this.token}`,
			},
			body: JSON.stringify({ query, variables }),
		});
		const result = parseJson(response);
		if (!isRecord(result)) {
			throw new WikiApiError(`Unexpected response from Wiki.js (HTTP ${response.status})`, response.status);
		}

		// GraphQL reports errors with HTTP 200, an invalid or under-privileged key included
		const errors = Array.isArray(result.errors) ? result.errors : [];
		const message = errors.map((e) => (isRecord(e) ? String(e.message) : String(e))).join('; ');
		if (message === 'Forbidden') {
			throw new WikiApiError(
				'Wiki.js rejected the API key: check that it is valid and has full access',
				403,
			);
		}
		if (message) {
			throw new WikiApiError(`Wiki.js error: ${message}`, response.status);
		}
		return result.data;
	}
}
