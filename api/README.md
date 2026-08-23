# API Python pour la gestion commerciale

Cette API fournit des endpoints simples pour exposer les données commerciales et servir de pont vers des services IA ou des intégrations externes.

## Endpoints
- GET /health : vérifie l'état du service
- GET /customers : retourne les clients de référence
- GET /orders : retourne les commandes de référence

## Lancement
```bash
python3 api/app.py
```

## Variables d'environnement
- PORT : port d'écoute du service (défaut 5000)

## Notes
Cette version utilise uniquement la bibliothèque standard Python, sans dépendance externe.
