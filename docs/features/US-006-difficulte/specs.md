# US-006 — Difficulté de la MR

## 1. Reformulation

Chaque MR affiche un indicateur de difficulté de relecture (Easy / Medium / Hard) sous forme d'un jeton de couleur
vert → orange → rouge, calculé à partir du nombre de fichiers et de lignes modifiés. Les seuils ont des valeurs par
défaut (configurables dans US-014).

## 2. User Stories

- **US-006** : En tant qu'utilisateur, je veux voir en un coup d'œil si une MR est facile ou compliquée à relire, afin de
  choisir une MR adaptée au temps dont je dispose.
    - Priorité : Must
    - Complexité estimée : S
    - Dépendances : US-005

## 3. Règles de gestion

- **RG-006-01** : Calcul selon RG-G03, réalisé côté backend (fonction pure `domain/difficulty.calculator.ts`) au moment de la lecture (`GET /merge-requests`), avec les seuils courants des paramètres, de sorte qu'un changement de seuil (US-014) s'applique sans resynchronisation.
- **RG-006-02** : Cellule : carré 12 px de couleur (Easy `#2f8f4e`, Medium `#d98a1f`, Hard accent) + libellé (« Easy », « Medium », « Hard ») + méta « N f · M l » en 11 px gris (N fichiers, M lignes).
- **RG-006-03** : Tooltip de la cellule : « 34 fichiers modifiés · 1 240 lignes (+900 / −340) » (additions et suppressions détaillées).
- **RG-006-04** : Si les statistiques de diff ne sont pas disponibles (échec de récupération), la cellule affiche « ? » avec un tooltip « Statistiques indisponibles » et la MR est considérée `medium` pour le tri.
- **RG-006-05** : Ordre de tri (US-008) : easy < medium < hard.

## 4. Maquettes de référence

- Wireframes **1a** / **1b** — colonne « Difficulté » (`diffColor`, `diffLabel`, `diffMeta`)
- Prototype — `diffOf`, `DIFF`
- Wireframe **1c** — section `05 · Seuils` (pour les valeurs par défaut)

## 5. Critères d'acceptation

```gherkin
Scenario Outline: Calcul de la difficulté avec les seuils par défaut
  Given une MR avec <fichiers> fichiers et <lignes> lignes modifiés
  When la difficulté est calculée
  Then elle vaut <difficulte>

  Examples:
    | fichiers | lignes | difficulte |
    | 1        | 14     | easy       |
    | 4        | 99     | easy       |
    | 5        | 99     | medium     |
    | 4        | 100    | medium     |
    | 9        | 310    | medium     |
    | 20       | 800    | medium     |
    | 21       | 10     | hard       |
    | 2        | 801    | hard       |
    | 34       | 1240   | hard       |

Scenario: Rendu de la cellule
  Given une MR « hard » avec 34 fichiers et 1240 lignes
  Then la cellule affiche un carré rouge, « Hard » et « 34 f · 1240 l »

Scenario: Tooltip détaillé
  Given une MR avec 900 additions et 340 suppressions sur 34 fichiers
  When je survole la cellule Difficulté
  Then le tooltip indique « 34 fichiers modifiés · 1 240 lignes (+900 / −340) »

Scenario: Statistiques indisponibles
  Given une MR dont les statistiques de diff sont nulles
  Then la cellule affiche « ? » et le tooltip « Statistiques indisponibles »

Scenario: Champs API
  When j'appelle GET /api/v1/merge-requests
  Then chaque MR contient difficulty ∈ {easy, medium, hard}, changedFiles, additions, deletions, changedLines
```

## 6. Questions ouvertes

- QO-006-01 : Faut-il exclure certains fichiers du décompte (lockfiles, snapshots, fichiers générés) ? Hypothèse : non en v1 ; pourrait devenir un paramètre (liste de globs).

## 7. Hors périmètre

- Configuration des seuils (US-014)
- Pondération par type de fichier
