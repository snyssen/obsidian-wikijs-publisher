import { describe, expect, it } from 'vitest';
import { V2Client } from '../../src/wiki/v2/client';
import { V3Client } from '../../src/wiki/v3/client';
import { fakeHttp, json, on } from '../helpers/fake-http';

const site = on('GET', '/_api/sites/current', json(200, { id: 'site-1', title: 'Default Site' }));
const input = { path: 'notes/test', title: 'Test', content: '# Test' };

describe('V2Client', () => {
	it('maps a missing page to null', async () => {
		const http = fakeHttp(
			on('POST', '/graphql', json(200, {
				errors: [{ message: 'This page does not exist.', extensions: { exception: { code: 6003 } } }],
				data: { pages: { singleByPath: null } },
			})),
		);
		await expect(new V2Client(http, 'http://wiki', 'key', '').getPageByPath('nope')).resolves.toBeNull();
	});

	it('reports a rejected key', async () => {
		const http = fakeHttp(on('POST', '/graphql', json(200, { errors: [{ message: 'Forbidden' }] })));
		await expect(new V2Client(http, 'http://wiki', 'bad', '').checkConnection()).rejects.toMatchObject({
			status: 403,
			message: expect.stringContaining('rejected the API key') as unknown,
		});
	});

	it('defaults the locale to en', async () => {
		const http = fakeHttp(on('POST', '/graphql', json(200, { data: { pages: { singleByPath: { id: 7, path: 'p', title: 'P' } } } })));
		const page = await new V2Client(http, 'http://wiki/', 'key', '').getPageByPath('p');
		expect(JSON.parse(http.requests[0]?.body as string)).toMatchObject({ variables: { locale: 'en' } });
		expect(page).toEqual({ id: '7', path: 'p', title: 'P', url: 'http://wiki/p' });
	});

	it('reports a failed mutation', async () => {
		const http = fakeHttp(on('POST', '/graphql', json(200, {
			data: { pages: { create: { responseResult: { succeeded: false, message: 'Duplicate' }, page: null } } },
		})));
		await expect(new V2Client(http, 'http://wiki', 'key', '').createPage(input)).rejects.toThrow('Wiki.js error: Duplicate');
	});
});

describe('V3Client', () => {
	it('looks pages up by path hash and locale', async () => {
		const http = fakeHttp(site, on('GET', '/pages/', json(200, { id: 'uuid-1', path: 'home', title: 'Home' })));
		const page = await new V3Client(http, 'http://wiki', 'token', 'fr').getPageByPath('home');
		expect(http.requests[1]?.url).toBe('http://wiki/_api/sites/site-1/pages/1867eaf483ceab?locale=fr');
		expect(page).toEqual({ id: 'uuid-1', path: 'home', title: 'Home', url: 'http://wiki/home' });
	});

	it('maps a missing page to null', async () => {
		const http = fakeHttp(site, on('GET', '/pages/', json(404, { message: 'This page does not exist.' })));
		await expect(new V3Client(http, 'http://wiki', 'token', '').getPageByPath('nope')).resolves.toBeNull();
	});

	it('queues a render after saving, and only warns when it fails', async () => {
		const http = fakeHttp(
			site,
			on('POST', '/render', json(503, { message: 'Rendering is not available' })),
			on('POST', '/pages', json(200, { page: { id: 'uuid-2', path: 'notes/test', title: 'Test' } })),
		);
		const page = await new V3Client(http, 'http://wiki', 'token', '').createPage(input);
		expect(http.requests.map((r) => `${r.method} ${r.url}`)).toEqual([
			'GET http://wiki/_api/sites/current',
			'POST http://wiki/_api/sites/site-1/pages',
			'POST http://wiki/_api/sites/site-1/pages/uuid-2/render',
		]);
		expect(http.requests[2]?.headers).not.toHaveProperty('Content-Type');
		expect(page.warning).toContain('could not render it');
	});

	it('explains a missing scope', async () => {
		const http = fakeHttp(site, on('PATCH', '/pages/', json(403, { message: 'Missing scope pages:write' })));
		await expect(new V3Client(http, 'http://wiki', 'token', '').updatePage('uuid-1', input)).rejects.toThrow(
			'The token is missing a scope or permission',
		);
	});
});

describe('upsertPage', () => {
	it('updates the existing page, or creates it', async () => {
		const existing = fakeHttp(
			site,
			on('GET', '/pages/', json(200, { id: 'uuid-1', path: 'notes/test', title: 'Old' })),
			on('PATCH', '/pages/uuid-1', json(200, { page: { id: 'uuid-1', path: 'notes/test', title: 'Test' } })),
			on('POST', '/render', json(202, { ok: true })),
		);
		await expect(new V3Client(existing, 'http://wiki', 't', '').upsertPage(input)).resolves.toMatchObject({ id: 'uuid-1' });

		const missing = fakeHttp(
			site,
			on('GET', '/pages/', json(404, {})),
			on('POST', '/render', json(202, { ok: true })),
			on('POST', '/pages', json(200, { page: { id: 'uuid-9', path: 'notes/test', title: 'Test' } })),
		);
		await expect(new V3Client(missing, 'http://wiki', 't', '').upsertPage(input)).resolves.toMatchObject({ id: 'uuid-9' });
	});
});
