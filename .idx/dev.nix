{ pkgs, ... }: {
  channel = "stable-23.11";
  packages = [
    pkgs.nodejs_20
    pkgs.python3
  ];
  idx = {
    previews = {
      enable = true;
      previews = {
        web = {
          command = ["python3" "-m" "http.server" "$PORT" "--bind" "0.0.0.0"];
          manager = "web";
        };
      };
    };
    workspace = {
      onCreate = {
        # files to open when the workspace is first opened.
        default.openFiles = [ "styles.css" "index.html" "script.js" ];
      };
    };
  };
}