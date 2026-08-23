import json
import os
import shutil
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from api.oracle_real_connector import OracleRealConnector


def write_json(path, payload):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding='utf-8')


def main():
    output_dir = ROOT_DIR / 'web' / 'api'
    ords_static_dir = Path(os.getenv('ORDS_STATIC_DIR', '/home/ubuntu/vs-projects/oracle/software/apex-24.2/apex/images/gestion-commerciale'))
    connector = OracleRealConnector()

    resources = {
        'dashboard': connector.get_dashboard(),
        'customers': connector.get_customers(),
        'products': connector.get_products(),
        'orders': connector.get_orders(),
        'invoices': connector.get_invoices(),
        'payments': connector.get_payments(),
        'audit': connector.get_audit(),
    }

    for name, payload in resources.items():
        write_json(output_dir / f'{name}.json', payload)

    write_json(output_dir / 'status.json', {
        'source': 'oracle-snapshot',
        'resources': sorted(resources),
        'database': connector.health(),
    })

    if ords_static_dir.exists():
        target_dir = ords_static_dir / 'api'
        if target_dir.exists():
            shutil.rmtree(target_dir)
        shutil.copytree(output_dir, target_dir)

    print(f'Oracle snapshot exported to {output_dir}')


if __name__ == '__main__':
    main()
