# Export abapGit - Gestion commerciale RAP

Ce dossier est genere par `node sap-rap/build-abapgit-export.mjs`. Il contient les sources RAP Clients/Produits et leurs metadonnees abapGit. Les sources d'origine restent dans `sap-rap/src`.

## Import dans ADT

1. Installe le plug-in abapGit pour ADT depuis `https://eclipse.abapgit.org/updatesite/` dans **Help > Install New Software...**.
2. Dans le plug-in abapGit d'ADT, clone `https://github.com/khalidh/gestion-commerciale`, branche `main`, dans le package cible, par exemple `ZGC_RAP`. Le fichier `.abapgit.xml` a la racine limite l'import a `sap-rap/abapgit-export/src`.
3. Examine les objets proposes et importe-les. Active-les ensuite dans ADT en resolvant les diagnostics du tenant.

## A creer encore dans SAP

- L'objet d'autorisation `ZGC_MDATA` et ses attributions IAM.
- Le binding `ZUI_GC_MASTER_O4` (OData V4 - UI) pour `ZUI_GC_MASTER`.
- Les index secondaires uniques `Z01` sur `ZGC_RAP_CUST(CLIENT, CUSTOMER_CODE)` et `ZGC_RAP_PROD(CLIENT, PRODUCT_CODE)`.

Le binding, les autorisations et les index ne sont pas dans les sources disponibles. La compilation, l'activation et ABAP Unit doivent etre verifies sur le vrai tenant BTP; la generation locale ne les valide.
