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
- [x] **M3 – Push a single note**
- [x] **M4 – Conversion**
- [x] **M5 – Bulk push**
- [x] **M6 – Automatic push**
- [ ] **M7 – Polish & release**  ← in progress
- [ ] **M8 – Folder notes** (after 1.0)

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

- [x] Command **Push current note** (`push-note`, available when a Markdown note is active) and a **Push to Wiki.js** entry in the file context menu (`src/commands/index.ts`, `push-note.ts`)
- [x] Destination modal (`src/ui/destination-modal.ts`): prefilled with the last used destination (`lastDestination`, kept in `data.json` but not shown in the settings tab), else the default destination; previews the resulting page path and validates it; Enter pushes
- [x] Path mapping and slugify (see [path constraint](#path-constraint)): `<destination>/<note name>`, e.g. `Some/Path` + `My note.md` → `some/path/my-note` (`src/publish/note.ts`, unit tested)
- [x] Title from frontmatter `title`, else the file name; `description` and `tags` from frontmatter too (a list or a comma/space separated string, `#` dropped)
- [x] Upsert, then a notice with a link to the page (`src/ui/notices.ts`, shared with the dev command)
- [x] Manual check in the throwaway Obsidian: push `Guides/Getting started` (frontmatter title, description and tags) and `Welcome` (no frontmatter) to both instances, from the command and the context menu; push again to check the overwrite

### M4 – Conversion

Conversion is a pure module (`src/convert/`, no Obsidian import, unit tested), parameterized by a per-version **dialect** (`src/convert/dialect.ts`). The Obsidian side (`src/publish/`) only resolves link targets and uploads attachments. Code blocks and inline code are never touched.

- [x] Strip frontmatter (done in M3: the body is cut after the frontmatter block)
- [x] Push registry (`src/publish/registry.ts`): where each note was last pushed, per wiki URL (`vault path → wiki path`, in `data.json`). Kept up to date on renames in the vault
- [x] `[[wikilinks]]`, aliases and heading links (`[[Note#Heading|alias]]`, `[[#Heading]]`) and Markdown links to notes (`[text](Note.md)`) → links to the target's page, found with `metadataCache.getFirstLinkpathDest` then the registry. Notes never pushed (or missing files) become their text followed by a `⛓️‍💥 broken link` marker in superscript, with a tooltip (`<sup title=…>`, kept by both wikis). Heading anchors computed like each wiki does (see [Heading anchors](#heading-anchors)); block references (`#^id`) link to the page
- [x] Attachments (`![[image.png]]`, `![[image.png|300]]`, `![](image.png)`, `[[file.pdf]]`) → uploaded to one shared folder (setting, default `attachments`), under their vault path (`attachments/<vault folder>/<file>`), then linked; image sizes → `=300x` (both versions)
- [x] Note embeds (`![[Other note]]`) → links to the note, like `[[Other note]]`
- [x] Callouts → per-version syntax (see [Callouts](#callouts)). Obsidian's many types map onto info / success / important / warning / danger; the Obsidian title (custom, or the type name) is kept; fold markers are dropped
  - v3: GitHub alerts, `> [!WARNING] Title`
  - v2: `<blockquote class="is-warning">` wrapper with the Markdown inside separated by blank lines, title in bold (the `{.is-warning}` line breaks when the quote ends with a code block or a nested quote)
- [x] Inline tags (`#tag` in the body): added to the page's tags (merged with the frontmatter ones, no duplicates), and turned into links to the wiki's tag search: `/t/<tag>?sort=title` on v2 (slashes of nested tags not encoded: the tag page splits its path into tags, so `/t/a/b` also searches several tags), `/_tags?t=<tag>` on v3
- [x] Highlights (`==text==`): `<mark>` on v2 (no `==` support), kept on v3
- [x] `%%comments%%` (inline or multi-line) removed; block ids (`^abc123`) removed
- [x] Unit tests for each rule (`tests/unit/convert.test.ts`), and an integration test checking the rendered HTML on both wikis (`tests/integration/conversion.test.ts`: heading ids, heading links, callouts with code and nesting, highlights, tag links). It showed that heading ids come from the *rendered* heading text, so inline Markdown is stripped before computing them (`headingText`)
- [x] Manual check in the throwaway Obsidian, on both instances: push `Guides/Getting started` (inline tag, SVG embed, link to `Welcome`), then `Welcome` (links to it now resolve, heading link to `Formatting`), then `Formatting` (callouts, highlight); push `Welcome` again once `Formatting` is pushed

- [x] Math: Obsidian's `$…$` / `$$…$$` is kept on v2 (rendered by KaTeX), and rewritten for v3, which has its own syntax: `` $`…`$ `` inline, and a `::block-katex` block around a `latex` fence for display math (`$$…$$` inside a paragraph stays inline). Math is also protected from the other rules (`==`, `#`). Prices like `$5 and $10` are not math, as in Obsidian
- [x] Mermaid: v3 only draws diagrams inside a `::block-diagram` block (see its sample content), so ` ```mermaid ` fences are wrapped on v3 (`src/convert/diagrams.ts`); v2 draws the fence as is
- [x] Relative Markdown links (`./Welcome.md`, `../x.png`) resolved from the note's folder, then by file name, when Obsidian's resolver doesn't find them
- [x] Checked with `dev/vault/Formatting.md`, which covers every case above (converted, then rendered on both wikis)

Supported natively by both wikis, so left alone (checked by rendering on both): headings, lists (nested, ordered with an offset), tasks, emphasis, horizontal rules, nested blockquotes, code blocks, footnotes, strikethrough, tables, image sizes, HTML comments (hidden on both).

Known limitations, documented rather than fixed:

- **Raw HTML** is passed through untouched; what survives is up to the wiki's sanitizer. Both keep inline HTML, `<audio>` and `<video>`. v2 strips `<script>`; v3 keeps it in the rendered HTML (whether it runs is up to the v3 frontend).
- **v2 drops some heading ids:** its sanitizer (DOMPurify, against DOM clobbering) removes ids that match `document` properties, e.g. `links`, `images`, `forms`. Links to headings named like that land at the top of the page on v2. Nothing the plugin can do.

### M5 – Bulk push

- [x] Folder push: **Push folder to Wiki.js** in the folder context menu, mapped as `<destination>/<folder path>/<note path>` (`vaultPagePath`), subfolders included
- [x] Frontmatter property push: command **Push notes marked for publishing** (`push-marked-notes`), for notes whose property (setting, default `publish-to-wikijs`) is `true` or any value but `false`/empty (`isMarkedForPublishing`). Mapped as `<destination>/<vault path>`, like a folder push from the vault root (M6 will refine destinations with the property's value)
- [x] One push engine for every kind of push (`src/publish/push.ts`): one client, notes pushed one after the other, sorted by path; the single-note push is a push of one
- [x] Links between notes of the same push resolve to their new pages: the planned paths are consulted before the registry
- [x] Attachments uploaded once per push (upload cache shared by the notes)
- [x] Planned paths checked before pushing (`src/publish/plan.ts`): a note whose name gives no path, or the same path as another note of the push, fails instead of overwriting it
- [x] Progress in the notice (`Pushing 3/12: Note…`); a notice when everything worked, otherwise a modal listing each failed note with its error (`src/ui/push-report.ts`). A failing note doesn't stop the others
- [x] Manual check in the throwaway Obsidian, on both instances: `Welcome` and `Guides/Getting started` are marked with `publish-to-wikijs` and link to each other: push them with the command, check both links work after a single push; push the `Guides` folder; push a folder with a note that fails (e.g. invalid YAML frontmatter) to see the report

### M6 – Automatic push

Refined with the user on 2026-11-06. The value of the publishing property (`publish-to-wikijs`) is the note's **destination**:

| Value | Meaning |
|---|---|
| `false` | Never pushed (excluded, also from automatic push) |
| `/some/path` (starts with `/`) | Pushed to `/some/path/<note name>`; `/` alone is the wiki root. Slugified again at push time: a value that changes (e.g. `/My Campaign` → `/my-campaign`) gives a warning naming the note |
| `true`, empty, anything else | Pushed under the default destination (a value without leading `/` gives a warning: probably a typo) |

- [x] **Destinations from the property**: `parseDestination` (pure, unit tested); **Push notes marked for publishing** uses each note's destination (confirmation with the count, no destination prompt); **Push current note** is prefilled with the note's destination. Push results carry warnings, and every warning or error names its note
- [x] **Set Wiki.js destination**:
  - on a folder (folder menu): writes `/` + slugified `<destination>/<note folder relative to the clicked folder>` on every note below it (e.g. folder `Events` → `/campaign`: `Events/Events.md` gets `/campaign`, `Events/Partie 0/x.md` gets `/campaign/partie-0`). Toggle **Only notes that already have the property**. Notes set to `false` are skipped
  - on a note (file menu and command): writes the slugified destination; asks first if the note is set to `false`
  - written with `fileManager.processFrontMatter`, already slugified (what you read is where the page goes)
- [x] **Exclude from Wiki.js** (folder menu, file menu, command): writes `false` (folder: after a confirmation with the count). Pages already on the wiki are left alone
- [x] **Destinations follow moves** (setting, on by default): when a note moves to another folder and its value follows the folder structure, the changed folder segments are replaced (`Events/Partie 0` → `Events/Partie 1`: `/campaign/partie-0` → `/campaign/partie-1`); other values are left alone. Batched: one notice per move, even for a whole folder
- [x] **Pages are moved, not duplicated**: when a note's path changes (rename, move, edited destination), its existing page is moved (`WikiClient.movePage`: v3 `PUT /pages/:id/path` with `updateLinks`, v2 `pages.move`)
- [x] **No overwrite without the registry's approval**: a page is only overwritten silently if the registry says this note pushed it. Any other page at the target path is a **collision**: one modal per push lists them, with **Replace** / **Skip** / **Exclude** per note or for all. Refusals are remembered (`data.json`): automatic push skips them silently, a manual push asks again; forgotten when the note's target changes
- [x] **Automatic push** (setting, off by default; delay setting, default 10 s): changed marked notes are queued (`metadataCache` `changed`), one shared debounce timer, one push run for all queued notes, runs never overlap. The queue is saved in `data.json` (mobile apps get suspended) and resumed at start-up
- [x] **Broken links heal**: a note pushed for the first time also re-pushes its marked backlinks already on the wiki, so their broken-link markers become links
- [x] **Quiet reporting**: successful automatic pushes are silent; desktop status bar shows the state (pushing / pushed at / failed); one notice per failed run; the last report can be reopened
- [x] Unit tests (`tests/unit/destinations.test.ts`: values, folder destinations, move inference; `registry.test.ts`), integration test of the page move on both wikis. The collision logic lives in the push engine, which needs Obsidian: covered by the manual check
- [x] Manual check in the throwaway Obsidian, on both instances:
  1. **Set Wiki.js destination** on a folder (try **Only notes that already have the property**), on a single note, and on a note set to `false` (asks first). Hand-edit a value to `/My Campaign` and push: warning naming the note, pushed under `/my-campaign`. **Exclude from Wiki.js** on a folder and a note
  2. Move a note to a sibling folder, then move a folder: destinations follow, one notice per move
  3. **Push notes marked for publishing**, then rename a note and push again: the page is moved, not duplicated. Push a note onto a page the plugin didn't create: the collisions modal opens; try **Skip**, **Replace the page** and **Exclude the note**
  4. Turn on **Push automatically**, edit a marked note: pushed after the delay, silently (status bar). Skip a collision: no modal on the next runs, a manual push asks again
  5. Push a new note that a pushed note links to, automatically: the other note's broken-link marker becomes a link

### M7 – Polish & release

- [ ] README: disclose network use and what is sent (Obsidian developer policies)
- [ ] Error messages reviewed
- [ ] Mobile smoke test
- [ ] Release 1.0.0 through the release workflow (Release Please: a `feat!:` commit or `Release-As: 1.0.0` in a commit body)

### M8 – Folder notes

> **Needs refinement before work starts.**

- [ ] Support the [Folder notes](https://lostpaul.github.io/obsidian-folder-notes/) plugin: a folder's note (e.g. `my/notes/notes.md` or `my/notes.md`, depending on its settings) becomes the page of the folder itself (`<destination>/my/notes`) instead of a child page
- [ ] Open points: detecting the plugin and reading its settings (note name and location), links to the folder note, what to do without the plugin

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
  commands/               push note / folder / marked notes, set destination / exclude, test connection, push test page (dev only)
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
  commands/index.ts       command and context menu registration
  convert/                Obsidian Markdown → Wiki.js Markdown (no Obsidian import)
    index.ts              convertMarkdown, referencedLinkpaths
    dialect.ts            per-version differences: heading ids, tag URLs, highlights, callouts
    callouts.ts           callout rewriting, line based, recursive for nested quotes
    segments.ts           splits code from text, drops %%comments%%
    inline.ts             links, embeds, tags, highlights, block ids
  publish/
    note.ts               note → PageInput: path mapping, title/description/tags from frontmatter (no Obsidian import)
    registry.ts           PushRegistry: wiki path of each pushed note, per wiki URL
    resolve.ts            link paths → pages (planned or registry) or uploaded attachments
    plan.ts               checks on planned paths (empty, duplicates)
    destinations.ts       publishing property values: parse, folder destinations, moves (no Obsidian import)
    property.ts           reads and writes the publishing property, marked notes → push items
    push.ts               push engine: plan (update / move / create / collision), ask, push; per-note results
    follow-moves.ts       updates destinations when notes move (batched)
    auto-push.ts          automatic push: queue, shared debounce timer, broken links healing, status
  ui/
    destination-modal.ts  asks where to push, with a page path preview
    notices.ts            pushed-page notice with a link, error message helper
    push-report.ts        result of a push: notice, or a modal listing failures, skipped notes and warnings
    collisions-modal.ts   what to do with pages in the way: replace, skip, exclude
    confirm-modal.ts      generic confirmation
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
	upsertPage(input: PageInput): Promise<RemotePage>; // shared: look up by path, then create or update
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
| Move a page | `pages.move(id, destinationPath, destinationLocale)` | `PUT /sites/:id/pages/:pageId/path` `{ path, updateLinks }` (`updateLinks` rewrites the links of other pages) |
| Server version | `system.info.currentVersion` | `/_api/system/info` refuses personal access tokens (403); the public OpenAPI spec has it (`info.version`, first bytes of a 512 KB document, `Range` ignored). Fetched by **Test connection** only |

Gotchas found on v2 (2.5.x):

- `pages.singleByPath` on a missing page returns `null` with a GraphQL error whose `extensions.exception.code` is `6003`.
- Mutations report failures in `responseResult { succeeded message }`, with HTTP 200 and no GraphQL error.
- `pages.update` fails with `Cannot read properties of undefined (reading 'map')` when `tags` is left out: always send it (the client does).
- `pages.update` **unpublishes the page** when `isPublished` is left out: always send `isPublished: true` (and `isPrivate: false`). Caught in manual testing; the integration tests now check that an updated page is still publicly readable.
- `POST /u` (multipart, field `mediaUpload` sent twice: `{"folderId":N}` then the file) only answers `ok`. Wiki.js lowercases the file name and replaces spaces with `_`, so read the stored name back with `assets.list(folderId)`. Same-name uploads overwrite.
- Asset folders: `assets.folders(parentFolderId)` and `assets.createFolder(parentFolderId, slug, name)` (slug is lowercased; creating an existing one fails with `succeeded: false`). Root folder id is `0`. Assets are served at `/<folder slugs>/<file name>`.

Both versions sanitize SVG files on upload (the stored file differs from the one sent).

### Callouts

Checked on the dev instances (2026-11-05) by rendering the same content on both:

- **v3** renders both `> text` + `{.is-info}` and GitHub alerts (`> [!NOTE]`, `[!TIP]`, `[!WARNING]`…), both as `<blockquote class="is-info">` (alerts add a `<p class="alert-title">` heading). Its Markdown editor toolbar inserts GitHub alerts, so that is the syntax v3 now favours.
- **v2** does not know GitHub alerts: `> [!NOTE]` renders as a plain blockquote with the literal text `[!NOTE]`. Only `{.is-info}` / `{.is-success}` / `{.is-warning}` / `{.is-danger}` work.

- **v3 alert types** (2026-11-05): `NOTE` → `is-info`, `TIP` → `is-success`, `IMPORTANT` → `is-important`, `WARNING` → `is-warning`, `CAUTION` → `is-danger`. Custom titles work (`> [!NOTE] Title`), and so do nested alerts. Any other type (e.g. `[!SUCCESS]`) renders as a broken plain quote.
- **v2 classes:** `is-info`, `is-success`, `is-warning`, `is-danger`. A `{.is-x}` line after the quote only works when the quote ends with a paragraph; a raw `<blockquote class="is-x">` with the Markdown inside separated by blank lines works everywhere (nested, with code blocks, inside lists).

Obsidian callouts (`> [!note]`, `> [!tip]-` foldable, custom titles, many types) are close to GitHub alerts, but types must be mapped onto the smaller set each version supports.

### Heading anchors

Ids are computed from the rendered heading text; a repeated heading gets `-1`, `-2`… (not handled by the plugin: links go to the first one).

- **v2** (`uslug`, in `server/modules/rendering/html-core/renderer.js`): NFKC, keeps letters, digits, combining marks and `-_~`, space separators become spaces, everything else is dropped; trimmed, runs of spaces and `-` become one `-`, lowercased. An id starting with a digit gets an `h-` prefix.
- **v3** (`slugifyHeading`, in `backend/models/rendering.ts`): lowercased, trimmed, keeps only letters, digits, whitespace and `-`, whitespace runs become `-`, repeated `-` collapsed and trimmed, cut at 100 characters; `section` when empty.

### Path constraint

v3 only allows letters, digits, `-`, `_`, spaces and `/` in paths: no dots. It lowercases paths and replaces spaces with hyphens on save. The plugin slugifies paths the same way for both versions: lowercase, spaces → `-`, other punctuation removed, `.md` dropped. So `test.md` becomes page `some/path/test`.

## Decisions

- **2026-11-04 – v3 rendering:** save the Markdown, then ask the server to render it (`POST .../render`). We don't bundle a Markdown renderer. If the instance has no Puppeteer (503), the plugin warns and the page stays unrendered until it is edited.
- **2026-11-04 – Credentials:** a single **API token** setting. It is an API key on v2 and a personal access token on v3. It is stored with Obsidian's secret storage.
- **2026-11-04 – Version:** auto-detection by default, with a manual override setting.
- **2026-11-05 – Page updates on v2** force `editor: "markdown"`, since the content sent is always Markdown. v3 leaves the editor alone (Markdown and Visual share one source).
- **2026-11-05 – File and folder names** are slugified by the plugin (`toWikiPath`, `toAssetFileName`) before being sent, so both versions store predictable names. The plugin still links to the name each server reports back.
- **2026-11-05 – Tooling:** esbuild bumped from 0.25.5 to 0.28.2 (required by vitest 5). Tests live in `tests/` (included in `tsconfig.json`, Obsidian lint rules relaxed there since they run in Node).
- **2026-11-05 – Releases:** Release Please (same workflow as the author's other projects), with the build done by Nix (`nix/packages/wikijs-publisher/`) so another CI (argunix) can take it over later. Tags have no leading `v` (Obsidian requirement). Versions start at `0.x` until M7's 1.0.0; until then the plugin is installed with BRAT. The sample's npm matrix lint workflow, Nix devshell workflow and tag-triggered release workflow were merged into `build-release.yaml`; `version-bump.mjs` and the empty `styles.css` were removed.
- **2026-11-05 – Single note push:** the frontmatter is parsed from the file content just read (`getFrontMatterInfo` + `parseYaml`), not from the metadata cache, which can lag behind recent edits. Invalid YAML fails the push with a clear message rather than pushing the raw block.
- **2026-11-05 – Links (M4):** links to notes resolve through a **push registry** (where each note was last pushed, per wiki URL, in `data.json`, kept up to date on vault renames). Notes never pushed to that wiki become their text plus a superscript `⛓️‍💥 broken link` marker (added 2026-11-06, so the reader sees a link was meant to be there). Pushing a note doesn't update the pages that link to it: push them again.
- **2026-11-05 – Attachments (M4):** uploaded to **one shared folder** (setting, default `attachments`) under their vault folder, so same-named files don't clash and v3 gets a single navigation entry. Uploaded on every push (same name overwrites).
- **2026-11-05 – Note embeds (M4):** become links to the embedded note, not inlined content.
- **2026-11-05 – Conversion without a Markdown parser:** a small scanner protects code (fences, inline spans) and drops comments; the rules are regexes on the remaining text, callouts are rewritten line by line. Keeps the bundle small and the behaviour easy to test. No regex lookbehind (unsupported on iOS < 16.4, enforced by the Obsidian lint rules).
- **2026-11-06 – Bulk push (M5):** notes found by the publishing property keep their vault folders under the destination, like a folder push from the vault root. Notes are pushed sequentially (gentle on the wiki, simple progress). If a note of the push fails, links to it from the others still point to its planned page.
- **2026-11-06 – Destinations (M6):** the publishing property holds the destination (see the M6 table). Values are written already slugified, and slugified again at push time with a warning when that changes them. Folder destinations leave out the clicked folder's own name.
- **2026-11-06 – Overwrites (M6):** the push registry decides: a page is overwritten silently only if this note pushed it; any other page in the way is a collision the user decides on. This replaces "Obsidian always wins" (which predates the registry). A note whose path changed has its page moved (keeping history; v3 also rewrites links to it).
- **2026-11-06 – Automatic push (M6):** one shared debounce timer, runs never overlap, the queue is saved in `data.json` for mobile (apps get suspended or killed in the background). Wiki unreachable: the notes go back in the queue and the error is shown once.
- **2026-11-04 – Page lookup:** pages are looked up by path on every push. No wiki ids are stored in the notes, so moving to another instance or from v2 to v3 doesn't leave stale ids.
