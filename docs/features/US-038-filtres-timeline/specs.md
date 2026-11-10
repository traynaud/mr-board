# US-038 — Historique : filtres de la timeline

> Complète `docs/features/US-033-historique-modifications/specs.md` (§ US-038, RG-038-01 → 04) et s'appuie sur la page
> livrée par US-037. La maquette validée d'US-037 (« MR Board — page Historique ») contient déjà la barre de filtres
> (recherche, pastilles « Type » / « Acteur », « + Ajouter un filtre », « Effacer », état « aucun résultat »).

## 1. Reformulation

L'utilisateur veut restreindre la timeline de la page Historique à ce qui l'intéresse : une MR (recherche sur le titre
ou le numéro), un ou plusieurs types d'action, un ou plusieurs acteurs, un ou plusieurs projets, une période. Les
filtres se combinent, sont partagés par l'URL et sont appliqués par le serveur (la timeline est paginée : un filtre
côté client ne verrait que les pages déjà chargées).

La reformulation est la seule lecture raisonnable : RG-038-01 → 04 sont déjà arbitrées dans la spec de l'épique.
Ce document les précise.

## 2. User Story

- **US-038** : En tant que membre de l'équipe, je veux filtrer l'historique (MR, type d'action, acteur, projet,
  période), afin de retrouver rapidement un changement.
  - Priorité : Should — Complexité : M — Dépendances : US-037, US-011

## 3. Règles de Gestion

Références : RG-G14 (ET entre filtres, OU dans un filtre), RG-G15 (URL), RG-026-* (recherche), RG-037-* (timeline).

- **RG-038-01** *(épique)* — Filtres disponibles : **recherche** (titre / numéro de la MR), **Type** (multi), **Acteur**
  (multi), **Projet** (multi), **Période** (du / au). « Acteur » = acteur de l'événement, pas auteur de la MR.
- **RG-038-02** *(épique)* — ET entre filtres différents, OU entre les valeurs d'un même filtre. Un filtre actif sans
  valeur n'exclut rien (RG-G14).
- **RG-038-03** *(épique)* — Filtrage **côté serveur** ; l'état des filtres est reflété dans l'URL de `/history` et
  restauré au chargement (RG-G15).
- **RG-038-04** *(épique)* — Une valeur de paramètre inconnue ou mal formée est rejetée par l'API avec une **400**.
- **RG-038-05** — Recherche : mêmes règles que RG-026-02/03/04/05/08, appliquées au titre **instantané** de la
  MR stocké dans l'événement : termes séparés par des espaces, tous requis (ET), insensible à la casse et aux
  accents, saisie `!42` / `#42` / `42` retenant aussi les événements dont `mr_iid` vaut 42 (en OU avec le titre).
  Longueur maximale de la saisie : 100 caractères (comme RG-026). Anti-rebond de 300 ms (RG-026-09).
  ✅ Hypothèse retenue : l'insensibilité aux accents est assurée côté serveur (voir archi) ; si elle s'avérait trop
  coûteuse, repli sur casse seule documenté.
