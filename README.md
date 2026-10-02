# Gestion commerciale Oracle / APEX / PL/SQL / Python

Ce dépôt contient une base de travail complète pour une application de gestion commerciale orientée Oracle Database, Oracle APEX, PL/SQL, SQL et services Python.

## Vue d’ensemble

Le projet couvre :
- la définition d’architecture fonctionnelle et technique,
- le schéma de base de données Oracle,
- les packages PL/SQL métier,
- la structure d’une application APEX,
- un prototype web navigateur Phase 1/2,
- un service API Python,
- un backend APEX prêt à consommer des données,
- un guide de déploiement et de mise en route.

## Structure du dépôt

- docs/ : spécifications, SDLC, harnais IA, guide de déploiement
- sql/ : scripts SQL et PL/SQL pour la base de données
- apex/ : spécification et template de structure APEX
- web/ : interface navigateur Phase 1-3 avec authentification API key
- api/ : services Python et backend APEX
- oracle/ : configuration et script de connexion Oracle
- deploy/ : scripts de démarrage et de publication ORDS/APEX

## Démarrage rapide

### 1. Interface web Phase 1/2 via ORDS/APEX
```bash
./deploy/publish_static_to_ords.sh
```
Puis ouvrir :
```text
http://164.132.64.7:8080/i/gestion-commerciale/index.html
```

Cette version navigateur couvre les flux Phase 1, Phase 2 et Phase 3 : création de client, ajout de produit, création de commande, génération de facture, enregistrement de paiement, reporting, soldes de factures, journal d’audit, export CSV, endpoints ORDS transactionnels et snapshots Oracle.

Mise a jour production : l'acces ORDS est maintenant protege par cle API (`X-API-Key`) et controle de role (`APP_ADMIN`, `SALES_USER`, `FINANCE_USER`, `REPORT_USER`).

### 1 bis. Interface web locale de secours
```bash
./start.sh
```
Puis ouvrir, si le port 8000 est accessible depuis votre navigateur :
```text
http://127.0.0.1:8000/web/index.html
```

### 2. Service API Python
```bash
python3 api/app.py
```

### 3. Backend APEX pro
```bash
python3 api/apex_backend_pro.py
```
Sous Windows, après le bootstrap Oracle :
```powershell
.\.venv\Scripts\python.exe .\api\apex_backend_pro.py
```
Endpoints principaux :
- `/apex/backend/pro/health`
- `/apex/backend/pro/dashboard`
- `/apex/backend/pro/customers`
- `/apex/backend/pro/products`
- `/apex/backend/pro/orders`
- `/apex/backend/pro/invoices`
- `/apex/backend/pro/payments`
- `/apex/backend/pro/audit`

### 4. Base Oracle
Exécuter les scripts SQL dans l’ordre indiqué dans :
- docs/oracle-init-order.md

La Phase 2 ajoute les vues de reporting, le package `pkg_reporting` et les triggers d’audit avec :
- sql/008_phase2_reporting_audit.sql

La Phase 3 ajoute les endpoints ORDS transactionnels avec :
- sql/010_phase3_ords_rest.sql

