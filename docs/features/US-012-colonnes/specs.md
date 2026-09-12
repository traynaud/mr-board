# US-012 — Colonnes redimensionnables

## 1. Reformulation

L'utilisateur peut ajuster la largeur de chaque colonne en faisant glisser le séparateur d'en-tête ; les largeurs
sont mémorisées dans le navigateur.

> ⚠️ **Recentrage par rapport à la roadmap initiale** : le menu « Colonnes », la case à cocher « Date d'ouverture »
> et la colonne « Ouverte » (avec sa propagation `cols=opened` dans l'URL) ont été anticipés et livrés dans **US-011**
> (RG-011-09/10/11, décision actée en Phase 1 de cette US, voir `docs/features/README.md`). US-012 ne couvre donc
> plus que le redimensionnement des colonnes et l'ajout de l'item « Réinitialiser les largeurs » au menu « Colonnes »
> déjà existant — RG-012-05/06 ci-dessous sont formulées en conséquence (elles ne recréent rien).

## 2. User Stories

- **US-012** : En tant qu'utilisateur, je veux redimensionner les colonnes du tableau, afin de l'adapter à mon écran
  et à mes besoins.
    - Priorité : Should
    - Complexité estimée : M
    - Dépendances : US-005, US-011

## 3. Règles de gestion

- **RG-012-01** : Chaque en-tête (sauf la dernière colonne « menu ») possède une poignée de redimensionnement sur son bord droit (zone de 6 px, curseur `col-resize`, trait 1 px visible au survol de l'en-tête). Le glisser modifie la largeur de la colonne en temps réel.
- **RG-012-02** : Largeur minimale par colonne : 40 px ; largeur maximale : 800 px. La colonne « Titre » est flexible : elle absorbe l'espace restant et n'a pas de poignée (sa largeur résulte des autres).
- **RG-012-03** : Les largeurs sont persistées dans `localStorage` sous la clé `mrboard.columns.v1` (`{ project: 80, author: 64, … }`) et restaurées au chargement ; elles ne sont pas dans l'URL.
- **RG-012-04** : Double-clic sur une poignée : rétablit la largeur initiale de la colonne (valeurs de RG-005-02). Un item « Réinitialiser les largeurs » dans le menu Colonnes rétablit toutes les largeurs.
- **RG-012-05** : Le menu « Colonnes » et sa case à cocher « Date d'ouverture » existent déjà (US-011, RG-011-09).
  Cette US y ajoute un séparateur puis un item « Réinitialiser les largeurs » (RG-012-04), sans toucher à l'état de
  la case à cocher ni à la visibilité de la colonne « Ouverte ».
- **RG-012-06** : La colonne « Ouverte » (déjà construite en US-011, RG-011-10) gagne un tooltip affichant la date et
  l'heure exactes de `createdAt`, au même format que le tooltip de la colonne « Depuis Ready »
  (`board.mergeRequests.ready.tooltip`, RG-007-04).
- **RG-012-07** : Le redimensionnement est accessible au clavier : la poignée est focusable, flèches gauche/droite ajustent de 8 px (`aria-label` « Redimensionner la colonne <nom> »).
- **RG-012-08** : Le redimensionnement n'interfère pas avec le tri : un clic sur la poignée ne déclenche pas le tri de la colonne.

## 4. Maquettes de référence

- Wireframe **1a** — note de pied « poignées de redimensionnement sur chaque séparateur d'en-tête », style `th::after` (trait 1 px, `cursor: col-resize`)
- Prototype — pas de redimensionnement dans le prototype de référence (menu `cols`/colonne `showOpened` déjà couverts par US-011) ; comportement de glisser-déposer et bornes min/max à interpréter selon RG-012-01/02

## 5. Critères d'acceptation

```gherkin
Scenario: Redimensionner une colonne
  Given la colonne « Projet » fait 80 px
  When je fais glisser sa poignée de 40 px vers la droite
  Then la colonne fait 120 px
  And localStorage « mrboard.columns.v1 » contient project: 120

Scenario: Restaurer les largeurs
  Given localStorage contient { project: 120 }
  When je recharge la page
  Then la colonne « Projet » fait 120 px

Scenario: Largeur minimale
  When je fais glisser la poignée de « Auteur » de 100 px vers la gauche
  Then la colonne fait 40 px

Scenario: Double-clic
  Given la colonne « Projet » fait 120 px
  When je double-clique sur sa poignée
  Then elle revient à 80 px

Scenario: Poignée sans tri
  Given la colonne « Difficulté » est triable
  When je clique sur sa poignée sans glisser
  Then le tri ne change pas

Scenario: Tooltip de la colonne Ouverte
  Given la colonne « Ouverte » est visible (menu « Colonnes », US-011)
  When je survole une date de la colonne « Ouverte »
  Then une infobulle affiche la date et l'heure exactes d'ouverture

Scenario: Réinitialiser les largeurs
  Given plusieurs colonnes ont été redimensionnées
  When je choisis « Réinitialiser les largeurs » dans le menu « Colonnes »
  Then toutes les colonnes reprennent leur largeur initiale et localStorage est nettoyé
  And la visibilité de la colonne « Ouverte » n'est pas affectée

Scenario: Redimensionnement clavier
  When je focalise la poignée de « Reviewer » et j'appuie sur Flèche droite 3 fois
  Then la colonne s'élargit de 24 px

Scenario: localStorage indisponible
  Given localStorage lève une exception
  Then le tableau fonctionne avec les largeurs initiales sans erreur visible
```

## 6. Questions ouvertes

- QO-012-01 : Faut-il permettre de masquer d'autres colonnes (ex : Commentaires) ? Hypothèse : non en v1, seule « Date d'ouverture » est optionnelle.
- QO-012-02 : Faut-il permettre de réordonner les colonnes ? Hypothèse : non.

## 7. Hors périmètre

- Réordonnancement des colonnes
- Largeurs partagées entre navigateurs / utilisateurs
