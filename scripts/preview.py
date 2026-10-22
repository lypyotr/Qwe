"""Serve the GitHub Pages layout locally using only Python's standard library."""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit
import webbrowser

ROOT = Path(__file__).resolve().parent.parent


class PreviewHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_GET(self):
        path = unquote(urlsplit(self.path).path)
        if path in ('/', '/Qwe'):
            self.send_response(302)
            self.send_header('Location', '/Qwe/')
            self.end_headers()
            return
        if not path.startswith('/Qwe/'):
            self.send_error(404)
            return
        relative = path[len('/Qwe/'):]
        target = (ROOT / (relative or 'index.html')).resolve()
        if not target.is_relative_to(ROOT) or any(part.startswith('.') for part in Path(relative).parts):
            self.send_error(403)
            return
        if target.suffix.lower() not in {'.html', '.css', '.js', '.json', '.svg', '.png', '.jpg', '.webp', '.ico'}:
            self.send_error(404)
            return
        self.path = '/' + (relative or 'index.html')
        super().do_GET()

    def list_directory(self, path):
        self.send_error(403)
        return None

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()


def main():
    server = None
    for port in range(8765, 8775):
        try:
            server = ThreadingHTTPServer(('127.0.0.1', port), PreviewHandler)
            break
        except OSError:
            continue
    if server is None:
        raise SystemExit('Ports 8765-8774 are busy. Close an older preview and try again.')
    url = f'http://127.0.0.1:{server.server_port}/Qwe/'
    print(f'Preview: {url}\nKeep this window open. Press Ctrl+C to stop.')
    webbrowser.open(url)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == '__main__':
    main()
