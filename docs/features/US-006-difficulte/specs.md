# US-006 — Difficulté de la MR

## 1. Reformulation

Chaque MR du tableau affiche un indicateur de difficulté de relecture (Easy / Medium / Hard), calculé à partir du
nombre de fichiers et de lignes modifiés (RG-G03), sous forme d'un jeton de couleur vert → orange → rouge avec un
libellé et un détail chiffré. Les seuils utilisés sont ceux, fixes, de RG-G03 : leur configuration par l'utilisateur
est le périmètre de US-014, pas de celle-ci.

## 2. User Stories

- **US-006** : En tant qu'utilisateur, je veux voir en un coup d'œil si une MR est facile ou compliquée à relire,
  afin de choisir une MR adaptée au temps dont je dispose.
    - Priorité : Must
    - Complexité estimée : S
    - Dépendances : US-005

## 3. Règles de gestion

- **RG-006-01** : Le calcul suit RG-G03, dans une fonction pure `domain/difficulty-calculator.ts`
  (`(files, lines, thresholds) → 'easy' | 'medium' | 'hard'`), appelée côté backend au moment de la lecture
  (`GET /merge-requests`) — pas au moment de la synchronisation — de sorte qu'un changement ultérieur de seuils
  (US-014) s'applique immédiatement, sans resynchronisation. Dans cette US, `thresholds` vaut toujours les valeurs
  par défaut de RG-G03 (`easyFiles=5, easyLines=100, hardFiles=20, hardLines=800`), passées par une constante
  exportée (`DEFAULT_DIFFICULTY_THRESHOLDS`) plutôt que lues en base : la table `settings` n'a aucune colonne de
  seuils tant que US-014 n'est pas livrée. US-014 changera l'appelant (lira les seuils en base), pas la fonction pure
  elle-même.
- **RG-006-02** *(pré-requis technique découvert en analyse — modifie un composant livré par US-004)* : le backend
  doit distinguer une MR dont les statistiques de diff sont réellement nulles (0 fichier modifié) d'une MR dont ces
  statistiques sont indisponibles (RG-006-05). Or `merge_requests.changed_files`/`additions`/`deletions` sont
  aujourd'hui des colonnes non-nullables, et `gitlab/mappers/map-graphql-merge-request.ts` (US-004) remplace
  silencieusement une absence de `diffStatsSummary` par `0` — les deux cas sont donc actuellement indiscernables en
  base. Cette US corrige ce mapper pour préserver `null` (au lieu de `?? 0`) et élargit la nullabilité de ces 3
  colonnes (nouvelle migration). Comportement de synchronisation (US-004) inchangé par ailleurs : ce correctif ne
  change que la valeur stockée dans ce cas limite, jamais rencontré en pratique avec l'API GitLab réelle mais
  jusqu'ici non représentable.
- **RG-006-03** : Cellule (colonne insérée entre Titre et 💬 dans le tableau existant, RG-005-02) : carré 12 px de
  couleur (Easy `#2f8f4e`, Medium `#d98a1f`, Hard — accent) + libellé (« Easy », « Medium », « Hard ») + méta
  « N f · M l » en 11 px gris (N fichiers, M lignes = additions + suppressions).
- **RG-006-04** : Tooltip de la cellule : « 34 fichiers modifiés · 1 240 lignes (+900 / −340) » — nombres formatés
  avec séparateur de milliers (espace, format français).
- **RG-006-05** : Si les statistiques de diff sont absentes (`changedFiles`/`additions`/`deletions` valent `null`,
  RG-006-02), la cellule affiche « ? » avec un tooltip « Statistiques indisponibles » ; le backend renvoie alors
  `difficulty: 'medium'` (valeur de repli pour un futur tri, US-008 — la fonction pure de RG-006-01 n'est pas
  appelée dans ce cas, c'est le service appelant qui applique ce repli).
- **RG-006-06** *(pour mémoire, non implémenté dans cette US)* : l'ordre de tri par difficulté (easy < medium <
  hard) sera implémenté par US-008, qui ajoutera le tri par clic sur une colonne ; cette US ne trie pas les MRs par
  difficulté.

## 4. Contrat API

`GET /api/v1/merge-requests` — `MergeRequestViewDto` étendu (US-005 en pose la base) avec :

```
{
  ...champs existants (US-005),
  difficulty: 'easy' | 'medium' | 'hard',
  changedFiles: number | null,
  additions: number | null,
  deletions: number | null,
  changedLines: number | null,   // additions + deletions, calculé, null si l'un des deux est null
}
```

## 5. Maquettes de référence

- Wireframes **1a** / **1b** — colonne « Difficulté » (`diffColor`, `diffLabel`, `diffMeta`)
- Prototype — `diffOf`, `DIFF`
- Wireframe **1c** — section `05 · Seuils` (valeurs par défaut, pour référence uniquement — pas d'écran construit
  dans cette US)
- `docs/tech/architecture-frontend.md` — `shared/difficulty-badge/` (déjà prévu)

## 6. Critères d'acceptation

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
  Given une MR « hard » avec 34 fichiers et 1240 lignes (900 additions, 340 suppressions)
  Then la cellule affiche un carré rouge, « Hard » et « 34 f · 1240 l »

Scenario: Tooltip détaillé
  Given une MR avec 900 additions et 340 suppressions sur 34 fichiers
  When je survole la cellule Difficulté
  Then le tooltip indique « 34 fichiers modifiés · 1 240 lignes (+900 / −340) »

Scenario: Statistiques indisponibles
  Given une MR synchronisée sans diffStatsSummary (changedFiles/additions/deletions null en base)
  When j'appelle GET /api/v1/merge-requests
  Then difficulty vaut "medium" et changedFiles/additions/deletions/changedLines valent null
  And la cellule affiche « ? » et le tooltip « Statistiques indisponibles »

Scenario: Distinction entre un vrai zéro et des statistiques indisponibles
  Given une MR avec 0 fichier, 0 addition, 0 suppression réellement synchronisés depuis GitLab
  When j'appelle GET /api/v1/merge-requests
  Then changedFiles vaut 0 (pas null) et difficulty vaut "easy"

Scenario: Champs API
  When j'appelle GET /api/v1/merge-requests
  Then chaque MR contient difficulty ∈ {easy, medium, hard}, changedFiles, additions, deletions, changedLines
```

## 7. Questions ouvertes

- QO-006-01 *(close)* : faut-il exclure certains fichiers du décompte (lockfiles, snapshots, fichiers générés) ?
  Non en v1 — pourrait devenir un paramètre (liste de globs) dans une itération future.

## 8. Hors périmètre

- Configuration des seuils par l'utilisateur (US-014) — les seuils restent les valeurs par défaut de RG-G03 dans
  cette US.
- Tri des MRs par difficulté (US-008).
- Pondération par type de fichier.
- Écran `05 · Seuils` des Paramètres (US-014).
