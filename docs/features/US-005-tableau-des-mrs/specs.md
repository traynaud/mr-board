# US-005 — Tableau des MRs : colonnes de base

## 1. Reformulation

L'écran Tableau affiche enfin les MRs synchronisées : chargement des données, structure de la page, et un premier
sous-ensemble de colonnes directement disponibles à partir de ce que US-004 a synchronisé (auteur, titre, reviewer,
affecté, commentaires, approbation). Les MRs draft ne sont pas retournées par cette US (elles le seront par US-009,
qui introduit le bouton « + Drafts ») ; les colonnes calculées (Difficulté, Depuis Ready) et la colonne « Ouverte »
n'existent pas encore (US-006, US-007, US-012). Le tri est celui, non paramétrable, de RG-G10 appliqué au seul bloc
Ready (US-008 ajoutera le tri par clic sur une colonne).

## 2. User Stories

- **US-005** : En tant qu'utilisateur, je veux voir la liste des MRs ouvertes (non draft) de mes projets dans un
  tableau lisible, afin d'avoir une vue d'ensemble de ce qui est en cours.
    - Priorité : Must
    - Complexité estimée : L
    - Dépendances : US-004

## 3. Règles de gestion

### Récupération et périmètre

- **RG-005-01** : `GET /api/v1/merge-requests` renvoie les MRs non-draft (RG-G02) des projets actifs (RG-G01),
  triées par `ready_at` croissant (RG-G10, bloc Ready — le bloc Drafts de RG-G10 ne s'applique pas puisque
  l'endpoint ne renvoie aucun draft dans cette US). Aucun paramètre de requête dans cette US (pas de filtre, pas de
  tri alternatif) — ils arriveront avec US-009/US-010. Pas de pagination (RG-G01 borne le volume aux MRs ouvertes ;
  voir `architecture-backend.md`).
- **RG-005-02** : Colonnes affichées par cette US (les autres colonnes du wireframe ne sont **pas** construites,
  voir §7 Hors périmètre) :

  | Colonne  | Contenu                                                                                      | Largeur initiale |
  |----------|-----------------------------------------------------------------------------------------------|------------------|
  | Projet   | Tag neutre avec l'alias du repo                                                                | 80 px            |
  | Auteur   | Avatar/initiales de l'auteur, style plein (RG-G12), tooltip nom complet                        | 64 px            |
  | Titre    | Titre tronqué sur une ligne avec ellipse, tooltip = titre complet, lien vers `webUrl` (RG-G11)  | flexible         |
  | 💬       | Nombre de commentaires (RG-G08) ; en-tête = icône bulle (`message-square`) + tooltip « Commentaires » | 60 px      |
  | Reviewer | Avatar/initiales du premier reviewer, style contour (RG-G12) ; « +N » et tooltip listant tous les reviewers si plusieurs (RG-G06) ; « — » si aucun | 84 px |
  | Affecté  | Idem Reviewer, pour les assignees                                                              | 84 px            |
  | Approved | Icône coche verte si `approved` (RG-G07), cellule vide sinon                                   | 88 px            |

- **RG-005-03** : Le clic sur le titre ouvre `webUrl` dans le même onglet (option nouvel onglet : US-015) ; le lien
  porte `rel="noopener"`.
- **RG-005-04** : Le survol d'une ligne colore son fond (`--color-neutral-100`). Aucune sélection de ligne.

### Chargement et rafraîchissement

- **RG-005-05** : Au premier chargement de l'écran, une `mat-progress-bar` est affichée et aucune ligne n'apparaît
  tant que la réponse n'est pas arrivée. Les chargements suivants ne vident jamais le tableau existant avant que les
  nouvelles données soient prêtes (pas de flash vide).
- **RG-005-06** : La liste est rechargée automatiquement chaque fois qu'une synchronisation se termine — c'est-à-dire
  à la même transition (`SyncStore.running` `true → false`) que celle déjà utilisée par le toast d'erreur de US-004
  — en plus du chargement initial à l'ouverture de l'écran. Il n'y a pas de polling dédié aux MRs elles-mêmes : le
  déclencheur est toujours une synchronisation (manuelle via « Rafraîchir », ou automatique via RG-004-15).
- **RG-005-07** : Si `GET /merge-requests` échoue, un toast « Impossible de charger les MRs. » s'affiche et le
  tableau conserve les dernières données connues (pas de vidage sur erreur).
