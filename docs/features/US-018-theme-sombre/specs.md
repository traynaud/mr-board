# US-018 — Thème sombre

## 1. Reformulation

L'utilisateur veut pouvoir utiliser MR Board avec un rendu sombre, soit en suivant la préférence de son système
d'exploitation, soit en forçant le mode clair ou sombre. Le choix se fait dans les paramètres (section « Divers »),
avec en complément une bascule rapide clair/sombre dans la toolbar du tableau, et s'applique immédiatement à tous
les écrans (tableau, paramètres, menus, dialogs, toasts) sans produire ni « flash » blanc au chargement, ni perte de
lisibilité des codes couleur du produit (vert / orange / rouge, accent).

Le design system « Modernist » ne définissait qu'un thème clair ; la palette sombre et les deux points d'accès
(réglage Paramètres + bascule toolbar) sont désormais validés par les maquettes dédiées (voir §4).

## 2. User Stories

- **US-018** : En tant qu'utilisateur, je veux choisir un thème clair, sombre ou automatique (système), afin de
  consulter le tableau confortablement quel que soit mon environnement de travail.
    - Priorité : Could
    - Complexité estimée : M
    - Dépendances : US-015 (section « Divers », export/import/reset), TECH-002 (thème Material)

## 3. Règles de gestion

### Préférence

