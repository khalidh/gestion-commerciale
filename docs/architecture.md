# Architecture technique

## Couches applicatives

### 1. Couche présentation
- Oracle APEX pour l’interface web
- pages par module : clients, produits, commandes, facturation, paiements
- tableaux de bord et rapports interactifs

### 2. Couche métier
- packages PL/SQL dédiés :
  - `pkg_client` : gestion des clients
  - `pkg_product` : gestion des articles et tarifs
  - `pkg_sales` : création de commandes et validation
  - `pkg_invoice` : génération de factures
  - `pkg_payment` : traitements de paiement
  - `pkg_reporting` : agrégations et exports

### 3. Couche données
- schéma Oracle avec tables de référence et transactionnelles
- contraintes, index, vues matérialisées si besoin
- historique et journalisation des opérations critiques

## Modèle de données de base

### Tables principales
- `customers`
- `products`
- `price_lists`
- `sales_orders`
- `sales_order_lines`
- `invoices`
- `invoice_lines`
- `payments`
- `audit_log`

## Flux fonctionnels

### Processus de vente
1. création d’un prospect ou client
2. saisie d’une commande
3. validation des stocks et des règles métier
4. génération de la facture
5. suivi du paiement
6. mise à jour des indicateurs de performance

## Sécurité et gouvernance

- séparation des rôles : `APP_ADMIN`, `SALES_USER`, `FINANCE_USER`, `REPORT_USER`
- usage de vues sécurisées et de privilèges minimaux
- journalisation des changements sensibles
- masquage des données si nécessaire dans les environnements non prod

## Intégrations possibles

- Oracle ORDS pour API REST
- connecteurs vers ERP/CRM tiers
- export CSV/Excel pour reporting externe
- webhooks pour notifications
