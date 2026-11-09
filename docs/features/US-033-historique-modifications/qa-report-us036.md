# Rapport QA — US-036 Rétention de l'historique

## Résultats
- Backend : 783 unitaires, e2e verts ; frontend : 846 passés ; lint, `tsc`, build OK (back et front).
- Couverture backend ≥ 98 % lignes (seuil 80 %).
- Test navigateur : non réalisé (rendu vérifié par tests de composant).

## Critères d'acceptation
| Scénario | Résultat | Test |
|---|---|---|
| Rétention cumulative (jours + nombre) | ✅ | `history-retention.service`, e2e |
| Purge par durée | ✅ | e2e (événement de 45 j, réglage 30 j) |
| Purge par nombre (on garde les plus récents) | ✅ | e2e (150 événements, réglage 100) |
| Réglage hors bornes → 400, inchangé | ✅ | e2e `it.each` (5 cas), formulaire (10 cas) |
| Purge à la fin d'une synchro | ✅ | `sync.service.spec`, e2e |
| Purge à l'enregistrement des réglages (et import) | ✅ | `settings.service.spec`, e2e |
| Suppression d'un projet : historique supprimé | ✅ | e2e (US-033) |
| Section « Historique » (champs, suffixes, erreurs, numérotation 05/06) | ✅ | `history-section.component.spec`, page |
| Valeurs par défaut 60 j / 5 000 | ✅ | service, formulaire |
| Reset des Paramètres ne vide pas l'historique | ✅ | par construction (remet seulement les 2 réglages) |

## Bugs trouvés
- BUG-001 `[TEST]` : fixtures e2e avec une date de création de MR de 69 jours → événement `created` purgé (conforme à
  la règle). Corrigé : dates récentes dans la fixture.

## Recommandations
- Contrôler la section dans un navigateur (alignement, dark mode) ; US-037 ajoutera la page qui rend la rétention visible.

## Décisions
### Prises en autonomie
- BUG-001 corrigé dans la boucle QA (1 itération) — réversible : oui
### Arbitrées par l'humain
- Aucune
