# Connexion Oracle

## Pré-requis
- Python 3
- module `oracledb`
- instance Oracle accessible (localement ou à distance)

## Installation
```bash
python3 -m pip install -r requirements.txt
```

Ou utilisez le script :

```bash
./oracle/install_python_driver.sh
```

Si `python3 -m pip` n’est pas disponible, installez d’abord `python3-pip` avec votre gestionnaire système ou utilisez un environnement Python qui fournit `pip`.

## Configuration
Copiez le fichier d'exemple et adaptez les valeurs :
```bash
cp oracle/connection_config.example.env oracle/connection_config.env
```

Puis exportez les variables :
```bash
export $(grep -v '^#' oracle/connection_config.env | xargs)
```

## Test de connexion
```bash
python3 oracle/connect_oracle.py
```

Le test affiche un JSON avec `status: connected` si la connexion Oracle est active, ou un diagnostic clair si le driver ou la configuration manque.

## Bootstrap du schéma applicatif

Le dépôt contient un bootstrap Python qui applique les scripts SQL sans dépendre de `sqlplus` :

```bash
export ORACLE_ADMIN_USER=system
export ORACLE_ADMIN_PASSWORD='votre_mot_de_passe_admin'
export ORACLE_ADMIN_DSN='//localhost:1521/FREEPDB1'
./oracle/bootstrap_app_schema.sh
```

Ne saisissez pas le mot de passe admin dans le chat. Exportez-le directement dans le terminal.

## Notes
- Ajustez `ORACLE_DSN` selon votre instance Oracle.
- Dans cet environnement ORDS utilise le service `FREEPDB1`, donc la valeur par défaut est `//localhost:1521/FREEPDB1`.
- Pour une vraie application APEX, la connexion se fait généralement via le schéma APEX et les objets DB du projet.
