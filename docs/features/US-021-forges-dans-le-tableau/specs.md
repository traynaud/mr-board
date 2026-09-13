# US-021 — Forges dans le tableau (indicateur, infobulle, filtre « Connexion »)

Fait partie de l'épique `docs/features/EPIC-001-multi-forges/README.md`.

## 1. Reformulation

Quand plusieurs connexions alimentent le tableau, l'utilisateur doit pouvoir distinguer d'où vient chaque MR
(forge et connexion) sans que l'affichage ne se charge pour ceux qui n'ont qu'une seule source. Cette US ajoute une
icône de forge discrète sur le tag projet, une infobulle « connexion · chemin », un filtre composable « Connexion »
et des messages de synchronisation qui nomment la connexion en cause.

## 2. User Stories

- **US-021** : En tant que membre d'une équipe multi-forges, je veux distinguer et filtrer les MRs par connexion,
  afin de me concentrer sur une source quand j'en ai besoin et de comprendre d'où vient une MR.
    - Priorité : Should
    - Complexité estimée : S
    - Dépendances : US-020 (au moins deux types de forge possibles), US-010 (filtres composables), US-011 (URL)

## 3. Règles de gestion

- **RG-021-01** : Tag projet (RG-005-02) : si les connexions configurées comportent **au moins deux types de forge
  différents**, une icône Lucide (`gitlab` ou `github`, 12 px, `currentColor`) précède l'alias dans le tag. Avec un
  seul type (même sur plusieurs connexions), aucune icône : le tableau reste identique à aujourd'hui.
- **RG-021-02** : Infobulle du tag projet (`matTooltip`) : « <nom de la connexion> · <pathWithNamespace> » dès qu'il
  existe **au moins deux connexions** ; avec une seule, l'infobulle est « <pathWithNamespace> » (comportement
  actuel, RG-005-02 inchangée).
- **RG-021-03** : Nouveau filtre composable **« Connexion »** (RG-010-01 étendue), clé `connection`, multi-sélection,
  valeurs = noms des connexions, options avec compteurs (RG-G19), combinaison en OU entre valeurs et en ET avec les
  autres filtres (RG-G14). Il n'apparaît dans le menu « + Ajouter un filtre » (en première position, avant
  « Projet ») **que s'il existe au moins deux connexions** ; s'il était actif et qu'il ne reste qu'une connexion, il
  est retiré de l'URL et de la barre au chargement. Pastille : « Connexion : github.com, gitlab.com ».
- **RG-021-04** : URL (RG-G15, RG-011-01) : `connection=<noms CSV>` (noms encodés `encodeURIComponent`, virgules
  interdites dans un nom de connexion : RG-019-01 complétée — le nom ne peut contenir ni `,` ni `;`). Valeur inconnue
  → ignorée silencieusement (RG-011).
- **RG-021-05** : `GET /merge-requests` accepte `?connection=a,b` (filtre par nom, insensible à la casse) et
  `GET /merge-requests/facets` renvoie `connection: FacetOption[]` (RG-010-07). Le compteur global (RG-G20) est
  inchangé (« N MRs · M projets »).
- **RG-021-06** : Statut de synchronisation (RG-004-08) : quand le dernier run est `partial` ou `error`, l'infobulle
  du libellé « Dernière synchro en échec » liste les repos en échec **préfixés du nom de leur connexion**
  (« github.com/equipe/front-web : jeton refusé »). Le toast d'erreur de fin de synchro (RG-004-12) nomme la
  connexion : « Synchronisation partielle : jeton refusé (github.com) ».
- **RG-021-07** : Pied du tableau (README §4.1, zone 6) : inchangé. Aucune colonne « Forge » dédiée (voir QO-021-01).
- **RG-021-08** : Notifications navigateur (US-016) : le corps de la notification « Nouvelle MR assignée » inclut le
  nom de la connexion après l'alias quand il existe au moins deux connexions (« [github.com · front-web] Titre »).

## 4. Maquettes de référence

- Wireframe **1a** — tag projet (colonne Projet), barre de filtres
- Wireframe **1b** — pastille de filtre et menu multi-sélection (pattern réutilisé pour « Connexion »)
- Prototype — menu « + Ajouter un filtre »

> ⚠️ **Écart avec les maquettes** : l'icône de forge dans le tag projet et le filtre « Connexion » n'y figurent pas.
> Ils réutilisent à l'identique le `.tag.tag-neutral` (icône 12 px + alias, espacement `--space-1`) et le pattern
> de filtre multi-sélection de US-010 ; à documenter dans `design.md` sans nouvelle maquette.

## 5. Critères d'acceptation

```gherkin
Scenario: Un seul type de forge
  Given deux connexions GitLab et aucune GitHub
  When le tableau s'affiche
  Then les tags projet n'ont pas d'icône
  And leur infobulle est « <connexion> · <chemin> »

Scenario: Deux types de forge
  Given une connexion GitLab et une connexion GitHub
  When le tableau s'affiche
  Then chaque tag projet est précédé de l'icône de sa forge
  And l'infobulle est « github.com · equipe/front-web » pour un repo GitHub

Scenario: Une seule connexion
  Given une seule connexion
  Then aucune icône, infobulle = chemin seul, et « Connexion » absent du menu « + Ajouter un filtre »

Scenario: Filtrer par connexion
  Given deux connexions « gitlab.com » (5 MRs) et « github.com » (3 MRs)
  When j'ajoute le filtre « Connexion » et je coche « github.com »
  Then 3 MRs sont affichées, la pastille indique « Connexion : github.com »
  And l'URL contient connection=github.com
  And le menu affiche « gitlab.com 5 » et « github.com 3 » (RG-G19)

Scenario: Combinaison avec un autre filtre
  Given le filtre Connexion = github.com et le filtre Approved = oui
  Then seules les MRs GitHub approuvées sont affichées

Scenario: Restauration depuis l'URL
  When j'ouvre /?connection=github.com,gitlab.com
  Then la pastille « Connexion : github.com, gitlab.com » est active

Scenario: Connexion supprimée
  Given l'URL contient connection=github.com et il ne reste qu'une connexion
  When j'ouvre le tableau
  Then le filtre est retiré de la barre et de l'URL

Scenario: Nom avec caractères spéciaux
  Given une connexion nommée « GitLab interne (R&D) »
  When je filtre dessus
  Then l'URL contient connection=GitLab%20interne%20(R%26D) et la restauration fonctionne

Scenario: Erreur de synchro nommée
  Given le jeton de github.com est refusé
  When une synchronisation se termine
  Then le toast affiche « Synchronisation partielle : jeton refusé (github.com) »
  And l'infobulle du statut liste « github.com/equipe/front-web : jeton refusé »

Scenario: Facets
  When j'appelle GET /api/v1/merge-requests/facets
  Then la réponse contient connection = [{ value: « gitlab.com », label: « gitlab.com », count: 5 }, …]
```

## 6. Questions ouvertes

- **QO-021-01** : Faut-il une colonne optionnelle « Connexion » (menu « Colonnes ») plutôt que l'icône + infobulle ?
  Hypothèse : non, l'icône suffit et n'élargit pas le tableau.
- **QO-021-02** : Le filtre « Connexion » doit-il être proposé dès deux connexions du **même** type ? Hypothèse : oui
  (RG-021-03), car deux instances GitLab sont deux sources distinctes ; seule l'icône dépend du type.

## 7. Hors périmètre

- Colonne dédiée à la forge
- Tri par connexion
- Statistiques par forge
