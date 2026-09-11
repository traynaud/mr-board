# US-005 — Tableau des MRs : colonnes de base

## 1. Reformulation

L'écran principal affiche les MRs synchronisées sous forme de tableau. Cette US couvre la structure de la page, le
chargement des données et les colonnes « brutes » (Projet, Auteur, Draft + Titre, Commentaires, Reviewer, Affecté,
Approved, Date d'ouverture). Les colonnes calculées (Difficulté, Depuis Ready), le tri et les filtres font l'objet
des US suivantes ; en attendant, le tableau affiche toutes les MRs non-draft dans l'ordre par défaut (RG-G10).

## 2. User Stories

- **US-005** : En tant qu'utilisateur, je veux voir la liste des MRs ouvertes de mes projets dans un tableau lisible, afin
  d'avoir une vue d'ensemble de ce qui est en cours.
    - Priorité : Must
    - Complexité estimée : L
    - Dépendances : US-004

## 3. Règles de gestion

- **RG-005-01** : Le tableau est un `mat-table` alimenté par `GET /api/v1/merge-requests`. Par défaut (avant US-009), seules les MRs non-draft sont renvoyées, triées selon RG-G10.
- **RG-005-02** : Colonnes et contenus :
  | Colonne       | Contenu                                                                                                             | Largeur initiale |
  |---------------|---------------------------------------------------------------------------------------------------------------------|------------------|
  | Projet        | Tag neutre avec l'alias du repo                                                                                     | 80 px            |
  | Auteur        | Avatar/initiales de l'auteur (RG-G12), tooltip nom complet                                                          | 64 px            |
  | Titre         | Tag « Draft » (si draft) + titre tronqué, tooltip titre complet, lien vers GitLab (RG-G11)                          | flexible         |
  | Difficulté    | (US-006)                                                                                                            | 150 px           |
  | 💬            | Nombre de commentaires (RG-G08), en-tête = icône bulle avec tooltip « Commentaires »                                | 60 px            |
  | Reviewer      | Avatar/initiales du reviewer (bordure), « — » si aucun (RG-G06)                                                     | 84 px            |
  | Affecté       | Avatar/initiales de l'assignee (bordure), « — » si aucun (RG-G06)                                                   | 84 px            |
  | Approved      | Coche verte si approuvée (RG-G07), vide sinon                                                                       | 88 px            |
  | Depuis Ready  | (US-007)                                                                                                            | 130 px           |
  | Ouverte       | Date d'ouverture `JJ/MM/AAAA`, **masquée par défaut** (US-012)                                                      | 120 px           |
- **RG-005-03** : Une ligne draft est affichée à 72 % d'opacité avec le tag « Draft » devant le titre.
- **RG-005-04** : Le clic sur le titre ouvre `webUrl` de la MR dans le même onglet (option nouvel onglet : US-015). Le lien porte `rel="noopener"`.
- **RG-005-05** : Le survol d'une ligne colore son fond (`neutral-100`). Aucune sélection de ligne.
- **RG-005-06** : Chargement : pendant le premier chargement, un `mat-progress-bar` est affiché et le tableau est vide ; les chargements suivants (après synchro) se font sans vider le tableau.
- **RG-005-07** : Erreur de chargement (`GET /merge-requests` en échec) : toast « Impossible de charger les MRs. » et le tableau conserve les dernières données connues.
- **RG-005-08** : Le pied de page rappelle : « Drafts après les MRs ready, triés par date d'ouverture · « Mes MRs » = auteur, reviewer ou affecté ».
- **RG-005-09** : Le compteur « N MR(s) · M projet(s) » (RG-G20) est affiché à droite de la barre de filtres (barre réduite à ce compteur tant que US-009/010 ne sont pas livrées).
- **RG-005-10** : Le tableau a une largeur minimale de 860 px avec défilement horizontal du conteneur en dessous ; la page ne défile jamais horizontalement.
- **RG-005-11** : La réponse API (`MergeRequestView`, voir README §6) inclut déjà tous les champs calculés ; le frontend ne recalcule rien.

## 4. Maquettes de référence

- Wireframe **1a** — tableau par défaut (colonnes, avatars, tags, coche Approved, pied de page)
- Wireframe **1b** — lignes draft à opacité réduite avec tag « Draft », tooltip auteur
- Prototype — rendu des cellules (`rows`), état vide, toolbar
- `docs/tech/design-system.md` §4 (composants visuels)

## 5. Critères d'acceptation

```gherkin
Scenario: Affichage des MRs
  Given 7 MRs non-draft synchronisées sur les repos « api », « web », « infra »
  When j'ouvre le tableau
  Then 7 lignes sont affichées
  And le compteur indique « 7 MRs · 3 projets »
  And chaque ligne affiche l'alias du projet dans un tag, les initiales de l'auteur, le titre, le nombre de commentaires

Scenario: Tooltip auteur
  Given une MR de l'auteur « Karim Benali »
  When je survole l'avatar « KB »
  Then un tooltip « Karim Benali » s'affiche

Scenario: Avatar GitLab disponible
  Given l'auteur a un avatar_url
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

Scenario: Ligne draft
  Given une MR draft est renvoyée (les drafts sont affichés)
  Then la ligne a une opacité de 72 % et un tag « Draft » précède le titre

Scenario: Premier chargement
  When j'ouvre le tableau et que la requête est en cours
  Then une barre de progression est affichée et aucune ligne

Scenario: Erreur de chargement
  Given GET /api/v1/merge-requests répond 500
  When j'ouvre le tableau
  Then un toast « Impossible de charger les MRs. » s'affiche

Scenario: Contrat API
  When j'appelle GET /api/v1/merge-requests
  Then la réponse est 200 avec un tableau d'objets MergeRequestView
  And aucun objet ne contient de champ « token » ou d'entité brute
```

## 6. Questions ouvertes

- QO-005-01 : Faut-il afficher l'identifiant `!iid` de la MR (par ex. devant le titre) ? Hypothèse : non, disponible dans le tooltip du titre (« !412 · Titre »).
- QO-005-02 : Faut-il un lien vers le projet GitLab sur le tag Projet ? Hypothèse : non.

## 7. Hors périmètre

- Difficulté (US-006), Depuis Ready (US-007), tri (US-008), filtres (US-009/010), colonnes redimensionnables et colonne Ouverte (US-012)
- Détail d'une MR dans l'application
