# Backend APEX Pro

Cette version etend le backend APEX avec un mode de secours local, un acces Oracle via connecteur et des controles de securite pre-production.

## Endpoints
- GET /apex/backend/pro/health
- GET /apex/backend/pro/dashboard
- GET /apex/backend/pro/customers
- GET /apex/backend/pro/products
- GET /apex/backend/pro/orders
- GET /apex/backend/pro/invoices
- GET /apex/backend/pro/payments
- GET /apex/backend/pro/audit
- POST /apex/backend/pro/snapshot/export

## Lancement
```bash
python3 api/apex_backend_pro.py
```

## Securite
- Auth active par defaut: `API_AUTH_REQUIRED=true`
- Entetes requis: `X-Api-Role` et `X-Api-Token`
- Tokens par role configures via `API_AUTH_TOKENS`
- Erreurs internes masquees en mode production (`API_DEBUG_ERRORS=false`)

## Comportement
- si Oracle est configure, les routes tentent de lire les donnees depuis Oracle,
- sinon elles retournent un fallback local sans exposer les details sensibles en production,
- les roles sont verifies selon le module (sales, finance, report, admin).
