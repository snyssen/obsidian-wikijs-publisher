import { describe, expect, it } from 'vitest';
import { buildMultipart } from '../../src/wiki/v2/multipart';

describe('buildMultipart', () => {
	it('builds a body that a standard multipart parser reads back', async () => {
		const file = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x00, 0xff]);
		const { body, contentType } = buildMultipart([
			{ name: 'mediaUpload', value: '{"folderId":3}' },
			{ name: 'mediaUpload', fileName: 'my "image".png', mimeType: 'image/png', data: file.buffer },
		]);

		const form = await new Response(body, { headers: { 'Content-Type': contentType } }).formData();
		const [folder, upload] = form.getAll('mediaUpload');
		expect(folder).toBe('{"folderId":3}');
		expect(upload).toBeInstanceOf(File);
		const uploaded = upload as File;
		// Quotes are escaped as %22 (like browsers do) and decoded back by the parser
		expect(uploaded.name).toBe('my "image".png');
		expect(uploaded.type).toBe('image/png');
		expect(new Uint8Array(await uploaded.arrayBuffer())).toEqual(file);
	});
});
