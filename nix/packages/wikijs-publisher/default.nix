{ pkgs, ... }:
let
  root = ../../..;
  packageJson = builtins.fromJSON (builtins.readFile (root + "/package.json"));
in
pkgs.buildNpmPackage {
  pname = packageJson.name;
  # Kept in sync with manifest.json by release-please
  version = packageJson.version;
  nodejs = pkgs.nodejs_24;

  # Only what the build, lint and unit tests read, so unrelated changes (dev environment, docs) don't trigger a rebuild
  src = pkgs.lib.fileset.toSource {
    inherit root;
    fileset = pkgs.lib.fileset.unions [
      (root + "/src")
      (root + "/tests")
      (root + "/esbuild.config.mjs")
      (root + "/eslint.config.mts")
      (root + "/manifest.json")
      (root + "/package.json")
      (root + "/package-lock.json")
      (root + "/tsconfig.json")
    ];
  };

  # Use importNpmLock so no hash needs to be computed manually.
  # Only package.json and package-lock.json are hashed, so changes to
  # other source files don't invalidate the dependency derivation.
  npmDeps = pkgs.importNpmLock {
    npmRoot = pkgs.lib.fileset.toSource {
      inherit root;
      fileset = pkgs.lib.fileset.unions [
        (root + "/package.json")
        (root + "/package-lock.json")
      ];
    };
  };
  npmConfigHook = pkgs.importNpmLock.npmConfigHook;

  # `npm run build` type-checks and bundles main.js
  doCheck = true;
  checkPhase = ''
    runHook preCheck
    npm run lint
    npm test
    runHook postCheck
  '';

  # The release artifacts Obsidian expects, at the top level
  installPhase = ''
    runHook preInstall
    mkdir -p "$out"
    cp main.js manifest.json "$out/"
    runHook postInstall
  '';
}
