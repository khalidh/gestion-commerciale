# Backend APEX Pro

Cette version étend le backend APEX avec un mode de secours local et un accès préparé à Oracle via le connecteur.

## Endpoints
- GET /apex/backend/pro/health
- GET /apex/backend/pro/customers
- GET /apex/backend/pro/orders

## Lancement
```bash
python3 api/apex_backend_pro.py
```

## Comportement
- si Oracle est configuré, la route `/customers` tente de lire les données depuis Oracle,
- sinon elle retourne un fallback local et explicite l’erreur.
