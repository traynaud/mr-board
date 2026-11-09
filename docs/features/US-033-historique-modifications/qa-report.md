# Rapport QA — US-033 Détection et journal des modifications

## Résultats
- Backend unitaire : 668 passés / 0 échoué ; e2e : toutes suites vertes (history : 8/8) ; lint, `tsc`, build OK.
- Couverture backend globale : 98,9 % lignes / 89,6 % branches (seuil 80 %) ; `history/` : 100 % lignes.
- Frontend : non concerné (aucun changement).
- Tests API manuels : sans objet (aucun endpoint dans cette US).

## Critères d'acceptation (périmètre US-033)
| Scénario | Résultat | Test |
|---|---|---|
| Renommage détecté (événement provisoire, MR en file) | ✅ | `detect…title_changed`, `history.service`, e2e « provisional events » |
| Une MR n'apparaît qu'une fois dans la file | ✅ | e2e « single queue entry » + `upsert` unitaire |
| Aucune différence, aucun événement | ✅ | unitaire + e2e |
| Première synchronisation d'un projet | ✅ | unitaire (baseline) + e2e |
| Nouveau commentaire (mise en file sans événement) | ✅ | unitaire + e2e |
| Projet supprimé → historique supprimé | ✅ | e2e (cascade) |
| MR disparue : le journal reste | ✅ | e2e |
| Échec d'écriture de l'historique sans échec de synchro | ✅ | `sync.service.spec` |
| Fusion/fermeture/404, enrichissement forge, réouverture, projet désactivé, rétention, timeline, filtres | ⏭️ | US-034 à US-038 (hors périmètre) |

## Bugs trouvés
Aucun.

## Recommandations
- US-034 : initialiser le curseur forge par MR (RG-034-04) ; prévoir la reprise des entrées dont `next_attempt_at` est échu.
- US-035 : brancher la mise en file au moment de `deleteMissing` (instantané titre/URL déjà dans la file).

## Décisions
### Prises en autonomie
- Les scénarios des US suivantes sont marqués « hors périmètre » plutôt qu'échoués — réversible : oui
### Arbitrées par l'humain
- Aucune
