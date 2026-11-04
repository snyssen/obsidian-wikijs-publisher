{ pkgs }:
pkgs.mkShell {
  # Add build dependencies
  packages = with pkgs; [
    nixfmt
    nixd
    just
    pre-commit
    # Plugin build
    nodejs_24
    # Wiki.js seeding (Docker itself is expected from the host)
    curl
    jq
    # Throwaway Obsidian instance for testing
    obsidian
  ];

  # Add environment variables
  env = {
    # Pinned copy of https://github.com/pjeby/hot-reload, installed in the dev vault by `just vault-setup`
    HOT_RELOAD_PLUGIN = pkgs.fetchFromGitHub {
      owner = "pjeby";
      repo = "hot-reload";
      rev = "4c5454963ec4cbe847302d3063ada4b4204d7e95"; # 0.3.1
      hash = "sha256-h1368UEB2wiRyi+cOHWp67go4ICaORMw2UIIDkuWer8=";
    };
  };

  # Load custom bash code
  shellHook = ''
    echo -e "This devshell uses '\e[32;1mjust\e[0m' as a task runner."
    just --list
    echo -e "\e[0;95mNOTE:\e[0m If this is your first time on this repo, running '\e[32;1mjust setup\e[0m' is recommended in order to initialize the development environment."
  '';
}
