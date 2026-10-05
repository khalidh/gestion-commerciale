# Portage Oracle Forms

Ce dossier contient les sources et spécifications du portage de l'application de gestion commerciale vers Oracle Forms. Il s'agit d'une interface distincte d'Oracle APEX, qui réutilise le schéma et les traitements Oracle lorsqu'ils sont compatibles.

## Premier lot

Le premier module prévu est la gestion des clients. Sa fiche de construction se trouve dans [forms/GC_CUSTOMERS.md](forms/GC_CUSTOMERS.md).

## Environnement Forms

La version d'Oracle Forms cible et son environnement d'exécution restent à confirmer avant de créer et compiler les modules. Les fichiers `.fmb` et `.fmx` doivent être créés ou compilés avec les outils Oracle Forms correspondants; ce dépôt ne peut pas produire un module Forms binaire sans ces outils.

Ne pas stocker ici de mots de passe, de fichiers de connexion contenant des secrets, ni de clés API. Le déploiement devra utiliser un compte Oracle dédié, limité aux tables et opérations nécessaires.

## Portage progressif

1. Clients: consultation, création et modification.
2. Produits: consultation et maintenance du catalogue.
3. Commandes et lignes de commande: saisie, calcul et validation.
4. Factures, paiements, reporting et audit.

Chaque lot doit être testé avec le schéma Oracle existant, ses contraintes, ses déclencheurs d'audit et ses règles métier. Les définitions APEX et les pages web ne sont pas converties automatiquement en écrans Forms.