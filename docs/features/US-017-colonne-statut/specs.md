# US-017 — Colonne « Statut » (mergeabilité de la MR)

## 1. Reformulation

L'utilisateur veut savoir, sans ouvrir la MR, si elle est **fusionnable en l'état**. Une nouvelle colonne « Statut »
affiche une coche verte si GitLab considère la MR comme fusionnable, une croix rouge sinon, et un troisième état
« indéterminé » quand GitLab n'a pas fini d'évaluer. Au survol, une infobulle liste **toutes** les raisons qui
empêchent la fusion (pipeline en échec, conflits, discussions non résolues, approbations manquantes…). La colonne
peut être affichée ou masquée via le menu « Colonnes », comme la colonne « Ouverte ».

Cette US lève partiellement le non-objectif « ne gère pas de pipelines » de la vision produit (§1 du README) : MR
Board **affiche** l'état de la pipeline de tête comme une raison de blocage, sans jamais lister les jobs ni relancer
quoi que ce soit (lecture seule, RG-G01 inchangé).

## 2. User Stories

- **US-017** : En tant que membre de l'équipe, je veux voir d'un coup d'œil si une MR est fusionnable et, sinon,
  pourquoi, afin de choisir une MR à relire qui ne sera pas bloquée et de repérer celles qui attendent une action
  de leur auteur.
    - Priorité : Should
    - Complexité estimée : M
    - Dépendances : US-004 (synchronisation), US-011 (menu « Colonnes » et paramètre `cols`), US-012 (largeurs)

## 3. Règles de gestion

### Données collectées (synchronisation)

- **RG-017-01** : La requête GraphQL de synchronisation (RG-004-01) récupère en plus, par MR : `detailedMergeStatus`,
  `conflicts`, `headPipeline { status }`, `approvalsRequired`, `approvalsLeft`, `resolvableDiscussionsCount`,
  `resolvedDiscussionsCount`. Ces valeurs sont persistées telles quelles (colonnes dédiées de `merge_requests`,
  migration obligatoire) et rafraîchies à chaque synchronisation. Aucun appel supplémentaire par MR.
- **RG-017-02** : Le calcul du statut est une **fonction pure** `domain/compute-merge-status.ts`
  `(données brutes) → { state, reasons[] }`, indépendante de la forge : les codes de raison sont génériques pour
  préparer l'épique multi-forges (voir `docs/features/EPIC-001-multi-forges/README.md`).

### Calcul du statut

- **RG-017-03** : `state` prend l'une des trois valeurs :

  | `state`     | Condition                                                                                                                              | Rendu                                     |
  |-------------|----------------------------------------------------------------------------------------------------------------------------------------|-------------------------------------------|
  | `unknown`   | `detailedMergeStatus` ∈ {`UNCHECKED`, `CHECKING`, `PREPARING`, `APPROVALS_SYNCING`} ou donnée absente (MR synchronisée avant cette US) | icône `circle-dashed` grise `neutral-600` |
  | `mergeable` | `reasons` vide **et** `detailedMergeStatus = MERGEABLE`                                                                                | icône `circle-check` verte `success`      |
  | `blocked`   | tout autre cas (`reasons` non vide)                                                                                                    | icône `circle-x` rouge `danger`           |

  Une pipeline en échec est **toujours** une raison de blocage, même si le projet GitLab n'exige pas une pipeline
  verte pour fusionner (voir QO-017-01).

