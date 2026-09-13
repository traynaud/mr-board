# US-020 — Connexion GitHub (github.com et GitHub Enterprise Server)

Fait partie de l'épique `docs/features/EPIC-001-multi-forges/README.md`.

## 1. Reformulation

Permettre d'ajouter une connexion de type **GitHub** (github.com ou une instance GitHub Enterprise Server), de tester
son jeton, d'y rattacher des dépôts `owner/repo`, et de synchroniser leurs Pull Requests ouvertes dans le tableau
avec **exactement les mêmes colonnes, calculs, filtres et tris** que pour GitLab. Toute la spécificité GitHub est
confinée au client de forge et à son mapper ; le reste de l'application ne voit que des « MRs ».

## 2. User Stories

- **US-020** : En tant que membre d'une équipe qui travaille sur GitLab et GitHub, je veux voir les Pull Requests
  GitHub de mes dépôts dans MR Board avec les mêmes informations que mes MRs GitLab, afin de n'avoir qu'un seul
  tableau à consulter.
    - Priorité : Must (cœur de l'épique)
    - Complexité estimée : L
    - Dépendances : US-019 (connexions), US-017 (codes de statut de mergeabilité)

## 3. Règles de gestion

### Connexion et jeton

- **RG-020-01** : Le type `github` devient sélectionnable (RG-019-11). URL par défaut `https://github.com` ; une
  instance GitHub Enterprise Server (GHES) est saisie par son hôte (`https://github.exemple.fr`), normalisée comme
  RG-001-01. Le backend en dérive les bases d'API : github.com → REST `https://api.github.com`, GraphQL
  `https://api.github.com/graphql` ; GHES → REST `<url>/api/v3`, GraphQL `<url>/api/graphql`. L'utilisateur ne
  saisit jamais une URL d'API.
- **RG-020-02** : Jetons acceptés : Personal Access Token **classique** (`ghp_…`, scope `repo` pour les dépôts privés
  ou `public_repo` pour les publics) ou **fine-grained** (`github_pat_…`, permissions dépôt « Metadata : lecture »,
  « Pull requests : lecture », « Commit statuses : lecture » et « Checks : lecture » pour le statut CI). Validation de
  forme : 8 caractères minimum (RG-001-02), aucun contrôle de préfixe (les jetons GHES peuvent différer). Envoi :
  en-têtes `Authorization: Bearer <jeton>`, `Accept: application/vnd.github+json`, `X-GitHub-Api-Version:
  2022-11-28` ; le jeton n'est jamais loggé (motifs masqués : `ghp_*`, `github_pat_*`, `Bearer *`).
- **RG-020-03** : « Tester la connexion » (RG-001-04 adapté) : `GET /user` avec délai 15 s. Succès → « ✓ Connecté ·
  <name ou login> (@login) » suivi de :
  - l'expiration lue dans l'en-tête `GitHub-Authentication-Token-Expiration` (« expire le JJ/MM/AAAA »), ou « sans
    expiration » si l'en-tête est absent ;
  - le contrôle de scope : si l'en-tête `X-OAuth-Scopes` est présent (jeton classique), il doit contenir `repo` ou
    `public_repo`, sinon « Échec : scope insuffisant (repo ou public_repo requis) » ; s'il est absent (fine-grained),
    aucun contrôle et mention « permissions non vérifiables ».
  Échecs : 401 → « Échec : jeton refusé (401) » ; injoignable / délai → « Échec : instance injoignable » ; 403 avec
  `X-RateLimit-Remaining: 0` → « Échec : limite de débit GitHub atteinte, réessayez plus tard ».
- **RG-020-04** : Le résultat du test expose `username = login`, `name` (repli `login` si vide), `avatarUrl`, et sert
  au pré-remplissage de l'identité par connexion (RG-019-09). L'email n'est pas exploité (GitHub ne l'expose pas de
  façon fiable) ; RG-019-07 s'applique avec le username seul.

### Repos

- **RG-020-05** : Chemin d'un dépôt GitHub : `owner/repo` (exactement deux segments, GitHub n'a pas de
  sous-groupes), saisi tel quel ou via l'URL de sa page (`https://github.com/owner/repo`, suffixes `/pulls`, `.git`…
  retirés — RG-003-01 adapté). Placeholder de la ligne d'ajout : « owner/repo ou URL GitHub ». Plus ou moins de deux
  segments → 400 `projects.invalidPath` (« Format attendu : owner/repo »).
