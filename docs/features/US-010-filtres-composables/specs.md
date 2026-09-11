# US-010 — Filtres composables (Projet, Auteur, Affecté à, Approved, Commenté)

## 1. Reformulation

L'utilisateur ajoute à la barre de filtres des pastilles de filtre parmi Projet, Auteur, Affecté à, Approved et
Commenté. Chaque pastille ouvre un menu de sélection (multi-sélection avec compteurs pour Projet / Auteur / Affecté à,
Oui / Non pour Approved / Commenté) et peut être retirée. Un état vide propose d'effacer les filtres quand aucune MR ne
correspond.

## 2. User Stories

- **US-010** : En tant qu'utilisateur, je veux filtrer le tableau par projet, auteur, personne affectée, statut
  d'approbation et présence de commentaires, en ajoutant ou retirant des filtres, afin de cibler précisément les MRs
  qui m'intéressent.
    - Priorité : Must
    - Complexité estimée : L
    - Dépendances : US-009

## 3. Règles de gestion

- **RG-010-01** : Filtres disponibles et sémantique :
  | Filtre     | Type            | Options                                                    | Paramètre API             |
  |------------|-----------------|------------------------------------------------------------|---------------------------|
  | Projet     | multi-sélection | alias des repos configurés (`alias · chemin`)              | `project=api,web`         |
  | Auteur     | multi-sélection | utilisateurs auteurs d'au moins une MR ouverte             | `author=mdupont,kbenali`  |
  | Affecté à  | multi-sélection | « Nobody » + utilisateurs reviewer ou assignee d'au moins une MR ouverte | `assigned=nobody,mdupont` |
  | Approved   | booléen         | Oui / Non                                                  | `approved=1|0`            |
  | Commenté   | booléen         | Oui (≥ 1 commentaire) / Non (0)                            | `commented=1|0`           |
