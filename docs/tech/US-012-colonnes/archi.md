# Architecture — US-012 Colonnes redimensionnables

## Résumé fonctionnel
Chaque colonne du tableau (sauf « Titre », flexible, et le menu « Colonnes ») porte une poignée de redimensionnement
sur son bord droit. Les largeurs choisies sont mémorisées dans `localStorage` et restaurées au chargement. Le menu
« Colonnes » (déjà construit en US-011) gagne un item « Réinitialiser les largeurs » ; la colonne « Ouverte »
(déjà construite en US-011) gagne un tooltip date+heure.

---

## Backend

Aucun changement. Purement frontend, aucune donnée persistée côté serveur (RG-012-03 : `localStorage`, jamais l'URL).

---

## Frontend

### Intégration dans les features existantes
- `features/board/mr-table/` reçoit les poignées de redimensionnement, le `table-layout: fixed` nécessaire pour que
  les largeurs soient respectées, et l'item de menu « Réinitialiser les largeurs ».
- `features/board/board-page.component.ts` orchestre : injecte le nouveau `ColumnWidthsStore` et passe les largeurs
  effectives à `<app-mr-table>`, cohérent avec le pattern déjà utilisé pour `ColumnsStore`/`FiltersStore` — **pas**
  d'injection directe du store dans `MrTableComponent`, qui reste un composant purement présentationnel (aucun état
  ni accès localStorage), cohérent avec tous les composants `features/board/*` existants.
- Nouveau `shared/resizable-column/` (déjà anticipé dans `architecture-frontend.md`) : directive générique,
  indépendante de toute logique métier (pas de dépendance à `ColumnWidthsStore` ni à l'i18n — reçoit largeur
  courante et `aria-label` déjà traduit en entrée, émet des événements).

