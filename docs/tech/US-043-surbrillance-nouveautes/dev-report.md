# Rapport de développement — US-043 Surbrillance des MRs nouvelles ou modifiées

## Livré

**Backend**
- Migration `1757602600000-AddHighlightChangesSetting` : `settings.highlight_changes` (défaut vrai). Réglage `highlightChanges`
  de bout en bout (entité, DTOs, service, export / import).
- `GET /api/v1/merge-requests` : chaque MR porte `change: 'new' | 'modified' | null`, déduit des événements non vus
  (`dismissed_at IS NULL`) par `domain/resolve-change-kind.ts` ; une requête `DISTINCT` limitée aux projets listés. Les
  préférences de notification sont ignorées (RG-043-02).
- `POST /api/v1/merge-requests/:id/seen` (204, idempotent, 404 si MR inconnue) : marque les événements de la MR comme vus.
- `MergeRequestsModule` enregistre `MergeRequestEvent` (même pattern que `NotificationsModule`, pas de cycle de modules).

**Frontend**
- `MergeRequestView.change`, `MergeRequestsService.markSeen`, `MergeRequestsStore.markSeen` (optimiste, retour arrière).
- Directive `shared/seen-on-hover` : 500 ms de survol **ou de focus clavier** continu avant d'émettre.
- `MrTableComponent` : classes `row-new` / `row-modified` (vert / ambre, filet gauche 2 px, fondu 400 ms, sans transition si
  `prefers-reduced-motion`), libellé masqué « Nouvelle » / « Modifiée » pour les lecteurs d'écran, sortie `rowSeen`.
- `BoardPageComponent.onRowSeen` : `markSeen` puis rafraîchissement du compteur de notifications ; échec silencieux.
- Paramètres : case « Surligner les MRs nouvelles ou modifiées dans le tableau » (Affichage › Interface), activée par défaut.
- i18n fr / en.

## Écarts par rapport au plan / aux docs
| Écart | Raison | Réversible |
|-------|--------|------------|
| Teinte « modifiée » ambre au lieu de l'accent rouge doux prévu | rouge confondu avec les états d'erreur et la colonne « Depuis Ready » | oui |
| Focus clavier déclenche aussi l'effacement | un utilisateur clavier n'aurait aucun moyen d'effacer la surbrillance | oui |

## Tests
- Backend : 825 unitaires, e2e dont `merge-request-highlight` (8) et import / export du réglage.
- Frontend : 993 tests (directive, service, store, table, page, formulaire, case à cocher).

## Décisions
### Prises en autonomie
- Voir `archi.md`, `design.md` et écarts ci-dessus — réversible : oui
### Arbitrées par l'humain
- Aucune (autonomie totale demandée ; recette navigateur avant merge)