- **RG-010-02** : Combinaison : ET entre filtres, OU entre valeurs d'un même filtre (RG-G14). « Affecté à » applique RG-G13.
- **RG-010-03** : Bouton « + Ajouter un filtre » : menu listant les filtres non encore actifs ; un filtre déjà actif y apparaît grisé avec une coche. Le bouton est désactivé si tous les filtres sont actifs. Choisir un filtre crée sa pastille et ouvre immédiatement son menu.
- **RG-010-04** : Pastille : libellé « <Filtre> : <valeur> » où valeur = liste des sélections (initiales pour les utilisateurs, alias pour les projets, « Nobody », « Oui » / « Non »), « tous » si aucune sélection (multi) ou « — » (booléen). Chevron à droite (ouvre / ferme le menu), séparateur, croix (retire la pastille et son filtre). Bordure accent pleine quand le menu est ouvert.
- **RG-010-05** : Menu multi-sélection : titre uppercase (« Projet », « Auteur », « Affecté à (Reviewer OU Affecté) »), champ « Rechercher… » (filtre les options par nom, affiché si > 6 options), options avec case à cocher, libellé et compteur à droite (RG-G19). Le menu reste ouvert pendant les sélections ; clic à l'extérieur ou Échap ferme. « Nobody » est toujours la première option de « Affecté à ».
- **RG-010-06** : Menu booléen : deux options exclusives « Oui » / « Non » avec compteurs ; choisir une option ferme le menu ; re-cliquer l'option sélectionnée la désélectionne (valeur « — »).
- **RG-010-07** : Les options et compteurs proviennent de `GET /merge-requests/facets?<filtres courants>` qui renvoie, pour chaque filtre, ses options avec le nombre de MRs correspondantes en appliquant tous les autres filtres actifs (y compris `drafts`, `mine`). Recalculé à chaque changement de filtre.
- **RG-010-08** : Les options « Auteur » et « Affecté à » sont triées par nom complet ; « Projet » par alias ; les options avec un compteur à 0 restent visibles mais grisées.
- **RG-010-09** : Une valeur sélectionnée qui n'existe plus (utilisateur disparu, alias renommé) est retirée silencieusement de la sélection au prochain chargement.
- **RG-010-10** : État vide : quand la réponse est vide et qu'au moins un filtre (hors Drafts) est actif, une ligne unique « Aucune MR ne correspond aux filtres. » avec bouton « Effacer les filtres » remplace le corps du tableau. Sans filtre actif et sans MR : « Aucune MR ouverte » (sans bouton).
- **RG-010-11** : « Effacer » (RG-009-05) retire toutes les pastilles.
- **RG-010-12** : Validation API : valeurs inconnues pour `approved` / `commented` → 400 ; alias / usernames inconnus pour les listes → ignorés (pas d'erreur).
- **RG-010-13** : Accessibilité : les menus sont des `mat-menu` navigables au clavier ; la croix de pastille a un `aria-label` « Retirer le filtre <nom> ».

## 4. Maquettes de référence

- Wireframe **1a** — pastilles « Projet : api, web » et « Affecté à : Nobody », bouton « Ajouter un filtre », compteur, « Effacer »
- Wireframe **1b** — menu « Affecté à » ouvert (recherche, Nobody coché, compteurs), menu « Ajouter un filtre » ouvert (Affecté à et Approved grisés cochés, Commenté survolé), pastille « Approved : Non »
- Prototype — `pills`, `optsFor`, `addOpts`, `count`, état vide `noRows`

## 5. Critères d'acceptation

```gherkin
Scenario: Ajouter un filtre Projet
  Given aucune pastille n'est active
  When je clique sur « Ajouter un filtre » puis « Projet »
  Then une pastille « Projet : tous » apparaît et son menu s'ouvre avec les alias « api · equipe/backend-api », « web · equipe/front-web », « infra · plateforme/infra-terraform » et leurs compteurs
  When je coche « api » et « web »
  Then la pastille affiche « Projet : api, web »
  And GET /api/v1/merge-requests?…&project=api,web est appelé
  And seules les MRs de api et web sont affichées

Scenario: Filtre Affecté à avec Nobody
  Given 3 MRs sans reviewer ni assignee et 4 MRs où mdupont est reviewer ou assignee
  When j'active « Affecté à » et je coche « Nobody » et « Marie Dupont »
  Then 7 lignes sont affichées
  And la pastille affiche « Affecté à : Nobody, MD »

Scenario: Affecté à en OU sur reviewer et assignee
  Given une MR où kbenali est reviewer et personne n'est assignee
  And une MR où personne n'est reviewer et kbenali est assignee
  When je filtre « Affecté à : Karim Benali »
  Then les deux MRs sont affichées

Scenario: Filtre Approved
  When j'active « Approved » et je choisis « Non »
  Then le menu se ferme, la pastille affiche « Approved : Non »
  And seules les MRs non approuvées sont affichées
  When je rouvre le menu et je reclique « Non »
  Then la pastille affiche « Approved : — » et le filtre n'exclut plus rien

Scenario: Filtre Commenté
  When j'active « Commenté » et je choisis « Oui »
  Then seules les MRs avec au moins 1 commentaire sont affichées

Scenario: Compteurs contextuels
  Given « Projet : api » est actif et 5 MRs de api dont 2 sans reviewer ni assignee
  When j'ouvre le menu « Affecté à »
  Then « Nobody » affiche le compteur 2
  And le compteur de « api » dans le menu « Projet » ne tient pas compte du filtre Projet lui-même

Scenario: Combinaison de filtres
  Given « Projet : api » et « Approved : Oui » et « Mes MRs » sont actifs
  Then seules les MRs de api, approuvées, où j'ai un rôle sont affichées

Scenario: Retirer une pastille
  Given « Projet : api, web » est actif
  When je clique sur la croix de la pastille
  Then la pastille disparaît, le filtre Projet n'est plus appliqué
  And « Projet » redevient sélectionnable dans « Ajouter un filtre »

Scenario: Tous les filtres actifs
  Given les 5 filtres ont une pastille
  Then le bouton « Ajouter un filtre » est désactivé

Scenario: Recherche dans le menu
  Given le menu « Auteur » a 8 options
  When je saisis « rou » dans « Rechercher… »
  Then seule « Léa Rousseau » est listée

Scenario: État vide avec filtres
  Given « Auteur : Tom Girard » et « Approved : Oui » ne correspondent à aucune MR
  Then le tableau affiche « Aucune MR ne correspond aux filtres. » et un bouton « Effacer les filtres »
  When je clique sur ce bouton
  Then toutes les pastilles sont retirées et les MRs réapparaissent

Scenario: Valeur inconnue
  When j'appelle GET /api/v1/merge-requests?approved=maybe
  Then l'API répond 400
  When j'appelle GET /api/v1/merge-requests?project=inconnu
  Then l'API répond 200 avec une liste vide

Scenario: Facets
  When j'appelle GET /api/v1/merge-requests/facets?drafts=0&project=api
  Then la réponse contient project[], author[], assigned[] (avec nobody en premier), approved{yes,no}, commented{yes,no}, chaque option ayant value, label, count
```

## 6. Questions ouvertes

- QO-010-01 : Les options « Auteur » / « Affecté à » doivent-elles lister tous les utilisateurs connus ou seulement ceux présents dans les MRs actuellement ouvertes ? Hypothèse : présents dans les MRs ouvertes (compteurs pertinents).
- QO-010-02 : Faut-il mémoriser les filtres par défaut de l'utilisateur (ex : toujours « Projet : api ») ? Hypothèse : couvert par l'URL (US-011) et les favoris du navigateur.

## 7. Hors périmètre

- Propagation dans l'URL (US-011)
- Filtres sur la difficulté, le délai, les labels
- Filtres sauvegardés
