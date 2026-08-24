# Matrice de conformite aux specifications

## Portee
Ce document trace la couverture des exigences de [docs/specifications-app.md](docs/specifications-app.md).

## Exigences fonctionnelles

| Exigence | Statut | Evidence |
| --- | --- | --- |
| Gestion clients (creer/consulter, statut) | Couverte | sql/001_schema.sql, sql/002_packages.sql (pkg_customer), web/app.js, sql/010_phase3_ords_rest.sql |
| Gestion produits (catalogue, prix, statut) | Couverte | sql/001_schema.sql, sql/002_packages.sql (pkg_product), web/app.js, sql/010_phase3_ords_rest.sql |
| Gestion commandes (creation, lignes, validation) | Couverte | sql/002_packages.sql (pkg_sales), sql/004_plsql_packages.sql, sql/010_phase3_ords_rest.sql |
| Facturation (generation et statut) | Couverte | sql/002_packages.sql (pkg_invoice), sql/010_phase3_ords_rest.sql, web/app.js |
| Paiements (encaissements, soldes, mode) | Couverte | sql/002_packages.sql (pkg_payment), sql/008_phase2_reporting_audit.sql, sql/010_phase3_ords_rest.sql |
| Reporting KPI et export CSV | Couverte | sql/008_phase2_reporting_audit.sql, web/app.js |
| Journalisation operations sensibles | Couverte | sql/008_phase2_reporting_audit.sql (audit), sql/006_oracle_init.sql |

## Exigences non fonctionnelles

| Exigence | Statut | Evidence |
| --- | --- | --- |
| Fiabilite transactionnelle | Couverte | Packages PL/SQL transactionnels, handlers ORDS PL/SQL |
| Securite roles/permissions | Couverte | sql/006_oracle_init.sql, sql/011_phase3_security_auth.sql, sql/010_phase3_ords_rest.sql |
| Performance de base | Partiellement couverte | Vues/reporting optimises en SQL; tuning index avance a valider sur volumetrie reelle |
| Tracabilite | Couverte | table audit_log + vues/reporting + endpoint audit |

## APEX

| Exigence APEX | Statut | Evidence |
| --- | --- | --- |
| Specification des pages APEX | Couverte | apex/apex-application-spec.md |
| Application APEX complete exportable (pages/processus/rubriques) | Partiellement couverte | Base ORDS + scripts SQL disponibles; import APEX final a industrialiser selon environnement |

## Actions residuelles avant go-live strict

1. Charger les cles API definitives par environnement via `pkg_security.upsert_api_client`.
2. Brancher les secrets Oracle/API sur un secret manager (Vault/KMS).
3. Ajouter des tests d'integration Oracle automatiques en environnement CI connecte a une base de test.
4. Finaliser et versionner un export Oracle APEX complet cible production.
