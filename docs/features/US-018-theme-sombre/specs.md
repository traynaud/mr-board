# US-018 — Thème sombre

## 1. Reformulation

L'utilisateur veut pouvoir utiliser MR Board avec un rendu sombre, soit en suivant la préférence de son système
d'exploitation, soit en forçant le mode clair ou sombre. Le choix se fait dans les paramètres (section « Divers »),
s'applique immédiatement à tous les écrans (tableau, paramètres, menus, dialogs, toasts) et ne doit produire ni
« flash » blanc au chargement, ni perte de lisibilité des codes couleur du produit (vert / orange / rouge, accent).

Le design system « Modernist » ne définit qu'un thème clair : cette US demande la définition d'une palette sombre
dérivée des tokens existants, à valider en phase de conception.

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

### Rendu

- **RG-018-07** : Le thème est porté par des tokens CSS uniquement : le thème Material passe en
  `theme-type: color-scheme` (`color-scheme: light dark` sur `html`), et **tous** les tokens du design system
  (`--color-bg`, `--color-surface`, `--color-text`, `--color-divider`, `--color-neutral-100..900`,
  `--color-accent-100..900`, `--color-success`, `--color-warning`, `--color-danger`, `--shadow-*`) ainsi que les
  surcharges `--mat-sys-*` (design-system.md §3) sont redéfinis sous `html[data-theme="dark"]` et sous
  `@media (prefers-color-scheme: dark)` pour `html:not([data-theme="light"])`. Aucune valeur hexadécimale ne doit
  subsister dans les composants (déjà interdit, design-system.md §6) : la revue de cette US inclut un audit.
- **RG-018-08** : Palette sombre proposée (à confirmer en phase Architecte / design, voir QO-018-01), construite en
  inversant la rampe neutre et en éclaircissant les couleurs sémantiques pour garder un contraste **≥ 4,5:1** sur
  les textes et **≥ 3:1** sur les icônes et bordures (WCAG AA) :

  | Token                         | Clair (existant)              | Sombre (proposé)                                  |
  |-------------------------------|-------------------------------|---------------------------------------------------|
  | `--color-bg`                  | `#f3f2f2`                     | `#1a1918`                                         |
  | `--color-surface`             | `#eae9e9`                     | `#242221`                                         |
  | `--color-text`                | `#201e1d`                     | `#f3f2f2`                                         |
  | `--color-divider`             | `color-mix(text 40%)`         | `color-mix(in srgb, #f3f2f2 30%, transparent)`    |
  | `--color-neutral-100..900`    | `#f8f4f4` … `#2d2b2b`         | rampe inversée : `neutral-100` ≈ `#262423` (hover lignes), `neutral-600` ≈ `#a8a3a3` (texte secondaire), `neutral-800` ≈ `#d7d3d3`, `neutral-900` ≈ `#e8e5e5` |
  | `--color-accent`              | `#ec3013`                     | `#ec3013` (inchangé : surfaces, bordures, icônes)  |
  | `--color-accent-text`         | *(nouveau)* `#ec3013`         | `#ff7a63` (texte accent sur fond sombre, ≥ 4,5:1)  |
  | `--color-accent-100/300/800`  | `#fff2ef` / … / …             | pastilles : fond `accent-900` `#4d170e`, bordure `accent-700`, texte `accent-200` |
  | `--color-success`             | `#2f8f4e`                     | `#5cc47c`                                         |
  | `--color-warning`             | `#d98a1f`                     | `#f0a83f`                                         |
  | `--color-danger`              | `var(--color-accent)`         | `#ff7a63`                                         |
  | `--shadow-md/lg`              | ombres douces                 | liseré 1 px `neutral-300` + ombre ambiante plus dense (cf. `styles.css` §« dark ») |

  Les composants qui utilisent le « noir plein » en clair sont inversés en sombre : avatar auteur (fond `neutral-800`
  → texte sombre sur fond clair), toast (`neutral-900` → fond clair, texte sombre, action `accent`), tag projet
  (fond `neutral-200`), bandeau « Aucun jeton » (fond `accent-900`, texte `accent-200`).
- **RG-018-09** : Périmètre visuel à couvrir et vérifier en QA, écran par écran : toolbar et statut de synchro,
  barre de progression, bandeau, chips et pastilles de filtres, menus de filtre (fond, hover, checkbox, champ
  « Rechercher… »), tableau (en-têtes, tri actif, hover ligne, ligne draft à opacité réduite, jetons difficulté, délai
  Ready, coche Approved, colonne Statut si US-017), état vide, pied, menu colonnes, poignées de redimensionnement,
  page Paramètres (sections, form fields, radio, checkbox, slide-toggle, tableau des repos, boutons stroked /
  primary, résultats de test de connexion vert / rouge), dialogs de confirmation, snackbars, tooltips, `:focus-visible`,
  barres de défilement (via `color-scheme`).
- **RG-018-10** : Les images d'avatar et le favicon ne changent pas. Les notifications navigateur (US-016) ne sont
  pas concernées.
- **RG-018-11** : Les seuils de couleur (RG-G03, RG-G04) restent sémantiquement identiques : vert = OK, orange =
  attention, rouge = alerte ; seule la teinte change pour le contraste.

## 4. Maquettes de référence

- Wireframe **1c** — section `06 · Divers` (emplacement du contrôle « Thème », en tête de section)
- Design system — `docs/design/design-system/readme.md` (rampes 100–900, états interactifs, focus) et
  `styles.css` (ombres « hairline edge + ambient darkness on a dark one »)

> ⚠️ **Écart avec les maquettes** : aucune maquette sombre n'existe. La phase Architecte doit produire, avant
> développement, une déclinaison sombre des écrans 1a et 1c (au minimum : tableau avec menus ouverts, page
> Paramètres) à partir de la palette RG-018-08, et la faire valider. Le contrôle « Thème » lui-même reprend le
> pattern radio de la section « Actualisation ».

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
```

## 6. Questions ouvertes

- **QO-018-01** : Les valeurs de la palette sombre (RG-018-08) sont des propositions. Qui valide la déclinaison
  sombre des maquettes ? Hypothèse : validation sur les deux écrans déclinés en phase Architecte avant tout
  développement.
- **QO-018-02** : Faut-il en plus un bouton de bascule rapide dans la toolbar du tableau (icône soleil / lune) ?
  Hypothèse : non, la toolbar des maquettes est figée (brand, statut, Rafraîchir, Paramètres) ; le réglage vit dans
  les paramètres.
- **QO-018-03** : La préférence de thème doit-elle rester par navigateur (`localStorage` seul) plutôt qu'en backend ?
  Hypothèse : backend (RG-G18, instance mono-utilisateur, cohérence avec export/import), avec `localStorage` comme
  cache anti-flash uniquement. À revoir si QO-G01 bascule en instance partagée.
- **QO-018-04** : L'accent `#ec3013` reste-t-il tel quel en sombre pour les surfaces (bouton primaire) ? Hypothèse :
  oui, seul le texte accent utilise la variante éclaircie `--color-accent-text`.

## 7. Hors périmètre

- Thème à contraste élevé, thèmes personnalisés
- Bascule rapide dans la toolbar (QO-018-02)
- Mode sombre des notifications navigateur (contrôlé par l'OS)
