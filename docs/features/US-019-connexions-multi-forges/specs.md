# US-019 — Connexions multi-forges (socle)

Fait partie de l'épique `docs/features/EPIC-001-multi-forges/README.md` (§5 : inventaire des impacts).

## 1. Reformulation

Remplacer la configuration « une instance GitLab + un jeton + une identité » par une **liste de connexions**, chacune
définie par un type de forge, un nom, une URL, un jeton et mon nom d'utilisateur sur cette forge. Les repos sont
rattachés à une connexion. Cette US ne livre **que GitLab** comme type (GitHub arrive avec US-020) : pour un
utilisateur GitLab actuel, le comportement fonctionnel est identique, seule la section « 02 · Connexions » change de
forme et sa configuration est migrée automatiquement.

## 2. User Stories

- **US-019** : En tant que tech lead, je veux déclarer une ou plusieurs connexions (instances GitLab, et à terme
  GitHub) avec leur jeton et mon identité sur chacune, et rattacher mes repos à ces connexions, afin de suivre dans
  un seul tableau des MRs venant de plusieurs sources.
    - Priorité : Must (prérequis de US-020)
    - Complexité estimée : L
    - Dépendances : US-015 (export/import), US-016 (dernière US touchant `settings`)

## 3. Règles de gestion

### Modèle et migration

- **RG-019-01** : Une **connexion** possède : `type` ∈ {`gitlab`, `github`} (seul `gitlab` est acceptable dans cette
  US, `github` renvoie 400 `connections.typeUnsupported` jusqu'à US-020), `name` (1 à 40 caractères, trimé, unique
  parmi les connexions, comparaison insensible à la casse), `url` (normalisée selon RG-001-01), un jeton (chiffré,
  RG-001-10, RG-G17), `meUsername` (nullable, RG-002-02) et des dates de création / modification.
- **RG-019-02** : Valeurs par défaut à la création dans l'UI : `type = gitlab`, `url = https://gitlab.com`,
  `name` proposé = hôte de l'URL sans `www.` (`gitlab.com`, `gitlab.exemple.fr`), modifiable ; si ce nom est déjà
  pris, le champ est laissé vide et en erreur « Nom déjà utilisé ».
- **RG-019-03** : Le jeton est **obligatoire à la création** (8 caractères minimum, RG-001-02) et optionnel à la
  modification (absent = inchangé). L'API ne renvoie que `tokenConfigured` et `tokenHint` (RG-001-03).
- **RG-019-04** : Un repo (`projects`) appartient à exactement une connexion (`connectionId`, clé étrangère avec
  suppression en cascade). Unicité d'un repo : (`connectionId`, `pathWithNamespace`) — le même chemin peut exister
  sur deux connexions. L'alias reste unique globalement (RG-003-04, inchangé, car il identifie la ligne dans le
  tableau et l'URL).
- **RG-019-05** : Les utilisateurs (`users`) sont uniques par (`connectionId`, `remoteUserId`) ; les identifiants
  distants (`remoteProjectId`, `remoteUserId`, `remoteId` de MR) sont stockés en **texte** (GitHub utilise des
  `node_id` chaînes).
- **RG-019-06** : **Migration automatique** au démarrage (détail EPIC-001 §6) : la configuration GitLab existante
  (URL, jeton, `meUsername`) devient une connexion nommée « GitLab » (ou l'hôte si « GitLab » est déjà pris — impossible
  en pratique), tous les repos lui sont rattachés. Sur une installation vierge (aucun jeton, aucun repo), aucune
  connexion n'est créée. Les colonnes `settings.gitlab_url`, `gitlab_token_encrypted`, `me_username` sont supprimées ;
  `me_email` reste global dans `settings`.

### Identité « moi » (RG-G09 amendée)

- **RG-019-07** : Mon identité est composée d'un **email global** (section 01, `settings.meEmail`, inchangé) et d'un
  **nom d'utilisateur par connexion** (`connections.meUsername`). Une MR est « à moi » si le `meUsername` de la
  connexion de son projet correspond (insensible à la casse) à l'auteur, un reviewer ou un assignee, ou, à défaut
  de username sur cette connexion, si l'email correspond (repli, quand la forge l'expose — GitLab uniquement).
