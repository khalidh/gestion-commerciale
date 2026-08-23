import json
from http.server import BaseHTTPRequestHandler, HTTPServer
import os
import sys

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

from api.oracle_real_connector import OracleRealConnector


class ApexBackendHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/apex/backend/health':
            payload = {'status': 'ok', 'module': 'apex-backend'}
            self._send_json(payload)
        elif self.path == '/apex/backend/customers':
            connector = OracleRealConnector()
            try:
                payload = connector.get_customers()
            except Exception as exc:
                payload = {'error': str(exc)}
            self._send_json(payload)
        else:
            self._send_json({'error': 'not found'}, status=404)

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
    port = int(os.getenv('APEX_BACKEND_PORT', '5002'))
    server = HTTPServer(('0.0.0.0', port), ApexBackendHandler)
    print(f'Apex backend serving on port {port}')
    server.serve_forever()


if __name__ == '__main__':
    main()
