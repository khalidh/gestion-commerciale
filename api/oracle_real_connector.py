import json
import os

try:
    import oracledb
except ImportError:
    oracledb = None

try:
    import cx_Oracle
except ImportError:
    cx_Oracle = None


class OracleRealConnector:
    def __init__(self, config_path=None):
        self.config_path = config_path or os.path.join(os.path.dirname(__file__), '..', 'oracle', 'connection_config.env')

    def load_config(self):
        config = {}
        if os.path.exists(self.config_path):
            with open(self.config_path, 'r', encoding='utf-8') as handle:
                for line in handle:
                    line = line.strip()
                    if not line or line.startswith('#'):
                        continue
                    if '=' in line:
                        key, value = line.split('=', 1)
                        config[key.strip()] = value.strip().strip('"').strip("'")

        for key in ('ORACLE_USER', 'ORACLE_PASSWORD', 'ORACLE_DSN', 'ORACLE_SCHEMA'):
            if os.getenv(key):
                config[key] = os.getenv(key)

        return config

    def driver_name(self):
        if oracledb is not None:
            return 'oracledb'
        if cx_Oracle is not None:
            return 'cx_Oracle'
        return None

    def connect(self):
        config = self.load_config()
        user = config.get('ORACLE_USER')
        password = config.get('ORACLE_PASSWORD')
        dsn = config.get('ORACLE_DSN')

        if not all([user, password, dsn]):
            raise RuntimeError('Missing Oracle connection values. Set ORACLE_USER, ORACLE_PASSWORD and ORACLE_DSN.')

        if oracledb is not None:
            return oracledb.connect(user=user, password=password, dsn=dsn)

        if cx_Oracle is not None:
            return cx_Oracle.connect(user=user, password=password, dsn=dsn)

        raise RuntimeError('Oracle Python driver not installed. Install python-oracledb with: python3 -m pip install oracledb')

    def fetch_all(self, sql, mapper):
        conn = self.connect()
        try:
            cursor = conn.cursor()
            cursor.execute(sql)
            return [mapper(row) for row in cursor.fetchall()]
        finally:
            conn.close()

    def fetch_json_value(self, sql):
        conn = self.connect()
        try:
            cursor = conn.cursor()
            cursor.execute(sql)
            row = cursor.fetchone()
            if not row:
                return {}
            value = row[0]
            if hasattr(value, 'read'):
                value = value.read()
            return json.loads(value)
        finally:
            conn.close()

    def get_dashboard(self):
        return self.fetch_json_value('SELECT pkg_reporting.dashboard_json() FROM dual')

    def get_customers(self):
        return self.fetch_all(
            'SELECT customer_id, customer_code, customer_name, customer_type, email, phone, status FROM customers ORDER BY customer_name',
            lambda row: {
                'customer_id': row[0],
                'customer_code': row[1],
                'customer_name': row[2],
                'customer_type': row[3],
                'email': row[4],
                'phone': row[5],
                'status': row[6]
            }
        )

    def get_products(self):
        return self.fetch_all(
            'SELECT product_id, product_code, product_name, unit_price, currency_code, status FROM products ORDER BY product_name',
            lambda row: {
                'product_id': row[0],
                'product_code': row[1],
                'product_name': row[2],
                'unit_price': float(row[3]),
                'currency_code': row[4],
                'status': row[5]
            }
        )

    def get_orders(self):
        return self.fetch_all(
            'SELECT sales_order_id, order_number, customer_name, order_status, total_amount, billing_status FROM v_sales_pipeline ORDER BY sales_order_id',
            lambda row: {
                'sales_order_id': row[0],
                'order_number': row[1],
                'customer_name': row[2],
                'order_status': row[3],
                'total_amount': float(row[4]),
                'billing_status': row[5]
            }
        )

    def get_invoices(self):
        return self.fetch_all(
            'SELECT invoice_id, invoice_number, sales_order_id, customer_name, total_amount, paid_amount, remaining_amount, invoice_status FROM v_invoice_balances ORDER BY invoice_id',
            lambda row: {
                'invoice_id': row[0],
                'invoice_number': row[1],
                'sales_order_id': row[2],
                'customer_name': row[3],
                'total_amount': float(row[4]),
                'paid_amount': float(row[5]),
                'remaining_amount': float(row[6]),
                'invoice_status': row[7]
            }
        )

    def get_payments(self):
        return self.fetch_all(
            'SELECT payment_id, invoice_id, payment_date, payment_amount, payment_method FROM payments ORDER BY payment_id',
            lambda row: {
                'payment_id': row[0],
                'invoice_id': row[1],
                'payment_date': row[2].isoformat() if hasattr(row[2], 'isoformat') else str(row[2]),
                'payment_amount': float(row[3]),
                'payment_method': row[4]
            }
        )

    def get_audit(self):
        return self.fetch_all(
            'SELECT audit_log_id, module_name, action_name, actor_name, action_details, created_at FROM audit_log ORDER BY audit_log_id DESC FETCH FIRST 50 ROWS ONLY',
            lambda row: {
                'audit_log_id': row[0],
                'module_name': row[1],
                'action_name': row[2],
                'actor_name': row[3],
                'action_details': str(row[4]) if row[4] is not None else None,
                'created_at': row[5].isoformat() if hasattr(row[5], 'isoformat') else str(row[5])
            }
        )

    def health(self):
        config = self.load_config()
        return {
            'status': 'ready' if self.driver_name() else 'missing-driver',
            'module': 'oracle-real-connector',
            'driver': self.driver_name(),
            'dsn_configured': bool(config.get('ORACLE_DSN')),
            'user_configured': bool(config.get('ORACLE_USER'))
        }


if __name__ == '__main__':
    connector = OracleRealConnector()
    try:
        result = connector.health()
        result['database'] = connector.fetch_json_value("SELECT JSON_OBJECT('db_name' VALUE SYS_CONTEXT('USERENV','DB_NAME'), 'session_user' VALUE SYS_CONTEXT('USERENV','SESSION_USER') RETURNING CLOB) FROM dual")
        print(json.dumps(result, indent=2))
    except Exception as exc:
        print(json.dumps({'status': 'error', 'message': str(exc), **connector.health()}, indent=2))
