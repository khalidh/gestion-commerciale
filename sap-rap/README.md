# SAP RAP natif - Clients et produits

Cette premiere tranche est du code source pour SAP BTP ABAP Environment, distinct du prototype OpenABAP/PostgreSQL. Elle prepare deux business objects managed avec drafts, UUID geres, validations, ETag, projections transactionnelles et annotations Fiori Elements.

**Etat: sources prepares, pas encore actives ni compiles sur SAP.** Les controles locaux ne prouvent pas la compatibilite avec la version de votre tenant. Aucun service BTP n'a ete publie. Les commandes, lignes, factures, paiements, rapports et audit metier RAP restent a implementer.

## Prerequis

- Une instance SAP BTP ABAP Environment accessible dans votre offre Trial. Un compte BTP seul ou SAP Business Application Studio ne fournit pas ce runtime.
- Eclipse et ABAP Development Tools (ADT) a jour, avec un projet ABAP Cloud connecte a cette instance.
- Un package de developpement, par exemple `ZGC_RAP`, avec ABAP language version **ABAP for Cloud Development**.
- Les droits de creation d'objets et la possibilite de configurer les autorisations du service. La disponibilite de ces fonctions doit etre verifiee sur votre Trial.

Ne communiquez pas de mot de passe, de jeton ou de service key dans le chat ou dans Git. La connexion au tenant se fait dans ADT avec votre identite SAP; le compte `admin` du prototype local ne donne aucun droit dans SAP.

## Sources Et Objets ADT

Les extensions suivent les conventions de noms des sources ABAP, mais ce dossier **n'est pas un export abapGit complet**: les metadonnees de repository et de transport ne sont pas generees. Creer les objets correspondants dans ADT et utiliser leurs editeurs de source. Les namespaces et noms doivent etre libres dans le systeme cible; sur un tenant partage, coordonner un suffixe de groupe et adapter toutes les references si necessaire.

| Type ADT | Nom | Source |
| --- | --- | --- |
| Database Table | `ZGC_RAP_CUST` | [src/zgc_rap_cust.tabl.asddl](src/zgc_rap_cust.tabl.asddl) |
| Database Table | `ZGC_RAP_PROD` | [src/zgc_rap_prod.tabl.asddl](src/zgc_rap_prod.tabl.asddl) |
| Database Table (draft) | `ZGC_RAP_CUST_D` | [src/zgc_rap_cust_d.tabl.asddl](src/zgc_rap_cust_d.tabl.asddl) |
| Database Table (draft) | `ZGC_RAP_PROD_D` | [src/zgc_rap_prod_d.tabl.asddl](src/zgc_rap_prod_d.tabl.asddl) |
| Data Definition | `ZI_GCCUSTOMER` | [src/zi_gccustomer.ddls.asddls](src/zi_gccustomer.ddls.asddls) |
| Data Definition | `ZI_GCPRODUCT` | [src/zi_gcproduct.ddls.asddls](src/zi_gcproduct.ddls.asddls) |
| Behavior Definition | `ZI_GCCUSTOMER` | [src/zi_gccustomer.bdef.asbdef](src/zi_gccustomer.bdef.asbdef) |
| Behavior Definition | `ZI_GCPRODUCT` | [src/zi_gcproduct.bdef.asbdef](src/zi_gcproduct.bdef.asbdef) |
| ABAP Class | `ZCL_GC_MASTER_RULES` | [src/zcl_gc_master_rules.clas.abap](src/zcl_gc_master_rules.clas.abap) |
| Behavior Implementation | `ZBP_I_GCCUSTOMER` | [src/zbp_i_gccustomer.clas.abap](src/zbp_i_gccustomer.clas.abap) et [src/zbp_i_gccustomer.clas.locals_imp.abap](src/zbp_i_gccustomer.clas.locals_imp.abap) |
| Behavior Implementation | `ZBP_I_GCPRODUCT` | [src/zbp_i_gcproduct.clas.abap](src/zbp_i_gcproduct.clas.abap) et [src/zbp_i_gcproduct.clas.locals_imp.abap](src/zbp_i_gcproduct.clas.locals_imp.abap) |
| Data Definition (projection) | `ZC_GCCUSTOMER` | [src/zc_gccustomer.ddls.asddls](src/zc_gccustomer.ddls.asddls) |
| Data Definition (projection) | `ZC_GCPRODUCT` | [src/zc_gcproduct.ddls.asddls](src/zc_gcproduct.ddls.asddls) |
| Behavior Definition (projection) | `ZC_GCCUSTOMER` | [src/zc_gccustomer.bdef.asbdef](src/zc_gccustomer.bdef.asbdef) |
| Behavior Definition (projection) | `ZC_GCPRODUCT` | [src/zc_gcproduct.bdef.asbdef](src/zc_gcproduct.bdef.asbdef) |
| Metadata Extension | `ZC_GCCUSTOMER` | [src/zc_gccustomer.ddlx.asddlxs](src/zc_gccustomer.ddlx.asddlxs) |
| Metadata Extension | `ZC_GCPRODUCT` | [src/zc_gcproduct.ddlx.asddlxs](src/zc_gcproduct.ddlx.asddlxs) |
| Service Definition | `ZUI_GC_MASTER` | [src/zui_gc_master.srvd.srvdsrv](src/zui_gc_master.srvd.srvdsrv) |
| Service Binding | `ZUI_GC_MASTER_O4` | A creer dans ADT: **OData V4 - UI**, service `ZUI_GC_MASTER` |
| Authorization Object | `ZGC_MDATA` | A creer/configurer dans SAP avec le champ `ACTVT` |