Le hardening de securite Phase 3 (clients API, hash des cles, controle d'acces par role) est ajoute avec :
- sql/011_phase3_security_auth.sql

Index public ORDS Phase 3 :
```text
http://164.132.64.7:8080/ords/gestion-commerciale/gestion-commerciale/api/index
```

Exemples de ressources ORDS :
```text
http://164.132.64.7:8080/ords/gestion-commerciale/gestion-commerciale/api/dashboard
http://164.132.64.7:8080/ords/gestion-commerciale/gestion-commerciale/api/customers
http://164.132.64.7:8080/ords/gestion-commerciale/gestion-commerciale/api/orders
```

Pour appliquer les scripts sans `sqlplus`, utilisez :
```bash
export ORACLE_ADMIN_USER=system
export ORACLE_ADMIN_PASSWORD='votre_mot_de_passe_admin'
export ORACLE_ADMIN_DSN='//localhost:1521/FREEPDB1'
./oracle/bootstrap_app_schema.sh
```

Sous Windows avec Oracle Free, lancez le bootstrap PowerShell (DSN par défaut : `//localhost:1521/FREEPDB1`) :

```powershell
.\oracle\setup_windows.ps1
```

Il installe le driver dans `.venv`, crée le schéma `CUSTOMER_APP`, applique les scripts SQL et configure `oracle/connection_config.env` en local. Les mots de passe sont demandés dans le terminal. Vérifiez ensuite la connexion :

```powershell
.\.venv\Scripts\python.exe .\oracle\connect_oracle.py
```

Le backend Python peut alors accéder directement à Oracle. L'interface navigateur en mode Oracle requiert également qu'ORDS soit installé/configuré sur `FREEPDB1`, car ses routes de lecture et d'écriture utilisent ORDS.

Ce bootstrap applique les scripts de securite et enregistre les endpoints REST Phase 3 si ORDS est installé.

## Prototype OpenABAP / PostgreSQL

Une tranche séparée couvre les clients complets, produits avec statut, commandes multi-lignes avec validation/annulation, factures, paiements rapprochables/annulables, rapports et audit avec le transpileur ABAP OpenABAP, PostgreSQL et SAPUI5 desktop, sans modifier l’instance Oracle :

```powershell
npm --prefix open-abap-postgres install
npm --prefix open-abap-postgres run setup
npm --prefix open-abap-postgres run test:service
npm --prefix open-abap-postgres start
```

L’application SAPUI5 est servie sur <http://127.0.0.1:3000/>. Le prototype utilise un sous-ensemble ABAP transpilé, ce n’est pas le runtime RAP SAP. Voir `open-abap-postgres/README.md`.

## Sources SAP RAP Natives

Le dossier [sap-rap/README.md](sap-rap/README.md) contient la premiere tranche Clients/Produits pour SAP BTP ABAP Environment : tables actives et draft, CDS, comportements managed, classes de validation, projections et annotations Fiori Elements, definition de service et guide de creation du binding OData V4 dans ADT.

Ces sources sont distinctes du prototype local et ne sont pas encore compilees, activees ou deployees dans SAP. Les autorisations SAP, index uniques et tests runtime restent a configurer/verifier dans le tenant Trial. Les autres parcours commerciaux RAP et la migration de donnees restent a implementer.

## Authentification ORDS (production)

1. Appliquer `sql/011_phase3_security_auth.sql` puis `sql/010_phase3_ords_rest.sql`.
2. Le bootstrap ne cree pas de cles API par defaut. Enregistrez vos propres cles fortes (seules leurs empreintes sont stockees) :
```sql
BEGIN
	pkg_security.upsert_api_client('GC_ADMIN', 'Admin', 'APP_ADMIN', 'VOTRE_CLE_ADMIN_FORTE');
	pkg_security.upsert_api_client('GC_SALES', 'Sales', 'SALES_USER', 'VOTRE_CLE_SALES_FORTE');
	pkg_security.upsert_api_client('GC_FINANCE', 'Finance', 'FINANCE_USER', 'VOTRE_CLE_FINANCE_FORTE');
	pkg_security.upsert_api_client('GC_REPORT', 'Report', 'REPORT_USER', 'VOTRE_CLE_REPORT_FORTE');
	COMMIT;
END;
/
```
3. Appeler les endpoints ORDS avec l'entete `X-API-Key`.

Exemple :
```bash
curl -H 'X-API-Key: VOTRE_CLE_ADMIN_FORTE' \
	http://164.132.64.7:8080/ords/gestion-commerciale/gestion-commerciale/api/dashboard
```

Le driver Python Oracle est installé dans `.venv` avec :
```bash
./oracle/install_python_driver.sh
```

## Points forts

- architecture orientée Oracle / APEX / PL/SQL,
- séparation claire entre base, logique métier, interface et services,
- prêt pour l’évolution vers une intégration IA,
- compatible avec un usage local, une preuve de concept ou une première version de production.

## Notes
Ce depot reste une base de reference Oracle/APEX. Pour une mise en production finale, appliquer les controles reseau, le secret manager, la supervision et les procedures d'exploitation de votre SI.

La trace de conformite aux specifications est disponible dans `docs/spec-compliance-matrix.md`.
