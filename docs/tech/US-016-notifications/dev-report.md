# US-016 — Notifications navigateur & badge d'onglet — Rapport de développement

## Résumé

Implémentation complète des deux options de la section « 06 · Divers » laissées
désactivées par US-015 : notification navigateur à l'affectation d'une MR
(RG-016-01/02/03) et badge de comptage des MRs rouges dans le titre de l'onglet
(RG-016-04). Les deux réglages sont persistés en backend (RG-016-05) et
suivent l'export/import de configuration existant.

## Backend

- `entities/settings.entity.ts` : colonnes `notify_assigned`/`tab_badge` (défaut `false`).
- `database/migrations/1757600800000-AddNotificationSettings.ts` : migration ajoutant les 2 colonnes.
- `dto/update-settings.dto.ts`, `dto/settings-response.dto.ts` : champs `notifyAssigned`/`tabBadge`.
- `settings-transfer/dto/import-settings.dto.ts` : mêmes champs, pour l'import de config (RG-016-05).
- `settings.service.ts` : `MergeableSettingsFields`, `ExportableSettings`, `mergeCommonFields()`, `load()` (défauts) et `toResponse()` étendus.
- `settings.service.spec.ts`, `test/settings.e2e-spec.ts` : fixtures mises à jour + nouveaux cas pour les 2 champs (set/keep, export, import).

## Frontend

- `models/settings.model.ts` : `notifyAssigned`/`tabBadge` sur `Settings` et `UpdateSettingsRequest`.
- `core/notifications/browser-notification.service.ts` (+ spec) : isolation de l'API `Notification` du navigateur (`isSupported`, `permission`, `requestPermission`, `show`).
- `stores/assignment-diff.ts` (+ spec) : fonction pure `findNewAssignments()` — détecte les MRs nouvellement assignées (reviewer/assigné), ignore les drafts, insensible à la casse. Vit dans `stores/` plutôt que dans un dossier `domain/` inexistant côté frontend (déviation documentée dans `archi.md`).
- `features/settings/settings-form.ts` (+ spec) : `FormControl` `notifyAssigned`/`tabBadge` ajoutés à `buildSettingsForm`, `resetSettingsForm`, `resetSettingsFormToDefaults`, `toUpdateRequest`.
- `stores/merge-requests.store.ts` (+ spec) : `load()` capture l'état précédent, diffuse les nouvelles affectations via `BrowserNotificationService.show()` si `notifyAssigned` est actif — jamais au premier chargement de la session (RG-016-03).
- `features/settings/sections/miscellaneous/miscellaneous-section.component.{ts,html,scss,spec}` : case « notification » activée avec interception `[checked]`/`(change)` (demande la permission avant de cocher), message « Notifications bloquées par le navigateur » si refusée (RG-016-02), case désactivée si l'API est absente ; case « badge » connectée normalement via `formControlName`.
- `features/board/board-page.component.ts` (+ spec) : `redCount` (computed), effect posant le titre `(N) MR Board` via `Title`, restauration du titre par défaut à la destruction du composant (évite un titre périmé en quittant l'écran).
- `public/i18n/fr.json` : suppression de la clé morte `settings.misc.comingSoon`, ajout de `settings.misc.notificationsBlocked`.

## Tests

- Backend : `npx tsc --noEmit`, `npm run lint`, `npm test` (unitaires), `npm run test:e2e`, `npm run build` — tous verts.
- Frontend : `npx tsc --noEmit`, lint, `ng test --no-watch` (534 tests), `npm run build` — tous verts.

## Vérification manuelle restante

Non testable en jsdom/Vitest, à valider dans un vrai navigateur :
- Demande de permission `Notification.requestPermission()` et affichage d'une notification réelle.
- Clic sur la notification → ouverture de la MR dans un nouvel onglet (`window.open`).
- Mise à jour effective du titre d'onglet du navigateur.