## Activation Dans ADT

1. Creer le package et l'objet d'autorisation `ZGC_MDATA` avec `ACTVT`.
2. Creer et activer les quatre tables, puis les deux CDS `ZI_*`. Les tables draft utilisent les noms de champs des entites CDS, pas les noms physiques des tables actives. Verifier les types standard `ABP_*` et `SYCH_BDL_DRAFT_ADMIN_INC` sur le tenant; le Quick Fix de generation des tables draft peut servir de reference pour cette version.
3. Creer la classe de regles. Dans son onglet **Test Classes**, utiliser [src/zcl_gc_master_rules.clas.testclasses.abap](src/zcl_gc_master_rules.clas.testclasses.abap). Activer et lancer **Run As > ABAP Unit Test**.
4. Creer les BDEF `ZI_*`, puis leurs behavior pools via le Quick Fix ADT. Le fichier `.clas.abap` correspond a la source globale; le fichier `.clas.locals_imp.abap` va dans **Local Types**. Activer les BDEF et classes ensemble en resolvant les diagnostics ADT.
5. Creer et activer les CDS `ZC_*`, leurs BDEF de projection et leurs metadata extensions.
6. Creer les index uniques requis ci-dessous avant les tests transactionnels.
7. Creer et activer `ZUI_GC_MASTER`, puis le service binding `ZUI_GC_MASTER_O4` de type **OData V4 - UI**. Le binding est cree par l'editeur ADT, sans URL ni metadonnees de tenant codees en dur.
8. Configurer les droits SAP, publier le endpoint local dans le binding et utiliser **Preview** pour `Customers` et `Products`. Ce sont deux apercus List Report/Object Page; aucune application Fiori Launchpad autonome n'est encore fournie.

La publication locale de preview ne constitue pas un deploiement de production. La connexion ADT, l'activation, les diagnostics, les tests ABAP Unit et la configuration IAM doivent etre verifies dans le vrai systeme.

## Unicite Des Codes

Les validations verifient les codes deja persistants et les doublons parmi les instances recues dans une meme validation. Cette verification seule ne garantit pas l'unicite entre transactions concurrentes.

Creer dans SAP un index secondaire **unique** pour chaque table active:

- `ZGC_RAP_CUST`, index `Z01`: `CLIENT`, `CUSTOMER_CODE`.
- `ZGC_RAP_PROD`, index `Z01`: `CLIENT`, `PRODUCT_CODE`.

Ces definitions d'index ne sont pas exportees dans les sources. **Ne pas considerer l'unicite concurrente comme livree tant que les index n'ont pas ete crees et testes dans SAP.** Si l'editeur ou les droits du Trial ne permettent pas leur creation, cette etape est bloquante: ne pas remplacer la contrainte par un simple SELECT ni publier le service pour un usage multi-utilisateur.

