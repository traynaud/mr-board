# Architecture — US-027 Favoris

## 0. ⚠️ Point bloquant : RG-027-16 factuellement incorrecte

**RG-027-16** dit : *« la réinitialisation de la configuration efface aussi tous les favoris. »*

Ce n'est pas possible tel quel : le bouton « Réinitialiser » (RG-015-05, section Divers des Paramètres) est un
**simple reset de formulaire non enregistré**, déjà précisé deux fois dans les specs validées :

- RG-015-05 (`docs/features/US-015-options-diverses/specs.md:23`) : *« remet dans le formulaire toutes les valeurs
  par défaut de toutes les sections […] **sans toucher au jeton ni aux repos** ; […] Rien n'est persisté avant
  « Enregistrer ». »*
- RG-019-20 (`docs/features/US-019-connexions-multi-forges/specs.md:151`) : *« « Réinitialiser » (RG-015-05) ne
  touche ni aux connexions, ni aux repos, ni aux identités. »*

Ce bouton ne fait **aucun appel backend** (`settings-page.component.ts` : `resetToDefaults()` ne fait qu'un
`FormGroup.reset()` local) et ne touche déjà ni aux repos ni aux connexions. Confirmé également côté backend :
aucune route de type « wipe » ou « reset global » n'existe dans `backend/src/modules/*` — il n'y a tout simplement
pas d'opération « réinitialisation de la configuration » qui supprime des données persistées.

Comme un favori dépend d'un repo existant (RG-027-04) et que ce bouton ne touche justement jamais aux repos, il ne
peut pas non plus toucher aux favoris — exactement par symétrie avec les repos/connexions.

**Proposition** : supprimer RG-027-16 des specs (les favoris ne sont, comme les repos et connexions, jamais
affectés par « Réinitialiser »). Je m'arrête ici sur ce point avant de poursuivre — le reste de cette archi
suppose déjà cette correction (aucune logique de purge liée au bouton Réinitialiser n'est prévue ci-dessous).

---

## 1. Vue d'ensemble

Nouvelle table `favorites` (backend), annotation locale indépendante des MRs synchronisées, identifiée par
(`project_id`, `iid`) — jamais l'id interne de la ligne `merge_requests` (RG-027-04). Bascule optimiste
(RG-027-09) exposée via l'existant `MergeRequestsController`, nouveau chip « Favoris » à côté de Drafts/Mes MRs,
nouvelle colonne étoile en tête de tableau, export/import étendu (RG-027-15).

Aucune dépendance circulaire : `MergeRequestsModule` importe `FavoritesModule` (jamais l'inverse), même schéma que
`MergeRequestsModule`/`SettingsTransferService` existant (`forwardRef` interdit, `architecture-backend.md` §9).

---

## 2. Backend

### 2.1 Nouvelle table `favorites`

Migration `AddFavorites<timestamp>.ts`, `CREATE TABLE` simple (comme `AddConnections`) :

```sql
CREATE TABLE "favorites" (
  "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  "project_id" integer NOT NULL,
  "iid" integer NOT NULL,
  "created_at" text NOT NULL,
  CONSTRAINT "UQ_favorites_project_iid" UNIQUE ("project_id", "iid"),
  CONSTRAINT "FK_favorites_project" FOREIGN KEY ("project_id") REFERENCES "projects" ("id") ON DELETE CASCADE
)
```

`ON DELETE CASCADE` suffit pour RG-027-05 (purge silencieuse à la suppression du repo) — confirmé par le
commentaire de `1757600400000-AllowNullDiffStats.ts` : TypeORM ne désactive `foreign_keys` que pendant
l'exécution des migrations, les FK sont bien appliquées en fonctionnement normal (comme
`merge_requests.project_id → projects.id` déjà en place). **Aucun code applicatif requis pour RG-027-05.**

Un favori orphelin (RG-027-05, MR absente après `deleteMissing`) n'a pas besoin d'être géré explicitement : la
ligne `favorites` survit simplement, indépendante de `merge_requests` — c'est le comportement par défaut, rien à
coder.

### 2.2 Entité (`modules/favorites/entities/favorite.entity.ts`)

Style identique à `MergeRequest` (pas de décorateur de relation, FK posée en migration SQL uniquement) :

```ts
@Entity({ name: 'favorites' })
export class Favorite {
  @PrimaryGeneratedColumn() id!: number;
  @Column({ name: 'project_id', type: 'integer' }) projectId!: number;
  @Column({ type: 'integer' }) iid!: number;
  @Column({ name: 'created_at', type: 'text' }) createdAt!: string;
}
```

### 2.3 `modules/favorites/`

- `favorites.service.ts` :
  - `list(): Promise<Favorite[]>` — toutes les lignes (volume faible, pas de pagination, même approche que
    `getIgnoredLabels`/`findAll` connexions dans `loadBase`).
  - `add(projectId: number, iid: number): Promise<void>` — idempotent (no-op si déjà favori).
  - `remove(projectId: number, iid: number): Promise<void>` — idempotent (`delete` sans vérif préalable).
- `favorites.module.ts` — `TypeOrmModule.forFeature([Favorite])`, exporte `FavoritesService`. Pas de controller
  propre : le seul point d'entrée HTTP est `MergeRequestsController` (§2.4), pour rester unidirectionnel.

### 2.4 Bascule : `MergeRequestsController`

```
PUT    /api/v1/merge-requests/:id/favorite   → 204, marque favori
DELETE /api/v1/merge-requests/:id/favorite   → 204, retire des favoris
```

`:id` est l'id interne de la ligne `merge_requests` (cohérent avec le reste de l'API, jamais exposé côté domaine
favoris). `MergeRequestsService.setFavorite(id, favorite)` résout `{projectId, iid}` via son propre repository
(`findOneBy({ id })`, `EntityNotFoundException('MergeRequest', id)` si absent → 404) puis délègue à
`FavoritesService.add`/`remove`. `MergeRequestsModule` importe `FavoritesModule`.

