# US-023 — Mise en surbrillance de l'utilisateur dans le tableau

Version : 1.0 — 2026-09-13
Statut : proposition PO, à valider avant `/project:feature US-023`.
Design de référence : commit `36cd4b4` (« Prototype et wireframe support github & surbrillance utilisateur »).

## 1. Reformulation

Dans le tableau des MRs, l'utilisateur veut repérer **immédiatement** les lignes qui le concernent et, sur chacune,
**en quelle qualité** : auteur, reviewer ou affecté. Pour cela, l'avatar (initiales ou photo) de l'utilisateur
courant — l'identité « Moi » des paramètres (US-002, RG-G09) — est entouré d'un **anneau accent** partout où il
apparaît dans les colonnes Auteur, Reviewer et Affecté. Le reste de la ligne ne change pas : c'est un marquage
ponctuel, lisible en balayant la colonne, complémentaire du filtre « Mes MRs » (US-009) qui, lui, masque tout le
reste.

Le comportement est activé par défaut et désactivable par une case à cocher dans la section `01 · Moi` des
paramètres. Cette US concrétise le « léger marquage visuel » évoqué par RG-009-06, resté optionnel jusqu'ici.

## 2. User Stories

- **US-023** : En tant qu'utilisateur, je veux que mon avatar soit mis en surbrillance dans les colonnes Auteur,
  Reviewer et Affecté du tableau, afin d'identifier d'un coup d'œil les MRs qui me concernent et mon rôle sur
  chacune, sans filtrer le tableau.
    - Priorité : Should
    - Complexité estimée : S
    - Dépendances : US-002 (identité « Moi »), US-009 (`isMine`, RG-G09), US-015 (export / import /
      réinitialisation), US-018 (tokens de thème : l'anneau doit fonctionner en clair et en sombre)

## 3. Règles de gestion

### Préférence

- **RG-023-01** : Nouveau paramètre booléen `highlightMe`, défaut **`true`**. Persisté côté backend avec les autres
  paramètres (`GET`/`PUT /settings`, colonne `highlight_me`, migration TypeORM), inclus dans l'export / import
  (RG-015-03/04 ; `version` d'export inchangée : champ optionnel, absent = `true`) et remis à `true` par
  « Réinitialiser » (RG-015-05).
- **RG-023-02** : Contrôle dans la section **`01 · Moi`**, sous forme d'une `mat-checkbox` placée **sous l'aperçu de
  l'identité** (RG-002-03), sur toute la largeur de la section, libellée « Surligner mes MRs dans le tableau (auteur,
  reviewer, affecté) ». Comme les autres cases, la valeur n'est appliquée au tableau qu'après « Enregistrer »
  (pas d'aperçu immédiat : le tableau n'est pas visible depuis l'écran Paramètres). Le formulaire est marqué
  modifié (RG-001-06) ; « Annuler » restaure la valeur enregistrée.
- **RG-023-03** : La case reste **active** même si l'identité (username et email) est vide : le réglage est conservé
  pour le jour où l'identité sera renseignée ; dans l'intervalle, aucun anneau n'est affiché (RG-023-05). Aucun
  message supplémentaire n'est ajouté sous la case (le chip « Mes MRs » porte déjà l'infobulle « Configurez votre
  identité dans les paramètres », RG-009-03).

### Détermination de « moi »

- **RG-023-04** : La correspondance est calculée **par personne et par rôle**, avec la règle RG-G09 (username, ou à
  défaut email, comparaison insensible à la casse) : sur une même ligne, l'auteur, chacun des reviewers et chacun
  des assignees sont évalués séparément. Une MR où je suis à la fois reviewer et affecté porte donc deux anneaux ;
  une MR dont je suis l'auteur et où un collègue est reviewer n'en porte qu'un, sur l'avatar Auteur.
- **RG-023-05** : Le calcul est fait **côté backend**, source unique de vérité pour RG-G09 (le frontend ne connaît ni
  l'email des utilisateurs GitLab ni la logique de repli) : chaque utilisateur du DTO `MergeRequestView` (`author`,
  `reviewers[]`, `assignees[]`) porte un champ **`isMe: boolean`**. Invariant : `isMine` (RG-009-06) ⇔
  `author.isMe || reviewers.some(isMe) || assignees.some(isMe)`. Si l'identité est vide, tous les `isMe` valent
  `false`. Le champ est renvoyé **indépendamment** de `highlightMe` (qui n'est qu'une préférence d'affichage) :
  le backend ne lit pas `highlightMe` pour construire la réponse.
- **RG-023-06** : **Plusieurs reviewers / assignees** (RG-G06 : seul le premier est affiché, avec « +N ») : quand
  `highlightMe` est actif et que je figure parmi les reviewers (resp. assignees) **sans être le premier**, mon avatar
  est **promu en première position** dans la cellule et porte l'anneau ; « +N » et l'infobulle listant tous les
  utilisateurs conservent l'ordre GitLab. Quand `highlightMe` est inactif, l'ordre GitLab est conservé partout
  (comportement actuel). Cette règle **précise RG-G06** (« affiche le premier (ordre GitLab) ») : à amender dans le
  README à la livraison. Voir QO-023-01 pour l'alternative.

### Rendu

- **RG-023-07** : **Anneau accent** autour de l'avatar 28 px (initiales **ou** photo, style plein Auteur ou contour
  Reviewer / Affecté), sans arrondi, réalisé par ombre portée plate (aucune modification de la taille de la cellule
  ni de l'alignement de la colonne) :

  ```
  box-shadow: 0 0 0 2px var(--color-bg), 0 0 0 4px var(--color-accent);
  ```

  soit un liseré 2 px couleur de fond (respiration) puis un anneau 2 px accent `#ec3013`, valeurs **validées par la
  maquette** (constante `RING` du prototype et des wireframes, commit `36cd4b4`). Tokens uniquement (design-system.md
  §6) : l'anneau se détache automatiquement en thème sombre (`--color-bg` sombre, accent inchangé, RG-018-08).
- **RG-023-08** : L'anneau est **le seul** changement visuel : ni fond de ligne, ni bordure de ligne, ni style de
  titre. Le survol de ligne (RG-005-04) et les lignes draft à opacité réduite (US-009) se comportent comme
  aujourd'hui — l'anneau d'une ligne draft hérite de l'opacité réduite de la ligne.
- **RG-023-09** : L'anneau ne doit pas être confondu avec l'anneau de focus clavier (design-system.md, `:focus-visible`
  2 px accent) : les avatars ne sont pas focusables et l'anneau « moi » est distinct par son liseré intérieur de
  2 px. Les cellules Auteur / Reviewer / Affecté gardent une hauteur de ligne suffisante pour que l'anneau (débord
  de 4 px) ne soit pas rogné par `overflow` ni chevauché par la ligne voisine (padding vertical des cellules ≥ 4 px,
  à vérifier en QA sur les lignes adjacentes).
- **RG-023-10** : **Infobulle** de l'avatar surligné : nom complet suivi de « (moi) » (clé i18n
  `board.mergeRequests.meSuffix`, valeur anglaise « (me) » si US-022 est livrée) — apport d'accessibilité : la
  couleur seule ne doit pas porter l'information. Voir QO-023-02 (la maquette montre le nom seul).
