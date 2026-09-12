# Architecture frontend — Angular + Angular Material

Ce document décrit l'architecture cible du frontend et les bonnes pratiques à respecter. Il fait autorité avec
`CLAUDE.md`. Le rendu visuel est régi par `docs/tech/design-system.md` et les maquettes de `docs/design/`.

---

## 1. Stack et versions

| Brique            | Choix                                        | Justification                                                   |
|-------------------|----------------------------------------------|-----------------------------------------------------------------|
| Framework         | Angular 21 (standalone, signals) — 22 dès Node ≥ 22.22 | Modernité, performance, API signals stable            |
| UI                | Angular Material 21 (+ CDK)                  | Exigence projet : composants Material en priorité               |
| État              | `@ngrx/signals` (SignalStore)                | Stores réactifs légers, sans boilerplate NgRx classique         |
| HTTP              | `HttpClient` + `provideHttpClient(withInterceptors)` | Interceptors d'erreur et de base URL                    |
| Styles            | SCSS + thème Material M3 personnalisé        | Tokens du design system Modernist                               |
| i18n              | Pipe custom `translate` + `public/i18n/fr.json` | Voir `docs/tech/i18n.md`                                     |
| Tests unitaires   | Vitest via `@angular/build:unit-test` (jsdom) | Builder officiel Angular, rapide, sans navigateur              |
| Tests E2E         | Playwright (phase ultérieure)                | Parcours utilisateur complets                                   |
| Qualité           | ESLint (`angular-eslint`) + Prettier         | Règles template et TS                                           |

Initialisation : `npx @angular/cli new frontend --style=scss --routing --ssr=false --standalone --strict`
puis `npx ng add @angular/material` (thème custom, typographie Archivo, animations) et `npm i @ngrx/signals`.

---

## 2. Organisation

```
frontend/
├── public/
│   ├── i18n/fr.json                     # toutes les chaînes visibles
│   └── changelog.json                   # journal des évolutions (règle CLAUDE.md)
├── proxy.conf.json                      # /api → http://localhost:3000
└── src/
    ├── styles.scss                      # thème Material + tokens design system + reset
    ├── environments/                    # apiBaseUrl…
    └── app/
        ├── app.config.ts                # providers : router, http, animations, i18n loader
        ├── app.routes.ts                # '' → board (eager), 'settings' → lazy
        ├── app.component.ts             # <router-outlet> uniquement
        ├── core/
        │   ├── api/                     # services HTTP : settings.service.ts, projects.service.ts, merge-requests.service.ts, sync.service.ts
        │   ├── i18n/                    # TranslateService, TranslatePipe
        │   ├── interceptors/            # api-base-url, http-error
        │   └── url-state/               # synchronisation filtres ↔ query params
        ├── shared/
        │   ├── avatar/                  # initiales + tooltip nom complet
        │   ├── difficulty-badge/        # jeton de couleur + label + méta
        │   ├── ready-delay/             # pastille couleur + libellé délai
        │   ├── resizable-column/        # directive de redimensionnement (CDK)
        │   └── ...
        ├── models/                      # interfaces TS miroir des DTOs backend
        ├── stores/
        │   ├── merge-requests.store.ts  # liste, chargement, erreurs, facets
        │   ├── filters.store.ts         # état des filtres/tri/colonnes (source de vérité, synchronisée avec l'URL)
        │   ├── settings.store.ts
        │   └── sync.store.ts            # statut de synchro, polling, refresh
        └── features/
            ├── board/
            │   ├── board-page.component.*        # layout écran Tableau
            │   ├── board-toolbar/                # brand, statut synchro, Rafraîchir, Paramètres
            │   ├── filter-bar/                   # chips Ready/Drafts, Mes MRs, pastilles composables, Ajouter un filtre, compteur, Effacer
            │   ├── filter-chip-menu/             # menu multi-sélection avec compteurs
            │   ├── mr-table/                     # mat-table, tri, colonnes redimensionnables, menu colonnes
            │   └── empty-state/
            └── settings/
                ├── settings-page.component.*     # layout 2 colonnes, Annuler/Enregistrer
                ├── sections/                     # me, gitlab-connection, repositories, refresh, thresholds, misc
                └── ...
```

---

## 3. Flux de données

```
Composant ──lit──▶ Store (signals) ──appelle──▶ Service HTTP ──▶ /api/v1
     │                  ▲
     └──événements──────┘ (méthodes du store)
```

- Les composants ne connaissent que les stores (et éventuellement des services purement UI comme `MatDialog`, `MatSnackBar`)
- Les stores encapsulent l'état, les états de chargement (`loading`, `error`), les `computed` (rows triées, compteurs) et les appels aux services
- Les services HTTP sont sans état, retournent des `Observable<T>` typés et ne sont appelés que par les stores
- `filters.store.ts` est la source de vérité des filtres ; `core/url-state` la synchronise dans les deux sens avec `ActivatedRoute.queryParams` (voir US-011)

---

## 4. Conventions Angular