### 2.5 `isFavorite` dans `MergeRequestViewDto`

Ajout de `isFavorite!: boolean;`, calculé dans `loadBase()` exactement comme `isMine` :

```ts
const [ignoredLabels, meEmail, allConnections, favorites] = await Promise.all([
  this.settings.getIgnoredLabels(),
  this.settings.getMeEmail(),
  this.connections.findAll(),
  this.favoritesService.list(),
]);
const favoriteKeys = new Set(favorites.map((f) => `${f.projectId}:${f.iid}`));
// … dans toMergeRequestView(...), nouvel argument `favoriteKeys`:
isFavorite: favoriteKeys.has(`${mergeRequest.projectId}:${mergeRequest.iid}`),
```

`MergeRequestsService` injecte `FavoritesService` (via `FavoritesModule` importé par `MergeRequestsModule`).

### 2.6 Filtre `favoritesOnly`

Nouveau param `fav=0|1`, même style que `mine` (toujours présent, pas comme `q` qui est omis si vide) :

- `MergeRequestFilterQueryDto` : `@IsOptional() @IsIn(BOOLEAN_PARAMS) fav?: '0' | '1';`
- `ListOpenOptions`/`FacetsOptions` : `favoritesOnly?: boolean` (défaut `false`)
- `MergeRequestsController` : `favoritesOnly: query.fav === '1'` sur `list()` et `facets()`
- `loadBase()` : après l'assemblage des vues, **au même endroit que `mineOnly`** :
  ```ts
  if (favoritesOnly) {
    views = views.filter((view) => view.isFavorite);
  }
  ```
  Combinable en ET avec `mineOnly` (deux filtres indépendants appliqués en série) — satisfait le scénario
  « combinaison avec Projet » et par extension avec Mes MRs.

Pas de compteur dédié sur la facette (RG-027-10 : « sans compteur propre ») — identique à `mine`, qui n'apparaît
déjà pas dans `MergeRequestsFacetsDto` aujourd'hui. Rien à ajouter à `buildFacets`.

### 2.7 Export / Import (RG-027-15)

Format demandé par les specs : `{ connexion, repo (chemin), iid }` — même structure que `ExportProjectDto`
(`connection`, `pathWithNamespace`) plus `iid`. Ajout **non versionnant** : `favorites` est un tableau optionnel du
`version: 2` existant (même pattern que `connections`, ajouté après coup sans bump de version dans
`ImportConfigDto`) :

- `dto/export-config.dto.ts` : `ExportFavoriteDto { connection: string; pathWithNamespace: string; iid: number }`,
  `ExportConfigDto.favorites!: ExportFavoriteDto[]`.
- `dto/import-favorite.dto.ts` : même shape, validée (`@IsString`, `@IsInt`).
- `dto/import-config.dto.ts` : `favorites?: ImportFavoriteDto[]` — absent/ignoré sur un fichier `version: 1`
  (RG-027-15 ne couvre que le format courant, pas de migration legacy nécessaire).
