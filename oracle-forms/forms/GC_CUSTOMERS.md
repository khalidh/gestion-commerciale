# Module Forms GC_CUSTOMERS

## Objectif

Fournir un écran Oracle Forms pour consulter, créer et modifier les clients de `CUSTOMER_APP.CUSTOMERS`.

## Structure proposée

- Module Forms: `GC_CUSTOMERS.fmb` (exécutable compilé: `GC_CUSTOMERS.fmx`).
- Fenêtre: `WIN_CUSTOMERS`.
- Canevas: `CAN_CUSTOMERS`.
- Bloc de données: `BLK_CUSTOMERS`, basé sur la table `CUSTOMERS`.
- Présentation: bloc tabulaire avec recherche/navigation et panneau de détail pour le client sélectionné.

## Items

| Colonne | Présentation | Règles |
| --- | --- | --- |
| `CUSTOMER_ID` | Caché ou affiché en lecture seule | Identifiant technique généré par Oracle. Vérifier sa récupération après insertion avec la version Forms cible. |
| `CUSTOMER_CODE` | Saisie | Obligatoire et unique; non modifiable après création, conformément au package `PKG_CUSTOMER`. |
| `CUSTOMER_NAME` | Saisie | Obligatoire. |
| `CUSTOMER_TYPE` | Saisie ou liste | Valeur par défaut `CUSTOMER`; ne pas restreindre à une liste non définie par le modèle. |
| `EMAIL` | Saisie | Facultatif. |
| `PHONE` | Saisie | Facultatif. |
| `STATUS` | Liste (`ACTIVE`, `INACTIVE`) | Valeur par défaut `ACTIVE`; respecter la contrainte `CHK_CUSTOMER_STATUS`. |
| `CREATED_AT` | Lecture seule | Valeur par défaut fournie par la base. |

## Comportements

- Utiliser les traitements DML standards d'Oracle Forms si les tests confirment leur compatibilité avec la colonne identity `CUSTOMER_ID`.
- Si Forms ne récupère pas correctement l'identifiant généré, fournir le DML par un package PL/SQL avec récupération de clé (`RETURNING INTO`) plutôt que fabriquer le nom de la séquence interne de l'identity.
- Enregistrer avec `COMMIT_FORM`; annuler les modifications non enregistrées avec `CLEAR_FORM(NO_VALIDATE)` après confirmation.
- Laisser les contraintes Oracle et le déclencheur `TRG_AUDIT_CUSTOMERS` appliquer l'unicité, les champs obligatoires, les statuts et la journalisation.
- Ne pas activer la suppression de clients dans ce premier module: les commandes, factures et autres références peuvent empêcher une suppression cohérente.
- Afficher les erreurs Oracle de manière compréhensible sans masquer leur cause; annuler la transaction en cas d'erreur.

## Vérifications d'acceptation

1. Rechercher et consulter un client existant.
2. Créer un client valide et vérifier l'identifiant généré ainsi que l'entrée dans `AUDIT_LOG`.
3. Vérifier le rejet d'un code déjà utilisé, d'un code ou nom vide et d'un statut autre que `ACTIVE` ou `INACTIVE`.
4. Modifier le nom, l'adresse email, le téléphone et le statut; confirmer que le code ne change pas.
5. Annuler une modification sans enregistrer et vérifier qu'aucune donnée ni entrée d'audit n'est créée.

## Dépendances existantes

- Table et contraintes: `sql/001_schema.sql`, `sql/007_phase1_core.sql`.
- Audit clients: déclencheur `TRG_AUDIT_CUSTOMERS` dans `sql/008_phase2_reporting_audit.sql`.
- API PL/SQL existante: `PKG_CUSTOMER` dans `sql/004_plsql_packages.sql`.