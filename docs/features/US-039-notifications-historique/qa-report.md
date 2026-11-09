# Rapport QA — US-039 → US-042 Notifications de l'historique

Date : 2026-11-09 — Environnement : backend NestJS + SQLite jetable (126 événements de démo), frontend `ng serve`,
navigateur piloté (Playwright).

## Résultat

**Conforme.** Aucun bug ouvert. 3 défauts d'implémentation `[IMPL]` trouvés en recette navigateur, corrigés dans la foulée.

## Recette navigateur

| Scénario | Résultat |
|----------|----------|
| Cloche + compteur dans la toolbar (30) | ✅ après correction (voir ci-dessous) |
| Ouverture du panneau en tiroir (440 px, voile, croix) | ✅ |
| Lignes de la timeline reprises, provisoires avec `~` et marqueur creux | ✅ |
| Fermer une entrée : compteur 30 → 29 côté panneau, cloche et serveur | ✅ |
| Confirmation d'un provisoire par la forge : même ligne mise à jour, `~` retiré, compteur inchangé (≤ 60 s, polling) | ✅ |
| Onglets Paramètres : 4 onglets, URL `?tab=`, sections renumérotées par onglet | ✅ |
| Onglet Notifications : périmètre, 18 types en 3 groupes, alertes navigateur | ✅ |
| Décocher « Commentée » + « Exclure mes propres actions », Enregistrer : retour au Tableau, compteur 29 → 22, plus aucun événement `commented` ni d'acteur « moi » | ✅ |
| « Seulement mes MRs » (identité `alice`) : 22 → 7 ; sans exclusions : 14 ; retour à « tout » : 29 | ✅ |
| « Tout marquer comme vu » : panneau vide, compteur masqué, état « Rien de nouveau » | ✅ |
| Console : aucune erreur | ✅ |

## Bugs trouvés et corrigés

| # | Cause | Défaut | Correction |
|---|-------|--------|------------|
| 1 | `[IMPL]` | Pastille du compteur (`MatBadge`) rendue hors du bouton, coupée par le haut de la toolbar | Pastille propre, positionnée dans le coin du bouton (maquette) |
| 2 | `[IMPL]` | Onglets étirés sur toute la largeur, texte centré | `mat-stretch-tabs="false"` + `mat-align-tabs="start"` (tout flush left, design system) |
| 3 | `[IMPL]` | « Tout marquer comme vu » avait l'air actif dans l'état vide (couleur forcée écrasait le style désactivé) | Couleur passée par le token du bouton Material |

## Couverture automatisée

- Backend : 812 tests unitaires, e2e dédiés (10) : cycle liste / fermeture, `dismiss-all` > 50, préférences, périmètre « mes MRs »
  (avec et sans identité), exclusion de mes actions, confirmation d'un provisoire en place, 404.
- Frontend : 963 tests (store, service, panneau, sections, onglets, toolbar, page Tableau).

## Points non couverts

- Rendu en thème sombre et en anglais des nouveaux écrans (clés en parité testée, rendu non revu visuellement).
- Comportement sur de vrais jetons GitLab / GitHub : la confirmation d'un provisoire a été simulée en base ; les tests
  d'enrichissement existants couvrent le chemin réel.
- Largeur mobile du tiroir et des onglets.

## Décisions
### Prises en autonomie
- Correction des 3 défauts d'implémentation sans arbitrage — réversible : oui
### Arbitrées par l'humain
- Aucune
