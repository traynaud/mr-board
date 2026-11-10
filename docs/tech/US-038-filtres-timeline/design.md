# Design — US-038 Filtres de la timeline

## Classification : changement **simple** (pas de D9)
La barre de filtres de la page Historique figure dans la maquette validée d'US-037
(https://claude.ai/artifact/VWCqL17YH834Mv6V8fGkNU) : champ de recherche, pastilles accent, « + Ajouter un filtre »,
« Effacer », état « aucun résultat ». Les pastilles ajoutées ici (Projet, Période) et leurs menus dupliquent à
l'identique le pattern pastille + menu du tableau (US-010). Aucun nouvel écran ni écart avec `docs/design/`.

## Barre de filtres (sous la toolbar de page, au-dessus de la timeline)
Même rendu que la barre du tableau (padding `10px 20px`, filet bas 2 px `--color-divider`, `flex-wrap`) :
1. **Recherche** — champ toujours visible à gauche (`matInput`, outline, 220 px, placeholder « Rechercher une MR… »,
   `maxlength` 100, anti-rebond 300 ms). Contrairement au tableau, ce n'est pas une pastille : la maquette validée
   l'affiche en permanence.
2. **Pastilles de filtres actifs** (accent-100 / accent-300 / accent-800, croix) : « Type : Approuvée, Fusionnée »,
   « Acteur : alice », « Projet : api », « Période : 06/11 → 08/11 ». Clic sur le corps = menu ; croix = retrait.
   Libellé tronqué à 2 valeurs puis « +N » (comme le tableau).
3. **« + Ajouter un filtre »** (bouton texte accent) — menu listant Type, Acteur, Projet, Période ; une entrée déjà
   active est grisée avec une coche (comportement du tableau).
4. **« Effacer »** à droite (bouton `mat-button`), visible seulement si un filtre ou la recherche est actif.

## Menus des pastilles
| Pastille | Contenu du menu |
|----------|-----------------|
| Type | Cases à cocher des 18 types (libellés `history.actions.*`), pastille carrée de couleur du type en préfixe ; pas de compteur |
| Acteur | Champ de recherche d'option, cases à cocher « Inconnu » (en tête) puis acteurs (nom, `@username` en gris) ; pas de compteur |
| Projet | Cases à cocher, pastille de couleur du repo (US-025), alias ; champ de recherche si > 8 projets |
| Période | Deux champs `mat-datepicker` « Du » / « Au » (Material, thème global, format local), bouton « Effacer » de la période ; « Du » ≤ « Au » imposé par `min` / `max` |

Les menus restent ouverts à chaque coche (multi-sélection, comme le tableau).

## États
- **Chargement après changement de filtre** : `mat-progress-bar` indeterminate en haut de la timeline (la liste
  précédente reste affichée en atténué, `opacity: .5`, pour éviter le saut visuel) — ✅ hypothèse.
- **Aucun résultat** : texte centré « Aucun événement ne correspond aux filtres. » + bouton texte « Effacer les filtres ».
- **Vide sans filtre / erreur** : inchangés (US-037). L'erreur offre « Réessayer » et, si des filtres sont actifs,
  « Effacer les filtres ».
- **Compteur de la toolbar** : `history.count` avec le total filtré.

## Composants
| Élément | Réutilisé / nouveau |
|---------|---------------------|
| Pastille + menu à cases | réutilise le style de `FilterPillComponent` ; composant dédié historique si le couplage aux `FilterKey` du tableau l'empêche (voir archi) |
| Menu « + Ajouter un filtre » | `MatMenu` (pattern du tableau) |
| Champ de recherche | `MatFormField` + `matInput` (pattern du tableau) |
| Dates | `MatDatepicker` + `provideNativeDateAdapter` (nouveau dans l'app, composant Material standard) |
| Icônes | existantes (`x`, `chevron-down`, `plus`…) |

## Tokens
Tokens existants uniquement (`--color-accent-*`, `--color-divider`, `--space-*`) ; aucune valeur brute nouvelle.

## Clés i18n (`fr.json` / `en.json`)
`history.filters.*` : `searchPlaceholder`, `add`, `clear`, `clearFilters`, `names.{type,actor,project,period}`,
`unknownActor`, `period.{from,to,clear}`, `remove`, `more`, `noMatch`.

## Décisions
### Prises en autonomie
- Changement classé « simple » : barre déjà dans la maquette validée d'US-037 — réversible : oui
- Recherche toujours visible (et non pastille) → conforme à la maquette validée — réversible : oui
- Datepicker Material (nouveau composant dans l'app) pour la période → Material d'abord — réversible : oui
- Liste précédente atténuée pendant le rechargement → évite le saut visuel — réversible : oui
### Arbitrées par l'humain
- Aucune (maquette d'US-037 validée le 2026-11-09)
