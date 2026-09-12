# Rapport QA — US-010 Filtres composables

## 1. Tests automatisés

| Suite | Résultat |
|-------|----------|
| Backend unit (`npm test`) | 291 passed / 0 failed |
| Backend e2e (`npm run test:e2e`) | 75 passed / 0 failed |
| Backend couverture (`npm run test:cov`) | 99,13 % statements / 87,63 % branches / 98,35 % fonctions / 99,19 % lignes — seuil 80 % respecté |
| Frontend (`ng test --no-watch --coverage`) | 320 passed / 0 failed |
| Frontend couverture | 98,14 % statements / 93,87 % branches / 95,54 % fonctions / 98,94 % lignes — seuil 80 % respecté |

`tsc --noEmit`, `ng lint`, `ng build`, `npm run lint` (backend) et `npm run build` (backend) : tous verts.

## 2. Couverture des critères d'acceptation (specs.md §5)

| Scénario Gherkin | Statut | Test(s) couvrant |
|---|---|---|
| Ajouter un filtre Projet | ✅ | `add-filter-menu.component.spec.ts` (ouverture menu, émission `addFilter`), `filter-bar.component.spec.ts` (rendu pastille + options facet), `merge-requests.e2e-spec.ts` (`project=api` narrowing) |
| Filtre Affecté à avec Nobody | ✅ | `filter-merge-requests.spec.ts` (nobody + username combiné), `merge-requests.e2e-spec.ts` (`assigned=nobody`), `filter-pill.component.spec.ts` (libellé « Nobody ») |
| Affecté à en OU sur reviewer et assignee | ✅ | `filter-merge-requests.spec.ts` (RG-G13), `merge-requests.e2e-spec.ts` (`assigned=kbenali` matches reviewer OU assignee) |
| Filtre Approved (toggle + untoggle) | ✅ | `filter-merge-requests.spec.ts`, `filters.store.spec.ts` (`setBoolean` re-clic → `null`), `merge-requests.e2e-spec.ts` (`approved=0`) |
| Filtre Commenté | ✅ | `filter-merge-requests.spec.ts`, `merge-requests.e2e-spec.ts` (`commented=1`) |
| Compteurs contextuels (exclusion du filtre lui-même) | ✅ | `build-facets.spec.ts` (test dédié RG-010-07), `merge-requests.e2e-spec.ts` (`facets?project=web` n'affecte pas le compteur `project` lui-même) |
| Combinaison de filtres (ET) | ✅ | `filter-merge-requests.spec.ts`, `merge-requests.e2e-spec.ts` (`project=api&approved=1&mine=1`) |
| Retirer une pastille | ✅ | `filters.store.spec.ts` (`removeFilter`), `filter-bar.component.spec.ts` (émission `filterRemove` au clic croix) |
| Tous les filtres actifs → bouton désactivé | ✅ | `add-filter-menu.component.spec.ts` (`should_disable_the_button_itself_when_all_5_filters_are_active`) |
| Recherche dans le menu (> 6 options) | ✅ | `filter-pill.component.spec.ts` (affichage conditionnel + filtrage par sous-chaîne) |
| État vide avec filtres + « Effacer les filtres » | ✅ | `board-page.component.spec.ts` (`should_show_the_empty_state_with_a_clear_button_when_a_composable_filter_is_active_but_matches_nothing`) |
| Valeur inconnue (`approved=maybe` → 400, `project=inconnu` → 200 vide) | ✅ | `merge-requests.e2e-spec.ts`, confirmé aussi manuellement (§3) |
| Endpoint `/merge-requests/facets` (forme de la réponse) | ✅ | `merge-requests.e2e-spec.ts`, `build-facets.spec.ts`, confirmé manuellement (§3) |

**13/13 scénarios validés.**

## 3. Tests API manuels

Serveur lancé localement (`nest start`, `DB_PATH=:memory:`, `APP_SECRET` de développement non committé) :

| Requête | Attendu | Constaté |
|---|---|---|
| `GET /merge-requests` (base vide) | `{"mergeRequests":[],"warnings":[]}` | ✅ conforme |
| `GET /merge-requests/facets` (base vide) | 5 tableaux vides/à compteur 0, `nobody` présent, `approved`/`commented` à 2 options | ✅ `{"project":[],"author":[],"assigned":[{"value":"nobody","label":"Nobody","count":0}],"approved":[{"value":"yes","label":"Oui","count":0},{"value":"no","label":"Non","count":0}],"commented":[...]}` |
| `GET /merge-requests?approved=maybe` | 400 | ✅ `code=400` |
| `GET /merge-requests?project=inconnu` | 200, liste vide | ✅ `{"mergeRequests":[],"warnings":[]}` |
| `GET /merge-requests/facets?approved=maybe` | 400 | ✅ `code=400` |
| `PUT /settings` (jeton factice) | 200, jeton masqué (`tokenHint` uniquement) | ✅ `tokenConfigured:true`, `tokenHint:"1234"`, jeton complet absent de la réponse |
| `POST /projects` (GitLab factice injoignable) | Erreur propre (502), pas de crash serveur | ✅ `code=502` |

Impossible de synchroniser de vraies MRs sans instance GitLab réelle (hors périmètre d'un smoke test local) — la
narrow-down effective des filtres sur des données réelles est donc validée par les 13 scénarios e2e (§2), qui
utilisent le même code applicatif avec `GitlabClientService` mocké.

## 4. Vérification UI contre les maquettes

⚠️ **Non réalisée visuellement** : aucun outil de navigateur/rendu disponible dans cette session pour ouvrir
`ng serve` et comparer à l'écran avec `docs/design/`. La conformité structurelle (composants Material utilisés,
pas de `mat-chip` forcé pour la pastille, `mat-menu` pour les menus, `mat-checkbox` en contenu libre, icônes
`chevron-down`/`x`/`check`/`plus` déjà enregistrées) est vérifiée par les tests de composants (`MatMenuHarness`,
assertions de classes CSS/texte), mais pas le rendu pixel (police Archivo, couleurs exactes, arrondi 0). À vérifier
manuellement par un humain avant mise en production, ou lors d'une session avec accès navigateur.

## 5. Bugs trouvés

Aucun bug bloquant trouvé. Aucun `BUG-XXX` à consigner.

## 6. Recommandations

- **Vérification visuelle manquante** (§4) : recommandé de lancer `cd frontend && npm start` et comparer à
  `docs/design/MR Board - Prototype.dc.html` / wireframes 1a/1b avant de considérer l'US totalement terminée du
  point de vue produit, même si le code est fonctionnellement vert.
- Les gestionnaires clavier `(keydown.enter)`/`(keydown.space)` ajoutés sur les options de sélection multi
  (`filter-pill.component.html`, pour satisfaire le lint d'accessibilité) n'ont pas de test dédié simulant une
  interaction clavier réelle — actuellement seul le clic est testé. Faible risque (le lint garantit la présence des
  gestionnaires), mais à noter pour une future US si l'accessibilité clavier devient un axe de test explicite.
- Les 3 points signalés dans `archi.md` (« Points à clarifier », repris dans `dev-report.md`) restent non tranchés
  par un retour explicite du PO : menu « Ajouter un filtre » toujours visible pour les 5 filtres, facet Projet sur
  repos configurés (pas seulement actifs), forme tableau pour `approved`/`commented`. Implémentés selon specs.md
  (source de vérité) — à confirmer en revue de code ou par le PO si un écart de compréhension est possible.
