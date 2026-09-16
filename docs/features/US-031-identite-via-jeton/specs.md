# US-031 — Identité « Moi » résolue depuis le jeton, section supprimée

Version : 1.0 — 2026-09-16
Statut : proposition PO, à valider avant `/project:feature US-031`.
Remplace **US-002** (Paramètres — Identité « Moi ») et amende **US-019** (RG-019-07/08/09/12/24/25) et
**US-023** (RG-023-02/03/15) — voir §3 « Cohérence avec les US existantes ».

## 1. Reformulation

Aujourd'hui, mon identité sur chaque connexion (`meUsername`) est **saisie à la main** dans la section `01 · Moi`
des paramètres, avec un aperçu qui indique si elle « correspond » ou non au jeton (US-002, RG-002-03). Cette saisie
manuelle est source d'erreur (faute de frappe, oubli de mise à jour) et fait double emploi avec une information que
MR Board connaît déjà : le jeton de chaque connexion identifie sans ambiguïté un compte GitLab ou GitHub.

On supprime donc la section `01 · Moi` et toute saisie manuelle d'identité. Mon nom d'utilisateur (et mon email,
quand la forge l'expose) sont désormais **résolus automatiquement depuis le jeton de chaque connexion**, affichés en
lecture seule dans la section « Connexions » sous la forme « Connecté en tant que … ». La case « Surligner mes MRs
dans le tableau », qui ne dépend d'aucune connexion, est conservée mais déplacée dans la section « Divers ». Le
calcul de « Mes MRs » et de l'anneau de surbrillance (RG-G09, RG-023-04/05) continue de fonctionner exactement
comme avant, à la seule différence que l'identité comparée pour chaque connexion est désormais celle résolue par le
jeton plutôt que celle saisie par l'utilisateur.

## 2. User Stories

- **US-031** : En tant qu'utilisateur, je veux que MR Board déduise automatiquement mon identité (nom d'utilisateur,
  email) sur chaque connexion à partir de son jeton, afin de ne plus avoir à la saisir ni à la maintenir à jour.
    - Priorité : Must
    - Complexité estimée : L
    - Dépendances : US-002 (remplacée), US-019 (connexions, amendée), US-023 (surbrillance, amendée)

## 3. Cohérence avec les US existantes

- **US-002** est intégralement remplacée : plus de champ « Nom d'utilisateur GitLab »/« email » saisissable, plus
  d'aperçu « détecté via le jeton / ne correspond pas / saisi manuellement » (RG-002-03) — cet état de « désaccord »
  entre saisie et jeton n'a plus de sens puisqu'il n'y a plus de saisie.
- **US-019** est amendée : RG-019-07/08/09 (identité par connexion saisie dans « 01 · Moi », pré-remplissage après
  test) sont remplacées par les règles RG-031-* ci-dessous. RG-019-12 (« aucun test implicite à la création ») est
  amendée : la création et la modification du jeton d'une connexion déclenchent désormais une résolution
  automatique de l'identité (RG-031-03), en plus de la synchronisation des repos déjà prévue. RG-019-24 (case
  « Surligner mes MRs » dans la section 01) est remplacée par RG-031-06 (case dans « Divers »). RG-019-25 (résolution
  de l'identité par connexion pour `isMe`) reste valable dans son principe, seule la source de l'identité change
  (RG-031-07).
- **US-023** est amendée : RG-023-02 (case dans « 01 · Moi », sous l'aperçu d'identité) devient RG-031-06 (case dans
  « Divers », plus d'aperçu d'identité à proximité). RG-023-03 (case active même identité vide) et RG-023-15
  (identité par connexion, anticipée sans travail à l'époque) sont reprises telles quelles, la source de l'identité
  changeant (RG-031-08). Aucun changement sur le rendu de l'anneau lui-même (RG-023-07 à 14).
- **RG-G09**, **RG-G12** (glossaire, modèle conceptuel) sont amendées en cohérence, voir §7 « Impacts documentaires ».

## 4. Règles de gestion

### Suppression de la section « Moi »

- **RG-031-01** : La section `01 · Moi` disparaît intégralement de l'écran Paramètres : plus de champ « Nom
  d'utilisateur sur <connexion> », plus de champ « Email », plus d'aperçu d'identité. Le contrat `PUT /settings`
  perd le champ `identities` (RG-019-08) et le champ `meEmail` (RG-002-02) ; `Settings.meEmail` (colonne
  `me_email`) est supprimée (migration TypeORM).

### Résolution automatique de l'identité par connexion

- **RG-031-02** : Chaque connexion porte désormais une **identité résolue**, en lecture seule, alimentée par
  l'API de sa forge (`GET /api/v4/user` GitLab, `GET /user` GitHub — même appel que le test de connexion existant,
  RG-001-04) : nom d'utilisateur, nom complet, email (`null` si la forge ne l'expose pas — GitHub sans email public
  ni scope `user:email` notamment) et URL d'avatar. Remplace `Connection.meUsername` (saisi) par
  `Connection.resolvedUsername` / `resolvedName` / `resolvedEmail` / `resolvedAvatarUrl` (résolus).