- **RG-005-08** : Avec un jeton et au moins un repo configurés (donc ni bandeau RG-004-10 ni état vide RG-004-11),
  si la liste renvoyée est vide, un état vide neutre « Aucune MR ouverte. » est affiché à la place du tableau — texte
  distinct de celui, orienté filtres, de US-010 (RG-G01 : pas de MR ouverte à afficher n'est pas une erreur).
- **RG-005-09** : Le compteur « N MR(s) · M projet(s) » (RG-G20) est affiché à droite d'une barre de filtres réduite
  à ce seul compteur tant que US-009/US-010 ne sont pas livrées.
- **RG-005-10** : Le tableau a une largeur minimale de 860 px avec défilement horizontal cantonné à son conteneur ;
  la page elle-même ne défile jamais horizontalement. Cette largeur est celle du wireframe complet (10 colonnes) :
  avec les 7 colonnes de cette US, l'espace excédentaire revient à la colonne Titre (flexible) plutôt que d'être
  retiré, pour éviter un réajustement de mise en page quand US-006/007/012 ajouteront leurs colonnes.

### Contrat de données

- **RG-005-11** : Le DTO `GET /merge-requests` de cette US est volontairement minimal : il ne contient que les
  champs nécessaires aux 7 colonnes ci-dessus (voir §4). Il ne contient ni `draft`, ni `difficulty`, ni `readyAt`/
  `readyDays`/`readyLevel`, ni `changedFiles`/`changedLines`, ni `labels`, ni `isMine` — ces champs seront ajoutés
  au DTO par les US qui les affichent (US-006, US-007, US-009, US-015). `ready_at` est utilisé côté backend pour le
  tri (RG-005-01) sans être exposé dans la réponse.

## 4. Contrat API

| Méthode | Route | Query | Réponse | Codes |
|---------|-------|-------|---------|-------|
| GET | `/api/v1/merge-requests` | — | `MergeRequestViewDto[]` | 200 |

`MergeRequestViewDto` :

```
{
  id: number,               // id interne, sert de track-by
  projectAlias: string,
  iid: number,
  title: string,
  webUrl: string,
  author: { username: string, name: string, avatarUrl: string | null },
  reviewers: { username: string, name: string, avatarUrl: string | null }[],
  assignees: { username: string, name: string, avatarUrl: string | null }[],
  approved: boolean,
  commentsCount: number,
}
```

Aucun champ « token » ni entité TypeORM brute. Tri déjà appliqué par le backend (RG-005-01) ; le frontend affiche
la liste dans l'ordre reçu, sans re-trier.

## 5. Maquettes de référence

- Wireframe **1a** — structure générale du tableau, avatars, tag Projet, coche Approved, largeur des colonnes.
  **Cette US construit un sous-ensemble** des colonnes visibles sur cette maquette : Projet, Auteur, Titre, 💬,
  Reviewer, Affecté, Approved. Les colonnes Difficulté, Depuis Ready et Ouverte visibles sur le wireframe n'existent
  pas tant que US-006/US-007/US-012 ne sont pas livrées (elles ne sont pas non plus construites en tant que colonnes
  vides/placeholder — voir §7).
- Prototype — rendu des lignes (`rows`), toolbar, structure générale (le bandeau sans-jeton, l'état vide sans-repo et
  la toolbar de synchronisation sont déjà livrés par US-004 et ne sont pas repris ici).
- `docs/tech/design-system.md` §4 (composants visuels : tags, avatars, icônes).

## 6. Critères d'acceptation

```gherkin
Scenario: Affichage des MRs
  Given 7 MRs non-draft synchronisées sur les repos « api », « web », « infra »
  When j'ouvre le tableau
  Then 7 lignes sont affichées
  And le compteur indique « 7 MRs · 3 projets »
  And chaque ligne affiche l'alias du projet dans un tag, les initiales de l'auteur, le titre, le nombre de commentaires

Scenario: Tri par défaut par date Ready
  Given 3 MRs avec des dates ready_at différentes
  When j'ouvre le tableau
  Then les lignes sont dans l'ordre croissant de ready_at (la plus ancienne en haut)

Scenario: Tooltip auteur
  Given une MR de l'auteur « Karim Benali »
  When je survole l'avatar « KB »
  Then un tooltip « Karim Benali » s'affiche

Scenario: Avatar GitLab disponible
  Given l'auteur a un avatarUrl
  Then l'image est affichée en 28 px carré à la place des initiales, avec le même tooltip

Scenario: Titre tronqué et lien
  Given une MR au titre de 120 caractères et d'URL https://gitlab.exemple.fr/equipe/backend-api/-/merge_requests/412
  Then le titre est affiché sur une ligne avec ellipse
  And le survol affiche le titre complet
  When je clique sur le titre
  Then la page GitLab de la MR s'ouvre dans le même onglet

Scenario: Reviewer et affecté vides
  Given une MR sans reviewer ni assignee
  Then les cellules Reviewer et Affecté affichent « — »

Scenario: Plusieurs reviewers
  Given une MR avec les reviewers « Marie Dupont » puis « Tom Girard »
  Then la cellule Reviewer affiche « MD » et « +1 »
  And le tooltip liste « Marie Dupont, Tom Girard »

Scenario: MR approuvée
  Given une MR avec au moins une approbation
  Then la cellule Approved affiche une coche verte
  Given une MR sans approbation
  Then la cellule Approved est vide

Scenario: Premier chargement
  When j'ouvre le tableau et que la requête est en cours
  Then une barre de progression est affichée et aucune ligne

Scenario: Rechargements suivants sans effacement
  Given le tableau affiche déjà 5 MRs
  When une nouvelle synchronisation se termine et que GET /merge-requests est relancé
  Then les 5 lignes restent visibles jusqu'à ce que la nouvelle réponse arrive, sans état de chargement vidant le tableau

Scenario: Rechargement automatique après une synchronisation
  Given le tableau est affiché avec 3 MRs
  When une synchronisation se termine (running passe de true à false) et que GitLab renvoie désormais 4 MRs
  Then GET /merge-requests est rappelé automatiquement et le tableau affiche 4 lignes, sans action de l'utilisateur

Scenario: Erreur de chargement
  Given GET /api/v1/merge-requests répond 500
  When j'ouvre le tableau
  Then un toast « Impossible de charger les MRs. » s'affiche

Scenario: Aucune MR malgré repos et jeton configurés
  Given un jeton et un repo sont configurés, GitLab ne renvoie aucune MR ouverte non-draft
  When j'ouvre le tableau
  Then un état vide « Aucune MR ouverte. » est affiché à la place du tableau
  And ni le bandeau sans-jeton ni l'état vide sans-repo (US-004) ne sont affichés

Scenario: Contrat API
  When j'appelle GET /api/v1/merge-requests
  Then la réponse est 200 avec un tableau de MergeRequestViewDto
  And aucun objet ne contient de champ « token », de champ hors périmètre (draft, difficulty, readyAt…) ni d'entité brute
```

## 7. Questions ouvertes

- QO-005-01 *(close)* : faut-il afficher l'`iid` de la MR (par ex. dans le tooltip du titre) ? Non retenu — le
  tooltip du titre reste le titre complet seul (RG-005-02), cohérent avec la sobriété du reste du design. `iid` est
  tout de même inclus dans le DTO (§4) car nécessaire à une future navigation ou un futur identifiant de ligne.
- QO-005-02 *(close)* : faut-il un lien vers le projet GitLab sur le tag Projet ? Non retenu.

## 8. Hors périmètre

- **Colonnes Difficulté (US-006), Depuis Ready (US-007) et Ouverte (US-012)** : non construites du tout dans cette
  US (ni en colonne pleine, ni en colonne vide/placeholder) — elles apparaîtront quand leur US respective sera
  livrée.
- **Affichage des MRs draft** (tag « Draft », opacité 72 %, tri du bloc Drafts de RG-G10) : différé à US-009, qui
  introduit le bouton « + Drafts » et le paramètre de requête correspondant sur `GET /merge-requests`.
- **Pied de page** (rappel des règles drafts / Mes MRs) : différé à US-009, pour ne pas afficher un texte faisant
  référence à des comportements (drafts affichés, Mes MRs) qui n'existent pas encore dans l'application.
- Tri par clic sur une colonne (US-008), filtres (US-009/US-010), propagation dans l'URL (US-011), colonnes
  redimensionnables et menu de colonnes (US-012).
- Détail d'une MR dans l'application ; toute action d'écriture sur GitLab.
