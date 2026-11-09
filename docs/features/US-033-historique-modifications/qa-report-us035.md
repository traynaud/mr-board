# Rapport QA — US-035 Clôtures, fusions et MRs introuvables

## Résultats
- Backend unitaire : 768 passés / 0 échoué ; e2e : toutes suites vertes (history : 15/15) ; lint, `tsc`, build OK.
- Couverture backend : 98,9 % lignes / 89,9 % branches (seuil 80 %). Frontend non concerné.
- Forges réelles : non testées (mockées). Aucun endpoint exposé : pas de test API manuel.

## Critères d'acceptation
| Scénario | Résultat | Test |
|---|---|---|
| Fusion d'une MR qui disparaît (acteur, date exacte, consultable ensuite) | ✅ | `build-terminal-event`, enrichissement, e2e |
| Fermeture (acteur, date) | ✅ | mappers GitLab / GitHub, `build-terminal-event` |
| MR introuvable (404) → `deleted`, acteur inconnu | ✅ | clients, e2e |
| Forge injoignable : repli `disappeared` après 5 échecs, synchro intacte | ✅ | `history-enrichment.service` |
| Réouverture → `reopened`, pas `created` | ✅ | `history.service`, e2e |
| Projet supprimé : file et historique supprimés | ✅ | e2e (US-033) |
| Aucun événement tant que la MR est encore ouverte côté forge | ✅ | `build-terminal-event`, enrichissement |
| Projet désactivé | ⏭️ | Sans objet : aucune bascule `enabled` dans l'API |
| Rétention, timeline, filtres | ⏭️ | US-036 à US-038 |

## Bugs trouvés
Aucun.

## Recommandations
- Tester `merge_user` / `closed_by` GitLab et `closed_by` GitHub sur une instance réelle.
- US-036 : la purge devra aussi couvrir la file (entrées abandonnées) si elle grossit.

## Décisions
### Prises en autonomie
- Scénario « projet désactivé » marqué sans objet plutôt qu'échoué — réversible : oui
### Arbitrées par l'humain
- Aucune
