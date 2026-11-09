# Design — US-037 Page Historique

## Référence maquettes
- Maquette validée par l'humain : https://claude.ai/artifact/VWCqL17YH834Mv6V8fGkNU (« MR Board — page Historique »).
- Elle inclut la barre de filtres d'US-038 (hors périmètre d'US-037 : non implémentée ici).

## Écrans
### Entrée de navigation
Bouton icône `mat-icon-button` « Historique » dans `BoardToolbarComponent`, **avant** la bascule de thème et les
paramètres (`routerLink="/history"`, icône `history`, tooltip + `aria-label` = `board.toolbar.history`).

### Page `/history`
1. **Toolbar de page** (même `mat-toolbar` que le tableau : fond `--color-bg`, filet bas 2 px `--color-divider`) :
   bouton retour (`arrow-left`, `routerLink="/"`), titre « Historique » (Archivo 800, 18 px), compteur à droite
   (`history.count`).
2. **Timeline** groupée par jour : titre de jour (11 px, majuscules, filet 2 px) puis lignes.
3. **Ligne d'événement** : heure (tooltip = date exacte `formatDateTime`), avatar 28 px carré (`AvatarComponent`,
   ou carré pointillé « ? » pour un acteur inconnu), pastille carrée 10 px colorée par type, phrase
   « *acteur* a *action* », tag projet (`projectTagStyle`), lien MR (`#iid titre`, `target="_blank"`), ligne de
   détail éventuelle (ancien → nouveau ; citation pour un commentaire).
4. **Pied** : bouton « Charger plus » (`mat-stroked-button`) tant que `nextCursor` existe.
5. **États** : chargement (`mat-progress-bar` indeterminate), vide (texte centré), erreur (texte + « Réessayer »).

## Couleur par type (pastille)
| Type | Token |
|------|-------|
| `approved`, `merged` | `--color-success` (vert `#2f8f4e`) |
| `closed`, `deleted`, `disappeared` | `--color-accent` |
| autres | `--color-neutral-500` |

## Composants
| Élément | Réutilisé / nouveau | Fichier |
|---------|---------------------|---------|
| Toolbar | `mat-toolbar` (styles copiés du pattern board) | nouveau `features/history/history-page.component` |
| Avatar | réutilisé | `shared/avatar/avatar.component.ts` |
| Tag projet | réutilisé (`projectTagStyle`) | `shared/project-color/project-tag-style.ts` |
| Dates | réutilisé (`formatDateTime`, `formatTime`) | `shared/format/format-date.ts` |
| Icônes | `arrow-left` existante ; **ajout** `history` | `shared/icons/provide-icons.ts` |
| Ligne d'événement | nouveau | `features/history/history-event-row/` |
| Phrase / détail d'un événement | fonction pure | `features/history/describe-event.ts` |

## Tokens
Couleurs `--color-*`, espacements `--space-*`, `--font-heading` ; aucune valeur brute hors tailles de police (11/12/13 px
déjà utilisées dans l'app).

## Clés i18n (`fr.json` / `en.json`)
`board.toolbar.history`, `history.title`, `history.count`, `history.loadMore`, `history.empty`, `history.error`,
`history.unknownActor`, `history.today`, `history.yesterday`, `history.actions.<type>` (18 types),
`history.detail.*` (brouillon, prêt, valeurs).

## Décisions
### Prises en autonomie
- Icône « Historique » = Lucide `history` ajoutée au registre → pattern existant → réversible : oui
- Pastille de type : 3 couleurs sur tokens existants, pas de nouveau token → réversible : oui
- Jours « Aujourd'hui » / « Hier » libellés, autres dates en `formatShortDate` → réversible : oui
### Arbitrées par l'humain
- Maquette du 2026-11-09 → validée telle quelle
