# Architecture — US-016 Notifications navigateur et badge d'onglet

## Résumé fonctionnel
Quand une MR m'est nouvellement affectée (reviewer/assignee), le navigateur affiche une notification cliquable
vers GitLab. Le titre de l'onglet affiche `(N) MR Board` où N = nombre de MRs actuellement affichées au niveau
Ready rouge. Les deux options sont des réglages persistés, entièrement calculés côté frontend à partir de
données déjà chargées — **aucun nouvel endpoint** n'est nécessaire au-delà de 2 booléens sur `settings`.

---

## Backend

### Impacts sur le modèle de données

- **Entité modifiée** : `Settings` — 2 colonnes, même précédent que `open_in_new_tab` (US-015) :

  | Colonne (DB)         | Propriété        | Type SQLite | Défaut |
  |------------------------|------------------|-------------|--------|
  | `notify_assigned`      | `notifyAssigned` | boolean     | 0      |
  | `tab_badge`             | `tabBadge`       | boolean     | 0      |

- **Migration** : `AddNotificationSettings<timestamp>`, même forme que `1757600700000-AddMiscSettings.ts`.

### Contrat API

Aucune route nouvelle. `UpdateSettingsDto`/`SettingsResponseDto` gagnent `notifyAssigned?`/`tabBadge?`
(`@IsOptional() @IsBoolean()`), fusionnés dans `SettingsService.mergeCommonFields()` (US-015) exactement comme
`openInNewTab` — pas de nouvelle méthode de service, `mergeCommonFields` prend juste 2 champs de plus dans
`MergeableSettingsFields`. `ImportSettingsDto` (US-015) doit aussi déclarer les 2 champs pour rester exportables/
importables (RG-016-05 : « persistées en backend »).

### Nouvelles tâches techniques

| Tâche | Type | Description |
|-------|------|-------------|
| Migration `AddNotificationSettings` | Migration | 2 colonnes + défauts |
| Étendre `settings.entity.ts` | Entité | `notifyAssigned`, `tabBadge` |
| Étendre `update-settings.dto.ts` / `settings-response.dto.ts` | DTO | 2 champs |
| Étendre `settings-transfer/dto/import-settings.dto.ts` | DTO | 2 mêmes champs (US-015) |
| Étendre `settings.service.ts` (`MergeableSettingsFields`, `mergeCommonFields`, `load()` défauts, `toResponse()`) | Service | même chaîne `if (dto.X !== undefined)` que les champs US-015 |
| Tests unitaires/e2e | Test | mêmes fichiers que US-015 (`settings.service.spec.ts`, `settings.e2e-spec.ts`), cas nominal + omis |

### Modifications sur l'existant

| Élément modifié | Nature | Risque | Solution |
|-------------------|--------|--------|----------|
| `settings.service.ts` | 2 champs de plus dans une fonction déjà généraliste | Aucun | Suivre exactement le patron `openInNewTab` |

---

## Frontend

### ⚠️ Écart assumé par rapport à specs.md (RG-016-06)

Les specs demandent `domain/assignment-diff.ts`. Le frontend de ce projet n'a **jamais** de dossier `domain/`
(convention backend uniquement) — les fonctions pures vivent à côté de leur consommateur
(`mr-table/summarize-users.ts`, `settings-form.ts`, `core/url-state/query-params.mapper.ts`). La fonction est donc
créée en `stores/assignment-diff.ts` (à côté de `merge-requests.store.ts`, son unique consommateur), même
exigence de pureté et de test unitaire, chemin différent.

### Nouveau service `BrowserNotificationService`

- `frontend/src/app/core/notifications/browser-notification.service.ts` (+ `.spec.ts`) — isole l'API `Notification`
  du navigateur (comme `GitlabClientService` isole les appels GitLab côté backend) :
  - `isSupported(): boolean` — `typeof Notification !== 'undefined'`
  - `permission(): NotificationPermission | 'unsupported'`
  - `requestPermission(): Promise<NotificationPermission>`
  - `show(title: string, body: string, onClick: () => void): void` — no-op silencieux si non supporté ou
    permission ≠ `'granted'` (défensif ; l'appelant ne doit normalement appeler `show` que si `notifyAssigned`
    est actif, ce qui implique déjà une permission accordée au moment de l'activation, RG-016-02)
  - Premier point du repo à toucher une API navigateur non encapsulée dans un composant (comme `Blob`/
    `<input type="file">` en US-015) : entièrement mockable en test (`vi.stubGlobal('Notification', …)`).

### `stores/assignment-diff.ts` (fonction pure, RG-016-06)

```
findNewAssignments(previous: MergeRequestView[], current: MergeRequestView[], username: string): NewAssignment[]
```
- Une MR compte si non-draft (RG-016-03), et si mon `username` (comparaison insensible à la casse — même
  convention que RG-G09/RG-G06) apparaît dans `reviewers[]` ou `assignees[]` de la version courante mais pas
  dans la version précédente **ou** que la MR est absente de `previous` (RG-016-01 : « ou MR nouvelle »).
  Correspondance par `id`. `username` vide → tableau vide (identité non configurée).
- Pas de logique d'email de repli : `RG-G09` documente déjà côté backend que ce repli est un no-op (les
  reviewers/assignees ne portent jamais que le `username` GitLab) — inutile de le porter côté frontend.
