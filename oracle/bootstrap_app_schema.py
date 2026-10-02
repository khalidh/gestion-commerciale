import argparse
import getpass
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

import oracledb

from oracle.apply_sql import execute_script


APP_USER = 'CUSTOMER_APP'
APP_SCRIPTS = (
    'sql/001_schema.sql',
    'sql/002_packages.sql',
    'sql/004_plsql_packages.sql',
    'sql/005_seed_data.sql',
    'sql/007_phase1_core.sql',
    'sql/008_phase2_reporting_audit.sql',
    'sql/009_phase2_seed_transactions.sql',
    'sql/011_phase3_security_auth.sql',
)
ORDS_SCRIPT = 'sql/010_phase3_ords_rest.sql'


def prompt_password(prompt):
    password = getpass.getpass(prompt)
    if not password or '\n' in password or '\r' in password:
        raise ValueError('Le mot de passe doit être renseigné sur une seule ligne.')
    return password


def connect_admin(user, password, dsn):
    options = {
        'user': user,
        'password': password,
        'dsn': dsn,
    }
    if user.strip().upper() == 'SYS':
        options['mode'] = oracledb.AUTH_MODE_SYSDBA
    return oracledb.connect(**options)


def ords_package_available(connection):
        cursor = connection.cursor()
        cursor.execute(
                """
                SELECT COUNT(*)
                FROM dba_objects
                WHERE owner = 'ORDS_METADATA'
                    AND object_name = 'ORDS'
                    AND object_type = 'PACKAGE'
                    AND status = 'VALID'
                """
        )
        return cursor.fetchone()[0] > 0


def save_connection_config(path, dsn, app_password, overwrite):
    if path.exists() and not overwrite:
        raise FileExistsError(
            f'{path} existe déjà. Relancez avec --overwrite-config pour le remplacer.'
        )

    path.write_text(
        '\n'.join((
            f'ORACLE_USER={APP_USER}',
            f'ORACLE_PASSWORD={app_password}',
            f'ORACLE_DSN={dsn}',
            f'ORACLE_SCHEMA={APP_USER}',
            '',
        )),
        encoding='utf-8',
    )


def main():
    parser = argparse.ArgumentParser(
        description='Initialise le schéma de gestion commerciale dans Oracle Free.'
    )
    parser.add_argument('--dsn', default='//localhost:1521/FREEPDB1')
    parser.add_argument('--admin-user', default='SYSTEM')
    parser.add_argument('--overwrite-config', action='store_true')
    args = parser.parse_args()

    config_path = ROOT_DIR / 'oracle' / 'connection_config.env'
    if config_path.exists() and not args.overwrite_config:
        parser.error(
            f'{config_path} existe déjà. Utilisez --overwrite-config pour le remplacer.'
        )

    admin_password = prompt_password(f'Mot de passe Oracle pour {args.admin_user}: ')
    app_password = prompt_password(f'Nouveau mot de passe pour {APP_USER}: ')
    if app_password != prompt_password(f'Confirmez le mot de passe {APP_USER}: '):
        raise SystemExit(f'Les mots de passe {APP_USER} ne correspondent pas.')

    api_admin_key = None
    with connect_admin(args.admin_user, admin_password, args.dsn) as connection:
        count = execute_script(connection, 'sql/006_oracle_init.sql')
        print(f'OK sql/006_oracle_init.sql: {count} instructions')

        escaped_password = app_password.replace('"', '""')
        cursor = connection.cursor()
        cursor.execute(f'ALTER USER {APP_USER} IDENTIFIED BY "{escaped_password}"')
        connection.commit()

    with oracledb.connect(
        user=APP_USER,
        password=app_password,
        dsn=args.dsn,
    ) as connection:
        save_connection_config(config_path, args.dsn, app_password, args.overwrite_config)
        for script in APP_SCRIPTS:
            count = execute_script(connection, script)
            print(f'OK {script}: {count} instructions')

    with connect_admin(args.admin_user, admin_password, args.dsn) as connection:
        count = execute_script(connection, 'sql/006_oracle_init.sql')
        print(f'OK sql/006_oracle_init.sql (grants finaux): {count} instructions')
        has_ords = ords_package_available(connection)
        if has_ords:
            api_admin_key = prompt_password('Nouvelle cle API pour GC_ADMIN: ')
            if api_admin_key != prompt_password('Confirmez la cle API GC_ADMIN: '):
                raise SystemExit('Les cles API GC_ADMIN ne correspondent pas.')

    if has_ords:
        with oracledb.connect(
            user=APP_USER,
            password=app_password,
            dsn=args.dsn,
        ) as connection:
            count = execute_script(connection, ORDS_SCRIPT)
            print(f'OK {ORDS_SCRIPT}: {count} instructions')
            cursor = connection.cursor()
            cursor.callproc('pkg_security.upsert_api_client', [
                'GC_ADMIN',
                'Gestion Commerciale Admin',
                'APP_ADMIN',
                api_admin_key,
                None,
            ])
            connection.commit()
            print('Cle API GC_ADMIN enregistree sous forme de hash uniquement.')
    else:
        print(f'SKIP {ORDS_SCRIPT}: ORDS n’est pas installé dans cette base.')

    print(f'Connexion applicative configurée dans {config_path}')
    print('Initialisation Oracle terminée.')


if __name__ == '__main__':
    try:
        main()
    except Exception as exc:
        raise SystemExit(f'Échec du bootstrap Oracle: {exc}') from exc