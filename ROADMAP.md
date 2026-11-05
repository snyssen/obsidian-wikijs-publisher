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
- [x] **M2 – API layer + first test push**
- [ ] **M3 – Push a single note** ← next
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

- [x] `WikiClient` interface (`src/wiki/types.ts`) and full `V2Client` / `V3Client` implementations: look up by path, create, update, delete, upload asset
- [x] v3 path hash (`src/wiki/v3/path-hash.ts`, cyrb53 port of Wiki.js `generatePathHash`, checked against hashes returned by the server)
- [x] v2 asset upload: hand-built multipart body (`src/wiki/v2/multipart.ts`, `requestUrl` has no FormData), folder ids resolved and created segment by segment, stored name read back from the folder listing
- [x] `upsertPage` (`WikiClient` method, implemented once in `src/wiki/base-client.ts`, which both clients extend): look up by path, then create or update
- [x] Path helpers (`src/wiki/paths.ts`): `slugify`, `toWikiPath`, `toAssetFileName`
- [x] Tests with vitest:
  - [x] unit tests (`tests/unit/`, `just test`, also run in CI): path hash, slugify, detection, multipart, client error mapping, upsert
  - [x] integration tests (`tests/integration/`, `just test-integration`) run against both docker instances: detection, connection, create → find → update (still published) → upsert → delete → re-create, asset upload (overwrite, binary integrity, SVG). On v3 they delete their `integration-tests` folder afterwards, since asset folders show in the navigation.
