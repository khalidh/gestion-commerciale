# Phase 2 - Prototype Oracle/APEX enrichi

## Objectifs
- rapprocher le prototype navigateur d'un usage Oracle APEX,
- ajouter le reporting commercial et financier,
- tracer les operations metier critiques,
- exposer des endpoints JSON consommables par APEX ou un service externe.

## Livrables
1. Interface navigateur complete avec onglets metier et reporting.
2. Publication statique sous ORDS via `/i/gestion-commerciale/`.
3. Vues Oracle de pilotage : factures/soldes, pipeline commercial, dashboard.
4. Triggers d'audit sur clients, commandes, factures et paiements.
5. Package `pkg_reporting` pour produire un dashboard JSON.
6. Backend Python `apex_backend_pro.py` enrichi avec endpoints Phase 2.

## Flux couverts
- consulter les KPI du tableau de bord,
- creer client, produit et commande,
- generer une facture depuis une commande,
- enregistrer un paiement et solder une facture,
- consulter les soldes de facture,
- consulter le journal d'audit,
- exporter les factures au format CSV.

## URLs utiles
- Prototype ORDS : `http://164.132.64.7:8080/i/gestion-commerciale/index.html`
- Health backend : `http://127.0.0.1:5003/apex/backend/pro/health`
- Dashboard backend : `http://127.0.0.1:5003/apex/backend/pro/dashboard`
- Audit backend : `http://127.0.0.1:5003/apex/backend/pro/audit`

## Scripts Oracle
Executer apres la Phase 1 :

```sql
@sql/008_phase2_reporting_audit.sql
```

Le script ajoute :
- `v_invoice_balances`,
- `v_sales_pipeline`,
- `v_phase2_dashboard`,
- `pkg_reporting.dashboard_json`,
- les triggers d'audit applicatif.

Les transactions de demonstration Oracle sont chargees avec :

```sql
@sql/009_phase2_seed_transactions.sql
```