### Composants
- `standalone: true` (implicite en v20), `changeDetection: ChangeDetectionStrategy.OnPush`
- `input()` / `output()` / `model()` fonctionnels ; `viewChild()` signal
- Control flow natif `@if`, `@for (… ; track item.id)`, `@switch`
- Un composant = un dossier avec `.ts`, `.html`, `.scss`, `.spec.ts`
- Les composants de `shared/` sont purement présentationnels (inputs/outputs), sans store
- Les composants « page » (`*-page.component`) sont les seuls à injecter les stores et à composer les sous-composants
- Pas d'appel HTTP direct, pas de `setTimeout` pour de la logique métier

### Angular Material — correspondance des éléments d'UI

| Élément (maquette)                     | Composant Material / CDK                         |
|----------------------------------------|--------------------------------------------------|
| Barre de titre, Rafraîchir, Paramètres | `mat-toolbar`, `mat-stroked-button`, `mat-icon-button` |
| Barre de progression synchro           | `mat-progress-bar mode="indeterminate"`          |
| Bandeau « Aucun jeton »                | Composant custom léger + `mat-button`            |
| Chips Drafts / Mes MRs                 | `mat-chip-listbox` + `mat-chip-option`           |
| Pastilles de filtre + menu             | `mat-chip` (removable) + `mat-menu` + `mat-checkbox` |
| Menu « Ajouter un filtre »             | `mat-menu` + `mat-menu-item`                     |
| Tableau                                | `mat-table` + en-tête `<th>` custom cliquable/clavier pour le tri contrôlé (US-008 : le rendu natif de `mat-sort-header` ne permet pas l'indicateur `↑`/`↓`/`↕` toujours visible exigé par le design) + CDK `cdkDrag` ou directive custom pour le resize |
| Tooltip nom complet, titre coupé       | `matTooltip`                                     |
| Coche Approved                         | `mat-icon` (SVG Lucide `check`)                  |
| Menu colonnes                          | `mat-menu` + `mat-checkbox`                      |
| Formulaires Paramètres                 | `mat-form-field` + `matInput`, `mat-radio-group`, `mat-slide-toggle`, `mat-checkbox` |
| Jeton (afficher/masquer)               | `mat-form-field` + `matSuffix` `mat-icon-button` |
| Toasts                                 | `MatSnackBar`                                    |
| Confirmation suppression de repo       | `MatDialog`                                      |
| Icônes                                 | `mat-icon` avec `MatIconRegistry.addSvgIconLiteral` (Lucide inline) |

Règle : si un composant Material couvre le besoin, il est utilisé. Un composant custom n'est écrit que pour les rendus
spécifiques du design (avatar initiales, jeton de difficulté, pastille délai) et reste dans `shared/`.

### Services HTTP (`core/api`)
- Nommage `<ressource>.service.ts`, méthodes `get…`, `post…`, `put…`, `delete…` retournant `Observable<T>`
- Base URL via interceptor (`environment.apiBaseUrl`), jamais en dur
- Gestion des erreurs HTTP dans l'interceptor (`http-error`) qui normalise en `ApiError` ; les stores traduisent en clé i18n

### Stores (`stores/`)
- `signalStore({ providedIn: 'root' }, withState(...), withComputed(...), withMethods(...))`
- État initial explicitement typé ; `loading: boolean`, `error: string | null` (clé i18n)
- Méthodes asynchrones via `rxMethod` + `tapResponse` ou `async/await` avec `firstValueFrom`
- Jamais d'accès au DOM ni au router (sauf `filters.store` via `core/url-state`)

### Styles
- Tokens exclusivement : `--mat-sys-*` (thème) et variables du design system exposées dans `styles.scss`
- Aucun `border-radius` ; ne jamais surcharger les composants Material via `::ng-deep` sauf documentation dans `design.md`
- Layout par `flex`/`grid`, densité compacte (`density: -2` sur les form fields de la page Paramètres si besoin)

### Accessibilité
- Tous les boutons icônes ont `aria-label` (clé i18n)
- Focus visible géré par Material (ring accent selon le design system)
- Les tooltips sont aussi accessibles au clavier (composants Material)

---

## 5. Gestion de l'URL et de la persistance locale

- Filtres, tri et colonnes visibles sont reflétés dans l'URL (`?drafts=0&mine=0&project=api,web&assigned=nobody&sort=ready:asc&cols=opened`) — source de vérité au chargement
- Largeurs de colonnes : `localStorage` (`mrboard.columns.v1`) — préférence par navigateur, non partagée
- Aucun secret côté navigateur : le jeton GitLab vit exclusivement dans le backend

---

## 6. Scripts npm attendus (`frontend/package.json`)

| Script          | Commande                                       |
|-----------------|------------------------------------------------|
| `start`         | `ng serve --proxy-config proxy.conf.json`      |
| `build`         | `ng build`                                     |
| `test`          | `ng test --no-watch`                           |
| `test:coverage` | `ng test --no-watch --coverage`                |
| `lint`          | `ng lint`                                      |
| `e2e`           | `playwright test` (quand mis en place)         |

Voir `docs/tech/testing.md` pour la stratégie de tests détaillée.