- [x] Dev-only command **Push test page (dev)** (only in dev builds, through the `__DEV__` esbuild `define`; checked absent from the production bundle): upserts `<default destination>/obsidian-test` with sample Markdown and an SVG image. Its flow was checked on both wikis with a script: the rendered HTML has the image and the callout.
- [x] Manual check in the throwaway Obsidian: run **Push test page (dev)** against both instances (the v2 unpublish bug was found this way, then fixed)

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
- [ ] Callouts → per-version syntax (see [Callouts](#callouts)): GitHub alerts (`> [!NOTE]`) on v3, `{.is-info}` class blocks on v2. Conversion therefore needs a per-version layer (e.g. a small dialect object chosen from `client.version`), not a single converter.
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
- Where to put a note's attachments on the wiki (M4): on v3, asset folders and pages share one tree, so an asset folder can't have the same path as a page, and **asset folders show up in the wiki's navigation** like page folders (v2 hides them). The dev command uses `<page path>-assets`, which adds one navigation entry per page: probably not what we want for real notes.
- Pages using a non-Markdown editor on v3 (e.g. HTML): updating them with Markdown content is untested. Markdown and Visual pages are fine (same source).
- Storing each note's destination in its frontmatter
- Dry-run preview before pushing
- Two-way sync

## Architecture

```text
src/
  main.ts                 lifecycle only: settings, setting tab, commands
  settings.ts             settings interface, defaults, declarative tab
  globals.d.ts            __DEV__ build flag (true in dev builds)
  commands/               test connection, push test page (dev only)
  wiki/
    types.ts              WikiClient interface, WikiConfig, PageInput, RemotePage, UploadedAsset
    http.ts               HttpFn abstraction + WikiApiError (no Obsidian import: testable in Node)
    obsidian-http.ts      HttpFn over Obsidian's requestUrl
    detect.ts             detectVersion(http, url): 'v2' | 'v3'
    factory.ts            createClient (auto/manual version), testConnection
    paths.ts              path validation and slugify helpers
    base-client.ts        BaseWikiClient: shared logic (upsertPage: look up by path → create or update)
    v2/client.ts          GraphQL implementation
    v2/multipart.ts       multipart body builder for uploads
    v3/client.ts          REST implementation (site id resolved lazily, render after save)
    v3/path-hash.ts       cyrb53 port
  publish/  (M3+)         path mapping, note → PageInput, conversion, bulk planner
  ui/       (M3+)         destination modal, progress
tests/
  unit/                   no network (`just test`, run in CI)
  integration/            against the docker wikis (`just test-integration`)
  helpers/                fake and fetch-based HttpFn
```

```ts
interface WikiClient {
	readonly version: WikiVersion;
	checkConnection(): Promise<ConnectionInfo>;
	getPageByPath(path: string): Promise<RemotePage | null>; // in the configured locale
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

Gotchas found on v2 (2.5.x):

- `pages.singleByPath` on a missing page returns `null` with a GraphQL error whose `extensions.exception.code` is `6003`.
- Mutations report failures in `responseResult { succeeded message }`, with HTTP 200 and no GraphQL error.
- `pages.update` **unpublishes the page** when `isPublished` is left out: always send `isPublished: true` (and `isPrivate: false`). Caught in manual testing; the integration tests now check that an updated page is still publicly readable.
- `POST /u` (multipart, field `mediaUpload` sent twice: `{"folderId":N}` then the file) only answers `ok`. Wiki.js lowercases the file name and replaces spaces with `_`, so read the stored name back with `assets.list(folderId)`. Same-name uploads overwrite.
- Asset folders: `assets.folders(parentFolderId)` and `assets.createFolder(parentFolderId, slug, name)` (slug is lowercased; creating an existing one fails with `succeeded: false`). Root folder id is `0`. Assets are served at `/<folder slugs>/<file name>`.

Both versions sanitize SVG files on upload (the stored file differs from the one sent).

### Callouts

Checked on the dev instances (2026-11-05) by rendering the same content on both:

- **v3** renders both `> text` + `{.is-info}` and GitHub alerts (`> [!NOTE]`, `[!TIP]`, `[!WARNING]`…), both as `<blockquote class="is-info">` (alerts add a `<p class="alert-title">` heading). Its Markdown editor toolbar inserts GitHub alerts, so that is the syntax v3 now favours.
- **v2** does not know GitHub alerts: `> [!NOTE]` renders as a plain blockquote with the literal text `[!NOTE]`. Only `{.is-info}` / `{.is-success}` / `{.is-warning}` / `{.is-danger}` work.

Obsidian callouts (`> [!note]`, `> [!tip]-` foldable, custom titles, many types) are close to GitHub alerts, but types must be mapped onto the smaller set each version supports.

### Path constraint

v3 only allows letters, digits, `-`, `_`, spaces and `/` in paths: no dots. It lowercases paths and replaces spaces with hyphens on save. The plugin slugifies paths the same way for both versions: lowercase, spaces → `-`, other punctuation removed, `.md` dropped. So `test.md` becomes page `some/path/test`.

## Decisions

- **2026-11-04 – v3 rendering:** save the Markdown, then ask the server to render it (`POST .../render`). We don't bundle a Markdown renderer. If the instance has no Puppeteer (503), the plugin warns and the page stays unrendered until it is edited.
- **2026-11-04 – Credentials:** a single **API token** setting. It is an API key on v2 and a personal access token on v3. It is stored with Obsidian's secret storage.
- **2026-11-04 – Version:** auto-detection by default, with a manual override setting.
- **2026-11-05 – Page updates on v2** force `editor: "markdown"`, since the content sent is always Markdown. v3 leaves the editor alone (Markdown and Visual share one source).
- **2026-11-05 – File and folder names** are slugified by the plugin (`toWikiPath`, `toAssetFileName`) before being sent, so both versions store predictable names. The plugin still links to the name each server reports back.
- **2026-11-05 – Tooling:** esbuild bumped from 0.25.5 to 0.28.2 (required by vitest 5). Tests live in `tests/` (included in `tsconfig.json`, Obsidian lint rules relaxed there since they run in Node).
- **2026-11-04 – Page lookup:** pages are looked up by path on every push. No wiki ids are stored in the notes, so moving to another instance or from v2 to v3 doesn't leave stale ids.
