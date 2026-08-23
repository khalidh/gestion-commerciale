# Backend APEX Oracle

Ce backend expose une API JSON qui peut être consommée par Oracle APEX ou tout autre client web.

## Endpoints
- GET /apex/backend/health
- GET /apex/backend/customers

## Lancement
```bash
python3 api/apex_backend.py
```

## Prérequis
- module cx_Oracle installé
- fichier oracle/connection_config.env correctement renseigné
