# Design — US-043 Surbrillance des MRs nouvelles ou modifiées

## Classification : changement **simple** (pas d'artefact, pas de D9)
Teinte de fond d'une ligne du tableau + filet gauche 2 px (tokens existants) et une case à cocher dans la section
« Interface » des Paramètres (pattern de « Surligner mes MRs »). Aucun nouvel écran, composant ni navigation.
Validation visuelle : la recette navigateur demandée par l'utilisateur, **avant** tout merge.

## Rendu des lignes (tableau principal)
| État | Fond de ligne | Filet gauche (2 px, `box-shadow: inset`) | Cas |
|------|---------------|-------------------------------------------|-----|
| Nouvelle | `color-mix(in srgb, var(--color-success) 14%, transparent)` | `var(--color-success)` | événement `created` non vu |
| Modifiée | `color-mix(in srgb, var(--color-warning) 16%, transparent)` | `var(--color-warning)` | autre événement non vu |

- Les deux teintes sont proches (même intensité) mais distinguables par leur teinte (vert / ambre) **et** par le
  libellé accessible, jamais par la couleur seule (RG-043-08).
- `color-mix` sur tokens → rendu correct en thème clair et sombre sans valeur brute.
- Le survol normal (`--color-neutral-100`) ne remplace pas la teinte pendant les 500 ms de survol : la règle
  surbrillance est plus spécifique, y compris sur `:hover`.
- Effacement : `transition: background-color 400ms ease, box-shadow 400ms ease` → fondu à la disparition (RG-043-04).
  `@media (prefers-reduced-motion: reduce)` : pas de transition.
- Aucun arrondi, aucune ombre portée autre que le filet.

## Accessibilité
Un texte masqué visuellement (« Nouvelle » / « Modifiée », clés i18n) est ajouté dans la cellule titre, lu par les
lecteurs d'écran avant le titre.

## Paramètres
Case à cocher `mat-checkbox` « Surligner les MRs nouvelles ou modifiées », section « Interface », juste sous
« Surligner mes MRs dans le tableau ». Coche par défaut.

## Clés i18n
`settings.misc.highlightChanges`, `board.mergeRequests.change.new`, `board.mergeRequests.change.modified`.

## Décisions
### Prises en autonomie
- Vert (`--color-success`) / ambre (`--color-warning`) — l'accent rouge est évité : il se confond avec les états d'erreur et la colonne « Depuis Ready » rouge — sur tokens existants + filet 2 px → cohérent avec « règles 2 px », pas de nouveau token — réversible : oui
- Libellé masqué plutôt qu'infobulle → accessibilité sans bruit visuel — réversible : oui
### Arbitrées par l'humain
- Aucune (recette navigateur avant merge demandée)
