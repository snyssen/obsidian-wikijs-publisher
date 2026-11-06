import { describe, expect, it } from 'vitest';
import { PushRegistry, PushRegistryData } from '../../src/publish/registry';

describe('PushRegistry', () => {
	const make = () => {
		const data: PushRegistryData = {};
		return { data, registry: new PushRegistry(data, () => Promise.resolve()) };
	};

	it('keeps paths per wiki, ignoring a trailing slash in the URL', async () => {
		const { registry } = make();
		await registry.set('http://wiki/', 'a.md', 'a');
		expect(registry.get('http://wiki', 'a.md')).toBe('a');
		expect(registry.get('http://other', 'a.md')).toBeUndefined();
		await registry.delete('http://wiki', 'a.md');
		expect(registry.get('http://wiki', 'a.md')).toBeUndefined();
	});

	it('follows renamed notes and folders', async () => {
		const { data, registry } = make();
		await registry.set('http://wiki', 'Events/Partie 0/a.md', 'campaign/partie-0/a');
		await registry.set('http://wiki', 'Events/Partie 01.md', 'campaign/partie-01');
		await registry.rename('Events/Partie 0', 'Events/Session 0');
		expect(data['http://wiki']).toEqual({ 'Events/Session 0/a.md': 'campaign/partie-0/a', 'Events/Partie 01.md': 'campaign/partie-01' });
	});
});