- Retourne `{ id, projectAlias, iid, title, webUrl }[]`, la forme minimale utile à la notification.

### Extension de `MergeRequestsStore` (RG-016-01/03)

- Injecte `SettingsStore` et `BrowserNotificationService` (comme il injecte déjà `FiltersStore`).
- Dans `load()` : capturer `const previous = store.mergeRequests();` **avant** l'appel réseau (jamais après —
  sinon `previous === current`). Après un chargement réussi (jamais sur erreur, RG-005-05/07 déjà respecté par
  construction) : si `hasLoadedOnce` (variable de fermeture, même patron que `reloadTimer`) et que
  `settingsStore.settings()?.notifyAssigned` est vrai, appeler `findNewAssignments(previous, mergeRequests,
  identity)` et déclencher une notification par résultat via `BrowserNotificationService.show(...)`. Poser
  `hasLoadedOnce = true` après le tout premier `load()` réussi, quel que soit `notifyAssigned` (RG-016-03 :
  « au premier chargement d'une session », pas seulement quand l'option est active).
- `identity` = `settingsStore.settings()?.meUsername ?? ''` (RG-G09 : le repli email n'a pas d'équivalent
  pertinent ici, voir ci-dessus).
- Titre de la notification : `` `MR Board — ${alias} !${iid}` ``, corps = titre de la MR (RG-016-01) ; clic →
  `window.open(webUrl, '_blank')` (cohérent avec RG-G11 : ouvrir GitLab dans un nouvel onglet depuis une source
  hors page).

### Section « 06 · Divers » — activer les 2 cases existantes (RG-016-02/05)

- `settings-form.ts` : ajouter `notifyAssigned: FormControl<boolean>`, `tabBadge: FormControl<boolean>` à
  `SettingsFormControls`/`buildSettingsForm`/`resetSettingsForm`/`resetSettingsFormToDefaults`/`toUpdateRequest`
  — même patron exact que `openInNewTab` (US-015), aucune règle métier supplémentaire sur `tabBadge` (case
  simple). `notifyAssigned` a une contrainte supplémentaire : voir ci-dessous, elle **ne suit pas**
  `formControlName` passivement.
- `miscellaneous-section.component.ts` : remplacer le `mat-checkbox disabled` « Notification navigateur… » par
  un contrôle actif nécessitant une interception (RG-016-02) — ne peut pas être un simple `formControlName`
  passif car cocher doit d'abord demander la permission avant de refléter l'état :
  - `[checked]="form().controls.notifyAssigned.value"` + `(change)="onNotifyToggle($event.checked)"`
  - `onNotifyToggle(checked: boolean)` : si `checked` est `false` → `form().controls.notifyAssigned.setValue(false)`
    directement (désactiver ne demande rien) ; si `true` → `await notifications.requestPermission()` : `'granted'`
    → `setValue(true)` ; sinon → laisser/remettre le contrôle à `false` (`setValue(false)`, au cas où Material
    aurait déjà coché visuellement) et afficher le message « Notifications bloquées par le navigateur » via un
    signal local (`protected readonly permissionBlocked = signal(false)`).
  - Case rendue `[disabled]="!notifications.isSupported()"` (RG-016-02 : « Si l'API n'existe pas, la case est
    désactivée ») — remplace l'ancien `disabled` statique.
  - `mat-checkbox` du badge (« tabBadge ») redevient un `formControlName="tabBadge"` normal, sans interception.
- Retirer la clé i18n `settings.misc.comingSoon` (US-015) — plus aucun appelant après cette US ; vérifier par
  recherche globale avant suppression.

### `BoardPageComponent` — badge de compteur (RG-016-04)

- `protected readonly redCount = computed(() => this.mrStore.mergeRequests().filter((mr) => mr.readyLevel === 'red').length);`
  — lit directement les lignes déjà filtrées par le backend (RG-010), donc « actuellement affichées » est déjà
  garanti sans code supplémentaire.
