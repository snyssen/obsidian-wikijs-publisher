/**
 * Wiki.js 3 addresses pages by a hash of their path (cyrb53, as hex). Exact port of
 * `generatePathHash` in Wiki.js `backend/helpers/common.ts`: both must agree bit for bit.
 *
 * @param path Page path, without a leading slash (the home page is `home`)
 */
export function pathHash(path: string, seed = 0): string {
	let h1 = 0xdeadbeef ^ seed;
	let h2 = 0x41c6ce57 ^ seed;
	for (let i = 0; i < path.length; i++) {
		const ch = path.charCodeAt(i);
		h1 = Math.imul(h1 ^ ch, 2654435761);
		h2 = Math.imul(h2 ^ ch, 1597334677);
	}
	h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
	h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
	h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
	h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);

	return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16);
}