- **RG-031-03** : La résolution est **automatique**, sans action de l'utilisateur, déclenchée dans les mêmes
  circonstances qu'une synchronisation de connexion (RG-004-15, RG-019-12, RG-013-01) : à l'ajout d'une connexion, à
  la modification de son jeton, à chaque synchronisation planifiée ou manuelle (« Rafraîchir ») — y compris pour une
  connexion sans aucun repo, contrairement à la synchronisation des MRs qui n'a rien à faire dans ce cas. Un échec de
  résolution (jeton invalide, forge injoignable) **n'empêche pas** la synchronisation des repos de la connexion
  (même principe que RG-G16) et **conserve la dernière identité résolue avec succès** (pas de remise à zéro) ; il
  n'est pas affiché comme une erreur supplémentaire, le bandeau existant (« Jeton refusé (<nom>) », RG-019-16) rend
  déjà compte du jeton en cause.
- **RG-031-04** : Le bouton « Tester » d'une connexion (RG-019-14, liste ou formulaire) déclenche en plus une
  résolution immédiate : sur un test réussi, l'identité résolue de la connexion est mise à jour dans la foulée (pas
  besoin d'attendre la prochaine synchronisation). Un test échoué ne change rien à l'identité déjà résolue
  (RG-031-03).
- **RG-031-05** : Tant qu'aucune résolution n'a réussi pour une connexion (jeton absent, jeton jamais testé avec
  succès, ou premher cycle non encore exécuté), son identité résolue est `null` sur les quatre champs.

### Affichage dans la section « Connexions »

- **RG-031-06** : Chaque ligne de connexion affiche, sous ses informations existantes (type, nom, URL, état du
  jeton, RG-019-10), une ligne « Connecté en tant que » :
  - **Résolue** : avatar 28 px (photo si disponible sinon initiales, RG-G12) + nom complet + « @<username> » + email
    (omis si `null`) — reprend le pattern d'aperçu d'identité de l'ex-RG-002-03 (avatar, nom, tag), sans les tags
    « détecté via le jeton »/« ne correspond pas »/« saisi manuellement » qui n'ont plus de sens.
  - **Non résolue, jeton configuré** : texte `neutral-600` « Identité non résolue » (résolution pas encore
    effectuée, ou en échec — RG-031-03).
  - **Aucun jeton configuré** : la ligne « Connecté en tant que » n'est pas affichée (cohérent avec l'état « Aucun
    jeton » déjà affiché pour le jeton, RG-019-10).
- **RG-031-07** : La case « Surligner mes MRs dans le tableau (auteur, reviewer, affecté) » (ex-RG-023-02) est
  déplacée dans la section **« Divers »**, en tête de section (avant les options existantes de RG-015-*), sans
  changement de comportement, de valeur par défaut (`true`) ni de contrat API (`highlightMe`, RG-023-01 inchangée).
  Elle reste active même si aucune connexion n'a d'identité résolue (ex-RG-023-03) : dans ce cas, aucun anneau ne
  s'affiche (ex-RG-023-05), comme aujourd'hui avec une identité vide.

### Identité « moi » (RG-G09, RG-023-04/05 amendées)

- **RG-031-08** : Une MR est « à moi » (RG-G09) si le `resolvedUsername` (à défaut, faute de mieux, le
  `resolvedEmail`) de la connexion de son projet correspond, insensible à la casse, à l'auteur, un reviewer ou un
  assigné. C'est la seule modification de RG-G09 : la source de l'identité comparée passe du champ saisi au champ
  résolu. `domain/is-mine.ts` (`isMe`, `isMine`) n'est pas modifié : seule `merge-requests.service.ts` change la
  provenance de l'`Identity` qu'il lui passe (RG-019-25 → connexion.`resolvedUsername`/`resolvedEmail`).