- **RG-023-11** : **Pied de page** du tableau (§4.1 zone 6) : quand `highlightMe` est actif, le rappel des règles
  devient « Drafts après les MRs ready, triés par date d'ouverture · anneau rouge = c'est moi (auteur, reviewer ou
  affecté) · « Mes MRs » = auteur, reviewer ou affecté » (texte validé par le prototype, commit `36cd4b4`) ; le
  segment « anneau rouge = c'est moi … » est omis quand `highlightMe` est inactif ou que l'identité est vide.
- **RG-023-12** : Le marquage s'applique **uniquement dans le tableau** : ni dans les menus de filtre « Auteur » /
  « Affecté à » (listes de noms avec compteurs), ni dans l'aperçu d'identité de la section « Moi », ni dans les
  notifications navigateur (US-016).

### Interactions

- **RG-023-13** : Le marquage est indépendant des filtres, du tri et des colonnes visibles : avec « Mes MRs » actif,
  toutes les lignes affichées portent au moins un anneau (cohérence RG-023-05) ; avec un filtre « Auteur = moi »,
  toutes les lignes portent l'anneau sur la colonne Auteur.
- **RG-023-14** : Après enregistrement d'un changement d'identité (US-002) ou de `highlightMe`, le tableau reflète
  la nouvelle valeur au prochain affichage (rechargement de `GET /merge-requests`, déjà déclenché au retour sur `/`)
  sans nécessiter de synchronisation GitLab.
- **RG-023-15** : Avec l'épique multi-forges (US-019, identité par connexion, RG-019-07), `isMe` sera évalué contre
  l'identité de la **connexion** de la MR ; la règle d'affichage (RG-023-07 → 14) est inchangée. Aucun travail
  anticipé ici.

## 4. Contrat API (extension de US-005 / US-009 / US-015)

- `GET /api/v1/settings` et `PUT /api/v1/settings` renvoient `highlightMe: boolean`.
- `PUT /api/v1/settings` accepte `highlightMe?: boolean` (absent = inchangé ; non booléen → `400`).
- `GET /settings/export` inclut `settings.highlightMe` ; `POST /settings/import` l'accepte (optionnel, défaut `true`).
- `GET /api/v1/merge-requests` : `author`, `reviewers[]` et `assignees[]` portent un champ supplémentaire
  `isMe: boolean` :

  ```
  author:    { username, name, avatarUrl, isMe },
  reviewers: { username, name, avatarUrl, isMe }[],
  assignees: { username, name, avatarUrl, isMe }[],
  isMine: boolean   // inchangé, dérivable des isMe (RG-023-05)
  ```

