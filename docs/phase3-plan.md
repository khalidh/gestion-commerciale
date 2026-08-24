# Phase 3 - Transactions Oracle via ORDS

## Objectifs
- permettre les ecritures Oracle depuis une couche REST,
- exposer des endpoints ORDS proches d'une application APEX reelle,
- proteger les endpoints ORDS par authentification API key et roles,
- rafraichir les snapshots publics apres les operations metier.

## Livrables
1. Module ORDS `gestion-commerciale.phase3`.
2. Endpoints REST de lecture et d'ecriture.
3. Operations transactionnelles Oracle pour clients, commandes, factures et paiements.
4. Export de snapshots Oracle vers `/i/gestion-commerciale/api/*.json`.
5. Front navigateur capable d'appeler ORDS lorsque la source Oracle est active.
6. Controle d'acces par roles: APP_ADMIN, SALES_USER, FINANCE_USER, REPORT_USER.

## Endpoints ORDS
Base locale ORDS :

```text
http://127.0.0.1:8080/ords/gestion-commerciale/gestion-commerciale/api
```

Le chemin `/api` seul n'est pas une ressource ORDS et renvoie donc 404. Utiliser l'index JSON :

```text
http://164.132.64.7:8080/ords/gestion-commerciale/gestion-commerciale/api/index
```

Endpoints :
- `GET /index`
- `GET /dashboard`
- `GET /customers`
- `POST /customers`
- `GET /products`
- `GET /orders`
- `POST /orders`
- `POST /orders/:order_id/invoice`
- `GET /invoices`
- `GET /payments`
- `POST /payments`
- `GET /audit`

## Validation
- creation commande via ORDS : `201 Created`,
- generation facture via ORDS : `201 Created`,
- paiement via ORDS : `201 Created`,
- snapshots ORDS mis a jour apres export.

## Scripts
```bash
.venv/bin/python oracle/apply_sql.py sql/010_phase3_ords_rest.sql
curl -X POST http://127.0.0.1:5003/apex/backend/pro/snapshot/export
```