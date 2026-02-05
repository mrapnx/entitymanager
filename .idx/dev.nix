{ pkgs, ... }: {
  channel = "stable-24.05";
  packages = [
    pkgs.nodejs_20
  ];
  idx = {
    extensions = [
      "google.gemini-cli-vscode-ide-companion"
    ];
    workspace = {
      onCreate = {
        "npm-install" = "npm install";
      };
      onStart = {};
    };
    previews = {
      enable = true;
      previews = {
        web = {
          command = ["sh" "-c" "PORT=$PORT node src/index.js"];
          manager = "web";
        };
      };
    };
  };
}
