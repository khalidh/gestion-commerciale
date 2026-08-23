import json
import os
import sys
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import urlparse

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

from api.oracle_real_connector import OracleRealConnector
from oracle.export_api_snapshot import main as export_api_snapshot


DEMO_DATA_PATH = os.path.join(ROOT_DIR, 'web', 'phase1_demo_data.json')


def load_demo_data():
    with open(DEMO_DATA_PATH, 'r', encoding='utf-8') as handle:
        return json.load(handle)


def format_demo_payload(data):
    customers = data.get('customers', [])
    products = data.get('products', [])
    orders = data.get('orders', [])
    invoices = data.get('invoices', [])
    payments = data.get('payments', [])

    paid_amount = sum(float(payment.get('amount', 0)) for payment in payments)
    invoiced_amount = sum(float(invoice.get('amount', 0)) for invoice in invoices)
    open_invoices = [invoice for invoice in invoices if invoice.get('status') != 'PAID']

    return {
        'dashboard': {
            'active_customers': len([customer for customer in customers if customer.get('status') == 'ACTIVE']),
            'active_products': len([product for product in products if product.get('status') == 'ACTIVE']),
            'order_count': len(orders),
            'invoice_count': len(invoices),
            'invoiced_amount': invoiced_amount,
            'paid_amount': paid_amount,
            'outstanding_amount': max(invoiced_amount - paid_amount, 0)
        },
        'customers': customers,
        'products': products,
        'orders': orders,
        'invoices': invoices,
        'payments': payments,
        'audit': data.get('auditLog', []),
        'open_invoices': open_invoices
    }


class ApexBackendProHandler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(204)
        self._send_cors_headers()
        self.end_headers()

    def do_GET(self):
        path = urlparse(self.path).path

        if path == '/apex/backend/pro/health':
            self._send_json({'status': 'ok', 'module': 'apex-backend-pro', 'oracle': OracleRealConnector().health()})
        elif path == '/apex/backend/pro/dashboard':
            self._send_json(self._get_dashboard())
        elif path == '/apex/backend/pro/customers':
            self._send_json(self._oracle_or_demo('customers', lambda connector: connector.get_customers()))
        elif path == '/apex/backend/pro/products':
            self._send_json(self._oracle_or_demo('products', lambda connector: connector.get_products()))
        elif path == '/apex/backend/pro/orders':
            self._send_json(self._oracle_or_demo('orders', lambda connector: connector.get_orders()))
        elif path == '/apex/backend/pro/invoices':
            self._send_json(self._oracle_or_demo('invoices', lambda connector: connector.get_invoices()))
        elif path == '/apex/backend/pro/payments':
            self._send_json(self._oracle_or_demo('payments', lambda connector: connector.get_payments()))
        elif path == '/apex/backend/pro/audit':
            self._send_json(self._oracle_or_demo('audit', lambda connector: connector.get_audit()))
        else:
            self._send_json({'error': 'not found'}, status=404)

    def do_POST(self):
        path = urlparse(self.path).path

        if path == '/apex/backend/pro/snapshot/export':
            try:
                export_api_snapshot()
                self._send_json({'status': 'ok', 'message': 'oracle snapshot exported'})
            except Exception as exc:
                self._send_json({'status': 'error', 'message': str(exc)}, status=500)
        else:
            self._send_json({'error': 'not found'}, status=404)

    def _get_dashboard(self):
        try:
            return OracleRealConnector().get_dashboard()
        except Exception as exc:
            payload = format_demo_payload(load_demo_data())['dashboard']
            payload['source'] = 'demo-fallback'
            payload['oracle_error'] = str(exc)
            return payload

    def _oracle_or_demo(self, resource_name, loader):
        try:
            connector = OracleRealConnector()
            return loader(connector)
        except Exception as exc:
            return {
                'source': 'demo-fallback',
                'oracle_error': str(exc),
                'items': format_demo_payload(load_demo_data())[resource_name]
            }

    def _send_json(self, payload, status=200):
        body = json.dumps(payload).encode('utf-8')
        self.send_response(status)
        self._send_cors_headers()
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _send_cors_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')

    def log_message(self, format, *args):
        return


def main():
    port = int(os.getenv('APEX_BACKEND_PRO_PORT', '5003'))
    server = HTTPServer(('0.0.0.0', port), ApexBackendProHandler)
    print(f'Apex backend pro serving on port {port}')
    server.serve_forever()


if __name__ == '__main__':
    main()
