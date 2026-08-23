#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "[1/3] Vérification du dépôt"
[[ -f README.md ]] || { echo "README.md manquant"; exit 1; }

echo "[2/3] Démarrage du service API"
if command -v python3 >/dev/null 2>&1; then
  python3 api/app.py > /tmp/gestion-commerciale-api.log 2>&1 &
  echo "Service API lancé en arrière-plan"
else
  echo "python3 introuvable"
  exit 1
fi

echo "[3/3] Déploiement terminé"
echo "API disponible sur http://127.0.0.1:5000/health"
