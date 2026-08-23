#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ORDS_STATIC_DIR="${ORDS_STATIC_DIR:-/home/ubuntu/vs-projects/oracle/software/apex-24.2/apex/images/gestion-commerciale}"

mkdir -p "$ORDS_STATIC_DIR"

if [[ -x "$ROOT_DIR/.venv/bin/python" ]]; then
	"$ROOT_DIR/.venv/bin/python" "$ROOT_DIR/oracle/export_api_snapshot.py" || true
fi

cp "$ROOT_DIR/web/index.html" "$ORDS_STATIC_DIR/index.html"
cp "$ROOT_DIR/web/app.js" "$ORDS_STATIC_DIR/app.js"
cp "$ROOT_DIR/web/styles.css" "$ORDS_STATIC_DIR/styles.css"
cp "$ROOT_DIR/web/phase1_demo_data.json" "$ORDS_STATIC_DIR/phase1_demo_data.json"
if [[ -d "$ROOT_DIR/web/api" ]]; then
	rm -rf "$ORDS_STATIC_DIR/api"
	cp -R "$ROOT_DIR/web/api" "$ORDS_STATIC_DIR/api"
fi

echo "Prototype publie dans $ORDS_STATIC_DIR"
echo "URL: http://164.132.64.7:8080/i/gestion-commerciale/index.html"