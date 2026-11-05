import { describe, expect, it } from 'vitest';
import { pathHash } from '../../src/wiki/v3/path-hash';

describe('pathHash', () => {
	// Hashes returned by a Wiki.js 3.0.2 server for these paths
	it.each([
		['home', '1867eaf483ceab'],
		['guides/getting-started', '1d39c992d2b0dd'],
		['m2-probe', '1ac0557dbfba15'],
	])('hashes %s like Wiki.js', (path, hash) => {
		expect(pathHash(path)).toBe(hash);
	});
});
