# Architecture — US-023 Surbrillance de l'utilisateur dans le tableau

## Résumé fonctionnel
Un anneau accent entoure l'avatar de l'utilisateur courant partout où il apparaît dans les colonnes Auteur, Reviewer
et Affecté du tableau des MRs, calculé côté backend (`isMe` par utilisateur) et désactivable via un nouveau
paramètre `highlightMe` (case dans la section « 01 · Moi », défaut activé).

---

## Backend

### Impacts sur le modèle de données

- **Entité modifiée** : `Settings` (`backend/src/modules/settings/entities/settings.entity.ts`) — nouvelle colonne
  booléenne `highlightMe` :

  ```ts
  /** Surligne mes avatars (auteur, reviewer, affecté) dans le tableau (RG-023-01). */
  @Column({ name: 'highlight_me', type: 'boolean', default: true })
  highlightMe!: boolean;
  ```

  Placée après `theme` (dernier champ ajouté, US-018), avant `updatedAt`, à l'identique du pattern des booléens
  existants (`openInNewTab`, `tabBadge`…).
- **Migration** : `backend/src/database/migrations/1757601100000-AddHighlightMeSetting.ts`, sur le modèle de
  `1757601000000-AddThemeSetting.ts` :

  ```ts
  export class AddHighlightMeSetting1757601100000 implements MigrationInterface {
    name = 'AddHighlightMeSetting1757601100000';
    async up(queryRunner: QueryRunner): Promise<void> {
      await queryRunner.query(
        `ALTER TABLE "settings" ADD COLUMN "highlight_me" boolean NOT NULL DEFAULT (1)`,
      );
    }
    async down(queryRunner: QueryRunner): Promise<void> {
      await queryRunner.query(`ALTER TABLE "settings" DROP COLUMN "highlight_me"`);
    }
  }
  ```

  SQLite stocke les booléens en `0`/`1` ; vérifier le littéral par défaut utilisé par les migrations booléennes
  existantes (`AddRefreshSettings` pour `pause_when_hidden`) et le reprendre à l'identique pour rester cohérent.
