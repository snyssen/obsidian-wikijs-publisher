# Roadmap

This is the reference document for the development of the Wiki.js Publisher plugin. It is shared across work sessions: check off items as they land, record decisions in [Decisions](#decisions), and update the API notes when something new is learned. Milestones are worked on in order; a milestone's details get refined when work on it starts.

## Vision

Push notes from an Obsidian vault to a Wiki.js instance:

- **What to push:** a single note, a folder, or every note that has a given frontmatter property (e.g. `publish-to-wikijs: true`).
- **Where:** the destination path on the wiki is chosen per push. Pushing note `test.md` to `some/path` creates page `some/path/test`. Pushing folder `my/notes/` (containing `readme.md` and `guides/first.md`) to `some/path` creates `some/path/my/notes/readme` and `some/path/my/notes/guides/first`. These rules may be refined later.
- **One-way:** Obsidian always wins. Existing wiki pages are overwritten, even if they were edited on the wiki.
- **Conversion:** Obsidian syntax is converted to something Wiki.js understands: at least `[[wikilinks]]` to Markdown links, and attachments uploaded and linked.
- **Wiki.js versions:** v3 first, v2 also supported, behind a single abstraction. The version is detected automatically, or set manually.

## Status

- [x] **M0 – Dev environment**
- [x] **M1 – Configuration & connection**
- [ ] **M2 – API layer + first test push** ← next
- [ ] **M3 – Push a single note**
- [ ] **M4 – Conversion**
- [ ] **M5 – Bulk push**
- [ ] **M6 – Polish & release**

## Milestones

### M0 – Dev environment ✅

- [x] Nix devshell from the [nix-dev-env](https://github.com/snyssen/nix-dev-env) template, direnv, just, pre-commit (with eslint)
- [x] Throwaway Wiki.js v2 in docker compose, seeded by script
- [x] Isolated throwaway Obsidian instance on `dev/vault/`, with Hot Reload; `just dev` builds straight into it
- [x] Plugin identity (`wikijs-publisher`), sample code removed, declarative settings API, `minAppVersion` 1.14.4

### M1 – Configuration & connection ✅

- [x] Dev env: add a Wiki.js v3 instance (`wiki-v3` on :3081, `postgres:18`) next to v2 (`wiki-v2` on :3080)
  - [x] `dev/wikijs/seed-v2.sh` (API key → `dev/wikijs/.api-key-v2`) and `dev/wikijs/seed-v3.sh` (login → enable API → personal access token → `dev/wikijs/.api-key-v3`, sample pages rendered server-side)
  - [x] `just wiki-*` recipes handle both instances; README and AGENTS.md updated
- [x] Settings (declarative, `src/settings.ts`), in two groups, **Connection** and **Publishing**:
  - [x] `wikiUrl` (validated URL)
  - [x] `apiTokenSecret` (`secret` control: the token lives in Obsidian's secret storage, not in `data.json`)
  - [x] `apiVersion`: `auto` | `v2` | `v3` (default `auto`)
  - [x] `locale` (empty = site's primary locale on v3, `en` on v2; not used before M2)
  - [x] `defaultDestination` (empty = wiki root, validated with the path rules; not used before M3)
  - [x] **Test connection** action, also available as a command: detects the version, checks the token, reports in a notice (also catches a forced version that doesn't match the server)
- [x] `src/wiki/http.ts` (+ `obsidian-http.ts`), `detect.ts`, `factory.ts`, `paths.ts`, and `checkConnection` for both clients; checked against both live instances with a fetch-based script (auto/forced version, bad token, wrong token type, not a wiki, unreachable, no token)
- [x] Manual check in the throwaway Obsidian: settings render and appear in settings search, the token is not in `data.json`, **Test connection** works on both instances

### M2 – API layer + first test push

- [ ] `WikiClient` interface (`src/wiki/types.ts`) and full `V2Client` / `V3Client` implementations
- [ ] v3 path hash (cyrb53 port of Wiki.js `generatePathHash`)
- [ ] v2 asset upload (multipart `POST /u`, folder ids): verify against the live instance first
- [ ] `upsertPage`: look up by path, then create or update
- [ ] Tests with vitest: unit tests (path hash, slugify, detection, error mapping) and integration tests run against both docker instances (`just test`, `just test-integration`)
- [ ] Dev-only command **Push test page** (only in `just dev` builds, through an esbuild `define` flag): upserts `obsidian-test` with sample Markdown and an image

### M3 – Push a single note

- [ ] Command and file context menu entry
- [ ] Destination modal, prefilled with the default destination, remembers the last used one
- [ ] Path mapping and slugify (see [path constraint](#path-constraint))
- [ ] Title from frontmatter `title` or the file name; tags from frontmatter
- [ ] Upsert, then a notice with a link to the page

### M4 – Conversion

- [ ] Strip frontmatter
- [ ] `[[wikilinks]]`, aliases and heading links → Markdown links to the target wiki paths (resolved with `metadataCache`)
- [ ] Embeds (`![[image.png]]`) → upload the attachment, then link to it
- [ ] Callouts → Wiki.js blockquote syntax (`{.is-info}` etc.; check that v3 renders it the same way)
- [ ] Highlights, `%%comments%%`
- [ ] Unit tests for each rule

### M5 – Bulk push

- [ ] Folder push (folder context menu), mapped as `<destination>/<folder path>/<note path>`
- [ ] Frontmatter property push (property name configurable, default `publish-to-wikijs`)
- [ ] Links between notes of the same batch resolved to their wiki pages
- [ ] Attachments uploaded once per batch
- [ ] Progress display and a summary of failures

### M6 – Polish & release

- [ ] README: disclose network use and what is sent (Obsidian developer policies)
- [ ] Error messages reviewed
- [ ] Mobile smoke test
- [ ] Release 1.0.0 through the release workflow

### Later / open questions

- Renames and deletions propagated to the wiki
- Storing each note's destination in its frontmatter
- Dry-run preview before pushing
- Two-way sync

## Architecture

```text
src/
  main.ts                 lifecycle only: settings, setting tab, commands
  settings.ts             settings interface, defaults, declarative tab
  wiki/
    types.ts              WikiClient interface, PageInput, RemotePage, UploadedAsset, WikiVersion
    http.ts               HttpFn abstraction (Obsidian requestUrl in the plugin, fetch in tests) + WikiApiError
    detect.ts             detectVersion(url): 'v2' | 'v3'
    factory.ts            createClient(settings, token): resolves the version (auto/manual) → client
    upsert.ts             upsertPage(client, input): look up by path → create or update
    v2/client.ts          GraphQL implementation
    v3/client.ts          REST implementation (site id resolved lazily, render after save)
    v3/path-hash.ts       cyrb53 port
  publish/  (M3+)         path mapping, note → PageInput, conversion, bulk planner
  commands/ (M3+)         command and context menu registration
  ui/       (M3+)         destination modal, progress
```

```ts
interface WikiClient {
	readonly version: WikiVersion;
	checkConnection(): Promise<{ version: string; site?: string }>;
	getPageByPath(path: string, locale?: string): Promise<RemotePage | null>;
	createPage(input: PageInput): Promise<RemotePage>;
	updatePage(id: string, input: PageInput): Promise<RemotePage>; // ids are strings (v2 integers are converted)
	deletePage(id: string): Promise<void>;
	uploadAsset(folderPath: string, fileName: string, data: ArrayBuffer, mimeType: string): Promise<UploadedAsset>;
}
```

The publishing logic only talks to `WikiClient`. HTTP calls go through Obsidian's `requestUrl` (no CORS issues, works on mobile), so the plugin stays usable on mobile (`isDesktopOnly: false`).

## Wiki.js API notes

v3 is **not** GraphQL: it is a REST API under `/_api`. Its OpenAPI spec is served without authentication at `/_api/json` (Swagger UI at `/_api/`); check contracts there.

Gotchas found so far on v3 (3.0.2):

- `GET /sites/:id/pages` (list) is a stub that always returns `[]`. Use `GET /sites/:id/pages/search` or the tree routes instead.
- Fastify rejects a request with a JSON `Content-Type` and an empty body (400): only send the header with a body.
- `GET /sites/:id/pages/:pageIdOrHash` needs a real hash or UUID: a plain path gives 400.
- A fresh install is private: the Guests group's "Default Rule" DENIES `read:pages`. The dev seed flips it to ALLOW (`PUT /_api/groups/:id` with the updated `rules`). Pushed pages are only visible to readers the wiki's own rules allow.

| | v2 (2.5.x) | v3 (3.0.x) |
|---|---|---|
| API | GraphQL, `POST /graphql` | REST, `/_api/...` |
| Credential | Admin API key (Bearer); the API must be enabled | **Personal access token** (Bearer) with scopes `pages:write` and `assets:write`. The API is off by default (`PUT /_api/system/api`). System API keys can't write pages. |
| Site | Single site | Every route is `/_api/sites/:siteId/...`. The public `GET /_api/sites/current` (resolved by hostname) returns the site id. |
| Look up by path | `pages.singleByPath(path, locale)` | `GET /sites/:id/pages/:hash?locale=&withContent=true`, where hash is cyrb53 of the normalized path |
| Create / update | `pages.create(...)` / `pages.update(id: Int, ...)`, `editor: "markdown"` | `POST /sites/:id/pages` (409 if the path exists) / `PATCH /sites/:id/pages/:uuid`, `editor: 'markdown'`, no conflict check |
| Rendering | The server renders on save | The client must provide the HTML: we save, then call `POST .../pages/:id/render` (server-side Puppeteer, included in the official image; 503 when missing → warn) |
| Assets | Multipart `POST /u` and folder ids (`assets.createFolder`) | Raw body `POST /sites/:id/assets?fileName=&folderPath=`. Folders are created automatically and the file name is normalized, so use the returned name. Served at `/_files/<folderPath>/<file>`. |
| Version detection | `POST /graphql` answers | `GET /_api/sites/current` returns JSON; `POST /graphql` returns 404 |
| Token check | `system.info` query (admin only, so it also checks for full access). A bad key gets HTTP 200 with a `Forbidden` GraphQL error. | `GET /sites/:id/pages/search?limit=1` (needs the `pages` scope): 401 with a reason (`Token is malformed.`, `The API is disabled.`…), 403 for a missing scope |
| Server version | `system.info.currentVersion` | Only in `/_api/system/info` (admin session) or the 512 KB OpenAPI spec (`info.version`): not fetched, the plugin only reports the site |

### Path constraint

v3 only allows letters, digits, `-`, `_`, spaces and `/` in paths: no dots. It lowercases paths and replaces spaces with hyphens on save. The plugin slugifies paths the same way for both versions: lowercase, spaces → `-`, other punctuation removed, `.md` dropped. So `test.md` becomes page `some/path/test`.

## Decisions

- **2026-11-04 – v3 rendering:** save the Markdown, then ask the server to render it (`POST .../render`). We don't bundle a Markdown renderer. If the instance has no Puppeteer (503), the plugin warns and the page stays unrendered until it is edited.
- **2026-11-04 – Credentials:** a single **API token** setting. It is an API key on v2 and a personal access token on v3. It is stored with Obsidian's secret storage.
- **2026-11-04 – Version:** auto-detection by default, with a manual override setting.
- **2026-11-04 – Page lookup:** pages are looked up by path on every push. No wiki ids are stored in the notes, so moving to another instance or from v2 to v3 doesn't leave stale ids.
