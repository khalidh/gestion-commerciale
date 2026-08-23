# Ordre d'exécution Oracle

1. Initialiser l’utilisateur Oracle, les rôles et les grants de base avec un compte administrateur :
   - sql/006_oracle_init.sql
2. Exécuter le script de création du schéma de base :
   - sql/001_schema.sql
3. Exécuter les packages PL/SQL :
   - sql/002_packages.sql
   - sql/004_plsql_packages.sql
4. Exécuter le script de préparation APEX :
   - sql/003_apex_ready.sql
5. Charger les données de départ :
   - sql/005_seed_data.sql
6. Appliquer les objets Phase 1 :
   - sql/007_phase1_core.sql
7. Appliquer les objets Phase 2 :
   - sql/008_phase2_reporting_audit.sql
8. Charger les transactions de démonstration Phase 2 :
   - sql/009_phase2_seed_transactions.sql
9. Publier les endpoints ORDS Phase 3 :
   - sql/010_phase3_ords_rest.sql
10. Réexécuter l’initialisation pour créer les vues sécurisées et grants dépendants des tables :
   - sql/006_oracle_init.sql
11. Tester la connexion depuis :
   - oracle/connect_oracle.py