- **RG-038-06** — Type : les 18 types du catalogue (RG-033-03). Options affichées dans l'ordre et avec les libellés
  de `history.actions.*`. Pas de compteur par option (contrairement à RG-G19 : ✅ hypothèse, le coût d'un décompte
  par facette sur un journal paginé n'est pas justifié).
- **RG-038-07** — Acteur : la liste des options est la liste des **acteurs distincts présents dans l'historique**
  (clé = `username`, libellé = nom, à défaut `username`), triée par libellé, récupérée auprès du serveur (la liste
  chargée par la page ne suffit pas : elle est paginée). Une option **« Inconnu »** (valeur `none`) retient les
  événements sans acteur identifié (`actor_username` nul), sur le modèle de « Nobody » (RG-G13).
- **RG-038-08** — Projet : options = projets configurés (`ProjectsStore`), libellé = alias, pastille de couleur
  (RG-025). Filtre sur `project_id`. ✅ Hypothèse : un événement d'un projet supprimé n'est pas retrouvable par ce
  filtre (il reste visible sans filtre Projet).
- **RG-038-09** — Période : date de début et date de fin **incluses**, au jour calendaire **local** de
  l'utilisateur. Une seule borne est autorisée. Début > fin → l'API répond 400 ; l'interface empêche cette saisie
  (la borne opposée est bornée). Dans l'URL les bornes sont des dates `YYYY-MM-DD` ; le front les convertit en
  instants (début du jour local de début, début du lendemain local de la date de fin) pour interroger l'API.
- **RG-038-10** — Pagination : tout changement de filtre repart de la **première page** (curseur abandonné) ;
  « Charger plus » conserve les filtres courants. Une réponse arrivée après un changement de filtre ne doit jamais
  écraser la liste (la dernière requête gagne).
- **RG-038-11** — Compteur : `total` renvoyé par l'API est le nombre d'événements **correspondant aux filtres**.
  L'en-tête affiche ce total ; sans filtre le comportement d'US-037 est inchangé.
- **RG-038-12** — « Effacer » (visible dès qu'un filtre est actif) retire tous les filtres, recherche comprise.
  Retirer une pastille retire son filtre. Un filtre « Type / Acteur / Projet / Période » ajouté sans valeur
  n'est pas écrit dans l'URL ni envoyé à l'API et reste affiché tant que la page est ouverte.
- **RG-038-13** — État « aucun résultat » : si des filtres sont actifs et que la liste est vide, afficher
  « Aucun événement ne correspond aux filtres. » + bouton texte « Effacer les filtres » (distinct de l'état vide
  « Aucun événement pour le moment. » quand aucun filtre n'est actif).
- **RG-038-14** — URL : paramètres `q` (recherche), `type`, `actor`, `project` (listes séparées par des virgules),
  `from`, `to` (`YYYY-MM-DD`). Une valeur restaurée d'une URL n'est jamais « corrigée » côté interface : une valeur
  inconnue (acteur absent des options, type inexistant) est ignorée pour l'affichage des options mais, si elle
  provoque une 400 de l'API, la page affiche l'état d'erreur existant avec « Réessayer » + « Effacer les filtres ».
  ✅ Hypothèse retenue : le front écarte lui-même les types inconnus et les dates mal formées à la restauration.
- **RG-038-15** — Les filtres ne sont pas persistés hors de l'URL (pas de mémorisation entre sessions).

## 4. Maquettes de référence

- `docs/tech/US-037-page-historique/design.md` — maquette validée d'US-037 : barre de filtres de la page Historique
  (recherche, pastilles accent, « + Ajouter un filtre », « Effacer », état « aucun résultat »).
- `docs/design/` : wireframe du tableau (barre de filtres, pastilles, menu « + Ajouter un filtre ») — référence du
  comportement.

## 5. Critères d'Acceptation

```gherkin
Scenario: Filtrer par type d'action
  Given l'historique contient des événements approved, merged et commented
  When j'ajoute le filtre Type et sélectionne « Approuvée » et « Fusionnée »
  Then seuls les événements approved et merged sont listés (OU)
  And l'URL contient type=approved,merged
  And le compteur indique le nombre d'événements filtrés

Scenario: Combiner deux filtres
  Given le filtre Type = approved et le filtre Acteur = alice
  Then seuls les événements approved dont l'acteur est alice sont listés (ET)

Scenario: Acteur inconnu
  Given des événements sans acteur identifié
  When je sélectionne l'acteur « Inconnu »
  Then seuls les événements sans acteur sont listés

Scenario: Recherche accent-insensible multi-termes
  Given une MR « Réfacto de la facturation » et une MR « Corrige le login »
  When je saisis « refacto fact »
  Then seuls les événements de la MR « Réfacto de la facturation » sont listés

Scenario: Recherche par numéro
  When je saisis « !128 »
  Then les événements de la MR d'iid 128 sont listés, ainsi que ceux dont le titre contient « 128 »

Scenario: Période
  When je choisis du 2026-11-06 au 2026-11-08
  Then les événements du 6 novembre 00:00 (local) au 8 novembre 23:59 (local) inclus sont listés

Scenario: Période inversée
  When l'API reçoit from postérieur à to
  Then elle répond 400

Scenario: Paramètre inconnu
  When l'API reçoit type=inconnu
  Then elle répond 400 avec une clé d'erreur

Scenario: Changement de filtre pendant une pagination
  Given j'ai chargé 2 pages
  When je modifie un filtre
  Then la liste repart de la première page avec le nouveau filtre
  And une réponse tardive de l'ancien filtre est ignorée

Scenario: Charger plus conserve les filtres
  Given un filtre actif et plus de 50 résultats
  When je clique sur « Charger plus »
  Then la page suivante respecte les mêmes filtres

Scenario: Restauration depuis l'URL
  When j'ouvre /history?type=merged&actor=alice&q=login&from=2026-11-01
  Then les pastilles Type, Acteur, la recherche et la période sont affichées
  And la liste est filtrée

Scenario: Aucun résultat
  Given des filtres actifs sans correspondance
  Then j'affiche « Aucun événement ne correspond aux filtres. » et « Effacer les filtres »

Scenario: Effacer
  When je clique sur « Effacer »
  Then tous les filtres disparaissent, l'URL est nettoyée et la liste complète est rechargée

Scenario: Aucun filtre
  Given aucun filtre
  Then le comportement d'US-037 est inchangé (liste complète, état vide classique)
```

## 6. Décisions et points ouverts

#### 🛑 Bloquant — arbitrage humain requis
Aucun.

#### ✅ Hypothèses retenues (non bloquant, modifiable après coup)
- Période incluse bornes, jour local converti en instants par le front → évite d'exposer un fuseau à l'API.
- Option « Inconnu » pour l'acteur → sinon impossible d'isoler les événements sans acteur.
- Pas de compteur par option dans les menus de filtre → coût disproportionné sur un journal paginé.
- Options d'acteur issues d'un endpoint dédié (acteurs distincts de l'historique) → la liste chargée est paginée.
- Recherche accent-insensible côté serveur (RG-038-05).
- Filtre Projet limité aux projets configurés (RG-038-08).
- Pas de persistance des filtres hors URL (RG-038-15).

## 7. Hors périmètre

- Filtrer le panneau de notifications (US-039 → US-042).
- Filtres rapides (chips « Mes événements », etc.).
- Export de l'historique, tri différent du « plus récent d'abord ».
- Recherche sur le contenu des commentaires, sur l'ancienne / nouvelle valeur ou sur l'acteur en texte libre.
- Compteurs par option de filtre (RG-G19).
- Mémorisation des filtres entre sessions.

## Décisions
### Prises en autonomie
- Période / acteur « Inconnu » / compteurs / endpoint d'acteurs / recherche accent-insensible → voir §6 — justifications données — réversible : oui
- Maquette : couverte par la maquette validée d'US-037 (barre de filtres incluse) → pas de D9 — réversible : oui
### Arbitrées par l'humain
- Aucune
