# Spécification Oracle APEX

## Application
Nom proposé : Gestion Commerciale

## Pages principales
1. Home Dashboard
   - KPI : clients, produits, commandes, CA facturé
   - graphiques de tendance
   - derniers événements

2. Clients
   - formulaire d’ajout/modification
   - grille interactive
   - filtres par statut et type

3. Produits
   - gestion du catalogue
   - prix et devise
   - statut actif/inactif

4. Commandes
   - création de commande
   - ajout de lignes
   - validation

5. Factures
   - génération automatique depuis une commande
   - suivi du statut

6. Paiements
   - enregistrement des encaissements
   - détail par facture

7. Rapports
   - ventes par période
   - encaissements
   - performances commerciales

## Composants APEX recommandés
- Interactive Grid pour les grilles transactionnelles
- Cards pour les tableaux de bord
- Forms pour la saisie métier
- Reports pour les exports
- Navigation Menu avec rôles

## Intégration PL/SQL
- Les écrans APEX appellent des procédures PL/SQL via Processus et API
- Les validations métier sont centralisées dans les packages
- Les requêtes de reporting utilisent des vues et packages de synthèse
