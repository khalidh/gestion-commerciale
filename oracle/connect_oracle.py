import json
import os
import sys

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

from api.oracle_real_connector import OracleRealConnector


def main() -> None:
    connector = OracleRealConnector()
    try:
        conn = connector.connect()
        try:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT JSON_OBJECT(
                    'db_name' VALUE SYS_CONTEXT('USERENV','DB_NAME'),
                    'session_user' VALUE SYS_CONTEXT('USERENV','SESSION_USER'),
                    'driver' VALUE :driver_name
                    RETURNING CLOB
                )
                FROM dual
                """,
                driver_name=connector.driver_name()
            )
            row = cursor.fetchone()
            payload = row[0].read() if hasattr(row[0], 'read') else row[0]
            print(json.dumps({'status': 'connected', **json.loads(payload)}, indent=2))
        finally:
            conn.close()
    except Exception as exc:
        print(json.dumps({'status': 'error', 'message': str(exc), 'connector': connector.health()}, indent=2))
        raise SystemExit(1) from exc


if __name__ == "__main__":
    main()
