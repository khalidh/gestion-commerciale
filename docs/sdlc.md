# SDLC et gouvernance du cycle de vie

## Environnements

- DEV : développement et tests unitaires
- TEST : validation fonctionnelle et intégration
- UAT : recette métier
- PROD : mise en production

## Organisation Git

- branche `main` pour la production
- branche `develop` pour l’intégration
- branches de fonctionnalités : `feature/<nom>`
- branches d’hypersécurité : `hotfix/<nom>`

## Processus de livraison

1. création d’une branche fonctionnelle
2. développement et tests locaux
3. pull request vers `develop`
4. validation automatisée
5. promotion vers les environnements de test puis production

## Contrôles qualité

- vérification de la structure des scripts SQL
- tests de non-régression sur les packages PL/SQL
- validation des pages APEX et des autorisations
- revue de sécurité avant mise en prod

## Pipeline CI/CD

La pipeline GitHub Actions prévue dans ce dépôt exécute :
- vérification de la structure du dépôt
- contrôle des artefacts attendus
- préparation de la release

## Checklist de release

- scripts SQL validés
- données de référence cohérentes
- tests de recette passés
- plan de rollback défini
- documentation mise à jour
