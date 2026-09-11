# US-012 — Colonnes redimensionnables et colonne « Date d'ouverture »

## 1. Reformulation

L'utilisateur peut ajuster la largeur de chaque colonne en faisant glisser le séparateur d'en-tête ; les largeurs sont
mémorisées dans le navigateur. Un menu « Colonnes » en fin d'en-tête permet d'afficher la colonne « Date d'ouverture »,
masquée par défaut.

## 2. User Stories

- **US-012** : En tant qu'utilisateur, je veux redimensionner les colonnes et afficher la date d'ouverture si besoin,
  afin d'adapter le tableau à mon écran et à mes besoins.
    - Priorité : Should
    - Complexité estimée : M
    - Dépendances : US-005, US-011

## 3. Règles de gestion

- **RG-012-01** : Chaque en-tête (sauf la dernière colonne « menu ») possède une poignée de redimensionnement sur son bord droit (zone de 6 px, curseur `col-resize`, trait 1 px visible au survol de l'en-tête). Le glisser modifie la largeur de la colonne en temps réel.
- **RG-012-02** : Largeur minimale par colonne : 40 px ; largeur maximale : 800 px. La colonne « Titre » est flexible : elle absorbe l'espace restant et n'a pas de poignée (sa largeur résulte des autres).
- **RG-012-03** : Les largeurs sont persistées dans `localStorage` sous la clé `mrboard.columns.v1` (`{ project: 80, author: 64, … }`) et restaurées au chargement ; elles ne sont pas dans l'URL.
- **RG-012-04** : Double-clic sur une poignée : rétablit la largeur initiale de la colonne (valeurs de RG-005-02). Un item « Réinitialiser les largeurs » dans le menu Colonnes rétablit toutes les largeurs.
- **RG-012-05** : Menu « Colonnes » (icône colonnes dans la dernière cellule d'en-tête, `mat-menu`) : titre « Colonnes », case à cocher « Date d'ouverture » (décochée par défaut), séparateur, « Réinitialiser les largeurs ».
- **RG-012-06** : La colonne « Ouverte » affiche `createdAt` au format `JJ/MM/AAAA`, tooltip avec l'heure ; elle est insérée entre « Depuis Ready » et le menu. Sa visibilité est propagée dans l'URL via `cols=opened` (RG-011-01).
- **RG-012-07** : Le redimensionnement est accessible au clavier : la poignée est focusable, flèches gauche/droite ajustent de 8 px (`aria-label` « Redimensionner la colonne <nom> »).
- **RG-012-08** : Le redimensionnement n'interfère pas avec le tri : un clic sur la poignée ne déclenche pas le tri de la colonne.

## 4. Maquettes de référence

- Wireframe **1a** — note de pied « poignées de redimensionnement sur chaque séparateur d'en-tête », style `th::after` (trait 1 px, `cursor: col-resize`), « Colonne masquée : Date d'ouverture »
- Prototype — menu `cols` avec case « Date d'ouverture », colonne « Ouverte » `showOpened`

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

Scenario: Afficher la date d'ouverture
  When j'ouvre le menu « Colonnes » et je coche « Date d'ouverture »
  Then la colonne « Ouverte » apparaît avec des dates au format JJ/MM/AAAA
  And l'URL contient « cols=opened »
  When je décoche
  Then la colonne disparaît et « cols » est retiré de l'URL

Scenario: Réinitialiser les largeurs
  Given plusieurs colonnes ont été redimensionnées
  When je choisis « Réinitialiser les largeurs »
  Then toutes les colonnes reprennent leur largeur initiale et localStorage est nettoyé

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