- **RG-017-04** : `reasons` est la liste **ordonnée et dédupliquée** des codes suivants, chacun ajouté si sa condition
  est vraie (plusieurs raisons peuvent coexister ; l'ordre est celui du tableau) :

  | Ordre | Code                     | Condition GitLab                                                                                                                                                         | Libellé (fr.json)                           |
  |-------|--------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------|---------------------------------------------|
  | 1     | `conflicts`              | `conflicts = true` ou `detailedMergeStatus = CONFLICT`                                                                                                                   | « Conflits de merge »                       |
  | 2     | `pipeline_failed`        | `headPipeline.status` ∈ {`FAILED`, `CANCELED`}                                                                                                                           | « Pipeline en échec »                       |
  | 3     | `pipeline_running`       | `headPipeline.status` ∈ {`CREATED`, `WAITING_FOR_RESOURCE`, `PREPARING`, `PENDING`, `RUNNING`, `SCHEDULED`} ou `detailedMergeStatus = CI_STILL_RUNNING`                   | « Pipeline en cours »                       |
  | 4     | `pipeline_missing`       | `detailedMergeStatus = CI_MUST_PASS` et `headPipeline = null`                                                                                                            | « Aucune pipeline »                         |
  | 5     | `changes_requested`      | `detailedMergeStatus = REQUESTED_CHANGES`                                                                                                                                | « Modifications demandées »                 |
  | 6     | `not_approved`           | `approvalsLeft > 0` ou `detailedMergeStatus = NOT_APPROVED`                                                                                                              | « Approbations manquantes (N restantes) »   |
  | 7     | `discussions_unresolved` | `resolvableDiscussionsCount − resolvedDiscussionsCount > 0` ou `detailedMergeStatus = DISCUSSIONS_NOT_RESOLVED`                                                          | « N discussion(s) non résolue(s) »          |
  | 8     | `need_rebase`            | `detailedMergeStatus = NEED_REBASE`                                                                                                                                      | « Rebase nécessaire »                       |
  | 9     | `blocked_by_mr`          | `detailedMergeStatus` ∈ {`BLOCKED_STATUS`, `MERGE_REQUEST_BLOCKED`}                                                                                                      | « Bloquée par une autre MR »                |
  | 10    | `policy`                 | `detailedMergeStatus` ∈ {`EXTERNAL_STATUS_CHECKS`, `POLICIES_DENIED`, `SECURITY_POLICY_VIOLATIONS`, `JIRA_ASSOCIATION_MISSING`, `TITLE_REGEX`, `LOCKED_PATHS`, `LOCKED_LFS_FILES`, `COMMITS_STATUS`} | « Règle du projet non satisfaite » |
  | 11    | `other`                  | `detailedMergeStatus` ni `MERGEABLE`, ni une valeur « unknown » (RG-017-03), ni une valeur listée ci-dessus (valeur inconnue d'une version GitLab future)              | « Non fusionnable (raison inconnue) »       |

  Le code `pipeline_running` seul (pipeline en cours, rien d'autre ne bloque) donne `state = blocked` : la MR n'est
  pas fusionnable **maintenant**, l'infobulle l'explique. `MERGE_TIME` (fusion planifiée) et `NOT_OPEN` ne
  produisent aucune raison (`NOT_OPEN` ne peut pas arriver, RG-G01). Si `detailedMergeStatus = CI_MUST_PASS` et
  qu'une pipeline existe, la raison est déjà couverte par `pipeline_failed` ou `pipeline_running`.
- **RG-017-05** : **Drafts** : le flag `draft` (RG-G02) n'est jamais une raison (la colonne Titre l'affiche déjà avec
  le tag « Draft »). `detailedMergeStatus = DRAFT_STATUS` est ignoré, et le statut d'un draft est calculé sur les
  autres signaux disponibles (conflits, pipeline, approbations, discussions) afin d'informer l'auteur de ce qui
  l'attend au passage en Ready. Si aucun de ces signaux n'est bloquant, `state = unknown` (GitLab n'a pas évalué le
  reste tant que la MR est draft).

### Exposition et affichage

- **RG-017-06** : `GET /merge-requests` expose `mergeStatus: { state: 'mergeable' | 'blocked' | 'unknown',
  reasons: { code, count? }[] }`. `count` accompagne uniquement `not_approved` (approbations restantes) et
  `discussions_unresolved` (discussions ouvertes). Les libellés sont traduits côté frontend (clés
  `board.mergeStatus.reasons.<code>`), jamais renvoyés en texte par le backend.
- **RG-017-07** : Colonne « Statut », en-tête « Statut », largeur initiale 64 px, redimensionnable (US-012),
  **positionnée après « Approved » et avant « Depuis Ready »**. Cellule : une seule icône Lucide 18 px, stroke 2.2,
  alignée à gauche comme les autres cellules. Non triable (voir QO-017-03).
- **RG-017-08** : Infobulle (`matTooltip`, multi-lignes, délai d'apparition 300 ms, accessible au clavier via le
  focus sur l'icône) :
  - `mergeable` → « Fusionnable » ;
  - `blocked` → « Non fusionnable : » suivi d'une ligne par raison, préfixée d'un tiret, dans l'ordre RG-017-04 ;
  - `unknown` → « Statut en cours de vérification par GitLab ».
  L'icône porte un `aria-label` égal au contenu de l'infobulle.
- **RG-017-09** : La colonne est **visible par défaut** et peut être masquée via le menu « Colonnes » (RG-011-09),
  qui contient désormais deux cases, dans cet ordre : « Statut » (cochée par défaut) et « Date d'ouverture »
  (décochée par défaut). Le paramètre d'URL `cols` (RG-011-02, RG-011-11) évolue : il liste les colonnes
  optionnelles visibles, **est omis quand l'état est celui par défaut** (`status` seul), et vaut `none` quand aucune
  colonne optionnelle n'est visible. Exemples : `?cols=status,opened`, `?cols=opened` (statut masqué, ouverture
  visible), `?cols=none`. Une valeur inconnue dans `cols` est ignorée. Cette règle amende RG-011-09/11 sans changer
  leur esprit (l'URL reste la seule persistance).
- **RG-017-10** : Le compteur, les filtres et « Mes MRs » ne sont pas affectés. Aucun filtre « Fusionnable » dans
  cette US (voir QO-017-02 et §7).
- **RG-017-11** : Les MRs déjà en base au moment du déploiement affichent `unknown` jusqu'à la synchronisation
  suivante (aucun recalcul rétroactif : la migration ajoute les colonnes à `null`).

## 4. Maquettes de référence

- Wireframe **1a** — tableau, colonne à insérer entre « Approved » et « Depuis Ready »
- Prototype — menu « Colonnes » (`MR Board - Prototype.dc.html`, lignes ~95-100), à enrichir d'une case « Statut »
- Design system — icônes Lucide `circle-check` / `circle-x` / `circle-dashed`, couleurs `--color-success`,
  `--color-danger`, `--color-neutral-600`

> ⚠️ **Écart avec le prototype** : ni la colonne « Statut » ni la case correspondante du menu « Colonnes »
> n'existent dans les maquettes. À concevoir en phase Architecte à partir des patterns existants : la cellule
> reprend le rendu de la coche « Approved » (SVG Lucide 18 px, RG-005-02) avec des icônes **cerclées** pour ne pas
> la confondre ; le menu « Colonnes » reprend le pattern à cases à cocher de RG-011-09 ; l'infobulle multi-lignes
> reprend le style de l'infobulle « +N » des reviewers (RG-G06).

## 5. Critères d'acceptation

```gherkin
Scenario: MR fusionnable
  Given une MR dont detailedMergeStatus = MERGEABLE, conflicts = false, headPipeline.status = SUCCESS, approvalsLeft = 0
  When le tableau est affiché
  Then la colonne « Statut » affiche une icône circle-check verte
  And le survol affiche « Fusionnable »

Scenario: MR bloquée pour plusieurs raisons
  Given une MR dont conflicts = true, headPipeline.status = FAILED, approvalsLeft = 2, detailedMergeStatus = CONFLICT
  When je survole l'icône de la colonne « Statut »
  Then l'icône est une circle-x rouge
  And l'infobulle affiche « Non fusionnable : » puis « – Conflits de merge », « – Pipeline en échec », « – Approbations manquantes (2 restantes) » dans cet ordre
  And aucune raison n'apparaît deux fois

Scenario: Pipeline en échec sur un projet qui ne l'exige pas
  Given une MR dont detailedMergeStatus = MERGEABLE et headPipeline.status = FAILED
  Then le statut est « blocked » avec l'unique raison « Pipeline en échec »

Scenario: Pipeline en cours
  Given une MR dont detailedMergeStatus = CI_STILL_RUNNING et headPipeline.status = RUNNING
  Then le statut est « blocked » avec l'unique raison « Pipeline en cours »

Scenario: Discussions non résolues comptées
  Given une MR avec resolvableDiscussionsCount = 5 et resolvedDiscussionsCount = 3
  Then l'infobulle contient « – 2 discussions non résolues »

Scenario: Statut indéterminé
  Given une MR dont detailedMergeStatus = CHECKING
  Then l'icône est une circle-dashed grise
  And l'infobulle affiche « Statut en cours de vérification par GitLab »

Scenario: Draft avec conflits
  Given une MR draft avec detailedMergeStatus = DRAFT_STATUS, conflicts = true et une pipeline SUCCESS
  When les drafts sont affichés
  Then le statut est « blocked » avec l'unique raison « Conflits de merge »
  And « Draft » n'apparaît pas dans les raisons

Scenario: Draft sans signal bloquant
  Given une MR draft avec detailedMergeStatus = DRAFT_STATUS, conflicts = false, headPipeline.status = SUCCESS, approvalsLeft = 0 et aucune discussion ouverte
  Then le statut est « unknown »

Scenario: Valeur inconnue de GitLab
  Given une MR dont detailedMergeStatus vaut « SOMETHING_NEW »
  Then le statut est « blocked » avec l'unique raison « Non fusionnable (raison inconnue) »

Scenario: MR synchronisée avant la mise à jour
  Given une MR en base sans données de statut (colonnes null)
  Then le statut est « unknown »
  When une synchronisation se termine
  Then le statut reflète les données GitLab

Scenario: Masquer la colonne
  Given la colonne « Statut » est visible (défaut) et l'URL ne contient pas cols
  When j'ouvre le menu « Colonnes » et je décoche « Statut »
  Then la colonne disparaît immédiatement et le menu reste ouvert
  And l'URL contient cols=none

Scenario: Afficher Ouverte en gardant Statut
  When je coche « Date d'ouverture » dans le menu « Colonnes »
  Then l'URL contient cols=status,opened

Scenario: Restauration depuis l'URL
  Given j'ouvre /?cols=opened
  Then la colonne « Statut » est masquée et la colonne « Ouverte » est visible
  And les cases du menu « Colonnes » reflètent cet état

Scenario: URL sans cols
  Given j'ouvre / sans paramètre cols
  Then la colonne « Statut » est visible et « Ouverte » masquée

Scenario: Contrat API
  When j'appelle GET /api/v1/merge-requests
  Then chaque MR contient mergeStatus.state ∈ {mergeable, blocked, unknown}
  And mergeStatus.reasons est un tableau de { code, count? } sans texte traduit

Scenario: Volume d'appels GitLab inchangé
  When une synchronisation s'exécute
  Then le nombre d'appels GitLab par projet est identique à celui d'avant cette US (une requête GraphQL paginée)
```

## 6. Questions ouvertes

- **QO-017-01** : Une pipeline en échec doit-elle bloquer le statut même si le projet GitLab n'exige pas de pipeline
  verte (`detailedMergeStatus = MERGEABLE`) ? Hypothèse retenue : **oui** (RG-017-03), le besoin exprimé est
  « Pipeline HS » comme raison, indépendamment de la configuration du projet. Alternative : s'aligner strictement
  sur GitLab (coche verte, et raison « informative » affichée en orange).
- **QO-017-02** : Faut-il un filtre composable « Statut » (Fusionnable / Non fusionnable / Indéterminé) dans la barre
  de filtres (US-010) ? Hypothèse : non dans cette US, à traiter comme évolution de US-010 si le besoin se confirme.
- **QO-017-03** : La colonne doit-elle être triable (fusionnables en premier) ? Hypothèse : non, RG-G10 impose un seul
  tri actif et le tri par ancienneté Ready reste le cœur du produit.
- **QO-017-04** : Le README mentionnait « issues » dans le hors-périmètre v1 (« pipelines / CI, conflits de merge,
  issues »). S'agit-il des issues GitLab liées à la MR (`Closes #123`) ? Hypothèse : hors périmètre de cette US, aucun
  lien avec la mergeabilité. À préciser si un besoin d'affichage des issues liées existe.
- **QO-017-05** : Faut-il notifier (US-016) quand une de « mes » MRs passe de fusionnable à bloquée (pipeline cassée) ?
  Hypothèse : non, hors périmètre.
- **QO-017-06** : Faut-il rendre la colonne masquée par défaut plutôt que visible ? Hypothèse : visible (RG-017-09),
  l'information est jugée à forte valeur ; le masquage coûte un clic.

## 7. Hors périmètre

- Détail des jobs de la pipeline, lien vers la pipeline, relance de pipeline (écriture)
- Issues liées à la MR
- Filtre ou tri sur le statut
- Notification sur changement de statut
- Statut pour GitHub (traité par US-020 via les codes génériques de RG-017-04)
