# Rapport QA — US-037 Page Historique

| Règle | Vérification | Résultat |
|-------|--------------|----------|
| RG-037-01 route + tri + groupes par jour | e2e tri décroissant ; spec page (Aujourd'hui / Hier / date) ; spec toolbar (lien `/history`) | ✅ |
| RG-037-02 contenu d'une ligne | spec ligne (acteur, action, tag, lien MR, ancien → nouveau, citation, date exacte au survol) | ✅ |
| RG-037-03 pagination par curseur | e2e (aucun doublon ni trou), specs store et page | ✅ |
| RG-037-04 états chargement / vide / erreur | spec page | ✅ |
| RG-037-05 acteur inconnu | e2e (`actor: null`), spec ligne (carré pointillé) | ✅ |
| Entrées invalides | e2e : `limit=0/201/abc`, `cursor=garbage` → 400 | ✅ |

Bugs : 1 `[TEST]` corrigé (e2e « acteur inconnu » : événement le plus ancien au lieu du plus récent).

## Non vérifié
- Rendu dans un vrai navigateur (non fait : tests jsdom uniquement).
- Dates GitHub sans millisecondes : tri lexicographique approximatif à la seconde près.

## Décisions
### Prises en autonomie
- Pas de test navigateur automatisé (Playwright optionnel dans le projet) — réversible : oui
### Arbitrées par l'humain
Aucune.
