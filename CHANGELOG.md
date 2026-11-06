# Changelog

## [0.3.1](https://github.com/snyssen/obsidian-wikijs-publisher/compare/0.3.0...0.3.1) (2026-11-06)


### Bug Fixes

* improve error messages, especially in case of attachments too large ([0a618c4](https://github.com/snyssen/obsidian-wikijs-publisher/commit/0a618c4f810951b5a5c06ae2ebf4b19e405a9a6b))

## [0.3.0](https://github.com/snyssen/obsidian-wikijs-publisher/compare/0.2.0...0.3.0) (2026-11-06)


### Features

* add auto-sync (M6) ([90b95b5](https://github.com/snyssen/obsidian-wikijs-publisher/commit/90b95b583b41c342102bebc04c98ea4727f748df))


### Bug Fixes

* ensure a note set to be excluded from push is not pushed when one of its parent folder is ([40cfe82](https://github.com/snyssen/obsidian-wikijs-publisher/commit/40cfe82131a116d58035d708fbde8be40e9010b6))

## [0.2.0](https://github.com/snyssen/obsidian-wikijs-publisher/compare/0.1.0...0.2.0) (2026-11-06)


### Features

* add explicit "broken link" on links to notes that are not published or not found ([2216bde](https://github.com/snyssen/obsidian-wikijs-publisher/commit/2216bde62f0f7d67864a115a637fff2c29ff9c07))
* implement nulk push (M5) - allows for push by folder or by frontmatter property ([a289597](https://github.com/snyssen/obsidian-wikijs-publisher/commit/a2895971dd1c164f0b25f9ae160036160c7444d6))

## 0.1.0 (2026-11-05)


### Features

* add initial dev environment ([6dd04b9](https://github.com/snyssen/obsidian-wikijs-publisher/commit/6dd04b9640d21eb2515b60cd27263d5fcc93395b))
* add initial settings screen with connection test ([77868a0](https://github.com/snyssen/obsidian-wikijs-publisher/commit/77868a012dc161f7267da3b07b4907061efc7afa))
* Implement initial API layer and push test page to wikijs (M2) ([8c8d50a](https://github.com/snyssen/obsidian-wikijs-publisher/commit/8c8d50a432489de3fb382dd15f6b17e63e424e2c))
* implement markdown conversion (M4) ([e7bab7c](https://github.com/snyssen/obsidian-wikijs-publisher/commit/e7bab7cf419ecdb44380cc0dff0cb2d2e792091d))
* implement note push (M3) ([7f838c1](https://github.com/snyssen/obsidian-wikijs-publisher/commit/7f838c1442c575105d20fd5d03639df33d48d2e0))


### Bug Fixes

* clean sample code to fix lint issues and align it with v1.14.4 of Obsidian ([022fe9f](https://github.com/snyssen/obsidian-wikijs-publisher/commit/022fe9f276c16251aebead84b70d7a738b11472d))
* **deps:** prevent renovate from trying to update wikijs v2 to v3 since we specifically want to test against v2 and v3 ([6965452](https://github.com/snyssen/obsidian-wikijs-publisher/commit/6965452b21794c8ff65c7c4b05f4540747f10bb1))