- Aucune autre entité modifiée. `MergeRequest`, `User` et leurs tables d'association ne changent pas : `isMe` est un
  champ **calculé à la volée** dans le DTO, jamais persisté (comme `isMine` aujourd'hui).

### Intégration dans les modules existants

- **`modules/settings/`** : `Settings` (entité), `UpdateSettingsDto`, `SettingsResponseDto`, `SettingsService`
  (`MergeableSettingsFields`, `ExportableSettings`, `mergeCommonFields`, `load()`, `getExportableSettings()`) — même
  circuit que `theme` (US-018) et `openInNewTab` (US-015).
- **`modules/merge-requests/`** : `domain/is-mine.ts` (nouvelle fonction pure `isMe`), `dto/merge-request-user.dto.ts`
  (nouveau champ), `merge-requests.service.ts` (`toMergeRequestUser`, `toMergeRequestView`) — aucun nouveau service,
  extension de l'existant.
- Aucun nouveau module.

### Contrat API

| Méthode | Route | Body / Query | Réponse | Codes |
|---------|-------|--------------|---------|-------|
| GET | `/api/v1/settings` | — | `SettingsResponseDto` (+ `highlightMe: boolean`) | 200 |
| PUT | `/api/v1/settings` | `UpdateSettingsDto` (+ `highlightMe?: boolean`) | `SettingsResponseDto` | 200, 400 |
| GET | `/api/v1/settings/export` | — | `ExportableSettings` (+ `highlightMe: boolean`) | 200 |
| POST | `/api/v1/settings/import` | (+ `highlightMe?: boolean`) | `SettingsResponseDto` (via `ImportResult`) | 200, 400 |
| GET | `/api/v1/merge-requests` | (inchangé) | `MergeRequestViewDto[]` — `author`/`reviewers[]`/`assignees[]` portent désormais `isMe: boolean` | 200 |

`isMe` est renvoyé **indépendamment** de `highlightMe` (RG-023-05) : le backend ne consulte pas ce paramètre pour
construire la réponse, il reflète uniquement RG-G09. `GET /merge-requests/facets` n'est pas concerné (RG-023-12).

### Nouvelles tâches techniques

| Tâche | Type | Description |
|-------|------|-------------|
| Ajouter `isMe(username, identity)` | Fonction pure | Nouvelle export dans `domain/is-mine.ts` : `(username: string, identity: Identity) => boolean`, comparaison RG-G09 (username puis email, insensible à la casse) pour **un seul** username. |
| Refactorer `isMine` | Fonction pure | `isMine(subject, identity)` devient `isMe(subject.authorUsername, identity) \|\| subject.reviewerUsernames.some(u => isMe(u, identity)) \|\| subject.assigneeUsernames.some(u => isMe(u, identity))` — comportement inchangé, dédoublonne la logique de comparaison. |
| Étendre `is-mine.spec.ts` | Test unitaire | Cas `isMe` seul (match, casse, vide) en plus des cas `isMine` existants (tous doivent continuer à passer sans modification). |
| Ajouter `isMe` à `MergeRequestUserDto` | DTO | `isMe!: boolean` dans `dto/merge-request-user.dto.ts`. |
| Modifier `toMergeRequestUser` | Service | Signature `(user: User, identity: Identity) => MergeRequestUserDto`, ajoute `isMe: isMe(user.username, identity)`. |
| Modifier les appels dans `toMergeRequestView` | Service | Les 3 appels (`author`, `reviewers.map`, `assignees.map`) passent désormais `identity` (déjà disponible dans la fonction, paramètre existant). |
| Ajouter colonne `highlight_me` | Entité | `Settings.highlightMe: boolean`, défaut `true`. |
| Créer migration `AddHighlightMeSetting` | Migration | Voir ci-dessus. |
| Étendre `UpdateSettingsDto` | DTO | `@IsOptional() @IsBoolean() highlightMe?: boolean;`, même style que `openInNewTab`. |
| Étendre `SettingsResponseDto` | DTO | `highlightMe!: boolean;`. |
| Étendre `SettingsService` | Service | `MergeableSettingsFields.highlightMe?: boolean`, `ExportableSettings.highlightMe: boolean`, une branche dans `mergeCommonFields`, valeur par défaut `true` dans `load()` (recréation de la ligne), mapping dans `getExportableSettings()` et dans `toResponse()`. |
| Étendre `ImportSettingsDto` | DTO | `modules/settings-transfer/dto/import-settings.dto.ts` (non listé initialement ci-dessus — DTO dédié à `POST /settings/import`, distinct de `UpdateSettingsDto`, avec son propre miroir champ à champ) : `@IsOptional() @IsBoolean() highlightMe?: boolean;`, même style que `theme`. Sans cette extension, `forbidNonWhitelisted` rejette tout import contenant `highlightMe`. |
| Étendre `settings.service.spec.ts` / `settings.controller.spec.ts` | Test unitaire | Cas `highlightMe` : défaut `true`, mise à jour, absence dans le body = inchangé, rejet si non booléen. |
| Étendre `merge-requests.service.spec.ts` | Test unitaire | Vérifier `isMe` sur `author`/`reviewers`/`assignees` pour une identité configurée, vide, et une correspondance insensible à la casse ; vérifier que `isMine` reste cohérent avec les `isMe` individuels. |
| Étendre `test/settings.e2e-spec.ts` | Test e2e | `GET`/`PUT /settings` avec `highlightMe`, `400` sur valeur invalide. |
| Étendre `test/settings-transfer.e2e-spec.ts` | Test e2e | Export contient `highlightMe`, import sans le champ → `true`. |
| Étendre `test/merge-requests.e2e-spec.ts` | Test e2e | `isMe` présent et correct dans la réponse `GET /merge-requests` pour une identité configurée. |

### Modifications sur l'existant

| Élément modifié | Nature de la modification | Risque | Solution proposée |
|-----------------|---------------------------|--------|--------------------|
| `domain/is-mine.ts` | Extraction d'une fonction `isMe`, `isMine` réécrite en termes de `isMe` | Faible | Comportement figé par la suite de tests existante (`is-mine.spec.ts`), à ne pas modifier — elle doit continuer à passer telle quelle. |
| `dto/merge-request-user.dto.ts` | Nouveau champ obligatoire `isMe` | Faible | Tous les objets littéraux construits en test (`merge-requests.service.spec.ts`, fixtures e2e) doivent l'inclure ; le compilateur TypeScript (`isMe!: boolean`) le signale à la compilation. |
| `merge-requests.service.ts` (`toMergeRequestUser`) | Signature étendue (+ `identity`) | Faible | Fonction privée au module, un seul point d'appel (`toMergeRequestView`) où `identity` est déjà disponible. |
| `settings.entity.ts` / migrations | Colonne ajoutée avec défaut | Faible | Pattern déjà éprouvé 6 fois (`theme`, `tabBadge`…) ; aucune donnée existante à retraiter (défaut `true` appliqué par SQLite). |

---

## Frontend

### Intégration dans les features existantes

- **`features/board/mr-table/`** : rendu de l'anneau sur les 3 colonnes avatar, promotion de l'avatar « moi » dans
  `summarize-users.ts`.
- **`features/board/board-page.component.ts/html`** : lecture de `settingsStore.settings()?.highlightMe`, transmis
  à `<app-mr-table>` (même pattern que `openInNewTab`) ; texte de pied de page conditionnel.
- **`features/settings/sections/me/`** : nouvelle case à cocher.
- **`shared/avatar/`** : nouvel état visuel « surligné ».
- Aucune nouvelle route.

### Composants réutilisables et Angular Material

| Composant | Origine | Usage prévu |
|-----------|---------|-------------|
| `AvatarComponent` | `shared/avatar` | Étendu avec un input `highlighted` (anneau) — colonnes Auteur/Reviewer/Affecté du tableau |
| `MatCheckbox` | Angular Material | Case « Surligner mes MRs… » dans `MeSectionComponent` |

### Nouvelles tâches techniques

| Tâche | Type | Description |
|-------|------|-------------|
| Ajouter `isMe` à `MergeRequestUser` | Modèle TS | `models/merge-request.model.ts` : `isMe: boolean` — miroir strict de `MergeRequestUserDto`. |
| Ajouter `highlightMe` à `Settings` / `UpdateSettingsRequest` | Modèle TS | `models/settings.model.ts` : `Settings.highlightMe: boolean`, `UpdateSettingsRequest.highlightMe?: boolean`. `ExportConfig`/`ImportConfig` en héritent automatiquement (`Omit<Settings, …>` / `Omit<UpdateSettingsRequest, …>`). |
| Étendre `AvatarComponent` | Composant | Nouvel `input<boolean>('highlighted', false)` ; classe `.highlighted` sur `.avatar` ; injecte `TranslateService` pour composer le tooltip (`name()` + suffixe traduit `board.mergeRequests.meSuffix` quand `highlighted()` est vrai, RG-023-10). |
| Style `.highlighted` | SCSS | `avatar.component.scss` : `box-shadow: 0 0 0 2px var(--color-bg), 0 0 0 4px var(--color-accent);` (tokens uniquement, RG-023-07). |
| Étendre `summarizeUsers` | Fonction pure | `mr-table/summarize-users.ts` : nouveau paramètre `highlightMe: boolean = true` ; si vrai, `first` = le premier utilisateur avec `isMe === true` (sinon `users[0]`) ; `tooltip` et `extraCount` inchangés (calculés sur l'ordre GitLab d'origine, RG-023-06). |
| Étendre `summarize-users.spec.ts` | Test unitaire | Cas : promotion quand « moi » n'est pas en premier, non-promotion quand `highlightMe = false`, tooltip toujours en ordre GitLab, aucun changement quand aucun `isMe`. |
| Câbler l'anneau dans `mr-table.component.ts/html` | Composant | Nouvel `input<boolean>('highlightMe', true)` ; colonne Auteur : `[highlighted]="row.author.isMe && highlightMe()"` ; colonnes Reviewer/Affecté : `summarizeUsers(row.reviewers, highlightMe())` / `(row.assignees, highlightMe())`, puis `[highlighted]="first.isMe && highlightMe()"`. |
| Câbler `highlightMe` dans `board-page.component.html` | Composant | `[highlightMe]="settingsStore.settings()?.highlightMe ?? true"` sur `<app-mr-table>`, même pattern que `[openInNewTab]`. |
| Pied de page conditionnel | Composant | `board-page.component.ts` : `protected readonly footerLegendKey = computed(() => this.settingsStore.settings()?.highlightMe ? 'board.footer.legendHighlighted' : 'board.footer.legend')` ; template : `{{ footerLegendKey() \| translate }}` à la place de la clé en dur. |
| Étendre `SettingsFormControls` / `buildSettingsForm` | Formulaire | `settings-form.ts` : `highlightMe: FormControl<boolean>`, construit avec `new FormControl(true, { nonNullable: true })`. |
| Étendre `resetSettingsForm` | Formulaire | `form.controls.highlightMe.reset(settings.highlightMe);`. |
| Étendre `resetSettingsFormToDefaults` | Formulaire | `controls.highlightMe.setValue(true);` (RG-015-05 : défaut `true`). |
| Étendre `toUpdateRequest` | Formulaire | Déstructurer et renvoyer `highlightMe` dans le corps `PUT /settings`. |
| Étendre `settings-form.spec.ts` | Test unitaire | Cas par défaut, reset, reset-to-defaults, présence dans `toUpdateRequest`. |
| Ajouter la case dans `MeSectionComponent` | Composant | `me-section.component.ts` : import `MatCheckboxModule` ; `me-section.component.html` : `<mat-checkbox formControlName="highlightMe">{{ 'settings.me.highlightMe' \| translate }}</mat-checkbox>`, placée **après** le bloc `@if (statusKey(); as key) { … }` (RG-023-02 : sous l'aperçu, quel que soit son état affiché ou non), pleine largeur de la section (`grid-column: 1 / -1` si le layout de la section le nécessite — voir `design.md`). |
| Étendre `me-section.component.spec.ts` | Test unitaire | Case reflète `form().controls.highlightMe`, cochée par défaut. |
| Ajouter les clés i18n | i18n | `public/i18n/fr.json` : `settings.me.highlightMe`, `board.mergeRequests.meSuffix`, `board.footer.legendHighlighted` (voir §i18n ci-dessous). |

### Modifications sur l'existant

| Élément modifié | Nature de la modification | Risque | Solution proposée |
|------------------|---------------------------|--------|--------------------|
| `AvatarComponent` | Nouvel input `highlighted` (défaut `false`) + injection `TranslateService` | Faible | Toutes les utilisations existantes (colonne Auteur/Reviewer/Affecté, aperçu identité Moi) restent inchangées si l'input est omis — rétrocompatible. |
| `summarizeUsers` | Nouveau paramètre `highlightMe` avec valeur par défaut `true` | Faible | Les appels existants sans ce paramètre continueraient de compiler (paramètre optionnel), mais **doivent** être mis à jour dans `mr-table.component.html` pour propager le réglage réel — sinon la promotion serait toujours active même quand l'utilisateur l'a désactivée. À vérifier explicitement en revue. |
| `MergeRequestUser` (modèle) | Nouveau champ obligatoire `isMe` | Faible | Toutes les fixtures de test frontend (`mr-table.component.spec.ts`, stores) doivent l'inclure ; le compilateur le signale. |
| `mr-table.component.ts/html` | Nouvel input `highlightMe`, bindings `[highlighted]` sur 3 `<app-avatar>` | Faible | Valeur par défaut `true` côté composant, cohérent avec le paramètre backend. |
| `board-page.component.html` | Binding supplémentaire sur `<app-mr-table>`, clé de pied de page devenue dynamique | Faible | Pattern déjà utilisé pour `openInNewTab` et `themeToggleLabelKey`. |
| `me-section.component.html` | Nouvel élément de formulaire | Faible | Section déjà en `FormGroup` réactif, ajout direct d'un contrôle existant dans `SettingsForm`. |

### i18n — clés à ajouter (`fr.json`)

| Clé | Valeur proposée |
|-----|------------------|
| `settings.me.highlightMe` | « Surligner mes MRs dans le tableau (auteur, reviewer, affecté) » |
| `board.mergeRequests.meSuffix` | « (moi) » |
| `board.footer.legendHighlighted` | Reprend `board.footer.legend` actuel en ajoutant le segment « · anneau rouge = c'est moi (auteur, reviewer ou affecté) » à l'endroit indiqué par la maquette (RG-023-11) — le Dev copie le texte exact du `board.footer.legend` existant et y insère ce segment, pour ne pas dupliquer une reformulation. |

---

## Points de vigilance globaux

- **Ordre des paramètres de `summarizeUsers`** : le paramètre `highlightMe` doit être ajouté à la fin avec une
  valeur par défaut pour ne pas casser les appels non liés au tableau (s'il y en a) ; en revue, vérifier que
  **tous** les appels de production passent explicitement le réglage courant (piège identifié dans le tableau
  ci-dessus).
- **Cohérence `isMe` / `isMine`** : ne pas dupliquer le calcul — `isMine` doit rester dérivable des trois `isMe`
  (invariant RG-023-05, testé explicitement).
- **Thème sombre** : l'anneau utilise exclusivement `var(--color-bg)` et `var(--color-accent)`, déjà redéfinis sous
  `html[data-theme="dark"]` (US-018) : aucune redéfinition supplémentaire nécessaire, mais à vérifier visuellement
  (QA) car aucun test automatisé ne couvre le rendu CSS calculé.
- **Débordement de l'anneau** : le `box-shadow` déborde de 4 px au-delà du carré 28 px ; vérifier que les cellules
  du tableau (`padding` vertical) et l'espacement entre lignes ne le rognent pas (RG-023-09) — point visuel à
  valider manuellement, aucun test automatisé ne le couvre.
- **Aucune régression sur RG-G06** : le champ `tooltip` et `extraCount` de `summarizeUsers` restent calculés sur
  l'ordre GitLab d'origine (`users`, non réordonné) — seule la valeur de `first` change. Un test doit figer ce
  comportement explicitement (voir tâche `summarize-users.spec.ts`).
- **Aucun impact sur les filtres/facets** : `GET /merge-requests/facets` et les menus de filtre ne sont pas
  modifiés (RG-023-12) — vérifier qu'aucun champ `isMe` ne s'y introduit par erreur de copier-coller du DTO.

---

## Ordre de réalisation suggéré

1. Backend : `domain/is-mine.ts` (extraction `isMe`) + tests unitaires.
2. Backend : `MergeRequestUserDto` + `merge-requests.service.ts` (`toMergeRequestUser`/`toMergeRequestView`) + tests unitaires.
3. Backend : migration `AddHighlightMeSetting` + entité `Settings`.
4. Backend : `UpdateSettingsDto`, `SettingsResponseDto`, `SettingsService` (`MergeableSettingsFields`, `ExportableSettings`, `mergeCommonFields`, `load`, `getExportableSettings`) + tests unitaires.
5. Backend : tests e2e (`settings.e2e-spec.ts`, `settings-transfer.e2e-spec.ts`, `merge-requests.e2e-spec.ts`).
6. Frontend : modèles TS (`merge-request.model.ts`, `settings.model.ts`).
7. Frontend : `summarize-users.ts` + tests unitaires.
8. Frontend : `AvatarComponent` (input `highlighted`, style, tooltip) + tests unitaires.
9. Frontend : `settings-form.ts` (contrôle, reset, reset-to-defaults, `toUpdateRequest`) + tests unitaires.
10. Frontend : `MeSectionComponent` (case à cocher) + i18n + tests unitaires.
11. Frontend : `mr-table.component.ts/html` (bindings `highlighted`, propagation `highlightMe`) + tests unitaires.
12. Frontend : `board-page.component.ts/html` (câblage `highlightMe`, pied de page conditionnel) + i18n + tests unitaires.
13. Validation manuelle contre les maquettes (clair + sombre), vérification du débordement de l'anneau (point de vigilance).
