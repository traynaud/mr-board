# US-021 — Forges dans le tableau (indicateur, infobulle, filtre « Connexion »)

Version : 1.1 — 2026-09-14 (relecture PO avant implémentation : intègre un correctif de conception sur l'écran
Paramètres, signalé en amont du développement — voir §0).
Fait partie de l'épique `docs/features/EPIC-001-multi-forges/README.md`.

## 0. Correctif de conception — repos rattachés à leur connexion dans l'UI (amende US-019)

**Constat** : le prototype a été mis à jour (commit `36cd4b4`, écran **2a**, postérieur à la rédaction initiale de
US-019) pour rattacher visuellement les repos à **leur** connexion : chaque connexion, dépliée, affiche son propre
tableau « Dépôts de cette connexion » avec sa ligne d'ajout. La section séparée « 03 · Repos à scanner » disparaît ;
elle est absorbée par « 02 · Connexions ». L'implémentation livrée par US-019 (RG-019-10/11/15, ✅) a gardé une
section « 03 · Repos à scanner » **globale**, avec un simple sélecteur « Connexion » dans sa ligne d'ajout — un écart
avec l'état actuel des maquettes que cette US corrige, conformément à la demande explicite de le faire à l'occasion
de US-021 et en prenant le prototype pour référence.

- **RG-021-00a** : La section `02 · Connexions` (RG-019-10) affiche, par connexion, une ligne **repliable** (icône
  de forge, nom, hôte de l'URL, nombre de repos en `tag-neutral`, état du jeton, chevron). Dépliée, elle montre :
  le formulaire de la connexion (RG-019-11, inchangé : type figé, nom, URL, jeton, test) **suivi** du tableau
  « Dépôts de cette connexion » (repos de **cette** connexion uniquement : chemin, alias éditable, supprimer, ligne
  d'ajout chemin + alias) et d'un lien « Supprimer cette connexion » en pied de carte. Une seule connexion dépliée à
  la fois (même règle qu'aujourd'hui pour le formulaire d'édition, RG-019-11). L'ajout d'une connexion (« + Ajouter
  une connexion ») ouvre une carte dépliée vide ; son tableau de repos n'apparaît qu'une fois la connexion créée
  (persistance immédiate, RG-019-12), et la carte **reste dépliée** après création pour enchaîner sur l'ajout des
  repos. Toutes les connexions sont repliées par défaut au chargement de l'écran Paramètres ; l'état déplié/replié
  n'est pas mémorisé entre deux visites.
- **RG-021-00b** : La section `03 · Repos à scanner` est **supprimée** : plus de tableau global multi-connexions, ni
  de sélecteur « Connexion » dans une ligne d'ajout partagée (RG-019-15 devient caduque). Chaque repo est ajouté /
  modifié / supprimé depuis le tableau de sa connexion (RG-021-00a). Le placeholder du champ chemin dépend du type
  de la connexion courante (inchangé). Une connexion sans jeton affiche son tableau de repos avec le message
  « Configurez d'abord le jeton de cette connexion » à la place de la ligne d'ajout (remplace la partie de RG-019-15
  sur ce cas ; le code d'erreur `connections.tokenMissing` est inchangé). Le cas « aucune connexion » ne se pose
  plus pour cette section puisqu'elle n'existe plus : le bandeau global du tableau (RG-019-17) reste la seule
  indication.
- **RG-021-00c** : Renumérotation des sections suivantes : `04 · Actualisation` → `03 · Actualisation`,
  `05 · Seuils` → `04 · Seuils`, `06 · Divers` → `05 · Divers`. Aucun changement de contenu pour ces trois sections.
  Clés i18n renumérotées en conséquence (`settings.refresh.number`, `settings.thresholds.number`,
  `settings.miscellaneous.number` : `"04"→"03"`, `"05"→"04"`, `"06"→"05"`) ; `settings.projects.*` est supprimé de
  `fr.json`/`en.json` et ses libellés réutilisables (en-têtes de colonnes repos, placeholders, messages d'erreur,
  dialog de suppression) migrent sous `settings.connections.*` (ex. `settings.connections.repos.pathHeader`).
  Parité `dictionary-parity.spec.ts` inchangée : suppression et ajout de clés faits simultanément dans les deux
  fichiers (RG-019-26).
- **RG-021-00d** : Comportement fonctionnel inchangé par ailleurs : unicité d'un repo par (`connectionId`,
  `pathWithNamespace`), alias unique globalement (RG-019-04), persistance immédiate de chaque ajout/suppression de
  repo (RG-003-10), toasts existants. Aucun changement d'API (`POST/PUT/DELETE /projects` déjà scopés par
  `connectionId`, RG-019-22) : le correctif est strictement une réorganisation de l'écran Paramètres.

### Maquette de référence du correctif

- Prototype, écran **2a** (`MR Board - Prototype.dc.html` / wireframe, commit `36cd4b4`) : liste de connexions,
  connexion repliée (GitLab équipe, 3 dépôts) vs dépliée (GitHub, formulaire + tableau « Dépôts de cette
  connexion »).

```gherkin
Scenario: Une connexion repliée affiche son nombre de repos
  Given une connexion « GitLab équipe » avec 3 repos, repliée
  Then sa ligne affiche « 3 dépôts » et aucun tableau de repos n'est visible

Scenario: Déplier une connexion affiche ses repos et seulement les siens
  Given deux connexions, chacune avec des repos différents
  When je déplie la première
  Then je vois son formulaire et un tableau listant uniquement ses propres repos
  And le tableau de la seconde connexion n'est pas visible

Scenario: Ajouter un repo depuis une connexion dépliée
  Given la connexion « GitHub » dépliée
  When je saisis « exemple-org/design-tokens » et l'alias « tokens » puis je valide
  Then POST /api/v1/projects est appelé avec connectionId = celui de « GitHub »
  And le nouveau repo apparaît dans le tableau de cette connexion, pas dans une liste globale

Scenario: Repos sur deux connexions distinctes ayant le même chemin
  Given « equipe/api » existe sur la connexion « gitlab.com »
  When j'ajoute « equipe/api » sur la connexion « gitlab.exemple.fr » avec l'alias « api-interne »
  Then l'ajout réussit (unicité par connexion, RG-019-04 inchangée)

Scenario: Connexion sans jeton
  Given une connexion « GitHub » sans jeton, dépliée
  Then son tableau de repos affiche « Configurez d'abord le jeton de cette connexion » à la place de la ligne d'ajout

Scenario: Plus de section « Repos à scanner » séparée
  When j'ouvre l'écran Paramètres
  Then je ne vois pas de section intitulée « Repos à scanner »
  And les sections suivantes sont numérotées « 03 · Actualisation », « 04 · Seuils », « 05 · Divers »
```

## 1. Reformulation

Quand plusieurs connexions alimentent le tableau, l'utilisateur doit pouvoir distinguer d'où vient chaque MR
(forge et connexion) sans que l'affichage ne se charge pour ceux qui n'ont qu'une seule source. Cette US ajoute une
icône de forge discrète sur le tag projet, une infobulle « connexion · chemin », un filtre composable « Connexion »
et des messages de synchronisation qui nomment la connexion en cause. Elle corrige aussi un écart entre les
maquettes et l'implémentation de US-019 sur le rattachement des repos à leur connexion dans l'écran Paramètres
(voir §0).

## 2. User Stories

- **US-021** : En tant que membre d'une équipe multi-forges, je veux distinguer et filtrer les MRs par connexion,
  afin de me concentrer sur une source quand j'en ai besoin et de comprendre d'où vient une MR.
    - Priorité : Should
    - Complexité estimée : S
    - Dépendances : US-020 (au moins deux types de forge possibles), US-010 (filtres composables), US-011 (URL)
- **US-021-bis** (correctif, §0) : En tant qu'utilisateur configurant plusieurs connexions, je veux gérer les repos
  d'une connexion directement depuis sa fiche, afin de ne pas avoir à chercher à quelle connexion appartient chaque
  repo dans une liste globale.
    - Priorité : Should (corrective, non fonctionnelle pour un utilisateur mono-connexion)
    - Complexité estimée : S
    - Dépendances : US-019 (amende RG-019-10/11/15)

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
- Wireframe **2a** — écran Paramètres, section « 02 · Connexions & dépôts » : connexion repliée avec compteur de
  dépôts, connexion dépliée avec formulaire + tableau « Dépôts de cette connexion » (référence du correctif §0)
- Wireframe **2b** — tableau multi-connexions : icône de forge sur le tag projet, infobulle, menu du filtre
  « Connexion », bandeau d'erreur nommant la connexion
- Prototype — menu « + Ajouter un filtre »

> ⚠️ **Écart avec les maquettes** : l'icône de forge dans le tag projet et le filtre « Connexion » (menu
> « + Ajouter un filtre ») n'y figurent pas explicitement au-delà du wireframe 2b. Ils réutilisent à l'identique le
> `.tag.tag-neutral` (icône 12 px + alias, espacement `--space-1`) et le pattern de filtre multi-sélection de
> US-010 ; à documenter dans `design.md` sans nouvelle maquette. Le correctif §0, lui, a désormais une maquette
> explicite (wireframe 2a) : elle doit être suivie à l'identique, ce n'est pas un écart.

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
- ~~QO-021-03~~ (correctif §0, tranchée) : une connexion nouvellement créée reste dépliée jusqu'à ce que
  l'utilisateur la replie ou en déplie une autre, pour permettre l'ajout des repos dans la foulée sans clic
  supplémentaire.
- ~~QO-021-04~~ (correctif §0, tranchée) : l'état déplié/replié n'est pas mémorisé ; toutes les connexions sont
  repliées par défaut au chargement de l'écran Paramètres (comme le formulaire d'édition aujourd'hui, RG-019-11).

## 7. Hors périmètre

- Colonne dédiée à la forge
- Tri par connexion
- Statistiques par forge
- Réorganisation de la section « 01 · Moi » (déjà par connexion depuis US-019, RG-019-08, inchangée)
- Désactivation temporaire d'une connexion (QO-019-02, toujours hors périmètre)