- **RG-019-08** : Section `01 · Moi` : le champ email est conservé ; le champ unique « Nom d'utilisateur GitLab »
  est remplacé par **une ligne par connexion** (« Nom d'utilisateur sur <nom de la connexion> »), avec l'aperçu
  d'identité de RG-002-03 par ligne (détecté via le jeton / ne correspond pas / saisi manuellement). Ces champs sont
  enregistrés par le bouton global « Enregistrer » (`PUT /settings` avec `identities: [{ connectionId, username }]`).
  Sans connexion, la section affiche « Ajoutez d'abord une connexion » et un lien vers la section 02.
- **RG-019-09** : Après un test de connexion réussi sur une connexion, si son username est vide dans le formulaire,
  il est pré-rempli avec le username retourné (RG-002-04, par connexion). Le filtre « Mes MRs » (RG-002-05,
  RG-009) est désactivé si **aucune** connexion n'a de username.

### Écran Paramètres — section « 02 · Connexions »

- **RG-019-10** : La section `02 · Connexion GitLab` devient `02 · Connexions` (description : « Forges interrogées
  par MR Board. Jeton en lecture seule, stocké chiffré côté serveur. »). Elle affiche une **liste** (tableau
  compact, même style que le tableau des repos) avec, par ligne : icône de forge (Lucide `gitlab` / `github`), nom
  (600), URL (`neutral-600`), état du jeton (« Jeton configuré (…xxxx) » / « Aucun jeton » en `danger`), et trois
  actions icônes : « Tester », « Modifier », « Supprimer ». Sous la liste : bouton stroked « + Ajouter une
  connexion ». État vide : « Aucune connexion. Ajoutez votre première forge. » + le même bouton.
- **RG-019-11** : « Ajouter » / « Modifier » ouvrent un **formulaire inline** sous la liste (un seul ouvert à la
  fois ; ouvrir l'autre ferme le premier après confirmation si modifié) : Type (`mat-radio-group` horizontal
  « GitLab » / « GitHub » — GitHub désactivé avec tooltip « Bientôt disponible » jusqu'à US-020), Nom, URL, Jeton
  (masqué, afficher/masquer, RG-001-02), bouton « Tester la connexion » (RG-001-04/05, résultat sous le champ),
  boutons « Valider » (primary) et « Annuler ». Le type n'est **pas modifiable** après création.
- **RG-019-12** : Les connexions sont persistées **immédiatement** (`POST` / `PUT` / `DELETE /connections`),
  indépendamment du bouton global « Enregistrer », comme les repos (RG-003-10), avec toast « Connexion ajoutée » /
  « Connexion modifiée » / « Connexion supprimée ». Aucun test implicite à la création : le test reste manuel
  (RG-001-04) ; seule la validation de forme du jeton (8 caractères minimum) est appliquée. Une création ou une
  modification réussie déclenche une synchronisation des repos de la connexion (même principe que RG-004-15).
- **RG-019-13** : « Supprimer » ouvre le dialog de confirmation partagé : « Supprimer la connexion « <nom> » ? Ses N
  repos et leurs MRs seront retirés du tableau. » / « Annuler » / « Supprimer ». La suppression cascade sur repos,
  MRs et utilisateurs de la connexion. Pendant une synchronisation en cours, la suppression est acceptée ; la
  synchro ignore les projets disparus.
- **RG-019-14** : « Tester » depuis la liste teste avec le jeton enregistré (`POST /connections/test` avec
  `connectionId`) ; depuis le formulaire, avec les valeurs saisies (RG-001-04). Messages inchangés, préfixés du
  nom de la connexion dans le toast si lancé depuis la liste (« gitlab.com : ✓ Connecté · Marie Dupont »).

### Repos et synchronisation

- **RG-019-15** : Section `03 · Repos à scanner` : la ligne d'ajout gagne un sélecteur « Connexion » (`mat-select`)
  **uniquement s'il existe au moins deux connexions** ; avec une seule, elle est implicite. Le placeholder du champ
  chemin dépend du type de la connexion sélectionnée (« groupe/projet ou URL GitLab »). Avec deux connexions ou
  plus, une colonne « Connexion » (nom, `neutral-600`) est ajoutée au tableau des repos, avant l'alias. Sans
  connexion, l'ajout est désactivé avec le message « Ajoutez d'abord une connexion » (remplace RG-003-02
  `settings.tokenMissing`, code `connections.missing`, 409). Une connexion sans jeton refuse l'ajout de repo avec
  « Configurez d'abord le jeton de cette connexion » (409, `connections.tokenMissing`).
- **RG-019-16** : La synchronisation (RG-004-05) itère sur les connexions puis sur leurs repos, séquentiellement.
  Une connexion sans jeton fait échouer ses repos avec « Aucun jeton (<nom>) » ; un jeton refusé, avec « Jeton refusé
  (<nom>) » (RG-004-12). Le message d'erreur agrégé du `sync_run` (RG-004-06) préfixe chaque repo de sa connexion.
- **RG-019-17** : Bandeau du tableau (RG-004-10) : « Aucune connexion configurée. Les données affichées sont celles
  du dernier cache. » s'il n'y a aucune connexion ; « Aucun jeton configuré pour <nom>. » (un bandeau, listant les
  noms séparés par des virgules) si au moins une connexion n'a pas de jeton. « Rafraîchir » n'est désactivé que
  dans le premier cas.

### Export / import / reset

- **RG-019-18** : Export `version: 2` : `{ version: 2, settings: {…sans identités}, connections: [{ type, name,
  url, meUsername }], projects: [{ connection: <name>, pathWithNamespace, alias }] }`. Aucun jeton, jamais.
- **RG-019-19** : Import : `version: 1` accepté (converti : une connexion `gitlab` nommée « GitLab » avec
  `settings.gitlabUrl` et `settings.meUsername` ; ses repos) ; `version: 2` : connexions fusionnées par **nom**
  (insensible à la casse ; existantes : URL et `meUsername` mis à jour, jeton conservé ; nouvelles : créées **sans
  jeton**), repos rattachés par nom de connexion (repo dont la connexion n'a pas de jeton → ignoré avec la raison
  `connections.tokenMissing` ; connexion inconnue → ignoré `connections.unknown`). Le dialog de confirmation résume
  « N paramètres, C connexions (K nouvelles, sans jeton), M repos (J nouveaux) ». Un toast final rappelle de
  renseigner les jetons manquants.
- **RG-019-20** : « Réinitialiser » (RG-015-05) ne touche ni aux connexions, ni aux repos, ni aux identités par
  connexion.

### Backend — abstraction

- **RG-019-21** : Un contrat `ForgeClient` (`modules/forges/`) expose : `testConnection(url, token)`,
  `resolveProject(url, token, path)`, `fetchOpenMergeRequests(url, token, project, { deadlineAt })` et renvoie des
  types communs (`ForgeUser`, `ForgeProject`, `ForgeMergeRequest` — ce dernier contenant les champs de RG-004-01 et
  RG-017-01 sous forme **déjà normalisée**, dont `mergeStatus` calculé par un mapper propre à la forge). La factory
  choisit l'implémentation selon `connection.type`. Les modules `sync`, `projects`, `connections` ne dépendent que
  du contrat. Les exceptions sont renommées `Forge*` (codes i18n `forge.*`).
- **RG-019-22** : Contrat API :

  | Méthode | Route                     | Corps / Query                                                    | Réponse                                             |
  |---------|---------------------------|------------------------------------------------------------------|-----------------------------------------------------|
  | GET     | `/connections`            | —                                                                | `ConnectionDto[]` (`id, type, name, url, tokenConfigured, tokenHint, meUsername, projectsCount`) |
  | POST    | `/connections`            | `{ type, name, url, token }`                                     | 201 `ConnectionDto`                                 |
  | PUT     | `/connections/:id`        | `{ name?, url?, token? }`                                        | 200 `ConnectionDto`                                 |
  | DELETE  | `/connections/:id`        | —                                                                | 204                                                 |
  | POST    | `/connections/test`       | `{ type, url, token? , connectionId? }` (token absent → jeton de `connectionId`) | `TestConnectionResult` (RG-001-04)   |
  | PUT     | `/settings`               | + `identities?: [{ connectionId, username }]` ; − `gitlabUrl`, `gitlabToken`, `meUsername` | `SettingsDto` (+ identités)  |
  | POST    | `/projects`               | + `connectionId?` (obligatoire si ≥ 2 connexions)                | inchangé + `connectionId`                           |
  | GET     | `/merge-requests`         | —                                                                | + `connection: { id, name, type }` par MR           |

  `POST /settings/test-connection` est supprimé.

## 4. Maquettes de référence

- Wireframe **1c** — sections `01 · Moi`, `02 · Connexion GitLab`, `03 · Repos à scanner`
- Prototype — section 02 (`MR Board - Prototype.dc.html`, ligne ~151), tableau des repos (ligne ~163), pattern
  de ligne d'ajout, dialog de confirmation de suppression (US-003)

> ⚠️ **Écart avec les maquettes** : la liste de connexions, son formulaire inline, la déclinaison de la section
> « Moi » par connexion et le sélecteur de connexion des repos n'existent pas dans les maquettes. À concevoir en
> phase Architecte (`design.md`) en réutilisant strictement : le tableau compact des repos (RG-003), la ligne
> d'ajout, les `mat-form-field` de la section 02 actuelle, `mat-radio-group` (section 04), le
> `ConfirmDialogComponent` partagé et les toasts. Contraintes design system : règles 2 px, aucun arrondi, tout
> flush left, icônes Lucide `gitlab` / `github` 16 px en `neutral-600`.

## 5. Critères d'acceptation

```gherkin
Scenario: Migration d'une configuration GitLab existante
  Given une base v1.2 avec gitlabUrl = « https://gitlab.exemple.fr », un jeton, meUsername = « mdupont » et 3 repos
  When le backend démarre
  Then GET /api/v1/connections renvoie une connexion { type: gitlab, name: « GitLab », url: « https://gitlab.exemple.fr », tokenConfigured: true, meUsername: « mdupont », projectsCount: 3 }
  And les 3 repos ont connectionId = cette connexion
  And le tableau affiche les mêmes MRs qu'avant la migration
  And « Mes MRs » donne le même résultat qu'avant

Scenario: Installation vierge
  Given une base sans jeton ni repo
  When le backend démarre
  Then GET /api/v1/connections renvoie []
  And le tableau affiche le bandeau « Aucune connexion configurée. »

Scenario: Ajouter une connexion
  Given la section 02 affiche « Aucune connexion »
  When je clique sur « + Ajouter une connexion »
  Then un formulaire inline s'ouvre avec Type = GitLab, URL = https://gitlab.com, Nom = « gitlab.com »
  When je saisis un jeton valide et je clique sur « Valider »
  Then POST /api/v1/connections est appelé et répond 201
  And la liste affiche la ligne « gitlab.com · https://gitlab.com · Jeton configuré (…wxyz) »
  And un toast « Connexion ajoutée » s'affiche

Scenario: Nom en doublon
  Given une connexion « gitlab.com » existe
  When je crée une connexion nommée « GITLAB.COM »
  Then l'API répond 400 connections.nameDuplicate et le champ Nom est en erreur

Scenario: Type GitHub indisponible dans cette US
  When j'ouvre le formulaire d'ajout
  Then l'option « GitHub » est désactivée avec le tooltip « Bientôt disponible »
  And POST /api/v1/connections avec type = github répond 400 connections.typeUnsupported

Scenario: Modifier sans ressaisir le jeton
  Given une connexion avec jeton
  When je modifie son URL et je valide sans saisir de jeton
  Then le jeton est conservé (tokenConfigured reste true)

Scenario: Tester depuis la liste
  Given une connexion « gitlab.com » avec jeton valide
  When je clique sur l'icône « Tester » de sa ligne
  Then POST /api/v1/connections/test est appelé avec connectionId et sans jeton
  And un toast « gitlab.com : ✓ Connecté · Marie Dupont (@mdupont) · expire le 12/03/2027 » s'affiche

Scenario: Supprimer une connexion
  Given une connexion avec 2 repos et 5 MRs
  When je clique sur « Supprimer » et je confirme « Supprimer la connexion « gitlab.com » ? Ses 2 repos et leurs MRs seront retirés du tableau. »
  Then DELETE /api/v1/connections/:id répond 204
  And GET /api/v1/projects ne contient plus ces repos
  And GET /api/v1/merge-requests ne contient plus ces MRs

Scenario: Identité par connexion
  Given deux connexions « gitlab.com » et « gitlab.exemple.fr »
  When j'ouvre la section 01 · Moi
  Then je vois un champ « Nom d'utilisateur sur gitlab.com » et un champ « Nom d'utilisateur sur gitlab.exemple.fr » plus le champ Email
  When je saisis « mdupont » et « marie.d » puis j'enregistre
  Then PUT /api/v1/settings contient identities = [{ connectionId: 1, username: « mdupont » }, { connectionId: 2, username: « marie.d » }]

Scenario: Mes MRs avec deux identités
  Given « mdupont » est reviewer d'une MR sur gitlab.com et « marie.d » auteur d'une MR sur gitlab.exemple.fr
  And un utilisateur « mdupont » existe aussi sur gitlab.exemple.fr comme auteur d'une troisième MR
  When j'active « Mes MRs »
  Then les deux premières MRs sont affichées
  And la troisième ne l'est pas (mdupont n'est pas mon identité sur gitlab.exemple.fr)

Scenario: Sélecteur de connexion des repos
  Given une seule connexion
  Then la ligne d'ajout de repo n'affiche pas de sélecteur « Connexion » et le tableau des repos n'a pas de colonne « Connexion »
  Given une seconde connexion est ajoutée
  Then le sélecteur apparaît, la première connexion est présélectionnée, et la colonne « Connexion » apparaît

Scenario: Même chemin sur deux connexions
  Given « equipe/api » est configuré sur gitlab.com avec l'alias « api »
  When j'ajoute « equipe/api » sur gitlab.exemple.fr avec l'alias « api-interne »
  Then l'ajout réussit
  When j'ajoute « equipe/api » sur gitlab.exemple.fr avec l'alias « api »
  Then l'API répond 400 projects.aliasDuplicate

Scenario: Synchronisation avec une connexion sans jeton
  Given deux connexions, la seconde sans jeton
  When une synchronisation s'exécute
  Then les repos de la première sont synchronisés
  And le run est « partial » avec le message « Aucun jeton (gitlab.exemple.fr) : equipe/api, equipe/web »
  And le tableau affiche le bandeau « Aucun jeton configuré pour gitlab.exemple.fr. »

Scenario: Export v2
  When j'exporte la configuration
  Then le fichier a version = 2, connections sans jeton, projects avec connection = nom de la connexion

Scenario: Import v1
  Given un fichier d'export version 1 avec gitlabUrl et 2 repos
  When je l'importe
  Then une connexion « GitLab » est créée (ou fusionnée) sans jeton
  And le résumé indique « 1 connexion (1 nouvelle, sans jeton) »
  And les 2 repos sont ignorés avec la raison connections.tokenMissing tant que le jeton n'est pas renseigné

Scenario: Import v2 avec connexion inconnue
  Given un fichier v2 dont un repo référence la connexion « inexistante »
  When je l'importe
  Then ce repo est ignoré avec la raison connections.unknown et les autres sont importés

Scenario: Aucune fuite de jeton
  When j'appelle GET /api/v1/connections, GET /api/v1/settings/export et que je consulte les logs
  Then aucun jeton en clair n'apparaît
```

## 6. Questions ouvertes

- **QO-019-01** : Le nom de connexion par défaut doit-il être l'hôte (`gitlab.com`) ou le type (« GitLab ») ?
  Hypothèse : l'hôte (RG-019-02), plus discriminant avec plusieurs instances ; la migration utilise « GitLab » pour
  la connexion héritée.
- **QO-019-02** : Faut-il permettre de **désactiver** une connexion sans la supprimer (pause) ? Hypothèse : non,
  même position que pour les repos (QO-003-01) ; colonne `enabled` réservée.
- **QO-019-03** : L'identité par connexion doit-elle être éditée dans la section 01 (choix retenu, RG-019-08) ou
  dans le formulaire de chaque connexion (section 02) ? Hypothèse : section 01 pour garder « Moi » au même endroit
  et ne pas mélanger persistance immédiate (connexions) et bouton global.
- **QO-019-04** : Faut-il conserver `POST /settings/test-connection` en alias déprécié ? Hypothèse : non, l'API
  n'a qu'un seul client (le frontend).
- Voir QO-E01-01 à QO-E01-04 (épique).

## 7. Hors périmètre

- Type GitHub (US-020), indicateurs dans le tableau et filtre « Connexion » (US-021)
- Désactivation temporaire d'une connexion
- OAuth, GitHub Apps