- `SettingsTransferService.export()` : résout chaque favori via la map `projectsById` déjà construite pour
  `projects`, exclut silencieusement un favori dont le projet n'existe plus (invariant impossible en pratique vu
  le cascade RG-027-05, mais sans risque de planter l'export).
- `SettingsTransferService.importCurrent()` (et non `importLegacy`, RG-027-15 n'a pas d'équivalent `version: 1`) :
  après `applyProjects`, résout chaque `ImportFavoriteDto` en cherchant le projet par (nom de connexion, chemin)
  dans `this.projects.list()` frais ; **ignoré silencieusement si introuvable** (RG-027-15) ; sinon
  `favoritesService.add(project.id, entry.iid)` — **additif, jamais de purge** des favoris existants (RG-027-15,
  cohérent avec l'import des repos qui ne supprime jamais un repo existant non plus).
- `SettingsTransferModule` importe `FavoritesModule`.

---

## 3. Frontend

### 3.1 Modèle (`models/merge-request.model.ts`)

- `MergeRequestView.isFavorite: boolean` (miroir du DTO, même style que `isMine`).
- `MergeRequestFilters.favorites: boolean` (filtre de base, même statut que `drafts`/`mine` — **pas** un
  `FilterKey` composable : pas de pastille, pas de menu, juste le chip).

### 3.2 Service HTTP (`core/api/merge-requests.service.ts`)

- `filterParams()` : `.set('fav', filters.favorites ? '1' : '0')`, même endroit que `drafts`/`mine`.
- Nouvelle méthode `setFavorite(id: number, favorite: boolean): Observable<void>` :
  ```ts
  setFavorite(id: number, favorite: boolean): Observable<void> {
    return favorite
      ? this.http.put<void>(`api://merge-requests/${id}/favorite`, {})
      : this.http.delete<void>(`api://merge-requests/${id}/favorite`);
  }
  ```

### 3.3 `FiltersStore`

- État : `favorites: boolean` (initial `false`).
- `toggleFavorites(): void` — identique à `toggleMine()`.
- `clear()` : remet aussi `favorites: false` (RG-027-11 : remis à zéro par Effacer, comme Mes MRs — **jamais**
  `toggleDrafts`/`drafts`, qui n'est pas touché par `clear()` non plus).

### 3.4 URL (`core/url-state/query-params.mapper.ts`)

- `UrlState.favorites: boolean`, décodé/encodé exactement comme `mine` (`fav=1` toujours présent, RG-027-11).

### 3.5 `MergeRequestsStore` — bascule optimiste (RG-027-09)

Nouvelle méthode, même convention retour que `ThemeService.quickToggle()` (clé i18n d'erreur ou `null`) :

```ts
async toggleFavorite(row: MergeRequestView): Promise<string | null> {
  const next = !row.isFavorite;
  patchState(store, {
    mergeRequests: store.mergeRequests().map((mr) =>
      mr.id === row.id ? { ...mr, isFavorite: next } : mr,
    ),
  });
  try {
    await firstValueFrom(api.setFavorite(row.id, next));
    return null;
  } catch (error) {
    patchState(store, {
      mergeRequests: store.mergeRequests().map((mr) =>
        mr.id === row.id ? { ...mr, isFavorite: !next } : mr,
      ),
    });
    return errorKeyOf(error);
  }
}
```

Pas de rechargement complet (`scheduleReload`) — RG-027-09 est un patch local ciblé, plus rapide et sans
scintillement du tableau ; si le filtre Favoris est actif, la ligne démasquée/masquée réactivement puisque
`rows()` (dans `board-page.component.ts`) est déjà `computed` sur `mergeRequests()`.

### 3.6 `BoardPageComponent`

- `onFavoritesToggle()` : mirroir de `onMineToggle()` → `filtersStore.toggleFavorites()` +
  `mrStore.scheduleReload()`.
- `onFavoriteStarToggle(row: MergeRequestView)` :
  ```ts
  protected async onFavoriteStarToggle(row: MergeRequestView): Promise<void> {
    const errorKey = await this.mrStore.toggleFavorite(row);
    if (errorKey) {
      this.toast(errorKey);
    }
  }
  ```

### 3.7 Chip « Favoris » (`filter-bar.component.html`)

Dans le même `mat-chip-listbox` que Drafts/Mes MRs, après Mes MRs, icône étoile :

```html
<mat-chip-option [selected]="favorites()" (selectionChange)="$event.isUserInput && favoritesToggle.emit()">
  <mat-icon svgIcon="star-fill" matChipAvatar />
  {{ 'board.filters.favorites' | translate }}
