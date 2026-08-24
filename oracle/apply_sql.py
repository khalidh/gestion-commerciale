import argparse
import os
import re
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

try:
    import oracledb
except ImportError as exc:
    raise SystemExit('oracledb is not installed. Run: .venv/bin/python -m pip install -r requirements.txt') from exc


def read_env_file(path):
    config = {}
    if path.exists():
        for line in path.read_text(encoding='utf-8').splitlines():
            line = line.strip()
            if not line or line.startswith('#') or '=' not in line:
                continue
            key, value = line.split('=', 1)
            config[key.strip()] = value.strip().strip('"').strip("'")
    return config


def connection_from_env(prefix='ORACLE'):
    config = read_env_file(ROOT_DIR / 'oracle' / 'connection_config.env')
    if prefix == 'ORACLE_ADMIN':
        user = os.getenv('ORACLE_ADMIN_USER')
        password = os.getenv('ORACLE_ADMIN_PASSWORD')
        dsn = os.getenv('ORACLE_ADMIN_DSN') or os.getenv('ORACLE_DSN') or config.get('ORACLE_DSN')
    else:
        user = os.getenv('ORACLE_USER') or config.get('ORACLE_USER')
        password = os.getenv('ORACLE_PASSWORD') or config.get('ORACLE_PASSWORD')
        dsn = os.getenv('ORACLE_DSN') or config.get('ORACLE_DSN')
    if not user or not password or not dsn:
        raise RuntimeError(f'Missing {prefix}_USER, {prefix}_PASSWORD or {prefix}_DSN')
    return oracledb.connect(user=user, password=password, dsn=dsn)


def strip_sqlplus_lines(script):
    lines = []
    for line in script.splitlines():
        stripped = line.strip()
        upper = stripped.upper()
        if not stripped:
            lines.append(line)
            continue
        if upper.startswith(('PROMPT ', 'SHOW ', 'SPOOL ', 'WHENEVER ')):
            continue
        if upper.startswith('SET ') and upper.split()[1] in {'DEFINE', 'SERVEROUTPUT', 'ECHO', 'FEEDBACK', 'VERIFY'}:
            continue
        lines.append(line)
    return '\n'.join(lines)


def split_statements(script):
    script = strip_sqlplus_lines(script)
    statements = []
    buffer = []
    in_plsql = False

    for line in script.splitlines():
        stripped = line.strip()
        upper = stripped.upper()

        # SQL*Plus delimiter line: ignore when outside a PL/SQL block.
        if stripped == '/' and not in_plsql:
            continue

        if re.match(r'^CREATE\s+OR\s+REPLACE\s+(PACKAGE|TRIGGER|PROCEDURE|FUNCTION)\b', upper) or upper.startswith('DECLARE') or upper.startswith('BEGIN'):
            in_plsql = True

        if in_plsql and stripped == '/':
            statement = '\n'.join(buffer).strip()
            if statement:
                statements.append(statement)
            buffer = []
            in_plsql = False
            continue

        if not in_plsql and stripped.endswith(';'):
            buffer.append(line.rstrip().rstrip(';'))
            statement = '\n'.join(buffer).strip()
            if statement:
                statements.append(statement)
            buffer = []
            continue

        buffer.append(line)

    remaining = '\n'.join(buffer).strip()
    if remaining:
        statements.append(remaining.rstrip(';'))
    return statements


def is_idempotent_error(exc):
    message = str(exc)
    return any(code in message for code in (
        'ORA-00955',
        'ORA-01408',
        'ORA-01430',
        'ORA-02260',
        'ORA-02261',
        'ORA-02264',
    ))


def execute_script(connection, script_path):
    path = Path(script_path)
    if not path.is_absolute():
        path = ROOT_DIR / path
    statements = split_statements(path.read_text(encoding='utf-8'))
    cursor = connection.cursor()
    for index, statement in enumerate(statements, start=1):
        try:
            cursor.execute(statement)
        except Exception as exc:
            if is_idempotent_error(exc):
                print(f'SKIP {path.name} statement {index}: {str(exc).splitlines()[0]}')
                continue
            raise RuntimeError(f'{path.name}, statement {index} failed: {exc}\n{statement[:500]}') from exc
    connection.commit()
    return len(statements)


def main():
    parser = argparse.ArgumentParser(description='Apply project SQL scripts through python-oracledb.')
    parser.add_argument('scripts', nargs='+', help='SQL scripts to execute')
    parser.add_argument('--admin', action='store_true', help='Use ORACLE_ADMIN_USER/PASSWORD/DSN instead of application credentials')
    args = parser.parse_args()

    prefix = 'ORACLE_ADMIN' if args.admin else 'ORACLE'
    with connection_from_env(prefix) as connection:
        for script in args.scripts:
            count = execute_script(connection, script)
            print(f'OK {script}: {count} statements')


if __name__ == '__main__':
    main()
