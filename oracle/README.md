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

Sous Windows, le script PowerShell crée un environnement virtuel, installe le driver Oracle, initialise le schéma dans `FREEPDB1` et demande les mots de passe sans les afficher :

```powershell
.\oracle\setup_windows.ps1
```

Si ORDS est installé, le bootstrap demande aussi deux fois une clé API `GC_ADMIN`. Seule son empreinte est stockée dans Oracle; la clé n'est pas écrite dans le dépôt.

Par défaut, le DSN est `//localhost:1521/FREEPDB1` et l'utilisateur administrateur est `SYSTEM`. Ils peuvent être adaptés :

```powershell
.\oracle\setup_windows.ps1 -Dsn "//localhost:1521/FREEPDB1" -AdminUser SYSTEM
```

Si vous utilisez le compte `SYS`, le bootstrap se connecte automatiquement avec le mode `SYSDBA` :

```powershell
.\oracle\setup_windows.ps1 -AdminUser SYS
```

Le script crée/configure `CUSTOMER_APP`, applique les scripts SQL et écrit les paramètres de connexion dans `oracle/connection_config.env`, fichier local exclu de Git. Pour remplacer une configuration existante, ajoutez `-OverwriteConnectionConfig`.

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

Sous Windows, après le bootstrap :

```powershell
.\.venv\Scripts\python.exe .\oracle\connect_oracle.py
```

## Bootstrap du schéma applicatif

Le dépôt contient un bootstrap Python qui applique les scripts SQL sans dépendre de `sqlplus` :

```bash
export ORACLE_ADMIN_USER=system
export ORACLE_ADMIN_PASSWORD='votre_mot_de_passe_admin'
export ORACLE_ADMIN_DSN='//localhost:1521/FREEPDB1'
./oracle/bootstrap_app_schema.sh
```

Ne saisissez pas le mot de passe admin dans le chat. Exportez-le directement dans le terminal.

Le bootstrap PowerShell ci-dessus est l'équivalent prévu pour Windows. Il crée également `CUSTOMER_APP` avec le mot de passe que vous choisissez.

## Notes
- Ajustez `ORACLE_DSN` selon votre instance Oracle.
- Dans cet environnement ORDS utilise le service `FREEPDB1`, donc la valeur par défaut est `//localhost:1521/FREEPDB1`.
- Pour une vraie application APEX, la connexion se fait généralement via le schéma APEX et les objets DB du projet.
- Le backend Python lit directement cette connexion. L'interface navigateur complète utilise des endpoints ORDS ; installer/configurer ORDS dans `FREEPDB1` reste nécessaire pour ses fonctions de lecture et d'écriture Oracle.
- Si ORDS n'est pas installé, le bootstrap configure quand même `CUSTOMER_APP` et la connexion Python, puis ignore uniquement l'enregistrement des endpoints REST (`sql/010_phase3_ords_rest.sql`).
- Les scripts SQL ne provisionnent pas de clés API par défaut. Le bootstrap demande une clé `GC_ADMIN` lorsque ORDS est disponible.