</mat-chip-option>
```

`FilterBarComponent` gagne `favorites = input.required<boolean>()` et `favoritesToggle = output<void>()`, câblés
par `BoardPageComponent` comme `drafts`/`mine`.

### 3.8 Colonne étoile (`mr-table.component.html`/`.ts`)

Nouvelle colonne `favorite`, **avant** `project`, en dehors de `COLUMNS_BEFORE_STATUS` (elle doit rester avant
Projet, RG-027-07) — ajout direct à `displayedColumns`. **Non redimensionnable, sans en-tête, 36px fixe** :
pas de `appResizableColumn`, pas de clé dans `ResizableColumnKey`/`ColumnWidthsStore` (RG-027-07 : ni optionnelle
ni redimensionnable).

```html
<ng-container matColumnDef="favorite">
  <th mat-header-cell *matHeaderCellDef class="favorite-header"></th>
  <td mat-cell *matCellDef="let row" class="favorite-cell">
    <button
      mat-icon-button
      type="button"
      class="favorite-toggle"
      [attr.aria-label]="(row.isFavorite ? 'board.mergeRequests.favorite.remove' : 'board.mergeRequests.favorite.add') | translate: { title: row.title }"
      (click)="favoriteToggle.emit(row)"
    >
      <mat-icon [svgIcon]="row.isFavorite ? 'star-fill' : 'star'" class="favorite-icon" [class.active]="row.isFavorite" />
    </button>
  </td>
</ng-container>
```

```ts
protected readonly displayedColumns = computed(() => [
  'favorite',
  ...COLUMNS_BEFORE_STATUS,
  ...(this.showStatus() ? ['status'] : []),
  ...COLUMNS_AFTER_STATUS,
  ...(this.showOpened() ? ['opened'] : []),
  'columnsMenu',
]);
```

Nouvel `output favoriteToggle = output<MergeRequestView>()`, câblé par `BoardPageComponent` vers
`onFavoriteStarToggle`. RG-027-08 (Entrée/Espace) : gratuit via `mat-icon-button` natif (`<button>` gère déjà
clavier/Entrée/Espace/focus).

### 3.9 Icônes (`shared/icons/provide-icons.ts`)

Deux nouvelles entrées Lucide `star` (contour, RG-027-08 état non favori) et `star-fill` (plein, accent
`#ec3013` porté par `currentColor` + classe `.active`, cf. maquette de référence en §4 des specs) :

```ts
star: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
'star-fill': '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" fill="currentColor"/>',
```

(`star-fill` surcharge `fill="none"` du gabarit `LUCIDE_ATTRS` directement sur le `<polygon>`, seule icône du
registre à le faire — même pattern que la coche `check`, mais avec la couleur portée par `currentColor` pour
suivre l'accent CSS de la classe `.active` plutôt qu'être figée en dur.)

### 3.10 i18n (`public/i18n/fr.json` — clés à ajouter, valeurs en `en.json` si présent)

- `board.filters.favorites` → « Favoris »
- `board.mergeRequests.favorite.add` → « Marquer « {{title}} » comme favori »
- `board.mergeRequests.favorite.remove` → « Retirer « {{title}} » des favoris »

---

## 4. Points d'attention pour la Phase 3 (Dev)

- **RG-027-16** : à retirer des specs avant ou pendant la Phase 3 — cf. §0, en attente de validation utilisateur.
- Le filtre `favorites` est un filtre de **base** (comme `mine`), pas un `FilterKey` : ne pas l'ajouter par erreur
  à `ALL_FILTER_KEYS`/`isMultiValueFilter`/`ComposableFilters`.
- `favoritesOnly` s'applique **après** l'assemblage des vues dans `loadBase()`, comme `mineOnly` — jamais avant
  (les stats de recherche/labels ignorés restent calculées sur l'ensemble complet).
- Le test e2e combiné Favoris + Drafts doit couvrir le même point que BUG-003 (US-026) : un draft favori reste
  masqué si `includeDrafts` est faux (RG-027-13), mais visible et filtrable si `includeDrafts` est vrai.
- QA API manuelle : proposer de reconduire le même choix que US-025/026 (voir historique des QA), sauf avis
  contraire de l'utilisateur.
