# US-032 — Filtre rapide « À relire »

## 1. Reformulation

Les MRs que personne n'a encore prises en charge (aucun relecteur désigné, aucun commentaire) sont celles qui
risquent de stagner. On ajoute un chip « À relire » (« To review » en anglais) à la barre de filtres, à côté de
« Drafts », « Mes MRs » et « Favoris », qui ne garde que ces MRs « orphelines ». Il se cumule librement avec les
autres filtres rapides et composables.

## 2. User Story

- **US-032** : En tant que membre de l'équipe, je veux n'afficher que les MRs qui n'ont ni relecteur ni commentaire,
  afin de repérer en un clic celles qui attendent encore quelqu'un pour les relire.
    - Priorité : Should
    - Complexité estimée : S
    - Dépendances : US-009 (filtres rapides), US-010 (facets/compteurs), US-011 (état dans l'URL), US-027 (précédent : chip rapide « Favoris »)

## 3. Règles de Gestion

- **RG-032-01** — Définition : une MR est « à relire » si `reviewers` est vide **ET** `commentsCount = 0`
  (RG-G08 : notes utilisateur, hors notes système). Les deux conditions sont obligatoires (ET). Les assignees, les
  approbations, le statut de mergeabilité et le draft n'entrent pas dans la définition.
- **RG-032-02** — Chip : « À relire » (fr) / « To review » (en), `mat-chip-option` identique à « Drafts »,
  « Mes MRs » et « Favoris » (US-009, RG-027-10), toujours visible, désélectionné par défaut, sans compteur propre.
  Ordre dans la barre : Drafts, Mes MRs, Favoris, À relire (le nouveau chip en dernier).
- **RG-032-03** — Combinaison : le filtre se combine en ET avec « Drafts », « Mes MRs », « Favoris » et tous les
  filtres composables (RG-G14), et alimente les compteurs de facets (RG-G19) et le compteur global (RG-G20) comme
  n'importe quel filtre.
- **RG-032-04** — Drafts : le filtre ne contourne pas la règle d'affichage des drafts (RG-009-01) ; un draft sans
  relecteur ni commentaire n'apparaît que si « Drafts » est aussi actif.
- **RG-032-05** — Labels ignorés : une MR masquée par un label ignoré (RG-015-02) reste masquée.
- **RG-032-06** — Paramètre API : `toReview=0|1` sur `GET /merge-requests` et `GET /merge-requests/facets`
  (même validation que `fav`/`mine` : valeur inconnue → 400). Le filtrage est fait côté serveur, comme les autres.
- **RG-032-07** — URL : reflété dans l'URL sous `toReview=1` (RG-G15), restauré au chargement.
- **RG-032-08** — « Effacer » désélectionne le chip (comme « Mes MRs » et « Favoris », contrairement à « Drafts » :
  RG-009-05, RG-027-11). Le bouton « Effacer » est affiché si le chip est actif.
- **RG-032-09** — État vide : si le chip est actif et que rien ne correspond, l'état vide de RG-010-10
  (« Aucune MR ne correspond aux filtres. » + « Effacer les filtres ») s'applique.
- **RG-032-10** — i18n : clé de libellé ajoutée dans `fr.json` (« À relire ») et `en.json` (« To review »), aucun
  texte en dur (RG-022).
- **RG-032-11** — Tri inchangé (RG-G10). Pas d'impact sur Export/Import de configuration (le filtre n'est pas une
  préférence persistée) ni sur le badge d'onglet / notifications (US-016).

## 4. Maquettes de référence

