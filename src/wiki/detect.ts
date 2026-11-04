import { HttpFn, isRecord, joinUrl, parseJson, send, WikiApiError } from './http';
import { WikiVersion } from './types';

/**
 * Detects the Wiki.js major version from unauthenticated endpoints:
 * v3 answers the public REST route `GET /_api/sites/current` with the site as JSON,
 * v2 answers GraphQL queries at `POST /graphql` (v3 has no GraphQL API).
 */
export async function detectVersion(http: HttpFn, baseUrl: string): Promise<WikiVersion> {
	const v3 = await send(http, { url: joinUrl(baseUrl, '/_api/sites/current'), method: 'GET' });
	const site = parseJson(v3);
	if (v3.status === 200 && isRecord(site) && typeof site.id === 'string') {
		return 'v3';
	}

	const v2 = await send(http, {
		url: joinUrl(baseUrl, '/graphql'),
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ query: '{ __typename }' }),
	});
	const result = parseJson(v2);
	if (isRecord(result) && ('data' in result || 'errors' in result)) {
		return 'v2';
	}

	throw new WikiApiError(`No Wiki.js instance found at ${baseUrl}`);
}
