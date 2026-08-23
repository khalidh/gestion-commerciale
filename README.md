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
- web/ : prototype navigateur sans authentification
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

Cette version navigateur couvre les flux Phase 1, Phase 2 et Phase 3 : création de client, ajout de produit, création de commande, génération de facture, enregistrement de paiement, reporting, soldes de factures, journal d’audit, export CSV, endpoints ORDS transactionnels et snapshots Oracle. Elle ne contient aucune authentification.

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
Ce dépôt est conçu comme une base de travail et une architecture de référence, pas comme une application finale prête à l’emploi sans adaptation à votre environnement Oracle.