Aucune maquette ne couvre ce chip (nouveauté postérieure aux wireframes). Il reprend le style des chips de la zone 4
des wireframes 1a/1b (`mat-chip-option`, cf. « Drafts », « Mes MRs »), sans icône ou avec une icône Lucide
discrète si cohérent avec « Mes MRs » (à trancher à l'architecture).

## 5. Critères d'Acceptation

```gherkin
Scenario: Seules les MRs sans relecteur ni commentaire sont retenues
  Given 4 MRs Ready : A (0 reviewer, 0 commentaire), B (1 reviewer, 0 commentaire), C (0 reviewer, 2 commentaires), D (2 reviewers, 3 commentaires)
  When j'active le chip "À relire"
  Then seule la MR A est affichée
  And le compteur indique "1 MR"

Scenario: Un assignee ne compte pas comme relecteur
  Given une MR avec 1 assignee, 0 reviewer, 0 commentaire
  When j'active le chip "À relire"
  Then cette MR est affichée

Scenario: Une MR approuvée sans relecteur ni commentaire est retenue
  Given une MR approuvée, 0 reviewer, 0 commentaire
  When j'active le chip "À relire"
  Then cette MR est affichée

Scenario: Les notes système ne comptent pas comme commentaires
  Given une MR avec 0 reviewer et uniquement des notes système (user_notes_count = 0)
  When j'active le chip "À relire"
  Then cette MR est affichée

Scenario: Cumul avec "Mes MRs"
  Given les chips "Mes MRs" et "À relire" sont actifs
  Then seules les MRs dont je suis auteur ou assignee, sans reviewer ni commentaire, sont affichées

Scenario: Cumul avec "Drafts"
  Given un draft sans reviewer ni commentaire
  When j'active "À relire" seul
  Then le draft n'apparaît pas
  When j'active aussi "Drafts"
  Then le draft apparaît après les MRs Ready

Scenario: Cumul avec un filtre composable
  Given le chip "À relire" actif et le filtre "Projet : api" actif
  Then seules les MRs de api sans reviewer ni commentaire sont affichées
  And les compteurs des options du menu "Projet" tiennent compte de "À relire"

Scenario: Propagation dans l'URL
  Given le chip "À relire" est actif
  Then l'URL contient toReview=1
  When je recharge la page avec cette URL
  Then le chip est toujours actif et le tableau reste restreint

Scenario: Effacer
  Given les chips "À relire" et "Drafts" sont actifs
  When je clique sur "Effacer"
  Then "À relire" est désélectionné
  And "Drafts" reste sélectionné

Scenario: Libellé en anglais
  Given la langue est "en"
  Then le chip s'intitule "To review"

Scenario: Aucune MR à relire
  Given toutes les MRs ont au moins un reviewer ou un commentaire
  When j'active le chip "À relire"
  Then l'état vide "Aucune MR ne correspond aux filtres." est affiché avec "Effacer les filtres"

Scenario: Valeur d'API invalide
  When j'appelle GET /api/v1/merge-requests?toReview=2
  Then la réponse est 400
```

## 6. Questions ouvertes

- **QO-032-01** : « dans la liste des filtres partagés » — j'interprète cela comme la zone des **filtres rapides**
  (chips en tête de barre, comme Favoris), vu que le filtre doit se « cumuler avec les filtres rapides existants ».
  *Hypothèse retenue* : chip rapide (RG-032-02). Alternative : une pastille composable dans le menu
  « + Ajouter un filtre » (Oui / Non). À confirmer.
- **QO-032-02** : « aucun relecteur » = `reviewers` vide uniquement (hypothèse, RG-032-01), ou faut-il aussi exclure
  les MRs ayant un assignee ? *Hypothèse retenue* : l'assignee ne compte pas (sur GitLab c'est souvent l'auteur).
- **QO-032-03** : une MR **approuvée** sans commentaire ni reviewer doit-elle rester « à relire » ? *Hypothèse
  retenue* : oui (RG-032-01), l'approbation n'entre pas dans la définition.
- **QO-032-04** : sur GitHub, `commentsCount` inclut-il les commentaires de revue en ligne ? À vérifier à
  l'architecture ; la règle reste « RG-G08 tel que déjà calculé par MR Board ».

## 7. Hors périmètre

- Chip avec compteur propre (« À relire · 3 »).
- Notification/badge spécifique aux MRs à relire.
- Persistance du filtre dans les préférences / export de configuration.
- Tri spécifique (les MRs à relire ne remontent pas en tête).
- Pastille composable dans « + Ajouter un filtre » (cf. QO-032-01).
