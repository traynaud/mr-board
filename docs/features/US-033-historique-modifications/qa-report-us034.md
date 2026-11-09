# Rapport QA — US-034 File asynchrone et enrichissement

## Résultats
- Backend unitaire : 731 passés / 0 échoué ; e2e : toutes suites vertes (history : 12/12) ; lint, `tsc`, build OK.
- Couverture backend : 98,9 % lignes / 89,3 % branches (seuil 80 %).
- Frontend : non concerné. Tests API manuels : sans objet (aucun endpoint). Forges réelles : non testées (mockées).

## Critères d'acceptation (US-034)
| Scénario | Résultat | Test |
|---|---|---|
| Renommage détecté puis confirmé (acteur, date exacte, « confirmé ») | ✅ | `reconcile-events`, `history-enrichment.service`, e2e |
| Une MR n'apparaît qu'une fois dans la file | ✅ | `history.service`, e2e (US-033) |
| Un seul appel forge pour plusieurs changements | ✅ | e2e : 1 appel par MR en file |
| Nouveau commentaire → événement `commented` (auteur, date, extrait) | ✅ | mappers GitLab / GitHub, e2e |
| Événement forge sans événement provisoire → créé confirmé | ✅ | `reconcile-events`, e2e |
| Traitement idempotent | ✅ | e2e (second passage), `reconcile-events` |
| Forge injoignable : attente croissante, synchro intacte | ✅ | `history-enrichment.service`, e2e |
| Abandon après 5 tentatives | ✅ | `history-enrichment.service` |
| Reprise après redémarrage (file persistée) | ✅ | file en base ; entrée relue par `processDue` (e2e) |
| Jeton jamais stocké ni logué | ✅ | revue de code, logs limités à `error.name` |
| Événement `disappeared` de repli, clôtures | ⏭️ | US-035 |

## Bugs trouvés
Aucun.

## Recommandations
- Valider l'analyse des notes système sur une instance GitLab réelle (libellés anglais) avant d'ouvrir la fonction à l'équipe.
- US-035 : brancher la mise en file au moment de `deleteMissing` ; `fetchMergeRequestEvents` retourne déjà `[]` sur 404.

## Décisions
### Prises en autonomie
- Scénarios des US suivantes marqués hors périmètre — réversible : oui
### Arbitrées par l'humain
- Aucune
