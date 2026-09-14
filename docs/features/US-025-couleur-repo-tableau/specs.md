# US-025 — Couleur d'arrière-plan par repo dans la colonne Projet

## 1. Reformulation

En multi-repo, toutes les cases de la colonne « Projet » du tableau se ressemblent (même tag neutre), ce qui rend
difficile le repérage visuel rapide d'un repo particulier parmi plusieurs. On veut pouvoir attribuer, par repo, une
couleur d'arrière-plan optionnelle choisie dans une palette prédéfinie d'une dizaine de teintes ; cette couleur
s'affiche pleine sur les MRs Ready et éclaircie sur les MRs Draft, sans jamais nuire à la lisibilité du texte.

## 2. User Story

- **US-025** : En tant que membre de l'équipe suivant plusieurs repos, je veux attribuer une couleur d'arrière-plan à
  un repo afin de le repérer d'un coup d'œil dans la colonne Projet du tableau.
    - Priorité : Should
    - Complexité estimée : M
    - Dépendances : US-003 (gestion des repos), US-005 (tableau, colonne Projet), US-021 (tag Projet, icône de forge)

## 3. Règles de Gestion

- **RG-025-01** — Attribut : chaque **Projet** (repo, voir Glossaire) porte un attribut `color` optionnel, choisi
  dans une **palette prédéfinie fermée** (pas de sélecteur RGB libre). Valeur par défaut : **Aucune** (transparent) —
  le tag garde alors exactement son style actuel (`tag-neutral`), pour ne rien changer sur les repos existants.
- **RG-025-02** — Palette : 10 couleurs pastel prédéfinies, choisies pour un contraste doux (texte sombre lisible
  dessus dans les deux thèmes, clair et sombre) et suffisamment distinctes entre elles. Chaque couleur de la palette
  est un couple `{ id, background, text }` (le `text` associé est fixe, indépendant du thème actif — voir RG-025-05) :

  | id       | Nom (FR)      | Fond      | Texte     |
  |----------|---------------|-----------|-----------|
  | `slate`  | Bleu ardoise  | `#c7d9ea` | `#20303f` |
  | `sage`   | Vert sauge    | `#c8ddc7` | `#25381f` |
  | `lilac`  | Lilas         | `#dcd3ea` | `#332a4a` |
  | `peach`  | Pêche         | `#f0d9c4` | `#4a2f14` |
  | `rose`   | Rose poudré   | `#f0d3d9` | `#4a1f28` |
  | `sand`   | Sable         | `#ece0c4` | `#43391a` |
  | `mint`   | Menthe        | `#c9e5dd` | `#173d31` |
  | `steel`  | Bleu gris     | `#cbd4dc` | `#28333d` |
  | `plum`   | Prune         | `#e3cfe0` | `#3d2038` |
  | `olive`  | Olive clair   | `#dde0c2` | `#353a17` |

  Aucune de ces couleurs ne reprend l'accent (`#ec3013`), le vert Difficulté/Ready (`#2f8f4e`) ni l'orange
  Difficulté/Ready (`#d98a1f`), pour ne pas entrer en conflit visuel avec ces codes couleur existants.
- **RG-025-03** — Application MR Ready : si la MR n'est pas draft (RG-G02), la case de la colonne Projet s'affiche
  avec la couleur `background` pleine de la couleur choisie pour son repo, et le texte (alias + icône de forge,
  RG-021-01) dans la couleur `text` associée.
- **RG-025-04** — Application MR Draft : si la MR est draft, la case s'affiche avec la même couleur mais **éclaircie**
  (RG-025-02) : le fond est mélangé à 45 % avec le fond de page (`background` à 45 % d'opacité sur la surface du
  tableau), le texte garde la même couleur `text` que la version pleine. Un repo sans couleur (`Aucune`) n'a pas de
  variante draft : son tag reste `tag-neutral` que la MR soit draft ou non (inchangé).
- **RG-025-05** — Lisibilité : la couleur `text` d'une entrée de palette est fixe, indépendante du thème actif
  (clair/sombre) — c'est la palette elle-même (RG-025-02) qui garantit le contraste, il n'y a pas de calcul de
  contraste dynamique. Un repo sans couleur continue d'utiliser le texte standard du tag, qui lui reste dépendant du
  thème comme aujourd'hui.
- **RG-025-06** — Portée : la couleur est un attribut du **Projet**, pas de la Connexion ni de la MR : elle
  s'applique donc à la case Projet de toutes les MRs de ce repo dans le tableau (RG-025-03/04), **et** à l'option
  correspondante dans le filtre « Projet » (RG-025-09) — confirmé par l'utilisateur (QO-025-02). Aucun autre élément
  de l'interface (menu colonnes, avatars, badges de difficulté/statut…) n'est concerné (voir §7).
- **RG-025-07** — Configuration : la couleur se choisit dans la fiche du repo (Paramètres, section « 02 ·
  Connexions », tableau des repos d'une connexion, US-019/US-021) via un sélecteur de pastilles (une par couleur de
  la palette, plus « Aucune »), au même niveau que l'alias. Disponible dès le formulaire d'ajout d'un repo, avec
  « Aucune » (transparent) présélectionnée par défaut, et modifiable ensuite comme l'alias (confirmé, QO-025-03).
- **RG-025-08** — Export/Import (US-015) : la couleur du projet est incluse dans l'export/import de configuration,
  au même titre que l'alias.
