/**
 * Deletes a root-level folder, with every page and asset in it, on a Wiki.js 3 instance.
 * Test cleanup only: on v3, asset folders show up in the wiki's navigation.
 * (Wiki.js 2 has no API to delete asset folders, but doesn't show them in its navigation.)
 */
export async function deleteV3RootFolder(url: string, token: string, name: string): Promise<void> {
	const headers = { Authorization: `Bearer ${token}` };
	const site = (await (await fetch(`${url}/_api/sites/current`)).json()) as { id: string };
	const tree = (await (
		await fetch(`${url}/_api/sites/${site.id}/tree?types=folder&depth=1`, { headers })
	).json()) as { id: string; folderPath: string; fileName: string }[];

	const folder = tree.find((item) => item.folderPath === '' && item.fileName === name);
	if (!folder) return;
	const response = await fetch(`${url}/_api/sites/${site.id}/tree/folders/${folder.id}`, { method: 'DELETE', headers });
	if (!response.ok) throw new Error(`Could not delete the ${name} folder: HTTP ${response.status}`);
}
