// Runs against the throwaway instances started by `just wiki-up`, with the tokens written by their seed scripts.
import { readFileSync } from 'node:fs';
import { afterAll, describe, expect, it } from 'vitest';
import { detectVersion } from '../../src/wiki/detect';
import { createClient } from '../../src/wiki/factory';
import { WikiVersion } from '../../src/wiki/types';
import { deleteV3RootFolder } from '../helpers/cleanup';
import { fetchHttp } from '../helpers/fetch-http';

const instances: { version: WikiVersion; url: string }[] = [
	{ version: 'v2', url: process.env.WIKI_V2_URL ?? 'http://localhost:3080' },
	{ version: 'v3', url: process.env.WIKI_V3_URL ?? 'http://localhost:3081' },
];

const svg = readFileSync(new URL('../../dev/vault/attachments/diagram.svg', import.meta.url));
// A 1×1 transparent PNG, to check binary files arrive intact
const png = Buffer.from(
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
	'base64',
);

function toArrayBuffer(buffer: Buffer): ArrayBuffer {
	return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
}

describe.each(instances)('Wiki.js $version', ({ version, url }) => {
	const token = readFileSync(new URL(`../../dev/wikijs/.api-key-${version}`, import.meta.url), 'utf8').trim();
	const run = Date.now().toString(36);
	const path = `integration-tests/${run}/page`;
	const getClient = () => createClient(fetchHttp, { url, token, version: 'auto', locale: '' });

	afterAll(async () => {
		if (version === 'v3') await deleteV3RootFolder(url, token, 'integration-tests');
	});

	it('detects the version', async () => {
		await expect(detectVersion(fetchHttp, url)).resolves.toBe(version);
	});

	it('connects', async () => {
		const client = await getClient();
		await expect(client.checkConnection()).resolves.toMatchObject({ version });
	});

	it('creates, finds, updates, upserts and deletes a page', async () => {
		const client = await getClient();
		await expect(client.getPageByPath(path)).resolves.toBeNull();

		const created = await client.createPage({ path, title: 'Created', content: '# Created', tags: ['test'] });
		expect(created).toMatchObject({ path, title: 'Created', url: `${url}/${path}` });
		expect(created.warning).toBeUndefined();
		await expect(client.getPageByPath(path)).resolves.toMatchObject({ id: created.id, title: 'Created' });

		const updated = await client.updatePage(created.id, { path, title: 'Updated', content: '# Updated' });
		expect(updated).toMatchObject({ id: created.id, title: 'Updated' });
		// Updating must not unpublish the page (Wiki.js 2 does when isPublished is left out)
		expect((await fetch(updated.url)).status).toBe(200);

		const upserted = await client.upsertPage({ path, title: 'Upserted', content: '# Upserted' });
		expect(upserted).toMatchObject({ id: created.id, title: 'Upserted' });

		await client.deletePage(created.id);
		await expect(client.getPageByPath(path)).resolves.toBeNull();

		// A deleted page must not block re-creating one at the same path (v3 keeps it in a recycle bin)
		const recreated = await client.upsertPage({ path, title: 'Recreated', content: '# Recreated' });
		expect(recreated.id).not.toBe(created.id);
		await client.deletePage(recreated.id);
	});

	it('moves a page, keeping its id and content', async () => {
		const client = await getClient();
		const from = `integration-tests/${run}/move-from`;
		const to = `integration-tests/${run}/move-to`;
		const page = await client.createPage({ path: from, title: 'Moved', content: '# Moved' });

		await client.movePage(page.id, to);
		await expect(client.getPageByPath(from)).resolves.toBeNull();
		await expect(client.getPageByPath(to)).resolves.toMatchObject({ id: page.id, title: 'Moved' });
		expect((await fetch(`${url}/${to}`)).status).toBe(200);
		await client.deletePage(page.id);
	});

	it('uploads assets into nested folders, overwriting same-name files', async () => {
		const client = await getClient();
		const folder = `integration-tests/${run}/assets`;

		const first = await client.uploadAsset(folder, 'pixel.png', toArrayBuffer(png), 'image/png');
		expect(first.fileName).toBe('pixel.png');
		expect(first.path).toBe(version === 'v3' ? `/_files/${folder}/pixel.png` : `/${folder}/pixel.png`);

		const second = await client.uploadAsset(folder, 'pixel.png', toArrayBuffer(png), 'image/png');
		expect(second).toEqual(first);

		const served = await fetch(`${url}${first.path}`);
		expect(served.status).toBe(200);
		expect(Buffer.from(await served.arrayBuffer())).toEqual(png);
	});

	it('uploads SVG files, which Wiki.js sanitizes', async () => {
		const client = await getClient();
		const asset = await client.uploadAsset(`integration-tests/${run}/assets`, 'diagram.svg', toArrayBuffer(svg), 'image/svg+xml');

		const served = await fetch(`${url}${asset.path}`);
		expect(served.headers.get('content-type')).toContain('image/svg+xml');
		expect(await served.text()).toContain('viewBox="0 0 200 80"');
	});
});
