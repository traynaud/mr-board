# Architecture — US-014 Paramètres : seuils de difficulté et de délai Ready

## Résumé fonctionnel
L'utilisateur configure, dans la section « 05 · Seuils » des Paramètres, les bornes qui déterminent la difficulté
(fichiers/lignes) et les niveaux de couleur du délai Ready (jours), ainsi que l'option jours ouvrés ; ces valeurs sont
relues à chaque chargement du tableau, sans resynchronisation GitLab.

---

## Backend

### Impacts sur le modèle de données

- **Entité modifiée** : `Settings` (`backend/src/modules/settings/entities/settings.entity.ts`) — 7 nouvelles colonnes :

  | Colonne (DB)            | Propriété           | Type SQLite | Défaut |
  |--------------------------|---------------------|-------------|--------|
  | `easy_files`             | `easyFiles`         | integer     | 5      |
  | `easy_lines`              | `easyLines`         | integer     | 100    |
  | `hard_files`              | `hardFiles`         | integer     | 20     |
  | `hard_lines`              | `hardLines`         | integer     | 800    |
  | `ready_green_days`        | `readyGreenDays`    | integer     | 1      |
  | `ready_orange_days`       | `readyOrangeDays`   | integer     | 3      |
  | `workdays_only`           | `workdaysOnly`      | boolean     | 0      |

  Valeurs par défaut identiques à `DEFAULT_DIFFICULTY_THRESHOLDS` (`calculate-difficulty.ts`) et
  `DEFAULT_READY_DELAY_THRESHOLDS` (`calculate-ready-delay.ts`) — RG-G03/RG-G04.

- **Migration** : `AddThresholdSettings<timestamp>` dans `backend/src/database/migrations/`, sur le modèle de
  `1757600500000-AddRefreshSettings.ts` (7 `ALTER TABLE "settings" ADD COLUMN ...` avec valeurs par défaut, `down`
  symétrique en `DROP COLUMN`).

### Intégration dans les modules existants

- Module `settings` : `SettingsService.load()` doit inclure les 7 colonnes dans la recréation de secours (mêmes
  défauts que la migration). Aucune nouvelle dépendance de module.
- Module `merge-requests` : `MergeRequestsService` consomme déjà `DEFAULT_DIFFICULTY_THRESHOLDS` /
  `DEFAULT_READY_DELAY_THRESHOLDS` et un `workdaysOnly` figé à `false` — c'est le seul point d'intégration, pas de
  nouveau module.
- Les fonctions pures `calculateDifficulty`, `calculateElapsedDays`, `readyLevelForDays`
  (`backend/src/modules/merge-requests/domain/`) acceptent déjà des seuils en paramètre : **aucune modification de
  signature**, seul l'appelant change de source (settings au lieu des constantes `DEFAULT_*`).

### Contrat API

| Méthode | Route                  | Body / Query                              | Réponse                | Codes |
|---------|-------------------------|--------------------------------------------|-------------------------|-------|
| GET     | `/api/v1/settings`      | —                                          | `SettingsResponseDto`   | 200   |
| PUT     | `/api/v1/settings`      | `UpdateSettingsDto` (+7 champs seuils)     | `SettingsResponseDto`   | 200, 400 |

`UpdateSettingsDto` : ajouter, en optionnel (même sémantique que `refreshIntervalMin`/`pauseWhenHidden` — absent =
inchangé) :

| Champ             | Validation `class-validator`                          |
|--------------------|--------------------------------------------------------|
| `easyFiles`        | `@IsInt() @Min(1)`                                     |
| `easyLines`        | `@IsInt() @Min(1)`                                     |
| `hardFiles`        | `@IsInt() @Min(1)`                                     |
| `hardLines`        | `@IsInt() @Min(1)`                                     |
| `readyGreenDays`   | `@IsInt() @Min(0)`                                     |
| `readyOrangeDays`  | `@IsInt() @Min(0)`                                     |
| `workdaysOnly`     | `@IsBoolean()`                                         |

La cohérence croisée (`hardFiles > easyFiles`, `hardLines > easyLines`, `readyOrangeDays > readyGreenDays`, RG-014-01)
n'est **pas** exprimable proprement par un décorateur `class-validator` isolé (elle dépend de la valeur finale
fusionnée, cf. `meUsername`/`refreshIntervalMin` = mise à jour partielle) : la valider dans `SettingsService.update`,
après fusion avec les valeurs existantes, sur le modèle de `requireUrl()` — une méthode privée (ex.
`requireCoherentThresholds`) qui lève `BusinessValidationException` avec un code dédié par champ en cause :
`settings.hardFilesTooLow`, `settings.hardLinesTooLow`, `settings.readyOrangeTooLow`.

`SettingsResponseDto` : ajouter les 7 mêmes champs (valeurs telles que stockées, jamais de calcul ici).

### Nouvelles tâches techniques

