# Architecture — US-025 Couleur d'arrière-plan par repo dans la colonne Projet

## Résumé fonctionnel
Chaque repo (Projet) peut recevoir une couleur d'arrière-plan parmi une palette fermée de 10 teintes pastel,
configurée dans sa fiche (Paramètres → 02 · Connexions). Elle s'affiche pleine sur la case Projet et l'option du
filtre « Projet » ; sur une MR Draft, la case du tableau l'affiche éclaircie (45 % de mélange avec le fond de page).

---

## Backend

### Impacts sur le modèle de données

- **`Project` (`backend/src/modules/projects/entities/project.entity.ts`)** : nouvelle colonne
  `color: string | null` (`@Column({ type: 'text', nullable: true })`), stockant l'**id** de la palette
  (`slate`, `sage`, …, voir Frontend) ou `null` (RG-025-01 « Aucune »). Le backend ne connaît que l'id, jamais les
  valeurs hex — celles-ci sont un détail de présentation frontend (voir §Frontend).
- **Migrations** : `AddProjectColor1757601600000` (suit `AddMergeStatusColumns1757601500000`) :
  `ALTER TABLE "projects" ADD COLUMN "color" text NULL` ; `down()` : `ALTER TABLE "projects" DROP COLUMN "color"`
  (réversible, contrairement à `AddMergeStatusColumns`, car c'est un ajout pur sans transformation de données).

### Intégration dans les modules existants

- **`modules/projects`** : `ProjectsService`, `CreateProjectDto`, `UpdateProjectDto`, `ProjectResponseDto` — seul
  module modifié côté modèle.
- **`modules/settings-transfer`** : `ExportProjectDto`, `ImportProjectDto`, `settings-transfer.service.ts` — pour
  RG-025-08 (export/import).
- **Aucun impact sur `modules/merge-requests` ni sur `MergeRequestView`** : la couleur est un attribut du **Projet**,
  résolu côté frontend par alias (le tableau reçoit déjà la liste des `Project[]` en entrée, voir §Frontend) — pas
  besoin de la dupliquer sur chaque MR ni de toucher au mapper GitLab/GitHub. Voir ⚠️ Points de vigilance.
- **Nouveau fichier `modules/projects/domain/project-color.ts`** : constante `PROJECT_COLOR_IDS` (tuple des 10 ids,
  voir Frontend pour les valeurs) + type `ProjectColorId`, utilisée par les DTOs pour la validation `@IsIn`. Le
  frontend a sa propre liste (couplée aux valeurs hex) — les deux listes d'ids doivent rester synchronisées
  manuellement (⚠️ Points de vigilance).

### Contrat API

| Méthode | Route                     | Body / Query                          | Réponse               | Codes |
|---------|---------------------------|----------------------------------------|------------------------|-------|
| POST    | `/api/v1/projects`        | `CreateProjectDto` (+ `color?`)        | `ProjectResponseDto`  | 201, 400, 404, 409 |
| PUT     | `/api/v1/projects/:id`    | `UpdateProjectDto` (`alias`, `color`)  | `ProjectResponseDto`  | 200, 400, 404 |
| GET     | `/api/v1/projects`        | —                                       | `ProjectResponseDto[]` (avec `color`) | 200 |
| GET     | `/api/v1/settings/export` | —                                       | `ExportConfigDto` (`projects[].color`) | 200 |
| POST    | `/api/v1/settings/import` | `ImportConfigDto` (`projects[].color?`) | `ImportResultDto`     | 200, 400 |

### Nouvelles tâches techniques

| Tâche | Type | Description |
|-------|------|-------------|
| Créer `domain/project-color.ts` | Constante + type | `PROJECT_COLOR_IDS` (10 ids), `ProjectColorId` — utilisé par les DTOs (`@IsIn`) |
| Créer migration `AddProjectColor1757601600000` | Migration | `ALTER TABLE projects ADD COLUMN color text NULL`, réversible |
| Créer `domain/project-color.spec.ts` | Test unitaire | Vérifie la forme de `PROJECT_COLOR_IDS` (10 entrées, pas de doublon) |

### Modifications sur l'existant

| Élément modifié | Nature de la modification | Risque | Solution proposée |
|-----------------|---------------------------|--------|--------------------|
| `entities/project.entity.ts` | Ajout colonne `color: string \| null`, nullable | Faible | Migration dédiée, défaut `null` |
| `dto/create-project.dto.ts` | Ajout `color?: string` optionnel, `@IsOptional() @IsIn(PROJECT_COLOR_IDS)` (RG-025-07 : dispo dès la création) | Faible | — |
| `dto/update-project.dto.ts` | Ajout `color: string \| null` **obligatoire dans le body** (le front envoie toujours les deux champs ensemble, voir §Frontend) ; valider avec `@ValidateIf((o) => o.color !== null) @IsIn(PROJECT_COLOR_IDS) color!: string \| null;` — `null` toujours accepté (RG-025-01, retour à « Aucune ») | Faible | Documenter le contrat dans le DTO (JSDoc) |
| `dto/project-response.dto.ts` | Ajout `color!: string \| null;` | Faible | — |
| `projects.service.ts` — `add()` | `color: dto.color ?? null` dans `repository.create(...)` | Faible | — |
| `projects.service.ts` — `rename()` | Persiste aussi `project.color = dto.color` (déjà `string \| null` d'après `UpdateProjectDto`) ; envisager de renommer la méthode (`rename` → `update`) puisqu'elle ne modifie plus seulement l'alias — au choix du dev, sans impact fonctionnel | Faible | Renommage optionnel, sinon JSDoc mis à jour |
| `projects.service.ts` — `toResponse()` | Ajoute `color: project.color` au retour | Faible | — |
| `projects.service.ts` — `importMany()` | `ImportProjectEntry.color?: string \| null` : si la clé est **absente** (fichier exporté par une version antérieure à US-025), la couleur existante d'un repo apparié n'est pas modifiée ; si elle est **présente** (y compris `null`), elle écrase toujours la couleur du repo apparié (RG-025-08, même logique que l'alias) ; pour un repo nouvellement créé par l'import, `entry.color ?? null` | Moyen | Distinguer `'color' in entry` (clé présente) de `entry.color === undefined` (clé absente) — voir `ExportProjectDto`/`ImportProjectDto` ci-dessous |
| `settings-transfer/dto/export-config.dto.ts` — `ExportProjectDto` | Ajout `color!: string \| null;` | Faible | — |
| `settings-transfer/dto/import-config.dto.ts` — `ImportProjectDto` (version 2) | Ajout `@IsOptional() @ValidateIf((o) => o.color !== null) @IsIn(PROJECT_COLOR_IDS) color?: string \| null;` | Faible | `ImportProjectLegacyDto` (version 1) reste inchangé — pas de `color`, donc toujours absent pour un import v1 |
| `settings-transfer.service.ts` | Mapping export : `color: project.color` sur chaque `ExportProjectDto`. Mapping import : transmettre `entry.color` (tel quel, `undefined` si absent côté v1) dans `ImportProjectEntry` | Faible | — |

---

## Frontend

### Intégration dans les features existantes

- **`features/board`** : `MrTableComponent` (case Projet), `FilterBarComponent` → `FilterPillComponent` (option du
  filtre Projet).
- **`features/settings`** : `RepositoriesSectionComponent` (sélecteur de couleur par repo, à la création et à
  l'édition), `repos-form.ts` (formulaire différé, RG-025-07).
- **Nouveau : `shared/project-color/`** : palette + helpers, réutilisée par `board` et `settings`. Aucune nouvelle
  route.

### Composants réutilisables et Angular Material

| Composant | Origine | Usage prévu |
|-----------|---------|-------------|
| `MatMenu` | Angular Material | Ouvre le sélecteur de 11 pastilles (10 couleurs + Aucune), même pattern que `FilterPillComponent` |
| `MatTooltip` | Angular Material | Nom de la couleur au survol d'une pastille (accessibilité) |
| `MatIconButton` | Angular Material | Bouton déclencheur du sélecteur dans la fiche repo |

### Nouvelles tâches techniques

| Tâche | Type | Description |
|-------|------|-------------|
| Créer `shared/project-color/project-color-palette.ts` | Constante + types | `ProjectColorId`, `ProjectColorSwatch { id, background, text, labelKey }`, `PROJECT_COLOR_PALETTE` (10 entrées, RG-025-02), `findProjectColor(id: string \| null)` |
| Créer `shared/project-color/project-tag-style.ts` | Fonction pure | `projectTagStyle(color: string \| null, draft: boolean): { background: string; color: string } \| null` — RG-025-03/04 : couleur pleine si `!draft`, mélange 45 % avec le fond de page si `draft` (conversion hex → `rgba(...,0.45)`), `null` si pas de couleur (le tag garde `tag-neutral`) |
| Créer `shared/project-color/project-tag-style.spec.ts` | Test unitaire | Couvre : pas de couleur → `null` ; Ready → couleurs pleines ; Draft → alpha 0.45, même `text` |
| Créer `shared/project-color/project-color-picker.component.ts` (+ `.html`, `.scss`, `.spec.ts`) | Composant | Bouton pastille + `mat-menu` de 11 options (`PROJECT_COLOR_PALETTE` + « Aucune »). `value = input<string \| null>(null)`, `valueChange = output<string \| null>()`. Chaque option : petit carré (16×16, zéro arrondi — design system) de la couleur, coché si sélectionné, `matTooltip` = libellé i18n |
| Étendre `models/project.model.ts` | Interface TS | `Project.color: string \| null` ; `CreateProjectRequest.color?: string \| null` ; `UpdateProjectRequest.color: string \| null` (toujours envoyé, voir `repos-form.ts`) |
| Étendre `models/settings.model.ts` | Interface TS | `TransferProject.color?: string \| null` |
| Étendre `repos-form.ts` | Formulaire | `RepoAliasFormGroup.color: FormControl<string \| null>` ; `buildRepoAliasGroup` l'initialise depuis `project.color`. Renommer `collectDirtyAliasChanges` → `collectDirtyRepoChanges`, incluant une ligne dès que `alias` **ou** `color` est dirty, et renvoyant toujours les deux valeurs courantes (`{ id, alias, color }`) |
| Étendre `repositories-section.component.ts`/`.html` | Composant | Nouvelle colonne « Couleur » : `<app-project-color-picker>` par ligne existante (liée à `row.group.controls.color`, différé) et dans la ligne d'ajout (`addForm.controls.color`, envoyé immédiatement dans `store.add(...)`, RG-025-07) |
| Étendre `mr-table.component.ts`/`.html` | Composant | `protected tagStyle(row: MergeRequestView)`: résout `Project` par `row.projectAlias` (comme `pathByAlias` existant) puis `projectTagStyle(project?.color ?? null, row.draft)` ; template : `[style.background-color]`/`[style.color]` sur `.tag`, classe `tag-neutral` conservée seulement quand le style résolu est `null` |
| Étendre `filter-bar.component.ts`/`.html` | Composant | Nouvel `input<Project[]>([])` `projects`, transmis à `<app-filter-pill [projects]="projects()">` pour toutes les pastilles (le composant ne l'utilise que pour `filterKey === 'project'`) |
| Étendre `filter-pill.component.ts`/`.html` | Composant | Nouvel `input<Project[]>([])` `projects` ; `colorByAlias` (computed) résolvant chaque option `value` (alias) → `ProjectColorSwatch` via `findProjectColor` ; dans `menu-options`, si `filterKey() === 'project'` et une couleur est résolue, afficher une pastille (`background`) avant `option-label` (RG-025-09) |
| Ajouter clés i18n `settings.connections.repos.colorHeader`, `.colorNone`, `.colors.{slate,sage,lilac,peach,rose,sand,mint,steel,plum,olive}` | i18n | `public/i18n/fr.json` **et** `public/i18n/en.json` (US-022) |
| Mettre à jour `docs/tech/design-system.md` | Doc | Ligne « Tag projet » (§ tableau des composants) : mentionner la variante colorée (US-025) à côté de `.tag.tag-neutral` |

### Modifications sur l'existant

| Élément modifié | Nature de la modification | Risque | Solution proposée |
|-----------------|---------------------------|--------|--------------------|
| `mr-table.component.html` | La case `.tag` du template project passe d'une classe statique (`tag tag-neutral`) à un style conditionnel | Faible | Fallback explicite sur `tag-neutral` quand `tagStyle(row)` est `null`, comportement actuel inchangé pour les repos sans couleur (RG-025-01) |
| `filter-pill.component.html` | Ajout d'un élément visuel dans `menu-options`, seulement pour `filterKey === 'project'` | Faible | Aucun changement pour les 4 autres filtres (auteur, affecté, approved, commented) |
| `settings-page.component.ts` — `save()` | `collectDirtyAliasChanges` → `collectDirtyRepoChanges`, et l'appel `projectsStore.rename(change.id, { alias: change.alias })` devient `projectsStore.rename(change.id, { alias: change.alias, color: change.color })` | Faible | `ProjectsStore.rename()` est un passe-plat générique (`UpdateProjectRequest`) — aucune modification du store lui-même |
| `repositories-section.component.ts` — `addForm` | Ajout du contrôle `color` (`FormControl<string \| null>(null)`), transmis dans `store.add({ path, alias, color, connectionId })` | Faible | Valeur par défaut `null` (RG-025-07, « Aucune » présélectionnée) |

---

## Points de vigilance globaux

- **Deux listes d'ids à synchroniser** : `PROJECT_COLOR_IDS` (backend, validation) et `PROJECT_COLOR_PALETTE`
  (frontend, rendu). Le backend ne stocke qu'un id opaque, jamais les valeurs hex — cohérent avec le principe
  existant « le backend calcule/valide, le frontend affiche » (ex : `difficulty`/`readyLevel` déjà traités ainsi).
  Un désaccord entre les deux listes (id accepté par un backend plus ancien mais absent de la palette frontend, ou
  inversement) doit être traité par `findProjectColor` en retournant `null` (repli sur `tag-neutral`), jamais une
  exception.
- **Pas de couleur par MR** : en résolvant la couleur côté frontend par `Project[]` (déjà chargé pour `pathByAlias`),
  on évite d'ajouter `color` à `MergeRequestView`/`GET /merge-requests` et donc tout risque de régression sur le
  mapper GitLab/GitHub ou le cache SQLite des MRs (RG-025-06). Si une future US a besoin de la couleur côté API MR,
  ce choix serait à revoir.
- **Contraste** : la palette (RG-025-02) est fixée manuellement par le PO/l'utilisateur, sans vérification
  automatique (RG-025-05) — à re-valider visuellement en QA sur les deux thèmes (clair/sombre), la case colorée
  utilisant volontairement un texte à couleur fixe indépendant du thème.
- **Éclaircissement Draft (45 %)** : implémenté en `rgba(r,g,b,0.45)` plutôt qu'un second jeu de couleurs pastel —
  le rendu final dépend donc légèrement du fond derrière la case (thème clair vs sombre), ce qui est le comportement
  voulu par RG-025-04 (« mélangé avec le fond de page »).
- **Rétrocompatibilité import v1** : un fichier `version: 1` n'a jamais eu de couleur — `ImportProjectLegacyDto`
  reste sans `color`, donc `entry.color` est `undefined` pour toutes ses entrées, et la règle « clé absente = ne pas
  toucher la couleur existante » s'applique naturellement.

---

## Ordre de réalisation suggéré

1. Backend : `domain/project-color.ts` + tests, migration `AddProjectColor1757601600000`, colonne d'entité
2. Backend : DTOs (`Create/Update/ProjectResponse`) + `ProjectsService` (`add`/`rename`/`toResponse`/`importMany`) + tests unitaires/e2e
3. Backend : `settings-transfer` (export/import) + tests
4. Frontend : `shared/project-color/` (palette, `projectTagStyle`, tests) — aucune dépendance UI, à faire tôt
5. Frontend : modèles TS (`project.model.ts`, `settings.model.ts`) + `repos-form.ts`
6. Frontend : `ProjectColorPickerComponent` + intégration dans `RepositoriesSectionComponent` (création + édition différée)
7. Frontend : `MrTableComponent` (case Projet colorée) + i18n
8. Frontend : `FilterBarComponent`/`FilterPillComponent` (pastille du filtre Projet, RG-025-09)
9. Doc : `docs/tech/design-system.md` (mention de la variante colorée du tag projet)
10. Tests unitaires frontend complets + validation manuelle (deux thèmes, MR Ready/Draft, filtre Projet)
