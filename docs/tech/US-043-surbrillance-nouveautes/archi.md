# Architecture — US-043 Surbrillance des MRs nouvelles ou modifiées

## Résumé fonctionnel
> Le tableau reçoit, pour chaque MR, un indicateur `change` (`'new' | 'modified' | null`) calculé à partir des
> événements du journal non vus. Le survol (500 ms) d'une ligne surlignée appelle un nouvel endpoint qui marque ses
> événements comme vus. Un réglage `highlightChanges` active / désactive la fonction.

## Backend
- **Aucun changement du journal** : on lit `merge_request_events.dismissed_at IS NULL` (US-039). Pas de nouvelle table.
- **Migration** `AddHighlightChangesSetting` : `settings.highlight_changes boolean NOT NULL DEFAULT 1` (additive, non
  destructive ; D4 non déclenché).
- **Réglage** `highlightChanges` : entité, `SettingsResponseDto`, `UpdateSettingsDto`, `SettingsService` (lecture / écriture
  / reset à `true`), export / import (`ImportSettingsDto`, optionnel : absent = valeur conservée), comme `highlightMe`.
- **Domaine pur** `merge-requests/domain/resolve-change-kind.ts` : `resolveChangeKind(types: string[]) → 'new' | 'modified' | null`
  (`created` ⇒ `new`, sinon non vide ⇒ `modified`).
- **Lecture** : `MergeRequestsModule` enregistre `MergeRequestEvent` (`TypeOrmModule.forFeature`, comme le module
  notifications : pas de dépendance de module vers `HistoryModule`, donc pas de cycle). Dans `loadBase`, une seule
  requête agrégée : `SELECT project_id, mr_iid, type FROM merge_request_events WHERE dismissed_at IS NULL AND
  (project_id, mr_iid) correspond aux MRs listées` — regroupée en mémoire par `(projectId, iid)` ; le résultat alimente
  `toMergeRequestView` (nouveau champ `change` de `MergeRequestViewDto`). Les préférences de notification sont ignorées
  (RG-043-02). La clé `(projectId, iid)` est celle des favoris.
- **Marquage** : `POST /api/v1/merge-requests/:id/seen` → `204`. `MergeRequestsService.markSeen(id)` : 404
  (`EntityNotFoundException`) si la MR n'existe pas ; sinon `UPDATE merge_request_events SET dismissed_at = now WHERE
  project_id = :p AND mr_iid = :iid AND dismissed_at IS NULL` (idempotent). Contrat d'API additif consommé par le seul
  front → pas de D3.
- **Sécurité** : aucun secret ; paramètres liés ; `ParseIntPipe`.

## Frontend
- `models/merge-request.model.ts` : `change: 'new' | 'modified' | null` dans `MergeRequestView`, type `ChangeKind`.
- `MergeRequestsService.markSeen(id)` (`POST`), `MergeRequestsStore.markSeen(id)` : mise à jour **optimiste** (`change: null`
  pour la MR), appel API, **retour arrière** de la ligne en cas d'erreur (RG-043-10), puis `NotificationsStore` rafraîchi
  par l'orchestrateur (la page Tableau) pour que le compteur de la cloche suive (RG-043-04).
- `MrTableComponent` : `highlightChanges = input(true)`, `rowSeen = output<MergeRequestView>()`. Le délai de 500 ms vit dans
  une petite directive `appSeenOnHover` (`shared/seen-on-hover.directive.ts`) : `mouseenter` arme un `setTimeout(500)`,
  `mouseleave` / destruction l'annulent ; émet `appSeenOnHover` à échéance. Appliquée sur `tr[mat-row]` seulement si
  `highlightChanges && row.change`. Classes `row-new` / `row-modified` sur la ligne ; libellé masqué dans la cellule
  titre (`cdk-visually-hidden` si présent, sinon classe locale).
- `BoardPageComponent` : passe `highlightChanges` (réglage, défaut `true`), relaie `rowSeen` → `store.markSeen` puis
  rafraîchissement du compteur de notifications.
- Réglage : `settings.model.ts`, `settings-form.ts` (contrôle `highlightChanges`, hydratation, reset à `true`, payload),
  `settings-tabs.ts` (onglet « Interface »), `miscellaneous-section` (case à cocher).
- i18n fr / en (parité testée).

## Points de vigilance
- Un MR avec des centaines d'événements non vus : la requête filtre sur les MRs listées et ne ramène que `(project_id,
  mr_iid, type)` ; index existant `IDX_merge_request_events_dismissed (dismissed_at, occurred_at)`.
- Le tri / les filtres ne changent pas : l'indicateur est ajouté après le calcul des vues.
- Le tableau n'est pas rechargé après `markSeen` (mise à jour locale uniquement) : évite un saut de lignes.

## Décisions
### 🛑 Arbitrage humain requis
Aucun (migration additive, API additive).
### ✅ Prises en autonomie
| Sujet | Choix | Justification | Réversible |
|-------|-------|---------------|------------|
| Source de vérité | `dismissed_at` des événements | pas de second état « vu » | oui |
| Délai de survol | directive dédiée, 500 ms | testable, réutilisable | oui |
| Mise à jour après survol | optimiste + rollback | pas de rechargement du tableau | oui |
| Compteur de la cloche | rafraîchi par la page | pas de couplage store → store | oui |
### Arbitrées par l'humain
- Aucune