- **RG-031-09** : Le calcul `isMe` par utilisateur (RG-023-04/05, promotion d'avatar RG-023-06) est inchangé au-delà
  de RG-031-08 : c'est la même fonction pure, alimentée différemment.
- **RG-031-10** : Conséquence directe : il ne peut plus exister de MR où « Mes MRs » ou l'anneau se trompent parce
  que le champ saisi divergeait du jeton réel (l'ex-état « ne correspond pas au jeton », RG-002-03, disparaît avec
  la saisie elle-même) — seule une identité pas encore résolue peut laisser « Mes MRs » inactif (RG-031-11).

### Renumérotation des sections et bandeaux

- **RG-031-11** : Les sections de l'écran Paramètres sont renumérotées après suppression de `01 · Moi` :
  `01 · Connexions` (ex-02), `02 · Actualisation` (ex-03), `03 · Difficulté` (ex-04), `04 · Temps depuis Ready`
  (ex-05), `05 · Divers` (ex-06, accueille désormais la case de surbrillance).
- **RG-031-12** : Le chip « Mes MRs » (RG-009-03) reste désactivé, avec une infobulle, tant qu'**aucune connexion**
  n'a d'identité résolue — le texte de l'infobulle change de « Configurez votre identité dans les paramètres » à
  « Ajoutez une connexion avec un jeton valide » (il n'existe plus d'écran de configuration d'identité à indiquer).

### Migration

- **RG-031-13** : Migration TypeORM : ajout de `connections.resolved_username`, `resolved_name`, `resolved_email`,
  `resolved_avatar_url` (texte, nullable) ; **seed** : `resolved_username` de chaque connexion existante est
  initialisé à son ancien `me_username` (pour ne pas casser « Mes MRs » le temps du premier cycle de résolution
  post-migration), les trois autres colonnes restent `null` jusqu'à la première résolution réussie. Suppression des
  colonnes `connections.me_username` et `settings.me_email`.
- **RG-031-14** : Export (`GET /settings/export`, RG-019-18) : le tableau `connections[]` perd le champ
  `meUsername` (rien à exporter, il n'y a plus de saisie) ; l'identité résolue n'est **pas** exportée non plus (elle
  sera reconstituée après import dès que le jeton sera renseigné et une synchronisation exécutée — les connexions
  importées n'ont jamais de jeton, RG-019-19). Import (`POST /settings/import`) : le champ `meUsername` d'un export
  `version: 2` antérieur à cette US, s'il est présent, est **ignoré silencieusement** (compatibilité ascendante,
  pas d'erreur de validation) ; la conversion `version: 1` (RG-019-19) ignore de même l'ancien `meUsername` global.

### Contrat API

- **RG-031-15** :

  | Méthode | Route                | Changement                                                                                   |
  |---------|----------------------|-----------------------------------------------------------------------------------------------|
  | GET     | `/connections`       | `ConnectionDto` : `meUsername` → `identity: { username, name, email, avatarUrl } \| null`     |
  | POST    | `/connections`       | Réponse : `identity` toujours `null` à la création (résolution async, RG-031-03)              |
  | PUT     | `/connections/:id`   | Réponse : `identity` inchangée si le jeton n'a pas changé, sinon `null` jusqu'à la prochaine résolution |
  | POST    | `/connections/test`  | `TestConnectionResult` gagne `email: string \| null` ; effet de bord : persiste `identity` sur la connexion testée (RG-031-04) |
  | GET/PUT | `/settings`          | Suppression de `meEmail` (réponse et corps) ; `PUT` perd `identities`                          |

## 5. Maquettes de référence

- Wireframe **1c**, prototype (`MR Board - Prototype.dc.html`) : aucune maquette existante pour l'affichage
  « Connecté en tant que » dans la section Connexions — **écart avec les maquettes**, à concevoir en phase
  Architecte en réutilisant strictement l'avatar 28 px et le pattern d'aperçu d'identité de l'ex-section « Moi »
  (RG-002-03, avatar + nom complet + username), sans les tags de correspondance (RG-031-06).
- La case de surbrillance déplacée reprend son style actuel (`mat-checkbox` pleine largeur, RG-023-02) tel
  qu'illustré en section `01 · Moi` des wireframes, simplement rattachée à la section « Divers ».
- `docs/tech/design-system.md` §4 — composant Avatar (identique, réutilisé sans changement).

## 6. Critères d'acceptation

```gherkin
Scenario: Suppression de la section Moi
  Given je suis sur /settings
  Then il n'existe plus de section « Moi »
  And les sections sont numérotées « 01 · Connexions », « 02 · Actualisation », « 03 · Difficulté »,
      « 04 · Temps depuis Ready », « 05 · Divers »

Scenario: Case de surbrillance déplacée
  When j'ouvre la section « 05 · Divers »
  Then j'y trouve la case « Surligner mes MRs dans le tableau (auteur, reviewer, affecté) », cochée par défaut
  And GET /api/v1/settings renvoie toujours highlightMe = true

Scenario: Identité résolue automatiquement à l'ajout d'une connexion
  Given une connexion « gitlab.com » vient d'être créée avec un jeton valide
  When la synchronisation qu'elle déclenche (RG-004-15) se termine
  Then la ligne de connexion affiche « Connecté en tant que » avec l'avatar, le nom complet et « @mdupont »
  And GET /api/v1/connections renvoie identity = { username: « mdupont », name: « Marie Dupont », email, avatarUrl }

Scenario: Identité non résolue avant le premier cycle
  Given une connexion vient d'être créée (POST /connections vient de répondre 201)
  Then identity vaut null dans la réponse
  And la ligne de connexion affiche « Identité non résolue »

Scenario: Jeton invalide ne réinitialise pas l'identité déjà connue
  Given une connexion a déjà une identité résolue « mdupont »
  When son jeton devient invalide (révoqué côté forge) et qu'une synchronisation s'exécute
  Then la synchronisation échoue pour cette connexion (bandeau « Jeton refusé »)
  And GET /api/v1/connections renvoie toujours identity.username = « mdupont » (dernière valeur connue)

Scenario: Résolution immédiate via « Tester »
  Given une connexion sans identité résolue, avec un jeton valide
  When je clique sur « Tester » depuis la liste et le test réussit
  Then GET /api/v1/connections renvoie aussitôt l'identity résolue, sans attendre une synchronisation planifiée

Scenario: Aucun jeton configuré
  Given une connexion sans jeton
  Then la ligne « Connecté en tant que » n'est pas affichée

Scenario: Mes MRs par connexion, identité résolue
  Given deux connexions « gitlab.com » (identity.username = « mdupont ») et « gitlab.exemple.fr » (identity.username = « marie.d »)
  And une MR sur gitlab.com dont mdupont est reviewer, une MR sur gitlab.exemple.fr dont mdupont est auteur (homonyme)
  When j'active « Mes MRs »
  Then seule la première MR est affichée (RG-031-08, identité par connexion inchangée dans son principe)

Scenario: Surbrillance par connexion inchangée
  Given highlightMe = true et l'identité résolue de la connexion du projet de la MR api!412 est « mdupont »
  And api!412 a pour reviewer et affecté mdupont
  When j'ouvre le tableau
  Then les avatars Reviewer et Affecté de api!412 portent l'anneau accent

Scenario: Chip Mes MRs désactivé sans identité résolue
  Given aucune connexion n'a d'identité résolue (aucun jeton valide nulle part)
  Then le chip « Mes MRs » est désactivé avec l'infobulle « Ajoutez une connexion avec un jeton valide »

Scenario: Migration d'une base existante
  Given une base antérieure avec une connexion meUsername = « mdupont » et settings.meEmail = « marie@exemple.fr »
  When le backend démarre avec cette US
  Then GET /api/v1/connections renvoie identity.username = « mdupont » (seedé depuis l'ancien champ) et identity.email = null
  And GET /api/v1/settings ne renvoie plus de champ meEmail
  And « Mes MRs » continue de fonctionner comme avant, sans interruption, en attendant la première résolution post-migration

Scenario: Export sans identité
  When j'exporte la configuration
  Then connections[] ne contient pas de champ meUsername ni de champ d'identité résolue

Scenario: Import d'un export version 2 antérieur avec meUsername
  Given un fichier version 2 exporté avant cette US, dont une connexion porte encore meUsername = « mdupont »
  When je l'importe
  Then l'import réussit, meUsername est ignoré silencieusement, aucune erreur de validation n'est levée

Scenario: PUT /settings n'accepte plus les champs d'identité
  When j'appelle PUT /api/v1/settings avec { identities: [...] } ou { meEmail: "x@y.z" }
  Then ces champs sont ignorés (propriétés inconnues, `whitelist: true`), la requête n'échoue pas pour autant si
       d'autres champs valides sont présents

Scenario: Parité des dictionnaires après suppression des clés settings.me.*
  When j'exécute les tests unitaires du frontend après cette US
  Then dictionary-parity.spec.ts passe : fr.json et en.json n'ont plus aucune clé settings.me.*
  And les nouvelles clés (settings.connections.identity*, tooltip Mes MRs mis à jour) existent dans les deux fichiers
```

## 7. Impacts documentaires (`docs/features/README.md`)

À appliquer à la livraison (comme les US précédentes le font en fin de §10) :
- §3 Glossaire, terme **« Moi »** : reformulé — « Identité de l'utilisateur courant, résolue automatiquement à
  partir du jeton de chaque connexion (aucune saisie), utilisée par « Mes MRs » et l'anneau « moi » ».
- §4.2, section 01 « Moi » supprimée ; renumérotation 02→01, 03→02, 04→03, 05→04, 06→05 (RG-031-11) ; section
  « Connexions » (01) gagne la mention « Connecté en tant que » par ligne ; section « Divers » (05) gagne la case de
  surbrillance en tête.
- §5, **RG-G09** amendée (RG-031-08 : identité résolue plutôt que saisie).
- §6 Modèle conceptuel : `Connection` porte `resolvedUsername/resolvedName/resolvedEmail/resolvedAvatarUrl`
  (résolus) au lieu de `meUsername` (saisi) ; `Settings` perd `meEmail`.
- §7 Roadmap : ajouter la ligne US-031 (Must, L, dépend de US-002/US-019/US-023) ; marquer US-002 comme remplacée
  par US-031 dans sa colonne Statut.

## 8. Questions ouvertes

- **QO-031-01** : Faut-il un indicateur de fraîcheur (« résolu il y a 2 min ») à côté de « Connecté en tant que » ?
  Hypothèse : non en v1 — la fraîcheur suit celle de la synchronisation de la connexion, déjà visible via le
  statut global de synchro du tableau (RG-004-10).
- **QO-031-02** : Faut-il déclencher une résolution d'identité **dédiée et immédiate** à la création d'une connexion
  (appel synchrone bloquant la réponse `POST /connections`), plutôt que d'attendre la synchronisation qu'elle
  déclenche (RG-031-03, async) ? Hypothèse retenue : non — cohérent avec RG-019-12 (« connexions persistées
  immédiatement, indépendamment de tout appel forge bloquant ») et avec le principe déjà en place selon lequel les
  repos/MRs d'une connexion n'apparaissent eux aussi qu'après la synchronisation déclenchée, pas dans la réponse de
  création. Cela laisse un court instant « Identité non résolue » après l'ajout, jugé acceptable (RG-031-05). À
  confirmer avec l'utilisateur.
- **QO-031-03** : Le repli sur `resolvedEmail` (RG-031-08, héritage de RG-G09) a-t-il encore un intérêt maintenant
  que `resolvedUsername` et `resolvedEmail` proviennent du **même** appel API (jamais l'un sans l'autre en
  pratique) ? Hypothèse : conservé pour fidélité à RG-G09 et par cohérence avec `domain/is-mine.ts` existant (déjà
  documenté comme limitation connue), mais son utilité réelle reste nulle en pratique — à documenter, pas à retirer.
- **QO-031-04** : GitHub n'expose l'email que si le jeton porte le scope `user:email` **et** que l'utilisateur en a
  un public/visible ; dans le cas contraire `resolvedEmail` reste `null` alors que `resolvedUsername` est bien
  résolu. Accepté comme tel (RG-031-02 le prévoit déjà : « `null` si la forge ne l'expose pas »).
- Voir QO-002-01 (autocomplétion, devenue sans objet), QO-G10 (identité par connexion, tranchée par US-019 et
  inchangée ici).

## 9. Hors périmètre

- Ré-authentification OAuth ou tout flux de connexion interactif : l'identité reste résolue à partir du jeton
  personnel déjà configuré (RG-019-01), pas d'un nouveau mode d'authentification.
- Affichage d'un historique des identités résolues ou d'un horodatage de fraîcheur (QO-031-01).
- Résolution immédiate et bloquante à la création d'une connexion (QO-031-02).
- Reconstitution de l'email des utilisateurs GitLab/GitHub *tiers* (auteur, reviewers, assignees des MRs) — seule
  **mon** identité (celle du jeton) est concernée par cette US ; la limitation connue de `domain/is-mine.ts` pour le
  repli email sur les autres utilisateurs n'est pas levée (QO-031-03).
- Choix ou modification manuelle de l'identité résolue (pas de champ « corriger mon identité ») : elle est
  entièrement dérivée du jeton, cohérent avec l'objectif de cette US.