### Composants réutilisables et Angular Material
| Composant | Origine | Usage prévu |
|-----------|---------|-------------|
| `mat-divider` | Angular Material (première utilisation dans le projet) | Séparateur avant « Réinitialiser les largeurs » dans le menu Colonnes (RG-012-05) |
| `mat-menu-item` | Angular Material | Item « Réinitialiser les largeurs » (action ponctuelle, ferme le menu — comportement par défaut, contrairement à la case à cocher « Date d'ouverture ») |

### Contrat — `shared/resizable-column/resizable-column.directive.ts`

Directive attribut générique (aucune dépendance à l'app), posée sur un `<span>` enfant de chaque `<th>`
redimensionnable :

```ts
@Directive({ selector: '[appResizableColumn]' })
export class ResizableColumnDirective {
  readonly currentWidth = input.required<number>();
  readonly ariaLabel = input.required<string>();       // déjà traduit par l'appelant (RG-012-07)
  readonly minWidth = input(40);                        // RG-012-02, configurable plutôt que figé
  readonly maxWidth = input(800);

  readonly widthChange = output<number>();              // nouvelle largeur, déjà bornée — émis en continu pendant le glisser et à chaque flèche
  readonly resetRequested = output<void>();              // RG-012-04, double-clic
}
```

**Interaction** : `pointerdown` capture le pointeur (`setPointerCapture`, évite de gérer des listeners
`document`-level et leur nettoyage) ; `pointermove` calcule `clamp(largeurDépart + deltaX)` et émet en continu
(RG-012-01, « temps réel ») ; `pointerup` relâche la capture. `dblclick` émet `resetRequested` (RG-012-04).
`keydown.ArrowLeft`/`ArrowRight` émettent `clamp(largeurCourante ± 8)` (RG-012-07). `click` sur la poignée appelle
`stopPropagation()` pour ne pas déclencher le tri des colonnes triables (RG-012-08, la poignée est un enfant du
`<th>` qui porte déjà `(click)="sortChange.emit(...)"` pour Difficulté/Depuis Ready). `role="separator"` +
`aria-orientation="vertical"` + `aria-valuenow/min/max` (bonus accessibilité au-delà du strict RG-012-07, coût nul).

⚠️ **jsdom (environnement de test) n'implémente pas `Element.prototype.setPointerCapture`/`hasPointerCapture`/
`releasePointerCapture`** — à stubber explicitement dans `resizable-column.directive.spec.ts` (`beforeEach` ou en
tête de fichier), sans quoi les tests de glisser échoueront avec « not a function ». Ne pas ajouter de garde
défensive dans la directive elle-même pour ce cas : ce serait du code mort en production (tous les navigateurs
cibles implémentent ces méthodes).

### Contrat — `stores/column-widths.store.ts`

```ts
export type ResizableColumnKey =
  | 'project' | 'author' | 'difficulty' | 'comments' | 'reviewer' | 'assignee' | 'approved' | 'ready' | 'opened';

/** RG-005-02 : largeurs initiales, reprises du prototype de référence. */
export const DEFAULT_COLUMN_WIDTHS: Record<ResizableColumnKey, number> = {
  project: 64, author: 52, difficulty: 150, comments: 44,
  reviewer: 72, assignee: 72, approved: 76, ready: 118, opened: 120,
};

export interface ColumnWidthsState {
  /** Uniquement les colonnes explicitement redimensionnées (RG-012-03). */
  overrides: Partial<Record<ResizableColumnKey, number>>;
}
```

- `widths` (computed) : `{ ...DEFAULT_COLUMN_WIDTHS, ...overrides() }` — largeurs effectives complètes, seul ce
  signal est consommé par `board-page.component.ts`.
- `setWidth(key, width)` : borne `[40, 800]` (RG-012-02), patch `overrides`, persiste (`localStorage.setItem`,
  try/catch silencieux — RG-012's cas « localStorage indisponible », voir Points de vigilance).
- `resetOne(key)` (RG-012-04, double-clic) : retire `key` de `overrides`, persiste.
- `resetAll()` (RG-012-04/05, item de menu) : `overrides = {}`, `localStorage.removeItem` (le scénario « localStorage
  est nettoyé » se lit comme une suppression complète, pas un objet vide stocké).
- Lecture initiale au premier accès au store (comme `initialState`, pas de méthode `load()` séparée à appeler
  depuis un composant — rien à orchestrer, contrairement à `FiltersStore`/`ColumnsStore` qui sont restaurés depuis
  l'URL) : `JSON.parse(localStorage.getItem('mrboard.columns.v1'))`, validé (objet, valeurs numériques dans
  `[40, 800]`, clés reconnues) et réduit à `{}` sur toute erreur (parse invalide, `localStorage` indisponible,
  valeurs corrompues) — jamais d'exception propagée au composant.

### Nouvelles tâches techniques

| Tâche | Type | Description |
|-------|------|--------------|
| Créer `shared/resizable-column/resizable-column.directive.ts` (+ `.spec.ts`) | Directive | Glisser (pointer capture), clavier, double-clic — voir contrat ci-dessus |
| Créer `stores/column-widths.store.ts` (+ `.spec.ts`) | SignalStore | `overrides`, `widths` (computed), `setWidth`/`resetOne`/`resetAll`, lecture/écriture `localStorage` résiliente |
| Étendre `features/board/mr-table/mr-table.component.ts` (+ `.spec.ts`) | Composant | Nouveaux inputs `columnWidths: Record<string, number>` ; nouveaux outputs `widthChange`, `resetColumnWidth`, `resetAllWidths` |
| Étendre `features/board/mr-table/mr-table.component.html` | Template | `[style.width.px]` sur chaque `<th>` redimensionnable + poignée `appResizableColumn` ; `<mat-divider>` + item « Réinitialiser les largeurs » dans le menu Colonnes ; tooltip sur la colonne « Ouverte » (RG-012-06) |
| Étendre `features/board/mr-table/mr-table.component.scss` | Style | `table-layout: fixed` sur `.mr-table` (nécessaire pour que les largeurs posées sur les `<th>` soient respectées) ; styles `.resize-handle` (zone 6px, trait 1px visible au survol de l'en-tête, accent au focus) |
| Étendre `features/board/board-page.component.ts` (+ `.spec.ts`) | Composant | Injecte `ColumnWidthsStore`, câble `[columnWidths]="columnWidthsStore.widths()"`, `(widthChange)="columnWidthsStore.setWidth(...)"`, `(resetColumnWidth)="columnWidthsStore.resetOne(...)"`, `(resetAllWidths)="columnWidthsStore.resetAll()"` |
| Étendre `features/board/board-page.component.html` | Template | Câblage des 4 nouveaux inputs/outputs sur `<app-mr-table>` |
| Ajouter clés `board.columns.resetWidths`, `board.columns.resizeAriaLabel`, `board.mergeRequests.opened.tooltip` | i18n | `public/i18n/fr.json` |

### Modifications sur l'existant

| Élément modifié | Nature | Risque | Solution |
|-----------------|--------|--------|----------|
| `mr-table.component.scss` (`table-layout: fixed`) | Change le mode de calcul des largeurs de colonnes | Moyen | Toutes les colonnes redimensionnables reçoivent une largeur explicite (défaut ou override) ; seule « Titre » reste sans largeur pour absorber l'espace restant — comportement déjà voulu par RG-012-02. À vérifier visuellement (aucun outil de rendu disponible dans cette session, voir Points de vigilance) |
| `mr-table.component.ts` | 2 nouveaux inputs `required`, 3 nouveaux outputs | Faible | Tous les call sites (`board-page.component.html`, tests) doivent les fournir |

---

## ⚠️ Points à clarifier

Aucun — les specs (déjà recentrées en Phase 1 sur le seul redimensionnement) sont suffisamment précises. Les choix
d'implémentation ci-dessus (pointer capture plutôt que listeners `document`, `minWidth`/`maxWidth` en inputs de la
directive plutôt qu'en constantes partagées avec le store) sont des décisions techniques internes, pas des
ambiguïtés fonctionnelles.

## Points de vigilance globaux

- **`table-layout: fixed`** change potentiellement le rendu visuel fin de colonnes qui n'avaient jusqu'ici aucune
  largeur explicite (`comments`, `approved`) — combiné à l'absence d'outil de rendu dans cette session (déjà signalé
  en US-010/011), à vérifier visuellement contre les maquettes avant mise en production.
- **jsdom et Pointer Events** : voir note dans le contrat de la directive — stubber `setPointerCapture` et
  consorts dans les tests, ne pas polluer le code de production.
- **`localStorage` partagé avec d'éventuelles autres clés `mrboard.*`** (aucune actuellement) — clé versionnée
  `mrboard.columns.v1` déjà choisie par les specs, cohérente avec une éventuelle migration future.

---

## Ordre de réalisation suggéré
1. `stores/column-widths.store.ts` (+ tests, y compris résilience `localStorage`)
2. `shared/resizable-column/resizable-column.directive.ts` (+ tests, avec stub Pointer Capture)
3. `mr-table.component.*` (largeurs, poignées, menu étendu, tooltip) (+ tests)
4. `board-page.component.*` (câblage) (+ tests)
5. Clés i18n
6. Validation manuelle contre les maquettes (non réalisable dans cette session, à signaler en QA)