- `effect()` dans le constructeur (aux côtés des deux `effect()` existants) : injecte `Title` de
  `@angular/platform-browser`, appelle `this.titleService.setTitle(...)` à partir de
  `settingsStore.settings()?.tabBadge` et `redCount()`. Constante partagée `APP_TITLE = 'MR Board'` (doit rester
  synchrone avec le `<title>` statique de `index.html`).
- **Point de vigilance à traiter** : l'`effect()` s'arrête quand `BoardPageComponent` est détruit (navigation
  vers `/settings`), mais le titre de l'onglet reste sur sa dernière valeur (`(2) MR Board`) au lieu de revenir
  à `MR Board` — remettre `APP_TITLE` dans `ngOnDestroy` (ou l'équivalent `destroyRef.onDestroy`).

### Nouvelles tâches techniques

| Tâche | Type | Description |
|-------|------|-------------|
| Créer `core/notifications/browser-notification.service.ts` + `.spec.ts` | Service | voir ci-dessus |
| Créer `stores/assignment-diff.ts` + `.spec.ts` | Fonction pure | voir ci-dessus (cas : nouvelle affectation, MR nouvelle, pas de doublon, draft ignoré, identité vide, casse) |
| Étendre `stores/merge-requests.store.ts` + `.spec.ts` | Store | diff + notification dans `load()`, tests avec `BrowserNotificationService` mocké |
| Étendre `settings-form.ts` + `.spec.ts` | Formulaire | `notifyAssigned`, `tabBadge` |
| Étendre `sections/miscellaneous/miscellaneous-section.component.*` | Composant | activation des 2 cases, message de blocage, désactivation si non supporté |
| Étendre `board-page.component.ts` + `.spec.ts` | Composant | `redCount`, effect Titre, reset au `ngOnDestroy` |
| i18n | — | `settings.misc.notificationsBlocked` ; suppression de `settings.misc.comingSoon` |

### Modifications sur l'existant

| Élément modifié | Nature | Risque | Solution |
|-------------------|--------|--------|----------|
| `miscellaneous-section.component.html/.ts` | Case « notify » : passe de `disabled` statique à contrôle actif avec interception async | Faible | Voir ci-dessus ; tests couvrant les 3 issues de `requestPermission` (`granted`/`denied`/`default`) |
| `board-page.component.ts` | Nouvel `effect()` + `ngOnDestroy` | Faible | Le composant n'implémentait pas encore `OnDestroy` explicite (seulement `destroyRef.onDestroy` pour les listeners) ; ajouter un `destroyRef.onDestroy(() => this.titleService.setTitle(APP_TITLE))` plutôt qu'un `ngOnDestroy` pour rester cohérent avec le style déjà utilisé dans ce composant |
| `merge-requests.store.ts` | Nouvelles dépendances (`SettingsStore`, `BrowserNotificationService`) | Faible | Injection standard, déjà précédenté par `FiltersStore` |

---

## Points de vigilance globaux

- **Pas de notification hors ligne/onglet fermé** : l'API `Notification` ne fonctionne que si l'onglet (ou son
  service worker, absent ici) est vivant — hors périmètre, RG-016 ne le demande pas.
- **`hasLoadedOnce` est un état de session** (variable de fermeture du store `providedIn: 'root'`), pas persisté
  — un rechargement complet de page (F5) redémarre une « session » au sens de RG-016-03, ce qui est le
  comportement attendu.
- **Sécurité/vie privée** : aucune donnée sensible dans le corps de la notification (titre de MR uniquement,
  déjà visible dans le tableau).
- **`window.open` bloqué par le navigateur** : le clic sur une notification déclenche `window.open` en dehors
  d'un geste utilisateur direct sur la page (c'est un événement `Notification.onclick`) — les navigateurs
  autorisent généralement ceci car il provient d'une interaction utilisateur (le clic sur la notification
  elle-même compte comme tel), mais à vérifier manuellement en Phase Dev (pas testable en Vitest/jsdom).

---

## Ordre de réalisation suggéré

1. Migration + entité + DTOs backend (2 champs, patron US-015) + tests
2. `stores/assignment-diff.ts` + tests (fonction pure, en premier — aucune dépendance)
3. `core/notifications/browser-notification.service.ts` + tests
4. `settings-form.ts` (2 champs) + tests
5. `MergeRequestsStore` (diff + notification dans `load()`) + tests
6. `miscellaneous-section` (activation des 2 cases, message de blocage) + tests + i18n
7. `board-page.component.ts` (badge, effect Titre, reset au destroy) + tests
8. Validation manuelle : notification réelle (permission accordée dans Chrome), badge du titre d'onglet visible