## 5. Maquettes de référence

- **`docs/design/MR Board - Wireframes.dc.html`** (commit `36cd4b4`) :
  - **1a / 1b** — tableau : avatars de « Marie Dupont » (auteur, reviewer, affecté) entourés de l'anneau accent
    (`box-shadow: RING`), sur initiales comme sur photo ; état draft (1b) avec anneau atténué par l'opacité de la
    ligne ; pied de page « … moi (auteur, reviewer ou affecté) → anneau accent autour de l'avatar (initiales ou
    photo) · désactivable dans Paramètres › Moi … »
  - **1c** et **2a** — Paramètres, section `01 · Moi` : case « Surligner mes MRs dans le tableau (auteur, reviewer,
    affecté) », cochée par défaut, sous l'aperçu d'identité, pleine largeur
- **`docs/design/MR Board - Wireframes -sombre-.dc.html`** (commit `36cd4b4`) — 1a / 1b : même anneau en thème sombre
  (liseré `--color-bg` sombre + accent)
- **`docs/design/MR Board - Prototype.dc.html`** (commit `36cd4b4`) — constante `RING`, propriété `highlightMe`
  (défaut `true`) du modèle de paramètres, case `data-key="highlightMe"` dans « Moi », calcul `personOf` (anneau si
  `highlightMe !== false` et la personne est l'identité de la connexion), pied de page conditionnel
- `docs/tech/design-system.md` §4 (avatars auteur / reviewer / affecté) et focus (`:focus-visible`)

> ⚠️ **Écarts avec les maquettes** : (1) l'infobulle « (moi) » (RG-023-10) n'y figure pas — proposition
> d'accessibilité, voir QO-023-02 ; (2) la promotion de mon avatar en première position (RG-023-06) n'est pas
> illustrée (les maquettes n'ont qu'un reviewer / assignee par ligne), voir QO-023-01 ; (3) les maquettes montrent
> la section « Moi » dans sa forme **multi-forges** (identité par connexion, US-019) : seule la case est reprise ici,
> la section conserve sa forme actuelle (username + email + aperçu, US-002).

## 6. Critères d'acceptation

```gherkin
Scenario: Valeur par défaut
  Given aucun paramètre highlightMe n'a jamais été enregistré
  When j'ouvre /settings
  Then la case « Surligner mes MRs dans le tableau (auteur, reviewer, affecté) » est cochée, sous l'aperçu d'identité de la section « 01 · Moi »
  And GET /api/v1/settings renvoie highlightMe = true

Scenario: Anneau sur mon rôle d'auteur
  Given mon identité est « mdupont » et highlightMe = true
  And la MR front!391 a pour auteur mdupont et pour reviewer lrousseau
  When j'ouvre le tableau
  Then l'avatar Auteur de front!391 porte l'anneau accent (box-shadow 2 px fond + 2 px accent)
  And l'avatar Reviewer ne porte pas d'anneau
  And GET /api/v1/merge-requests renvoie author.isMe = true et reviewers[0].isMe = false pour cette MR

Scenario: Deux anneaux sur une même ligne
  Given la MR api!412 a pour auteur kbenali, pour reviewer mdupont et pour affecté mdupont
  Then les avatars Reviewer et Affecté portent chacun l'anneau, l'avatar Auteur non

Scenario: Anneau sur une photo de profil
  Given mon utilisateur GitLab a un avatarUrl
  Then l'anneau entoure l'image 28 px exactement comme il entourerait les initiales, sans modifier sa taille

Scenario: Comparaison insensible à la casse
  Given mon identité est « MDupont » et l'auteur d'une MR a pour username « mdupont »
  Then l'avatar Auteur porte l'anneau

Scenario: Je suis le second reviewer
  Given highlightMe = true et la MR infra!77 a pour reviewers « kbenali » puis « mdupont »
  When j'ouvre le tableau
  Then la cellule Reviewer affiche l'avatar de mdupont en premier, avec l'anneau, suivi de « +1 »
  And l'infobulle liste « Karim Benali, Marie Dupont » (ordre GitLab)
  Given highlightMe = false
  Then la cellule affiche l'avatar de kbenali en premier, sans anneau, suivi de « +1 »

Scenario: Désactiver la surbrillance
  Given highlightMe = true et je suis reviewer de 3 MRs
  When je décoche la case dans « 01 · Moi » et j'enregistre
  Then PUT /api/v1/settings contient highlightMe = false
  When je reviens sur le tableau
  Then aucun avatar ne porte d'anneau
  And le pied de page ne mentionne plus « anneau rouge = c'est moi »
  And GET /api/v1/merge-requests renvoie toujours les champs isMe (inchangés)

Scenario: Annuler la modification
  Given highlightMe = true enregistré
  When je décoche la case puis je clique sur « Annuler » et confirme l'abandon
  Then la case est de nouveau cochée et rien n'a été persisté

Scenario: Identité vide
  Given meUsername et meEmail sont vides et highlightMe = true
  Then la case reste cochée et active dans les paramètres
  And aucun avatar ne porte d'anneau dans le tableau
  And le pied de page ne mentionne pas « anneau rouge = c'est moi »
  And GET /api/v1/merge-requests renvoie isMe = false pour tous les utilisateurs et isMine = false

Scenario: Cohérence isMe / isMine
  Given une liste de MRs quelconque
  Then pour chaque MR, isMine est vrai si et seulement si author.isMe, ou l'un des reviewers[].isMe, ou l'un des assignees[].isMe est vrai

Scenario: Combinaison avec « Mes MRs »
  Given highlightMe = true et « Mes MRs » sélectionné
  Then chaque ligne affichée porte au moins un anneau

Scenario: Ligne draft
  Given « Drafts » sélectionné et une MR draft dont je suis l'auteur
  Then l'avatar Auteur porte l'anneau, atténué par l'opacité réduite de la ligne draft (aucun style spécifique)

Scenario: Infobulle
  When je survole mon avatar surligné
  Then l'infobulle affiche « Marie Dupont (moi) »
  When je survole l'avatar d'un collègue
  Then l'infobulle affiche son nom complet seul

Scenario: Thème sombre
  Given le thème sombre est actif (US-018)
  Then l'anneau reste visible : liseré intérieur couleur --color-bg sombre, anneau accent #ec3013, contraste ≥ 3:1 avec le fond de ligne (y compris au survol)

Scenario: Pas d'anneau hors du tableau
  Given highlightMe = true
  When j'ouvre le menu de filtre « Auteur » et la section « Moi » des paramètres
  Then aucun anneau n'y est affiché

Scenario: Changement d'identité
  Given highlightMe = true et mon identité est « mdupont »
  When je change mon identité en « kbenali » et j'enregistre, puis je reviens sur le tableau
  Then les anneaux sont désormais sur les avatars de kbenali (après le rechargement de la liste, sans synchronisation GitLab)

Scenario: Export / import / réinitialisation
  When j'exporte la configuration
  Then le fichier contient settings.highlightMe
  When j'importe un fichier sans champ highlightMe
  Then highlightMe vaut true
  Given highlightMe = false
  When je clique sur « Réinitialiser »
  Then la case est cochée dans le formulaire (non enregistré)

Scenario: Valeur invalide
  When j'envoie PUT /api/v1/settings avec highlightMe = "oui"
  Then l'API répond 400

Scenario: Aucun hex en dur
  When j'inspecte le style de l'anneau
  Then il n'utilise que var(--color-bg) et var(--color-accent)
```

## 7. Questions ouvertes

- **QO-023-01** : Quand je suis reviewer / affecté mais pas en première position (RG-G06), faut-il **promouvoir** mon
  avatar en premier (hypothèse RG-023-06) ou conserver l'ordre GitLab et porter l'anneau sur l'indicateur « +N » ?
  La promotion est plus lisible (l'anneau est toujours sur un avatar) mais fait varier l'ordre selon la préférence.
- **QO-023-02** : L'infobulle « Nom complet (moi) » (RG-023-10) est une proposition d'accessibilité non présente dans
  la maquette. La garder ? Hypothèse : oui.
- **QO-023-03** : Faut-il, en plus de l'anneau, un marquage discret de la **ligne** (ex. filet 2 px accent à gauche)
  pour les balayages très rapides ? Hypothèse : non — la maquette n'en montre pas et la barre de progression /
  les bordures 2 px existantes rendraient le filet ambigu. À reconsidérer après retour d'usage.
- **QO-023-04** : La case doit-elle être **désactivée** (grisée) quand l'identité est vide ? Hypothèse : non
  (RG-023-03), pour ne pas perdre le réglage et parce que l'identité peut être renseignée dans la même session
  sans rechargement.

## 8. Hors périmètre

- Surbrillance de la ligne entière ou du titre (QO-023-03)
- Surbrillance dans les menus de filtre, l'aperçu d'identité et les notifications (RG-023-12)
- Choix de la couleur ou du style de l'anneau
- Identité par connexion / multi-forges (US-019, RG-023-15)
- Reconstitution de l'email des utilisateurs GitLab pour rendre effectif le repli email de RG-G09 (limitation connue,
  `domain/is-mine.ts`)
