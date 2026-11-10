# Design — US-043 Surbrillance des MRs nouvelles ou modifiées

## Classification : changement **simple** à l'origine ; rendu des lignes revu avec maquette (D9) après recette
Teinte de fond d'une ligne du tableau + filet gauche 2 px (tokens existants) et une case à cocher dans la section
« Interface » des Paramètres (pattern de « Surligner mes MRs »). Aucun nouvel écran, composant ni navigation.
Validation visuelle : la recette navigateur demandée par l'utilisateur, **avant** tout merge.

## Rendu des lignes (tableau principal) — variante « A + B » validée
Maquette : https://claude.ai/artifact/LCryNaVS78m4MMdLbvuLu9 (variante « Tag contour + filet + pointillé »).
Le fond coloré initial a été jugé trop flashy (retour utilisateur) ; il est remplacé par :

| État | Filet gauche (2 px, `box-shadow: inset` sur la 1re cellule : sur `<tr>` il n'est pas rendu) | Ligne du bas | Tag devant le titre |
|------|------|------|------|
| Nouvelle | `var(--color-success)` | pointillé 1 px `var(--color-success)` | « Nouvelle », contour + texte `--color-success` |
| Modifiée | `var(--color-warning)` | pointillé 1 px `var(--color-warning)` | « Modifiée », contour `--color-warning`, texte ambre assombri (`color-mix` avec `--color-text`) |

- **Aucun fond de ligne** : le survol normal (`--color-neutral-100`) s'applique comme sur les autres lignes.
- Tag : 10,5 px, majuscules, 600, contour 1 px, aucun arrondi, visible (remplace le libellé masqué) → le sens ne repose
  plus sur la couleur seule (RG-043-08), lecteurs d'écran inclus.
- Disposition : `.title-line` (flex) = tag fixe + lien tronqué par ellipsis.
- Effacement : `transition: box-shadow 400ms` (RG-043-04) ; `prefers-reduced-motion` : pas de transition.
- Thèmes clair et sombre via tokens, aucune valeur brute.

## Paramètres
Case à cocher `mat-checkbox` « Surligner les MRs nouvelles ou modifiées », section « Interface », juste sous
« Surligner mes MRs dans le tableau ». Coche par défaut.

## Clés i18n
`settings.misc.highlightChanges`, `board.mergeRequests.change.new`, `board.mergeRequests.change.modified`.

## Décisions
### Prises en autonomie
- Vert (`--color-success`) / ambre (`--color-warning`) — l'accent rouge est évité : il se confond avec les états d'erreur et la colonne « Depuis Ready » rouge — sur tokens existants + filet 2 px → cohérent avec « règles 2 px », pas de nouveau token — réversible : oui
- Libellé masqué plutôt qu'infobulle → accessibilité sans bruit visuel — réversible : oui
- Texte du tag « Modifiée » assombri par `color-mix` — contraste insuffisant de l'ambre pur sur fond clair, pas de nouveau token — réversible : oui
### Arbitrées par l'humain
- Rendu des lignes → variante A + B (tag contour, filet, pointillé) parmi 5 propositions ; fond coloré abandonné