- **RG-020-06** : Résolution à l'ajout via `GET /repos/{owner}/{repo}` : stocke `remoteProjectId = id` (texte),
  `pathWithNamespace = full_name` (casse canonique renvoyée par GitHub), `webUrl = html_url`. 404 (inexistant **ou**
  privé sans accès, GitHub ne distingue pas) et 403 → RG-003-03 « Projet introuvable ou inaccessible avec ce jeton ».
  Alias dérivé (RG-003-05) = `repo`. Unicité RG-003-06 sur (`connectionId`, `remoteProjectId`).

### Synchronisation (RG-004-01 adaptée)

- **RG-020-07** : Les PRs ouvertes sont récupérées via **GraphQL** en une requête paginée par curseur par dépôt
  (`repository(owner, name).pullRequests(states: OPEN, first: 50, after: $cursor)`), page de **50** (nœuds plus
  lourds que GitLab). Champs et **mapping** vers le modèle commun (`ForgeMergeRequest`, RG-019-21) :

  | Champ MR Board (RG)                  | Source GraphQL GitHub                                                                    | Règle                                                                                  |
  |--------------------------------------|------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------|
  | `remoteId`                           | `id` (node id)                                                                           | texte                                                                                  |
  | `iid`                                | `number`                                                                                 |                                                                                        |
  | `title`, `webUrl`                    | `title`, `url`                                                                           |                                                                                        |
  | `draft` (RG-G02)                     | `isDraft`                                                                                |                                                                                        |
  | `createdAt`, `updatedAt`             | `createdAt`, `updatedAt`                                                                 |                                                                                        |
  | `commentsCount` (RG-G08)             | `comments { totalCount }` + `reviewThreads { totalCount }`                               | commentaires généraux + fils de revue de code (approximation, voir QO-020-01)          |
  | `approved` (RG-G07)                  | `latestOpinionatedReviews(first: 20) { nodes { state author { login } } }`               | vrai si au moins un `state = APPROVED` ; `reviewDecision` **n'est pas** utilisé (indépendance vis-à-vis des règles du dépôt, RG-G07) |
  | `changedFiles`, `additions`, `deletions` (RG-G03) | `changedFiles`, `additions`, `deletions`                                    | toujours présents (jamais `null`)                                                      |
  | `labels`                             | `labels(first: 50) { nodes { name } }`                                                   | RG-015-02 s'applique (`wip`, `on-hold`)                                                |
  | `author` (RG-G12)                    | `author { login avatarUrl url ... on User { name } }`                                    | `username = login` ; `name` = `name` ou `login` si vide / si l'auteur est un Bot ; `remoteUserId` = `login` (préfixé `bot:` pour un Bot, ces comptes n'ayant pas de `node_id` User stable exposé ici) |
  | `assignees` (RG-G06)                 | `assignees(first: 20) { nodes { login name avatarUrl url } }`                            | ordre GitHub                                                                           |
  | `reviewers` (RG-G06)                 | `reviewRequests(first: 20) { nodes { requestedReviewer { ... on User {…} } } }` **∪** auteurs de `latestOpinionatedReviews` | voir RG-020-08                                                            |
  | `mergeStatus` (RG-017)               | `mergeable`, `mergeStateStatus`, `reviewDecision`, `commits(last: 1) { nodes { commit { statusCheckRollup { state } } } }` | voir RG-020-09                                                     |

