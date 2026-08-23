# Spécifications de l'application de gestion commerciale

## 1. Résumé exécutif

L’application de gestion commerciale a pour objectif de digitaliser et d’optimiser les processus de vente, de facturation, de suivi client et de pilotage commercial au sein d’une entreprise utilisant Oracle comme plateforme de données et Oracle APEX comme interface web.

Elle sera structurée autour de trois couches principales :
- une couche de base de données Oracle avec SQL et PL/SQL,
- une couche applicative métier pour la logique de traitement,
- une interface utilisateur web avec Oracle APEX.

## 2. Objectifs fonctionnels

L’application doit permettre de :
- gérer les clients et prospects,
- gérer les produits et leur tarification,
- créer et suivre des commandes commerciales,
- générer des factures,
- enregistrer et suivre les paiements,
- produire des tableaux de bord et rapports de suivi,
- assurer la traçabilité des opérations critiques.

## 3. Périmètre fonctionnel

### 3.1 Gestion des clients

Fonctionnalités attendues :
- création, modification et consultation des clients,
- classification par type de client,
- gestion du statut actif/inactif,
- suivi des coordonnées et informations de contact,
- historique des interactions commerciales.

### 3.2 Gestion des produits

Fonctionnalités attendues :
- gestion des articles ou services,
- codes produits uniques,
- prix unitaires et devises,
- gestion du statut actif/inactif,
- possibilité d’associer des remises ou prix spécifiques.

### 3.3 Gestion des commandes

Fonctionnalités attendues :
- création de commandes commerciales,
- ajout de lignes de commande,
- validation des commandes,
- suivi de l’état de la commande (brouillon, validée, livrée, annulée),
- calcul automatique du montant total.

### 3.4 Gestion de la facturation

Fonctionnalités attendues :
- génération automatique de factures à partir des commandes,
- numérotation des factures,
- suivi du statut de la facture,
- calcul du montant total et des éventuels montants réglés.

### 3.5 Gestion des paiements

Fonctionnalités attendues :
- enregistrement des encaissements,
- suivi des paiements par facture,
- suivi des soldes restants,
- gestion des modes de paiement.

### 3.6 Reporting et pilotage

Fonctionnalités attendues :
- tableaux de bord KPI,
- suivi des ventes par période,
- suivi des encaissements,
- état des clients et des commandes,
- exports vers Excel ou CSV.

## 4. Exigences fonctionnelles non fonctionnelles

### 4.1 Fiabilité
- l’application doit garantir la cohérence des données,
- les transactions doivent être atomiques en cas d’échec métier.

### 4.2 Sécurité
- gestion des rôles et permissions,
- accès restreint selon le profil utilisateur,
- journalisation des opérations sensibles.

### 4.3 Performance
- traitement rapide des opérations courantes,
- indexation adaptée des tables transactionnelles,
- usage de requêtes optimisées.

### 4.4 Traçabilité
- journal des opérations critiques,
- historisation de modifications sensibles.

## 5. Modèle de données proposé

### 5.1 Entités principales

- customers : informations clients et prospects
- products : catalogue de produits/services
- sales_orders : commandes commerciales
- sales_order_lines : lignes de commande
- invoices : factures
- payments : paiements enregistrés
- audit_log : journal d’audit

### 5.2 Relations principales
- un client peut avoir plusieurs commandes,
- une commande contient plusieurs lignes,
- une commande peut générer une ou plusieurs factures,
- une facture peut avoir plusieurs paiements,
- une ligne de commande pointe vers un produit.

## 6. Architecture technique proposée

### 6.1 Couche base de données
- Oracle Database comme moteur principal,
- utilisation de SQL pour les requêtes et manipulations,
- utilisation de PL/SQL pour la logique métier.

### 6.2 Couche applicative
- packages PL/SQL dédiés par domaine :
  - pkg_customer
  - pkg_product
  - pkg_sales
  - pkg_invoice
  - pkg_payment
  - pkg_reporting

### 6.3 Couche interface utilisateur
- Oracle APEX pour l’interface web,
- pages de gestion des entités principales,
- formulaires, grilles interactives, dashboards et rapports.

## 7. Composants PL/SQL proposés

### 7.1 Packages métier
- pkg_customer : création, mise à jour, consultation des clients
- pkg_product : gestion du catalogue et tarifs
- pkg_sales : création de commandes, ajout de lignes, validation
- pkg_invoice : génération et suivi des factures
- pkg_payment : enregistrement et suivi des paiements
- pkg_reporting : calculs de ventes, encaissements et indicateurs

### 7.2 Procédures et fonctions attendues
- create_customer
- update_customer
- create_order
- add_order_line
- validate_order
- generate_invoice
- record_payment
- get_sales_dashboard

## 8. Spécifications Oracle APEX

### 8.1 Pages prévues
- accueil avec tableau de bord
- page clients
- page produits
- page commandes
- page factures
- page paiements
- page reporting

### 8.2 Composants attendus
- formulaires d’ajout et de modification,
- grilles interactives,
- cartes KPI,
- graphiques de ventes,
- filtres dynamiques,
- menus de navigation et rôles APEX.

## 9. Sécurité et gouvernance

### 9.1 Rôles proposés
- APP_ADMIN : administration complète
- SALES_USER : gestion des commandes et clients
- FINANCE_USER : gestion des factures et paiements
- REPORT_USER : consultation des tableaux de bord et rapports

### 9.2 Mesures de sécurité
- privilèges minimaux,
- vues sécurisées,
- journalisation des actions sensibles,
- contrôle d’accès par profil et par module.

## 10. SDLC et déploiement

### 10.1 Environnements
- dev : développement
- test : validation fonctionnelle
- uat : recette métier
- prod : production

### 10.2 Processus de livraison
- développement sur branche fonctionnelle,
- revue de code,
- validation automatisée,
- promotion vers les environnements de test puis production.

## 11. Intégration IA (optionnelle)

L’application peut évoluer vers un harnais IA pour :
- résumer des commandes et factures,
- proposer des recommandations de produits,
- assister la saisie des données,
- générer des insights commerciaux à partir des historiques.

## 12. Livrables attendus

Le projet doit livrer :
- un schéma Oracle fonctionnel,
- les packages PL/SQL de base,
- les pages APEX de gestion métier,
- un plan de sécurité et de gouvernance,
- une documentation de déploiement et de maintenance.
