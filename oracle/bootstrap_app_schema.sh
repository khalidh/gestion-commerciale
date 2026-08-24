#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [[ ! -x .venv/bin/python ]]; then
  python3 -m venv .venv
fi

.venv/bin/python -m pip install -r requirements.txt

if [[ -z "${ORACLE_ADMIN_USER:-}" || -z "${ORACLE_ADMIN_PASSWORD:-}" ]]; then
  echo "Definissez ORACLE_ADMIN_USER et ORACLE_ADMIN_PASSWORD dans le terminal avant de lancer ce script."
  echo "Exemple :"
  echo "export ORACLE_ADMIN_USER=system"
  echo "export ORACLE_ADMIN_PASSWORD='votre_mot_de_passe'"
  echo "export ORACLE_ADMIN_DSN='//localhost:1521/FREEPDB1'"
  exit 1
fi

.venv/bin/python oracle/apply_sql.py --admin sql/006_oracle_init.sql
.venv/bin/python oracle/apply_sql.py \
  sql/001_schema.sql \
  sql/002_packages.sql \
  sql/004_plsql_packages.sql \
  sql/005_seed_data.sql \
  sql/007_phase1_core.sql \
  sql/008_phase2_reporting_audit.sql \
  sql/009_phase2_seed_transactions.sql \
  sql/011_phase3_security_auth.sql \
  sql/010_phase3_ords_rest.sql
.venv/bin/python oracle/apply_sql.py --admin sql/006_oracle_init.sql
.venv/bin/python oracle/connect_oracle.py