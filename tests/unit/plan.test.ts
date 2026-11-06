import { describe, expect, it } from 'vitest';
import { planErrors } from '../../src/publish/plan';

describe('planErrors', () => {
	it('accepts distinct paths', () => {
		expect(planErrors([{ vaultPath: 'a.md', path: 'a' }, { vaultPath: 'b.md', path: 'b' }]).size).toBe(0);
	});

	it('rejects empty paths and duplicates after the first', () => {
		const errors = planErrors([
			{ vaultPath: 'Read me.md', path: 'read-me' },
			{ vaultPath: '???.md', path: '' },
			{ vaultPath: 'read-me.md', path: 'read-me' },
		]);
		expect([...errors.keys()]).toEqual(['???.md', 'read-me.md']);
		expect(errors.get('read-me.md')).toContain('Read me.md');
	});
});
