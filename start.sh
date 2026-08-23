#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

# stop existing web server if any
pkill -f 'python3 -m http.server 8000' >/dev/null 2>&1 || true

echo "Prototype disponible sur http://127.0.0.1:8000/web/index.html"
echo "Depuis votre navigateur externe, essayez aussi http://164.132.64.7:8000/web/index.html"
python3 -m http.server 8000 --bind 0.0.0.0
