#!/bin/zsh

set -e

SCRIPT_DIR="${0:A:h}"
SITE_DIR="$SCRIPT_DIR/dist"

if [[ ! -f "$SITE_DIR/index.html" ]]; then
  osascript -e 'display alert "没有找到课程岛网页" message "请重新下载并完整解压安装包后再试。" as critical'
  exit 1
fi

if ! command -v python3 >/dev/null 2>&1; then
  osascript -e 'display alert "无法启动课程岛" message "这台 Mac 没有可用的 Python 3。你仍可以使用 GitHub Pages 在线版。" as critical'
  exit 1
fi

exec python3 -u - "$SITE_DIR" <<'PY'
import functools
import http.server
import os
import pathlib
import sys
import threading
import webbrowser

site_dir = pathlib.Path(sys.argv[1]).resolve()
handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(site_dir))
server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
url = f"http://127.0.0.1:{server.server_port}/"

print("课程岛已启动。关闭这个窗口即可停止本地服务。")
print(url)
if os.environ.get("COURSE_ISLAND_NO_BROWSER") != "1":
    threading.Timer(0.5, lambda: webbrowser.open(url)).start()

try:
    server.serve_forever()
except KeyboardInterrupt:
    pass
finally:
    server.server_close()
PY