- **RG-020-08** : **Reviewers** : GitHub retire un utilisateur de `reviewRequests` dès qu'il a soumis une revue.
  Pour que la colonne Reviewer reste significative, `reviewers` = reviewers **demandés** (dans l'ordre GitHub) suivis
  des utilisateurs ayant **déjà soumis** une revue (`latestOpinionatedReviews`, ordre chronologique), dédupliqués,
  auteur exclu. Les équipes demandées en revue (`... on Team`) sont ignorées (voir QO-020-02).
- **RG-020-09** : **Statut de mergeabilité** (codes de RG-017-04, calculés par le mapper GitHub) :

  | Code RG-017-04           | Condition GitHub                                                                                     |
  |--------------------------|------------------------------------------------------------------------------------------------------|
  | `conflicts`              | `mergeable = CONFLICTING` ou `mergeStateStatus = DIRTY`                                              |
  | `pipeline_failed`        | `statusCheckRollup.state` ∈ {`FAILURE`, `ERROR`}                                                      |
  | `pipeline_running`       | `statusCheckRollup.state` ∈ {`PENDING`, `EXPECTED`}                                                   |
  | `pipeline_missing`       | jamais (l'absence de checks n'est pas un blocage sur GitHub ; `statusCheckRollup = null` → aucune raison) |
  | `changes_requested`      | `reviewDecision = CHANGES_REQUESTED`                                                                  |
  | `not_approved`           | `reviewDecision = REVIEW_REQUIRED` (sans `count`, GitHub n'expose pas le nombre restant)             |
  | `discussions_unresolved` | jamais (non disponible sans requête supplémentaire, voir QO-020-03)                                  |
  | `need_rebase`            | `mergeStateStatus = BEHIND`                                                                          |
  | `blocked_by_mr`          | jamais                                                                                               |
  | `policy`                 | `mergeStateStatus = BLOCKED` **et** aucune autre raison déjà présente (règles de protection non expliquées par les codes précédents) |
  | `other`                  | jamais                                                                                               |

  `state` : `unknown` si `mergeable = UNKNOWN` ou `mergeStateStatus = UNKNOWN` (GitHub calcule en arrière-plan) ;
  sinon `blocked` si `reasons` non vide ; sinon `mergeable` si `mergeable = MERGEABLE` et `mergeStateStatus` ∈
  {`CLEAN`, `HAS_HOOKS`, `UNSTABLE`} ; sinon `unknown`. RG-017-05 (drafts : `mergeStateStatus = DRAFT` ignoré, calcul
  sur les autres signaux) s'applique. Libellé `unknown` de l'infobulle : « Statut en cours de vérification par
  <nom de la forge> » (RG-017-08 paramétrée).
- **RG-020-10** : **Date Ready** : RG-G05 / RG-004-04 inchangées (transition `isDraft`). Amélioration possible via
  l'événement `ReadyForReviewEvent` de la timeline, non retenue (même position que QO-G03).
- **RG-020-11** : **Limites de débit** (RG-004-13 adaptée) : sur 403 ou 429 avec `X-RateLimit-Remaining: 0`, attendre
  jusqu'à `X-RateLimit-Reset` (plafonné à 30 s) ; sur 403/429 avec `Retry-After` (limite secondaire), attendre
  `Retry-After` (plafonné à 30 s) ; une seule nouvelle tentative, puis échec du repo. Une réponse GraphQL 200 contenant
  `errors[].type = RATE_LIMITED` est traitée comme un 429. Le budget de 60 s par repo (RG-004-14) est inchangé.
- **RG-020-12** : Erreurs : 401 → `ForgeAuthException` (« Jeton refusé (<connexion>) ») ; 403 hors limite de débit →
  idem (jeton fine-grained sans accès au dépôt) ; `repository = null` en GraphQL ou 404 → le repo échoue avec
  « Repo introuvable ou inaccessible » **sans** supprimer ses MRs (RG-004-03) ; erreurs GraphQL de schéma (champ
  inconnu sur une vieille GHES) → repo en échec avec « Version GitHub non supportée : <message> » (QO-020-04).
- **RG-020-13** : Les utilisateurs GitHub sont upsertés par (`connectionId`, `remoteUserId = login`) (RG-019-05),
  avec `avatarUrl` (`avatars.githubusercontent.com`, déjà autorisé par le CSP) et `webUrl`.

### Interface

- **RG-020-14** : Dans la section 02, une ligne GitHub affiche l'icône Lucide `github` ; le formulaire affiche sous
  le champ Jeton une aide : « Jeton classique avec le scope `repo` (ou `public_repo`), ou jeton fine-grained avec
  les permissions Pull requests, Commit statuses et Checks en lecture. » Le lien du titre (RG-G11) ouvre la PR
  GitHub. Aucun autre changement d'écran (indicateurs de forge : US-021).
- **RG-020-15** : Les textes visibles qui citent GitLab dans des contextes désormais génériques sont neutralisés
  dans `fr.json` : « Aucun jeton GitLab configuré » (déjà traité RG-019-17), « Fréquence de synchronisation
  automatique avec GitLab » → « … avec les forges », « Configurez d'abord un jeton GitLab » → RG-019-15. Les
  libellés propres au type (placeholders, aide jeton) restent spécifiques.

## 4. Maquettes de référence

- Wireframe **1c** — sections 02 et 03 (via US-019)
- Design system — icône Lucide `github` 16 px `neutral-600`

> ⚠️ **Écart avec les maquettes** : aucune maquette GitHub. La phase Architecte de US-019 couvre le formulaire de
> connexion ; cette US n'ajoute que l'option de type activée, l'aide sous le champ Jeton et le placeholder du chemin.

## 5. Critères d'acceptation

```gherkin
Scenario: Ajouter une connexion GitHub
  When je clique sur « + Ajouter une connexion » et je choisis « GitHub »
  Then l'URL vaut https://github.com et le nom proposé « github.com »
  When je saisis un jeton et je valide
  Then POST /api/v1/connections répond 201 avec type = github

Scenario: Tester un jeton classique valide
  Given GitHub répond 200 à GET /user avec X-OAuth-Scopes: repo, read:org et GitHub-Authentication-Token-Expiration: 2027-03-12 10:00:00 UTC
  When je clique sur « Tester la connexion »
  Then « ✓ Connecté · Marie Dupont (@mdupont) · expire le 12/03/2027 » s'affiche

Scenario: Tester un jeton fine-grained
  Given GitHub répond 200 à GET /user sans en-tête X-OAuth-Scopes ni expiration
  When je clique sur « Tester la connexion »
  Then « ✓ Connecté · Marie Dupont (@mdupont) · sans expiration · permissions non vérifiables » s'affiche

Scenario: Scope insuffisant
  Given GitHub répond 200 avec X-OAuth-Scopes: read:user
  When je clique sur « Tester la connexion »
  Then « Échec : scope insuffisant (repo ou public_repo requis) » s'affiche

Scenario: GitHub Enterprise Server
  Given une connexion GitHub d'URL https://github.exemple.fr
  When je teste la connexion
  Then l'appel part vers https://github.exemple.fr/api/v3/user
  When une synchronisation s'exécute
  Then les requêtes GraphQL partent vers https://github.exemple.fr/api/graphql

Scenario: Ajouter un dépôt par URL
  When j'ajoute « https://github.com/Equipe/Front-Web/pulls » sur la connexion GitHub
  Then GET /repos/Equipe/Front-Web est appelé
  And le repo est stocké avec pathWithNamespace = « equipe/front-web » (full_name renvoyé) et l'alias « front-web »

Scenario: Chemin invalide
  When j'ajoute « equipe/sous/front-web » sur une connexion GitHub
  Then l'API répond 400 projects.invalidPath (« Format attendu : owner/repo »)

Scenario: Dépôt privé inaccessible
  Given GitHub répond 404 à GET /repos/x/y
  When j'ajoute « x/y »
  Then « Projet introuvable ou inaccessible avec ce jeton » s'affiche

Scenario: Synchronisation d'un dépôt GitHub
  Given un dépôt GitHub avec 120 PRs ouvertes
  When une synchronisation s'exécute
  Then 3 requêtes GraphQL paginées (50, 50, 20) sont envoyées
  And 120 MRs sont présentes avec projectAlias, iid = number, webUrl = url

Scenario: Mapping d'une PR
  Given une PR isDraft = false, 4 commentaires généraux, 3 fils de revue, changedFiles = 7, additions = 200, deletions = 60, labels [« wip »], auteur login « kbenali » sans name
  Then commentsCount = 7, changedLines = 260, difficulty selon RG-G03, author.name = « kbenali »
  And si ignoredLabels contient « wip », la MR est masquée du tableau

Scenario: Approved indépendant des règles
  Given une PR avec reviewDecision = REVIEW_REQUIRED et une revue APPROVED de « mdupont »
  Then approved = true

Scenario: Reviewers après revue
  Given une PR avec reviewRequests = [« pmartin »] et une revue APPROVED soumise par « mdupont »
  Then reviewers = [« pmartin », « mdupont »]
  And « Mes MRs » avec meUsername = « mdupont » sur cette connexion inclut cette PR

Scenario: Équipe demandée en revue
  Given une PR dont reviewRequests contient uniquement l'équipe « frontend »
  Then reviewers = [] et la cellule affiche « — »

Scenario: Statut bloqué
  Given une PR mergeable = CONFLICTING, statusCheckRollup.state = FAILURE, reviewDecision = CHANGES_REQUESTED
  Then mergeStatus.state = blocked et reasons = [conflicts, pipeline_failed, changes_requested]

Scenario: Statut fusionnable sans CI
  Given une PR mergeable = MERGEABLE, mergeStateStatus = CLEAN, statusCheckRollup = null, reviewDecision = null
  Then mergeStatus.state = mergeable

Scenario: Statut inconnu
  Given une PR mergeable = UNKNOWN
  Then mergeStatus.state = unknown
  And l'infobulle affiche « Statut en cours de vérification par GitHub »

Scenario: Règle de protection seule
  Given une PR mergeable = MERGEABLE, mergeStateStatus = BLOCKED, statusCheckRollup.state = SUCCESS, reviewDecision = null
  Then reasons = [policy]

Scenario: Limite de débit
  Given GitHub répond 403 avec X-RateLimit-Remaining: 0 et X-RateLimit-Reset dans 10 s
  When une synchronisation s'exécute
  Then le backend attend ~10 s puis réessaie une fois
  And un second 403 fait échouer ce repo sans bloquer les autres

Scenario: Version GHES trop ancienne
  Given GraphQL répond avec une erreur « Field 'mergeStateStatus' doesn't exist »
  Then le repo est en échec avec « Version GitHub non supportée : … » et ses MRs en cache sont conservées

Scenario: Tableau mixte
  Given un repo GitLab et un repo GitHub configurés
  When le tableau s'affiche
  Then les MRs des deux sources sont mélangées, triées par date Ready (RG-G10)
  And les filtres Projet / Auteur / Affecté à listent les valeurs des deux forges
  And le compteur indique « N MRs · 2 projets »

Scenario: Aucune fuite du jeton GitHub
  When je consulte les logs après une synchronisation en échec 401
  Then aucun jeton ghp_ / github_pat_ ni en-tête Authorization n'y figure
```

## 6. Questions ouvertes

- **QO-020-01** : Le nombre de commentaires GitHub = commentaires généraux + fils de revue (RG-020-07) est une
  approximation (un fil de 5 messages compte 1). Alternative exacte : `reviews { nodes { comments { totalCount } } }`
  (plus coûteux). Hypothèse : approximation acceptable, le filtre « Commenté » (oui/non) n'est pas affecté.
- **QO-020-02** : Faut-il afficher les **équipes** demandées en revue (`@org/frontend`) comme un reviewer
  « virtuel » ? Hypothèse : ignorées (RG-020-08) ; les membres qui répondent apparaîtront via leur revue.
- **QO-020-03** : Faut-il récupérer les fils de revue non résolus (`reviewThreads { nodes { isResolved } }`, paginé)
  pour produire `discussions_unresolved` ? Hypothèse : non en v1, coût GraphQL ; `policy` couvre le cas où le dépôt
  exige la résolution.
- **QO-020-04** : Quelle version minimale de GHES supporter ? Les champs utilisés (`mergeStateStatus`,
  `latestOpinionatedReviews`, `statusCheckRollup`, `reviewDecision`) existent sur GHES ≥ 3.0. Hypothèse : aucune
  vérification préalable, échec explicite par repo (RG-020-12).
- **QO-020-05** : Les auteurs de type Bot (dependabot, renovate) doivent-ils être affichés comme des auteurs normaux
  ou exclus ? Hypothèse : affichés (avatar du bot, nom = login), filtrables par le filtre Auteur.
- **QO-020-06** : Les PRs issues de forks (`headRepository` ≠ dépôt) sont-elles à afficher ? Hypothèse : oui, sans
  distinction.

## 7. Hors périmètre

- Indicateurs de forge dans le tableau, filtre « Connexion » (US-021)
- GitHub Apps, OAuth, jetons d'installation
- Fils de revue non résolus (QO-020-03), détail des checks
- Bitbucket, Gitea, Azure DevOps
