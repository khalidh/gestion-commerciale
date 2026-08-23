# Guide de déploiement Oracle + APEX + Python

## 1. Objectif
Ce guide décrit la manière de préparer, déployer et faire tourner l’application de gestion commerciale dans un environnement orienté Oracle Database, Oracle APEX et services Python.

## 2. Prérequis
- instance Oracle accessible
- Oracle APEX installé ou disponible
- Python 3.x
- accès au schéma Oracle cible
- réseau permettant l’accès entre les composants

## 3. Préparation de la base Oracle
1. Créer ou utiliser un schéma applicatif.
2. Exécuter les scripts SQL dans cet ordre :
   - sql/001_schema.sql
   - sql/002_packages.sql
   - sql/003_apex_ready.sql
   - sql/004_plsql_packages.sql
   - sql/005_seed_data.sql
   - sql/006_oracle_init.sql
3. Vérifier que les tables et packages ont bien été créés.

## 4. Configuration de la connexion Oracle
1. Copier l’exemple de configuration :
   ```bash
   cp oracle/connection_config.example.env oracle/connection_config.env
   ```
2. Renseigner les variables :
   - ORACLE_USER
   - ORACLE_PASSWORD
   - ORACLE_DSN
3. Tester la connexion :
   ```bash
   python3 oracle/connect_oracle.py
   ```

## 5. Déploiement de l’interface web
Le prototype navigateur est disponible dans :
- web/index.html

Pour le servir localement :
```bash
cd /home/ubuntu/vs-projects/oracle/gestion-commerciale
python3 -m http.server 8000
```
Puis ouvrir :
```text
http://127.0.0.1:8000/web/index.html
```

## 6. Déploiement des services Python
### Service principal
```bash
python3 api/app.py
```

### API APEX
```bash
python3 api/apex_api.py
```

### Backend APEX pro
```bash
python3 api/apex_backend_pro.py
```

## 7. Vérifications post-déploiement
- vérifier la santé du service principal :
  ```bash
  curl http://127.0.0.1:5000/health
  ```
- vérifier l’API APEX :
  ```bash
  curl http://127.0.0.1:5001/apex/health
  ```
- vérifier le backend APEX pro :
  ```bash
  curl http://127.0.0.1:5003/apex/backend/pro/health
  ```

## 8. Intégration Oracle APEX
1. Créer une application APEX.
2. Utiliser les pages décrites dans apex/apex-application-spec.md.
3. Brancher les écrans sur les schémas et objets Oracle.
4. Consommer les APIs Python si nécessaire pour les services externes ou IA.

## 9. Bonnes pratiques
- séparer les environnements DEV / TEST / PROD,
- garder les scripts SQL versionnés,
- journaliser les opérations critiques,
- sécuriser l’accès aux services Python et à Oracle.
