# Rapport QA — US-038 Filtres de la timeline

Date : 2026-11-10 — Environnement : backend NestJS + SQLite jetable (120 événements de démo, 2 projets, acteurs
alice / bob / carole / inconnu), frontend `ng serve`, navigateur piloté (Playwright, fuseau Europe/Paris).

## Résultat

**Conforme.** Aucun bug ouvert. 2 défauts d'implémentation `[IMPL]` trouvés en recette navigateur, corrigés dans la foulée
avec test de non-régression.

## Recette navigateur

| Scénario | Résultat |
|----------|----------|
| Restauration depuis l'URL (`type`, `actor` dont `none`, `q`) : pastilles, champ de recherche, liste filtrée, 4 résultats | ✅ |
| Recherche « refacto » retrouve « Réfacto de la facturation » (casse / accents) | ✅ |
| « + Ajouter un filtre » → Période : pastille sans valeur, URL et liste inchangées | ✅ |
| Saisie de date `01/11/2026` : `from=2026-11-01`, 74 événements | ✅ après correction (bug 1) |
| Calendrier ouvert dans le menu : s'affiche au-dessus, ne ferme pas le menu, `Du` ≤ `Au` | ✅ |
| Choix du 8 nov. : `to=2026-11-08`, 64 événements = total de l'API pour [01/11 00:00 ; 09/11 00:00[ local, 08/11 inclus | ✅ |
| Recherche sans résultat « zzz » : « Aucun événement ne correspond aux filtres. » + « Effacer les filtres », compteur 0 | ✅ |
| « Charger plus » sous filtre : 50 → 64 lignes, mêmes filtres | ✅ |
| « Effacer » : URL nettoyée, pastilles retirées, 120 événements, bouton masqué | ✅ |
| Échap ferme le menu Période, sans voile résiduel | ✅ après correction (bug 2) |
| Console : aucune erreur ni avertissement | ✅ |

## Bugs trouvés et corrigés

| # | Cause | Défaut | Correction |
|---|-------|--------|------------|
| 1 | `[IMPL]` | `DateAdapter` natif de Material lisait `01/11/2026` à l'américaine (→ 11 janvier) malgré la locale `fr` | `AppDateAdapter` : lecture `JJ/MM/AAAA` / `AAAA-MM-JJ`, affichage selon la langue (RG-022-10), saisie invalide rejetée |
| 2 | `[IMPL]` | `stopPropagation` du clavier sur le contenu des menus avalait aussi Échap : menu impossible à fermer au clavier depuis un champ, voile résiduel | Échap laissé passer dans les menus Période et Type / Acteur / Projet |

## Couverture automatisée
- Backend : 20 e2e `history-filters` (chaque filtre, ET / OU, acteur inconnu, accents, numéro, jokers `LIKE`, bornes de
  période, pagination + `total` filtré, `/history/actors`, 8 cas 400), unitaires `history-filter` et `typeorm-options`.
- Frontend : 1032 tests (store : course et annulation, URL, service, barre, pastilles, adaptateur de dates, page).

## Points non couverts
- Rendu en thème sombre et en anglais, largeur mobile de la barre et des menus (non revus visuellement).
- Datepicker sous fuseau négatif (UTC−) : la conversion jour local → instant est testée unitairement, pas en navigateur.
- Volumétrie : la recherche (fonction SQL non indexable) parcourt le journal ; non mesurée sur une grosse base.

## Décisions
### Prises en autonomie
- Correction des 2 défauts d'implémentation sans arbitrage — réversible : oui
### Arbitrées par l'humain
- Aucune
