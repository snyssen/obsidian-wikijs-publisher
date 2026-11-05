# Default package (`nix build`): the plugin, defined in packages/wikijs-publisher/
{ perSystem, ... }:
perSystem.self.wikijs-publisher