Ne pas ajouter ces index aux tables draft: un brouillon d'edition peut avoir le meme code que sa propre instance active. Un code reutilise apres une suppression dans la meme transaction peut etre refuse par le controle conservateur sur les lignes actives; pour cette premiere tranche, terminer la suppression avant de recreer le code.

## Autorisations Et Limites

Les handlers executent `AUTHORITY-CHECK OBJECT 'ZGC_MDATA'` pour `ACTVT` `01` (creer), `02` (modifier) et `06` (supprimer). Une absence de droits refuse l'operation; aucun contournement de type "autoriser tous les utilisateurs" n'est fourni.

L'objet d'autorisation, son integration IAM, le catalogue et le role SAP doivent encore etre crees et attribues dans le systeme. Ne pas utiliser les anciens roles/jetons Node ou Oracle a leur place. Pour les donnees de reference, seuls les futurs roles administrateur et commercial devraient obtenir les droits d'ecriture; finance et reporting restent en lecture. La matrice complete des roles RAP n'est pas encore livree.

Les vues portent `@AccessControl.authorizationCheck: #NOT_REQUIRED`: **aucune restriction DCL de lecture par ligne n'est implementee**. Les utilisateurs autorises a consommer le service peuvent lire les donnees exposees dans leur client SAP. Finaliser les droits IAM du service et les restrictions DCL necessaires avant toute exposition externe. Ne pas publier anonymement.

Les champs `CreatedBy`, `CreatedAt` et les timestamps de modification sont geres par RAP. Ils ne constituent pas un journal d'audit des suppressions ou de toutes les operations. Le journal metier complet viendra dans une tranche suivante.

La devise est actuellement validee sur son format de trois lettres, pas sur son existence dans le referentiel SAP. La conversion monetaire et les devises a decimales variables restent a valider avant d'ajouter la facturation. Le montant utilise la semantique devise CDS standard.

## Controles Et Recette

Depuis la racine du depot:

```powershell
node sap-rap/check-sources.mjs
```

Ce controle sans dependances verifie les mappings, champs de drafts, projections, actions exposees et metadonnees. Ce n'est ni un compilateur SAP, ni un test d'execution RAP. Une analyse grammaticale locale des fichiers ABAP a aussi ete effectuee avec le parseur abaplint disponible dans le prototype; elle ne valide pas les types/frameworks du tenant.

Les sept methodes ABAP Unit preparees testent les regles pures: client valide, code/type/statut invalides, email invalide, nom vide, prix nul autorise, prix negatif et devise mal formee. **Elles n'ont pas encore ete executees sur SAP** et ne testent pas le cycle draft ni les autorisations.

Recette a executer apres activation:

1. Creer un client avec `CUST-001`, un nom, type `CUSTOMER`, statut `ACTIVE`, puis activer le draft. Verifier les champs administratifs et le UUID.
2. Creer un produit `PROD-001`, nom, montant positif ou nul, devise `EUR`, statut `ACTIVE`. Modifier puis activer; discard/resume doivent conserver le parcours draft standard.
3. Verifier les messages sur email incorrect, nom vide, type/statut inconnu, prix negatif et devise mal formee.
4. Reutiliser un code sur un autre UUID, y compris deux creations concurrentes: une seule instance active doit etre persistante.
5. Modifier une instance avec un ETag devenu obsolete: l'ecriture stale doit etre rejetee. Tester aussi l'expiration/reprise de verrou draft et le total ETag.
6. Verifier que les comptes sans `01`/`02`/`06` ne peuvent pas executer les operations correspondantes, y compris par OData et les actions draft. Ne pas se limiter a l'etat des boutons Fiori.

## References

- [SAP RAP100](https://github.com/SAP-samples/abap-platform-rap100): patterns managed/draft et publication via ADT.
- [ABAP Development Tools](https://tools.hana.ondemand.com/#abap): installation et mises a jour.

Aucune dependance aux tables `/DMO`, a PostgreSQL, a Express ou aux mots de passe du prototype local. Aucune donnee Oracle ou PostgreSQL n'est migree par cette tranche.