| Tâche | Type | Description |
|-------|------|-------------|
| Migration `AddThresholdSettings` | Migration | 7 colonnes + défauts, `down` symétrique |
| Étendre `settings.entity.ts` | Entité TypeORM | 7 colonnes (voir tableau ci-dessus) |
| Étendre `update-settings.dto.ts` | DTO | 7 champs optionnels + validations unitaires |
| Étendre `settings-response.dto.ts` | DTO | 7 champs en sortie |
| Étendre `settings.service.ts` | Service | fusion + `requireCoherentThresholds`, défauts de `load()`, `toResponse()` |
| Ajouter `SettingsService.getThresholds()` | Service | `{ difficulty: DifficultyThresholds; readyDelay: ReadyDelayThresholds; workdaysOnly: boolean }`, lu par `MergeRequestsService` |
| Modifier `merge-requests.service.ts` | Service | `loadBase` charge `getThresholds()` une fois, le passe à `toDifficultyFields`/`toReadyFields` (remplace `DEFAULT_*` et le `false` figé) |
| Étendre `settings.service.spec.ts` | Test unitaire | cas nominal + les 3 erreurs de cohérence + valeurs par défaut de secours |
| Étendre `merge-requests.service.spec.ts` | Test unitaire | seuils non défaut pris en compte dans `difficulty`/`readyLevel`/`readyDays` (workdays inclus) |
| Étendre `test/settings.e2e-spec.ts` (ou équivalent) | Test e2e | PUT seuils valides (200) + 3 cas 400 |

### Modifications sur l'existant

| Élément modifié | Nature de la modification | Risque | Solution proposée |
|-------------------|-----------------------------|--------|---------------------|
| `calculate-difficulty.ts` / `calculate-ready-delay.ts` | Aucune (signatures déjà prêtes) | Aucun | — |
| `merge-requests.service.ts` (`toDifficultyFields`, `toReadyFields`) | Deviennent paramétrées par les seuils au lieu des constantes `DEFAULT_*` | Faible | Passer les seuils en paramètre explicite ; supprimer le `false` figé de `calculateElapsedDays` |
| `settings.service.ts` (`load()`) | Ajout de 7 propriétés à la recréation de secours | Faible | Reprendre les mêmes défauts que la migration |

---

## Frontend

### Intégration dans les features existantes

- Feature `features/settings` : nouvelle section présentationnelle `sections/thresholds/thresholds-section.component.ts`
  (même schéma que `sections/refresh/`), insérée dans `settings-page.component.html` entre la section
  « 04 · Actualisation » et une future section « 06 · Divers » (US-015) — `[last]="true"` déplacé sur cette nouvelle
  section en attendant.
- Aucune nouvelle route.

### Composants réutilisables et Angular Material

| Composant | Origine | Usage prévu |
|-----------|---------|-------------|
| `MatFormField` + `input matInput type="number"` | Angular Material | 6 champs numériques (easyFiles, easyLines, hardFiles, hardLines, readyGreenDays, readyOrangeDays) |
| `MatSlideToggle` | Angular Material | « Compter uniquement les jours ouvrés » (mêmes classes que `refresh-section`) |
| `app-settings-section` | `shared/settings-section` | Conteneur de section, comme les 4 sections existantes |

### Nouvelles tâches techniques

| Tâche | Type | Description |
|-------|------|-------------|
| Étendre `models/settings.model.ts` | Interface TS | 7 champs sur `Settings` et `UpdateSettingsRequest` |
| Étendre `settings-form.ts` | Formulaire | 7 `FormControl<number \| boolean>`, `Validators.required`/`Validators.min`, `DEFAULT_THRESHOLDS` (5/100/20/800/1/3/false), validateur croisé (voir plus bas), extension de `resetSettingsForm`/`toUpdateRequest` |
| Créer `sections/thresholds/thresholds-section.component.ts/html/scss/spec.ts` | Composant | Bloc Difficulté (grille Easy/Medium/Hard) + bloc Temps depuis Ready (Vert/Orange/Rouge) + toggle jours ouvrés + lien « Valeurs par défaut » |
| Modifier `settings-page.component.html` | Intégration | Ajoute `<app-settings-section>` + `<app-thresholds-section [form]="form" />` |
| Ajouter clés `settings.thresholds.*` | i18n | `public/i18n/fr.json`, voir liste ci-dessous |
| Étendre `settings-form.spec.ts` | Test unitaire | construction, reset, `toUpdateRequest`, validateur croisé (3 scénarios), lien défauts |
| Créer `thresholds-section.component.spec.ts` | Test unitaire | rendu des 7 champs, erreurs affichées, clic « Valeurs par défaut » |

### Validateur croisé (RG-014-01/RG-014-02, scénarios « Seuils incohérents » et « readyOrange ≤ readyGreen »)

- Les 3 comparaisons (`hardFiles > easyFiles`, `hardLines > easyLines`, `readyOrangeDays > readyGreenDays`) doivent se
  ré-évaluer quel que soit le champ modifié (saisir `easyFiles` doit invalider ou revalider `hardFiles`).
