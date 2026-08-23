import json
from http.server import BaseHTTPRequestHandler, HTTPServer
import os


class ApexAPIHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/apex/health':
            payload = {"status": "ok", "module": "apex-api"}
            self._send_json(payload)
        elif self.path == '/apex/customers':
            payload = [
                {"customer_id": 1, "customer_name": "Acme SA", "status": "ACTIVE"},
                {"customer_id": 2, "customer_name": "Globex", "status": "ACTIVE"}
            ]
            self._send_json(payload)
        elif self.path == '/apex/orders':
            payload = [
                {"sales_order_id": 1, "order_number": "ORD-001", "order_status": "VALIDATED", "total_amount": 2500}
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
    port = int(os.getenv('APEX_API_PORT', '5001'))
    server = HTTPServer(('0.0.0.0', port), ApexAPIHandler)
    print(f'Apex API serving on port {port}')
    server.serve_forever()


if __name__ == '__main__':
    main()
