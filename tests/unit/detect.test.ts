import { describe, expect, it } from 'vitest';
import { detectVersion } from '../../src/wiki/detect';
import { WikiApiError } from '../../src/wiki/http';
import { fakeHttp, json, on } from '../helpers/fake-http';

describe('detectVersion', () => {
	it('detects v3 from the public site route', async () => {
		const http = fakeHttp(on('GET', '/_api/sites/current', json(200, { id: 'abc', title: 'Default Site' })));
		await expect(detectVersion(http, 'http://wiki/')).resolves.toBe('v3');
		expect(http.requests[0]?.url).toBe('http://wiki/_api/sites/current');
	});

	it('detects v2 from a GraphQL answer, even an error', async () => {
		const http = fakeHttp(on('POST', '/graphql', json(200, { errors: [{ message: 'Forbidden' }] })));
		await expect(detectVersion(http, 'http://wiki')).resolves.toBe('v2');
	});

	it('rejects a server that is not Wiki.js', async () => {
		const http = fakeHttp(on('GET', '/', { status: 200, text: '<html></html>' }));
		await expect(detectVersion(http, 'http://wiki')).rejects.toThrow('No Wiki.js instance found');
	});

	it('reports an unreachable server', async () => {
		const http = () => Promise.reject(new Error('ECONNREFUSED'));
		await expect(detectVersion(http, 'http://wiki:1234')).rejects.toThrow(
			new WikiApiError('Could not reach http://wiki:1234: ECONNREFUSED'),
		);
	});
});
