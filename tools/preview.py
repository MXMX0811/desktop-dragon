"""Run the delivered animation preview: python3 tools/preview.py."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]

class PreviewHandler(SimpleHTTPRequestHandler):
    def translate_path(self, path):
        if urlsplit(path).path.startswith("/assets/"):
            directory = self.directory
            self.directory = str(ROOT / "assets")
            try:
                return super().translate_path(path[len("/assets"):])
            finally:
                self.directory = directory
        return super().translate_path(path)

    def send_head(self):
        del self.headers["If-Modified-Since"]
        return super().send_head()

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

if __name__ == "__main__":
    handler = partial(PreviewHandler, directory=ROOT / "app")
    with ThreadingHTTPServer(("127.0.0.1", 55888), handler) as server:
        print("http://127.0.0.1:55888/runtime/index.html", flush=True)
        server.serve_forever()