- **RG-018-01** : Nouveau paramètre `theme` ∈ {`system`, `light`, `dark`}, défaut `system`. Il est persisté côté
  backend avec les autres paramètres (`PUT /settings`, colonne `theme`, migration), inclus dans l'export / import
  (RG-015-03/04, `version` d'export inchangée : champ optionnel, absent = `system`) et remis à `system` par
  « Réinitialiser » (RG-015-05).
- **RG-018-02** : Contrôle dans la section `06 · Divers`, en tête de section, sous forme d'un `mat-radio-group`
  horizontal « Thème » avec trois options « Système », « Clair », « Sombre » (même pattern que la fréquence de
  RG-013). Comme les autres champs, la valeur est enregistrée par le bouton global « Enregistrer ».
- **RG-018-03** : **Aperçu immédiat** : changer l'option applique le thème à toute l'application sans attendre
  « Enregistrer ». « Annuler » ou l'abandon des modifications (RG-001-07) restaure le thème enregistré. Le formulaire
  est marqué modifié (RG-001-06).
- **RG-018-04** : Mode `system` : suit `prefers-color-scheme` du navigateur, y compris quand il change pendant
  l'utilisation (écoute de `matchMedia('(prefers-color-scheme: dark)')`), sans rechargement.
- **RG-018-05** : **Aucun flash** : le thème enregistré est recopié dans `localStorage` (`mrboard.theme.v1`) à chaque
  chargement des paramètres, et un script inline minimal dans `index.html` lit cette clé avant le premier rendu pour
  poser l'attribut `data-theme="light|dark"` (ou rien pour `system`) sur `<html>`. Si `localStorage` est vide ou
  indisponible, l'application démarre en `system`, puis s'aligne sur la valeur backend dès sa réception. La valeur
  backend fait toujours autorité en cas d'écart.
- **RG-018-06** : Le thème effectif (`light` ou `dark`, résolu depuis la préférence et le système) est exposé par
  un `ThemeService` (`core/theme/`) sous forme de signal ; aucun composant ne lit `matchMedia` directement.
- **RG-018-12** : **Bascule rapide dans la toolbar** (nouveau, confirmé par la maquette sombre) : un bouton icône
  (soleil / lune, `md-icon-button`) est ajouté dans la toolbar du tableau, entre « Rafraîchir » et « Paramètres ».
  Son infobulle et son icône indiquent le thème vers lequel il bascule (ex. « Passer en thème sombre » quand le
  thème effectif est clair). Un clic bascule directement entre `light` et `dark` (jamais vers `system`) et
  **enregistre immédiatement** le nouveau paramètre `theme` en backend (`PUT /settings`, sans passer par le bouton
  « Enregistrer » de l'écran Paramètres, puisque le clic n'a pas lieu sur cet écran) ; `localStorage`
  (RG-018-05) est mis à jour dans le même temps. Si l'écran Paramètres est ouvert avec des modifications non
  enregistrées, la bascule toolbar ne modifie que le thème effectif immédiat et le paramètre persisté, sans
  affecter les autres champs du formulaire en cours d'édition ni son état « modifié ».
- **RG-018-13** : Si la préférence enregistrée est `system`, cliquer sur la bascule toolbar fige le thème sur sa
  valeur effective opposée (`light` ou `dark`) : l'utilisateur sort du mode automatique. Il peut revenir à
  `system` uniquement depuis l'écran Paramètres.

### Rendu

- **RG-018-07** : Le thème est porté par des tokens CSS uniquement : le thème Material passe en
  `theme-type: color-scheme` (`color-scheme: light dark` sur `html`), et **tous** les tokens du design system
  (`--color-bg`, `--color-surface`, `--color-text`, `--color-divider`, `--color-neutral-100..900`,
  `--color-accent-100..900`, `--color-success`, `--color-warning`, `--color-danger`, `--shadow-*`) ainsi que les
  surcharges `--mat-sys-*` (design-system.md §3) sont redéfinis sous `html[data-theme="dark"]` et sous
  `@media (prefers-color-scheme: dark)` pour `html:not([data-theme="light"])`. Aucune valeur hexadécimale ne doit
  subsister dans les composants (déjà interdit, design-system.md §6) : la revue de cette US inclut un audit.
- **RG-018-08** : Palette sombre **validée par la maquette** (`MR Board - Wireframes -sombre-.dc.html`, écrans 1a/1b/1c,
  et `MR Board - Prototype.dc.html`), garantissant un contraste **≥ 4,5:1** sur les textes et **≥ 3:1** sur les icônes
  et bordures (WCAG AA) :

  | Token                         | Clair (existant)              | Sombre (validé maquette)                          |
  |-------------------------------|-------------------------------|----------------------------------------------------|
  | `--color-bg`                  | `#f3f2f2`                     | `#161514`                                          |
  | `--color-surface`             | `#eae9e9`                     | `#201e1d`                                          |
  | `--color-text`                | `#201e1d`                     | `#f3f2f2`                                          |
  | `--color-divider`             | `color-mix(text 40%)`         | `color-mix(in srgb, #f3f2f2 32%, transparent)`     |
  | `--color-neutral-100..900`    | `#f8f4f4` … `#2d2b2b`         | `100:#242221 200:#2d2b2b 300:#444141 400:#605d5d 500:#7d7979 600:#a8a4a4 700:#bab6b6 800:#d7d3d3 900:#eae7e7` |
  | `--color-accent`              | `#ec3013`                     | `#ec3013` (inchangé : surfaces, bordures, icônes)  |
  | `--color-accent-100..400/600..900` | `#fff2ef` … `#4d170e`   | `100:#3a1510 200:#4d170e 300:#7c1405 400:#ae1800 600:#ff563c 700:#ff9783 800:#ffc4b8 900:#ffe0d9` — `--color-accent-500` absent de la maquette : à interpoler par l'Architecte selon le même motif (~`#dd2b0f`, valeur de `--color-accent-600` clair) |
  | `--color-success`             | `#2f8f4e`                     | `#4fb26f`                                          |
  | `--color-warning`             | `#d98a1f`                     | `#e9a03a`                                          |
  | `--color-danger`              | `var(--color-accent)`         | `var(--color-accent)` (inchangé, référence QO-018-04) |
  | `--shadow-sm/md/lg`            | ombres douces                 | liseré blanc translucide (`rgba(255,255,255,.06-.08)`) + ombre noire plus dense (`rgba(0,0,0,.5-.65)`), voir maquette pour les valeurs exactes |
  | `--mat-sys-*` (surface, on-surface, outline, primary-container…) | tokens clairs (styles.scss L.92-102) | à redéfinir en miroir sous `html[data-theme="dark"]`, valeurs de référence dans le bloc `:root[data-theme="dark"]` du prototype (`--md-sys-color-*`) |

  Les composants qui utilisent le « noir plein » en clair sont inversés en sombre en remplaçant le hex en dur par
  `var(--color-bg)` (ex. texte de l'avatar auteur sur fond `neutral-800`, texte du toast sur fond `neutral-900`) :
  cela fonctionne dans les deux thèmes sans variable dédiée supplémentaire, comme démontré par la maquette.
- **RG-018-09** : Périmètre visuel à couvrir et vérifier en QA, écran par écran : toolbar (statut de synchro,
  bouton de bascule rapide RG-018-12 avec son icône et son infobulle dynamiques), barre de progression, bandeau,
  chips et pastilles de filtres, menus de filtre (fond, hover, checkbox, champ « Rechercher… »), tableau (en-têtes,
  tri actif, hover ligne, ligne draft à opacité réduite, jetons difficulté, délai Ready, coche Approved, colonne
  Statut si US-017), état vide, pied, menu colonnes, poignées de redimensionnement, page Paramètres (sections, form
  fields, radio dont le nouveau contrôle « Thème », checkbox, slide-toggle, tableau des repos, boutons stroked /
  primary, résultats de test de connexion vert / rouge), dialogs de confirmation, snackbars, tooltips,
  `:focus-visible`, barres de défilement (via `color-scheme`).
- **RG-018-10** : Les images d'avatar et le favicon ne changent pas. Les notifications navigateur (US-016) ne sont
  pas concernées.
- **RG-018-11** : Les seuils de couleur (RG-G03, RG-G04) restent sémantiquement identiques : vert = OK, orange =
  attention, rouge = alerte ; seule la teinte change pour le contraste.

## 4. Maquettes de référence

- **`docs/design/MR Board - Wireframes -sombre-.dc.html`** (commit `ca05b69`) — déclinaison sombre validée des trois
  écrans de référence :
  - **1a** — tableau, état par défaut, avec le bouton de bascule rapide dans la toolbar (icône lune/soleil, entre
    « Rafraîchir » et « Paramètres »)
  - **1b** — tableau avec drafts, menus « Ajouter un filtre » et pastille « Affecté à » ouverts, tooltip auteur
  - **1c** — écran Paramètres complet, section `06 · Divers` avec le contrôle « Thème » (`seg`/radio horizontal,
    même pattern que la fréquence RG-013) en tête de section
- **`docs/design/MR Board - Prototype.dc.html`** (commit `ca05b69`) — version interactive : tokens `:root[data-theme="dark"]`,
  bouton de bascule toolbar fonctionnel (`data-act="theme-toggle"`), radio « Thème » dans Divers (`data-act="theme"`)
- Wireframe clair **1c** — pour comparaison, emplacement identique du contrôle « Thème »
- Design system — `docs/design/design-system/readme.md` (rampes 100–900, états interactifs, focus) et `styles.css`
  (ombres « hairline edge + ambient darkness on a dark one »)

La palette et les deux points d'accès (Paramètres + bascule toolbar) sont donc **validés**, plus une hypothèse à
confirmer par l'utilisateur (QO-018-01 levée, voir §6).

## 5. Critères d'acceptation

```gherkin
Scenario: Valeur par défaut
  Given aucun paramètre theme n'a jamais été enregistré
  When j'ouvre /settings
  Then l'option « Système » est sélectionnée
  And GET /api/v1/settings renvoie theme = "system"

Scenario: Passer en sombre avec aperçu immédiat
  Given je suis sur /settings en thème clair
  When je sélectionne « Sombre »
  Then l'application passe immédiatement en sombre (html[data-theme="dark"])
  And le bouton « Enregistrer » est activé
  When je clique sur « Enregistrer »
  Then PUT /api/v1/settings contient theme = "dark"
  And localStorage["mrboard.theme.v1"] vaut "dark"

Scenario: Annuler l'aperçu
  Given le thème enregistré est « Clair » et j'ai sélectionné « Sombre » sans enregistrer
  When je clique sur « Annuler » et je confirme l'abandon
  Then l'application revient en clair

Scenario: Mode système suit l'OS
  Given theme = "system" et l'OS est en mode sombre
  When j'ouvre le tableau
  Then l'application est en sombre
  When l'OS passe en mode clair
  Then l'application passe en clair sans rechargement

Scenario: Aucun flash au chargement
  Given theme = "dark" est enregistré et présent dans localStorage
  When je recharge la page
  Then html porte data-theme="dark" avant le premier rendu (aucune image clair → sombre)

Scenario: localStorage vide
  Given theme = "dark" est enregistré côté backend mais localStorage est vide
  When je recharge la page
  Then l'application démarre selon le système puis passe en sombre dès la réception des paramètres
  And localStorage est mis à jour

Scenario: Export / import
  When j'exporte la configuration
  Then le fichier contient settings.theme
  When j'importe un fichier sans champ theme
  Then theme vaut "system"

Scenario: Réinitialiser
  Given theme = "dark"
  When je clique sur « Réinitialiser »
  Then l'option « Système » est sélectionnée dans le formulaire (non enregistré)

Scenario: Contraste des couleurs sémantiques
  Given le thème sombre est actif
  Then les textes Easy / Medium / Hard, les libellés de délai Ready et le texte des pastilles de filtre ont un contraste ≥ 4,5:1 sur leur fond

Scenario: Aucun hex en dur
  When j'inspecte les fichiers .scss des composants
  Then aucune couleur hexadécimale n'y figure (tokens uniquement)

Scenario: Surfaces flottantes
  Given le thème sombre est actif
  When j'ouvre un menu de filtre, un dialog de confirmation et un toast
  Then chacun est lisible et se détache du fond (liseré + ombre)

Scenario: Valeur invalide
  When j'envoie PUT /api/v1/settings avec theme = "blue"
  Then l'API répond 400

Scenario: Bascule rapide depuis la toolbar
  Given theme = "light" et je suis sur le tableau (pas sur /settings)
  When je clique sur le bouton de bascule de la toolbar
  Then l'application passe immédiatement en sombre
  And PUT /api/v1/settings est appelé avec theme = "dark" sans passer par l'écran Paramètres
  And localStorage["mrboard.theme.v1"] vaut "dark"

Scenario: Bascule rapide depuis le mode système
  Given theme = "system" et l'OS est en mode clair
  When je clique sur le bouton de bascule de la toolbar
  Then l'application passe en sombre et le paramètre enregistré devient "dark" (sortie du mode automatique)
  When j'ouvre /settings
  Then l'option « Sombre » est sélectionnée (plus « Système »)
```

## 6. Questions ouvertes

- ~~QO-018-01~~ **Résolue** : la palette sombre (RG-018-08) est validée par la maquette dédiée (§4), plus
  l'interpolation `--color-accent-500` à faire par l'Architecte selon le motif observé.
- ~~QO-018-02~~ **Résolue** : oui, un bouton de bascule rapide existe dans la toolbar (RG-018-12/13), en complément
  du réglage dans les Paramètres.
- ~~QO-018-03~~ **Résolue** (confirmé par l'utilisateur) : la préférence de thème est sauvegardée côté backend
  (RG-G18, instance mono-utilisateur, cohérence avec export/import), avec `localStorage` comme cache anti-flash
  uniquement (RG-018-05). À revoir si QO-G01 bascule en instance partagée.
- ~~QO-018-04~~ **Résolue** : oui, l'accent `#ec3013` reste inchangé en sombre pour les surfaces (bouton primaire,
  icônes) ; seules les pastilles/texte accent utilisent la rampe `--color-accent-100..900` sombre (RG-018-08).
- **QO-018-05** *(nouvelle)* : le clic sur la bascule toolbar doit-il déclencher un toast de confirmation (cohérence
  avec les autres actions persistées silencieusement, ex. tri de colonne) ? Hypothèse : non, l'application immédiate
  du thème est son propre feedback visuel, pas de toast.

## 7. Hors périmètre

- Thème à contraste élevé, thèmes personnalisés
- Mode sombre des notifications navigateur (contrôlé par l'OS)