- Comme le formulaire reste plat (`SettingsForm`, pas de sous-groupe), implémenter un **validateur au niveau du
  `FormGroup`** (passé en second argument de `buildSettingsForm`'s `new FormGroup(...)`), qui recalcule les 3 paires
  à chaque changement d'un descendant (Angular ré-exécute les validateurs du parent à chaque
  `updateValueAndValidity` d'un enfant) et pose/efface `{ mustExceed: true }` directement sur `hardFiles`, `hardLines`,
  `readyOrangeDays` via `control.setErrors(...)`/`control.setErrors(null)`.
- Message affiché sous le champ en cause : clé i18n `settings.thresholds.errors.mustExceedEasy` /
  `mustExceedReadyGreen` (« Doit être supérieur à Easy » / « Doit être supérieur à Vert »).
- `canSave` (déjà basé sur `form.valid && form.dirty`, `settings-page.component.ts`) bloque automatiquement
  l'enregistrement sans changement supplémentaire.

### Lien « Valeurs par défaut » (RG-014-05)

- Bouton texte dans `thresholds-section.component.html`, `(click)` appelle une méthode du composant qui fait
  `form().patchValue(DEFAULT_THRESHOLDS)` puis `markAsDirty()` sur les 7 contrôles concernés (pas de `markAsPristine`
  : la spec exige que rien ne soit enregistré tant que « Enregistrer » n'est pas cliqué, donc le formulaire doit
  rester « modifié » pour activer le bouton Enregistrer).

### Clés i18n à ajouter (`public/i18n/fr.json`, bloc `settings`)

```
settings.thresholds.number = "05"
settings.thresholds.title = "Seuils"
settings.thresholds.description = "Règles de calcul de la difficulté et du délai Ready."
settings.thresholds.difficulty.title = "Difficulté"
settings.thresholds.difficulty.easy / .medium / .hard
settings.thresholds.difficulty.filesSuffix = "fich."
settings.thresholds.difficulty.linesSuffix = "l."
settings.thresholds.difficulty.between = "entre les deux"
settings.thresholds.ready.title = "Temps depuis Ready"
settings.thresholds.ready.green / .orange / .red
settings.thresholds.ready.daysSuffix = "jours"
settings.thresholds.ready.beyond = "au-delà"
settings.thresholds.workdaysOnly = "Compter uniquement les jours ouvrés"
settings.thresholds.resetDefaults = "Valeurs par défaut"
settings.thresholds.errors.mustExceedEasy = "Doit être supérieur à Easy"
settings.thresholds.errors.mustExceedReadyGreen = "Doit être supérieur à Vert"
settings.thresholds.errors.min = "Doit être un entier ≥ {{min}}"
```

### Modifications sur l'existant

| Élément modifié | Nature de la modification | Risque | Solution proposée |
|-------------------|-----------------------------|--------|---------------------|
| `settings-form.ts` | Ajout de 7 contrôles + validateur de groupe | Faible | Les contrôles existants et leurs validateurs ne changent pas |
| `settings-page.component.html` | Ajout d'une section, déplacement de `[last]="true"` | Faible | — |
| `models/settings.model.ts` | Ajout de champs (non breaking, additifs) | Faible | — |

---

## Points de vigilance globaux

- **RG-014-04** : les seuils doivent être relus à *chaque* `GET /merge-requests` (pas seulement au chargement de la
  page) — s'assurer que `getThresholds()` n'est pas mis en cache au niveau du service (une requête DB par appel,
  comme `getIdentity()` aujourd'hui).
- Couleurs des carrés (Easy/Medium/Hard, Vert/Orange/Rouge) : réutiliser les tokens existants `--color-success`
  (`#2f8f4e`), `--color-warning` (`#d98a1f`), `--color-accent`/`--color-danger` (`#ec3013`) — ne pas coder les
  couleurs en dur dans le nouveau composant (cohérent avec `difficulty-badge` et `ready-delay`).
- Pas de migration de données à risque : toutes les colonnes ont une valeur par défaut, aucune ligne existante
  (singleton `id = 1`) n'est laissée `NULL`.
- Pas de commande GitLab impliquée ; aucun impact sur `SyncService` ou le rate limit.

---

## Ordre de réalisation suggéré

1. Migration TypeORM + colonnes d'entité `Settings`
2. `update-settings.dto.ts` / `settings-response.dto.ts` + validations unitaires
3. `SettingsService` : fusion, `requireCoherentThresholds`, `getThresholds()`, défauts de `load()` — tests unitaires
4. `MergeRequestsService` : consommation de `getThresholds()` dans `toDifficultyFields`/`toReadyFields` — tests unitaires
5. Test e2e `PUT /api/v1/settings` (nominal + 3 cas 400)
6. `models/settings.model.ts` + `settings-form.ts` (contrôles, validateur croisé, `DEFAULT_THRESHOLDS`, reset/toUpdateRequest) — tests unitaires
7. `thresholds-section.component.*` + intégration dans `settings-page.component.html` + clés i18n — tests unitaires + validation manuelle contre le prototype
