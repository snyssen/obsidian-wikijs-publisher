// Obsidian's requestUrl has no FormData support: multipart bodies are built by hand.

export type MultipartPart =
	| { name: string; value: string }
	| { name: string; fileName: string; mimeType: string; data: ArrayBuffer };

export function buildMultipart(parts: MultipartPart[]): { body: ArrayBuffer; contentType: string } {
	const boundary = `----WikiJsPublisher${Math.random().toString(16).slice(2)}`;
	const encoder = new TextEncoder();
	const chunks: Uint8Array[] = [];

	for (const part of parts) {
		let header = `--${boundary}\r\nContent-Disposition: form-data; name="${escapeQuotes(part.name)}"`;
		if ('data' in part) {
			header += `; filename="${escapeQuotes(part.fileName)}"\r\nContent-Type: ${part.mimeType}`;
		}
		chunks.push(encoder.encode(`${header}\r\n\r\n`));
		chunks.push('data' in part ? new Uint8Array(part.data) : encoder.encode(part.value));
		chunks.push(encoder.encode('\r\n'));
	}
	chunks.push(encoder.encode(`--${boundary}--\r\n`));

	const body = new Uint8Array(chunks.reduce((size, chunk) => size + chunk.length, 0));
	let offset = 0;
	for (const chunk of chunks) {
		body.set(chunk, offset);
		offset += chunk.length;
	}
	return { body: body.buffer, contentType: `multipart/form-data; boundary=${boundary}` };
}

function escapeQuotes(value: string): string {
	return value.replace(/"/g, '%22');
}