- **RG-025-09** — Filtre Projet : dans le menu du filtre « Projet » (RG-010-*), chaque option affiche une pastille
  de la couleur pleine assignée à ce repo (même `background`/`text` que RG-025-02), à côté de son libellé. Un repo
  sans couleur (« Aucune ») n'affiche pas de pastille (comportement actuel inchangé). Cette pastille ne dépend pas
  de l'état draft — RG-025-04 (éclaircissement) ne s'applique qu'à la case du tableau, par MR, jamais au filtre qui
  raisonne par repo.

## 4. Maquettes de référence

Aucune maquette de `docs/design/` ne couvre cette fonctionnalité (nouveauté postérieure aux wireframes). Référence
existante : tag Projet visible en zone 5 du wireframe 1a/1b et dans le prototype (icône de forge + alias, US-021,
RG-021-01) — cette US n'en change que la couleur de fond/texte, pas la structure (icône + libellé, infobulle
RG-021-02 inchangée).

**Écart signalé avec `docs/tech/design-system.md`** : le design system pose comme principe une couleur d'accent
unique utilisée avec parcimonie. Cette US introduit délibérément une palette de 10 couleurs pastel supplémentaires,
à la demande explicite de l'utilisateur, cantonnée à la case Projet du tableau et à l'option du filtre « Projet »
(RG-025-06) — confirmé par l'utilisateur (QO-025-02).

## 5. Critères d'Acceptation

```gherkin
Scenario: Un repo sans couleur configurée garde l'apparence actuelle
  Given un repo "web/api" sans couleur configurée (valeur par défaut "Aucune")
  When je consulte le tableau des MRs
  Then la case Projet de ses MRs s'affiche avec le style neutre actuel (tag-neutral), pleine ou draft

Scenario: Une couleur choisie s'applique à une MR Ready
  Given un repo "web/api" avec la couleur "sage" configurée
  And une MR de "web/api" qui n'est pas draft
  When je consulte le tableau des MRs
  Then la case Projet de cette MR affiche le fond "sage" plein (#c8ddc7) et le texte dans sa couleur associée (#25381f)

Scenario: La même couleur s'affiche éclaircie sur une MR Draft
  Given un repo "web/api" avec la couleur "sage" configurée
  And une MR de "web/api" qui est draft
  When je consulte le tableau des MRs
  Then la case Projet de cette MR affiche le fond "sage" éclairci (RG-025-04) et le même texte que la version pleine

Scenario: Changer la couleur d'un repo met à jour toutes ses MRs
  Given un repo "web/api" avec la couleur "sage" configurée et plusieurs MRs affichées
  When je change la couleur du repo pour "peach" dans les Paramètres et j'enregistre
  Then toutes les cases Projet des MRs de "web/api" affichent désormais "peach" (pleine ou éclaircie selon draft)

Scenario: Revenir à "Aucune" couleur restaure le style neutre
  Given un repo "web/api" avec la couleur "sage" configurée
  When je repasse sa couleur à "Aucune" dans les Paramètres et j'enregistre
  Then la case Projet de ses MRs revient au style tag-neutral actuel

Scenario: Deux repos avec des couleurs différentes coexistent dans le tableau
  Given un repo "web/api" avec la couleur "sage" et un repo "web/front" avec la couleur "slate"
  When je consulte le tableau des MRs sans filtre
  Then les MRs de "web/api" affichent le fond "sage" et celles de "web/front" le fond "slate", chacune avec son
    propre texte associé

Scenario: La couleur d'un repo est conservée à l'export puis à l'import de la configuration
  Given un repo "web/api" avec la couleur "peach" configurée
  When j'exporte la configuration puis je la réimporte (US-015)
  Then le repo "web/api" conserve la couleur "peach" après import

Scenario: Le filtre Projet affiche la couleur de chaque repo
  Given un repo "web/api" avec la couleur "sage" et un repo "web/front" sans couleur ("Aucune")
  When j'ouvre le menu du filtre « Projet »
  Then l'option "web/api" affiche une pastille "sage" à côté de son libellé
  And l'option "web/front" n'affiche aucune pastille
```

## 6. Questions ouvertes

Toutes résolues par l'utilisateur à la validation des specs :

- **QO-025-01** *(résolu)* : pas de couleur personnalisée libre (sélecteur RGB) — uniquement la palette fermée de
  10 couleurs (RG-025-02). Confirmé.
- **QO-025-02** *(résolu)* : la couleur teinte aussi le filtre « Projet » (RG-025-09), pas seulement la case du
  tableau (RG-025-03/04). Confirmé — « les filtres aussi ».
- **QO-025-03** *(résolu)* : le champ couleur est disponible dès le formulaire d'ajout d'un repo, avec « Aucune »
  (transparent) présélectionnée par défaut (RG-025-07). Confirmé.
- **QO-025-04** *(résolu)* : les 10 couleurs et libellés proposés en RG-025-02 sont validés tels quels.

## 7. Hors périmètre

- Sélecteur de couleur libre (RGB/hex arbitraire) — uniquement la palette prédéfinie (QO-025-01).
- Coloration d'autres éléments que la case Projet du tableau et l'option du filtre Projet : menu colonnes, avatars,
  badges de difficulté/statut, pastille des autres filtres, etc. (RG-025-06).
- Coloration par Connexion ou par groupe de repos — uniquement par Projet (repo) individuel (RG-025-06).
- Vérification automatique de contraste (WCAG ou autre) — la palette est choisie manuellement pour un contraste
  jugé suffisant (RG-025-02), sans calcul dynamique (RG-025-05).
- Personnalisation de la teinte « draft » (pourcentage d'éclaircissement) — fixée à 45 % pour toute la palette
  (RG-025-04), non configurable par l'utilisateur, et ne s'applique de toute façon pas au filtre (RG-025-09).
