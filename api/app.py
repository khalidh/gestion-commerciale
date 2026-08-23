from http.server import BaseHTTPRequestHandler, HTTPServer
import json
import os


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/health':
            payload = {"status": "ok", "service": "gestion-commerciale"}
            self._send_json(payload)
        elif self.path == '/customers':
            payload = [
                {"id": 1, "name": "Acme SA", "status": "ACTIVE"},
                {"id": 2, "name": "Globex", "status": "ACTIVE"}
            ]
            self._send_json(payload)
        elif self.path == '/orders':
            payload = [
                {"id": 1, "number": "ORD-001", "status": "VALIDATED", "total": 2500}
            ]
            self._send_json(payload)
        else:
            self._send_json({"error": "not found"}, status=404)

    def _send_json(self, payload, status=200):
        body = json.dumps(payload).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format, *args):
        return


def main():
    port = int(os.getenv('PORT', '5000'))
    server = HTTPServer(('0.0.0.0', port), Handler)
    print(f'Serving on port {port}')
    server.serve_forever()


if __name__ == '__main__':
    main()
