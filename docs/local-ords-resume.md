# Reprise locale Oracle / ORDS

État vérifié le 2026-10-02.

## Oracle

- Instance : Oracle AI Database 26ai Free, service `FREEPDB1`, port `1521`.
- Schéma applicatif : `CUSTOMER_APP`.
- La connexion Python réussit avec `session_user=CUSTOMER_APP` via `oracle/connection_config.env`.
- Le bootstrap a appliqué les scripts applicatifs. ORDS a ensuite été installé et `sql/010_phase3_ords_rest.sql` appliqué.
- Le mot de passe SYS a été changé via SQL*Plus local `SYSDBA`. Aucun mot de passe n'est conservé dans ce fichier.

## ORDS

- Version : `26.2.3.r2371104`, téléchargée depuis Oracle et vérifiée avec les sommes de contrôle officielles.
- Installation : `C:\app\Administrator\ords\26.2.3.237.1104`.
- Configuration et coffre du pool : `C:\app\Administrator\ords\config`.
- Pool `default` : validé pour `localhost:1521/FREEPDB1`.
- Fichiers web servis depuis `C:\app\Administrator\ords\static\gestion-commerciale`.
- ORDS est limité à `127.0.0.1:8080`.
- Oracle APEX `26.1.0` est installé et `VALID` dans `FREEPDB1`.
- Le workspace `GESTION-COMMERCIALE` existe. Il doit être associé au schéma `CUSTOMER_APP`; `SCHEMANAME` n'est pas le schéma métier.
- ORDS utilise `plsql.gateway.mode=proxied` sur le pool `default` pour APEX.
- Les images APEX sont servies depuis `C:\app\Administrator\apex_26.1\apex\images`.

Si le processus ORDS n'est plus actif, le relancer dans PowerShell :

```powershell
& 'C:\app\Administrator\ords\26.2.3.237.1104\bin\ords.exe' --config 'C:\app\Administrator\ords\config' serve --apex-images 'C:\app\Administrator\apex_26.1\apex\images' --document-root 'C:\app\Administrator\ords\static' --ip-addresses 127.0.0.1 --port 8080
```

Application : <http://127.0.0.1:8080/gestion-commerciale/index.html>
Connexion APEX : <http://127.0.0.1:8080/ords/r/apex/workspace-sign-in/oracle-apex-sign-in>

## Vérifications déjà passées

- `oracle/connect_oracle.py` : connecté à `FREEPDB1` sous `CUSTOMER_APP`.
- ORDS `config --db-pool default verify` : connexion valide, version ORDS installée détectée.
- Page statique : HTTP 200.
- API sans clé : HTTP 401.
- API `dashboard` avec la clé de développement présente dans `sql/011_phase3_security_auth.sql` : HTTP 200 et données métier.

## À faire avant tout accès réseau

Les clés API ne doivent pas être enregistrées dans Git. Le serveur est actuellement limité à localhost; remplacez les clés API avant de l'exposer sur le réseau. Les mots de passe SYS, `CUSTOMER_APP`, APEX et REST ainsi que le contenu de `oracle/connection_config.env` ne sont pas consignés ici.

Après modification des fichiers `web/`, recopier `index.html`, `app.js`, `styles.css`, `phase1_demo_data.json` et le dossier `api/` dans le répertoire statique ORDS ci-dessus.