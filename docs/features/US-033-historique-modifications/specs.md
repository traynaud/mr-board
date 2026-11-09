# US-033 → US-038 — Historique des modifications

> **Statut : specs arbitrées (2026-11-09).** Les trois arbitrages ouverts à l'issue de l'étude de faisabilité sont
> rendus (section 8). Les notifications liées à l'historique restent **hors périmètre** (itération suivante).

## 1. Reformulation

À chaque synchronisation, MR Board compare l'état reçu de la forge à l'état précédent. Toute différence sur une MR
crée un événement d'historique **provisoire** (acteur inconnu, date = synchro) et place la MR dans une **file
asynchrone** où chaque MR figure au plus une fois. Un worker traite la file : il interroge la forge pour cette MR,
récupère **ce qui s'est réellement passé** (qui a fait quoi, quand, les commentaires…) et crée ou met à jour les
événements correspondants (acteur et date exacts, statut « confirmé »). Les MRs qui disparaissent du tableau
(fusionnées, fermées, introuvables) suivent le même chemin : la file va chercher leur sort réel par identifiant.
Une page « Historique » affiche une timeline filtrable ; une rétention (60 j / 5 000 événements par défaut, réglable
dans les Paramètres) borne la taille du journal.

**Ma reformulation est-elle la seule lecture raisonnable ?** Oui — le besoin et les arbitrages lèvent les ambiguïtés.

## 2. Étude de faisabilité (synthèse, validée)

### 2.1 SQLite — **adapté**
- Volume : jusqu'à ~100 000 lignes sans difficulté avec index ; plafond par défaut 5 000.
- Un seul écrivain (RG-G16) : cohérent avec SQLite ; la file asynchrone est elle-même une table SQLite
  (persistante au redémarrage) avec contrainte d'unicité, ce qui garantit « une MR = une seule entrée ».
- Valeurs ancienne/nouvelle en JSON texte (comme `labels`). Pagination par curseur `(occurred_at, id)`.
- Nouvelles tables uniquement (pas de ALTER sur `merge_requests`, coûteux en SQLite) ; `settings` gagne deux colonnes.

### 2.2 Clé étrangère vers `merge_requests` — **à éviter**
`deleteMissing` supprime physiquement les MRs absentes ; les tables de liaison sont en `ON DELETE CASCADE`. Une FK
détruirait l'événement « fusionnée / fermée » au moment où il se produit ; une MR rouverte reçoit un nouvel `id`.
→ Tables `merge_request_events` et `history_queue` **sans FK vers `merge_requests` ni `users`** ; identifiant
logique `(project_id, mr_iid)` + instantané dénormalisé (titre, URL, alias projet, acteur). Seule FK :
`project_id → projects ON DELETE CASCADE` (historique et file supprimés avec le projet, arbitrage n°3).

### 2.3 Performance
- Comparaison : état précédent déjà en base, lu en une requête par projet avant l'upsert ; fonction pure `domain/`.
- Appels forge déplacés **hors** de la synchro, dans la file : la synchro n'est jamais ralentie ni mise en échec par
  l'enrichissement. Parallélisme limité, respect du 429 (RG-004-13), reprise au prochain passage.
- Dédoublonnage : N changements sur la même MR avant traitement = 1 seule requête forge.
- Limite structurelle : la comparaison ne voit que l'état net entre deux synchros ; c'est précisément ce que la file
  corrige en récupérant les événements réels côté forge.

### 2.4 Source de vérité côté forge (à chiffrer par l'architecte sur les API réelles)
- **GitLab** : notes système de la MR (titre, draft, relecteurs, affectés, approbations), *resource events*
  (état, labels), notes utilisateur (commentaires) ; MR par `iid` pour `merged_by` / `closed_by` / dates.
- **GitHub** : timeline de la PR (renommage, ready for review, review demandée, labels, merged, closed) +
  commentaires. Passage obligatoire par le contrat `ForgeClient` (US-020) : nouvelle méthode de récupération des
  événements d'une MR.

### 2.5 Risques
| Risque | Mitigation |
|---|---|
| Doublons entre événement provisoire (comparaison) et événement forge | Clé d'appariement `(project_id, mr_iid, type, sujet, new_value)` + identifiant d'événement forge unique (`source_event_id`) |
| Faux « created » à la 1re synchro d'un projet | Baseline silencieuse (RG-033-05) |
| Réouverture vue comme une création | Consultation du journal par `(project_id, iid)` → `reopened` |
| File qui grossit (projet très actif, forge lente) | Une entrée par MR, tentatives bornées, repli après échecs (RG-034-07) |
| Perte de la file au redémarrage | File persistée en base |
| Commentaires = contenu potentiellement sensible | Extrait tronqué (RG-034-05), purgé avec la rétention |

## 3. User Stories

- **US-033** : En tant que membre de l'équipe, je veux que MR Board détecte et enregistre à chaque synchronisation
  les modifications des MRs, afin qu'aucun changement ne passe inaperçu.
  - Priorité : Must — Complexité : L — Dépendances : US-004, US-019, US-020
- **US-034** : En tant que membre de l'équipe, je veux que chaque MR modifiée soit enrichie en arrière-plan avec ce
  qui s'est réellement passé (qui, quand, commentaires), afin d'avoir un historique fiable sans ralentir le rafraîchissement.
  - Priorité : Must — Complexité : L — Dépendances : US-033
- **US-035** : En tant que membre de l'équipe, je veux connaître le sort exact d'une MR qui disparaît du tableau
  (fusionnée, fermée, introuvable), son auteur et sa date, afin de comprendre pourquoi elle n'est plus là.
  - Priorité : Must — Complexité : M — Dépendances : US-034
- **US-036** : En tant qu'administrateur de l'instance, je veux régler la rétention de l'historique (jours et nombre
  maximum d'événements), afin de maîtriser la taille de la base.
  - Priorité : Must — Complexité : S — Dépendances : US-033, US-015
- **US-037** : En tant que membre de l'équipe, je veux une page « Historique » en timeline (du plus récent au plus
  ancien), afin de parcourir les changements.
  - Priorité : Must — Complexité : L — Dépendances : US-033 (maquette requise : nouvel écran, **D9**)
- **US-038** : En tant que membre de l'équipe, je veux filtrer l'historique (MR, type d'action, acteur, dates,
  projet…), afin de retrouver rapidement un changement.
  - Priorité : Should — Complexité : M — Dépendances : US-037, US-011
- *(Notifications : itération ultérieure.)*

## 4. Règles de Gestion

### US-033 — Détection et journal
- **RG-033-01** — Un événement est créé quand la comparaison entre l'état stocké et l'état reçu révèle une
  différence sur un champ du catalogue (RG-033-03). Aucun événement si rien n'a changé.
- **RG-033-02** — Champs d'un événement : `id`, `occurred_at`, `detected_at`, `type`, `status`
  (`provisional` | `confirmed`), `source_event_id` (nullable, unique par `(connection_id, source_event_id)`),
  `connection_id`, `project_id`, `mr_iid`, titre de la MR (instantané), URL de la MR, alias du projet (instantané),
  acteur (username, nom, avatar — nullables), `old_value`, `new_value` (JSON texte, nullables). Pas de FK vers
  `merge_requests` ni `users`.
- **RG-033-03** *(arbitré)* — Catalogue : `created`, `title_changed`, `marked_draft`, `marked_ready`, `approved`,
  `approval_removed`, `reviewer_added`, `reviewer_removed`, `assignee_added`, `assignee_removed`, `label_added`,
  `label_removed`, `commented`, `merged`, `closed`, `reopened`, `deleted` (MR introuvable), `disappeared` (repli,
  RG-034-07). **Exclus** : pushs / nouveaux commits, pipeline et statut de mergeabilité, statistiques de diff,
  `ready_at`, favoris.
- **RG-033-04** — Un événement par changement atomique (un relecteur ajouté = un événement ; deux labels ajoutés =
  deux événements ; un commentaire = un événement).
- **RG-033-05** — Baseline : la première synchronisation d'un projet (ou après réactivation) n'émet aucun
  événement. Le curseur d'événements forge de chaque MR est initialisé par US-034 (RG-034-04) à la date de la baseline ou de la première détection : pas de rattrapage du passé.
- **RG-033-06** — Atomicité : les événements provisoires et les mises en file d'un projet sont écrits dans la même
  transaction que l'upsert des MRs. Une synchro de projet en erreur n'écrit rien.
- **RG-033-07** — Un événement provisoire a `actor = null`, `occurred_at = detected_at = heure de la synchro`.
- **RG-033-08** — Ne sont pas déclencheurs de journalisation : changements purement calculés (pipeline, mergeabilité),
  diff, `ready_at`. Une hausse de `commentsCount` (RG-G08) **est** un déclencheur de mise en file (RG-034-01).
- **RG-033-09** — Événements enregistrés pour toutes les MRs synchronisées, y compris celles masquées par un label
  ignoré (RG-015-02) ; le masquage est appliqué à l'affichage. ✅ hypothèse.

### US-034 — File asynchrone et enrichissement
- **RG-034-01** — Déclencheurs de mise en file d'une MR : toute différence du catalogue, une hausse du nombre de
  commentaires, ou la disparition de la MR (RG-035-01).
- **RG-034-02** — Unicité : la file contient **au plus une entrée par `(project_id, mr_iid)`** (contrainte
  d'unicité). Un nouveau déclencheur sur une MR déjà en file **actualise** l'entrée existante (date de dernière
  demande, tentatives remises à zéro) sans en créer une seconde ; l'entrée n'est traitée qu'une fois pour
  l'ensemble des déclencheurs reçus avant son traitement.
- **RG-034-03** — La file est persistée en base (survit au redémarrage) et traitée hors du cycle de synchro, par
  un worker : parallélisme limité (✅ hypothèse : 2), ordre FIFO sur la date de dernière demande, pause quand la
  forge répond 429 (RG-004-13), aucune interférence avec le bouton « Rafraîchir » (RG-G16).
- **RG-034-04** — Traitement d'une entrée : récupérer via `ForgeClient` les événements de la MR **postérieurs au
  curseur** (qui a fait quoi, quand, commentaires) ; pour chacun : s'il existe un événement provisoire
  correspondant (RG-034-06) → le **mettre à jour** (acteur, date exacte, `status = confirmed`,
  `source_event_id`) ; sinon → le **créer** `confirmed` ; l'idempotence est garantie par `source_event_id`. Puis
  avancer le curseur et supprimer l'entrée de la file.
- **RG-034-04b** *(précisé à l'implémentation)* — Fenêtre : `since` = synchronisation précédente de la MR − 5 min
  (MR nouvelle : sa date de création), conservée au plus ancien tant que l'entrée attend. `created` est confirmé
  dès la détection (acteur = auteur de la MR, date = date de création, sans appel forge). Titre côté GitLab : le texte
  de la forge ne donne pas les valeurs → appariement sur le seul type, valeurs provisoires conservées.
- **RG-034-05** — Commentaires : un événement `commented` par commentaire utilisateur (hors notes système),
  `new_value` = extrait tronqué à 200 caractères, acteur et date exacts. Les modifications et suppressions de
  commentaires ne sont pas suivies. ✅ hypothèse sur l'extrait (réversible : ne stocker aucun contenu).
- **RG-034-06** — Appariement provisoire ↔ forge : même `(project_id, mr_iid, type, sujet)` et même `new_value`
  (ex. même relecteur ajouté, même titre). Les événements provisoires sans correspondance forge après traitement
  restent `provisional` (acteur « Inconnu » affiché).
- **RG-034-07** — Échec (réseau, 5xx, 429) : nouvelle tentative avec attente croissante, **5 tentatives maximum**
  (✅ hypothèse) ; l'entrée est ensuite abandonnée, les événements provisoires restent tels quels. Pour une
  disparition (US-035), un événement de repli `disappeared` est alors créé. Un échec ne fait jamais échouer une
  synchro.
- **RG-034-08** — Aucun jeton ni secret n'est écrit dans la file ni dans le journal ; le jeton est relu depuis la
  connexion au moment du traitement. Si la connexion est supprimée, ses entrées le sont aussi (cascade projet).

### US-035 — Clôtures, fusions, 404
- **RG-035-01** — Une MR présente en base et absente de la réponse d'un projet synchronisé **avec succès** est
  supprimée du tableau comme aujourd'hui (RG-G01 inchangée) **et** mise en file avec son identité logique
  (`project_id`, `iid`, instantané du titre/URL) — la ligne `merge_requests` n'est plus nécessaire au traitement.
- **RG-035-02** — Traitement : requête forge **par `iid`** → état `merged` → événement `merged` ; `closed` →
  `closed` ; introuvable (404 / MR supprimée) → `deleted` ; encore `opened` → aucun événement (anomalie de
  pagination, la MR reviendra à la synchro suivante).
- **RG-035-03** — L'événement porte `old_value = opened`, `new_value` = nouvel état, acteur (`merged_by` /
  `closed_by`) et date exacte (`merged_at` / `closed_at`) fournis par la forge.
- **RG-035-04** — Aucun événement ni mise en file quand la disparition vient de la désactivation ou de la
  suppression du projet / de la connexion.
- **RG-035-05** — Réouverture : si une MR réapparaît ouverte et que son dernier événement connu est
  `merged` / `closed`, l'événement est `reopened` (pas `created`).

### US-036 — Rétention
- **RG-036-01** — Deux réglages dans `settings` : `history_retention_days` (défaut **60**) et `history_max_events`
  (défaut **5 000**), dans une section « Historique » des Paramètres.
- **RG-036-02** *(arbitré)* — Les deux limites s'appliquent **cumulativement** : est supprimé tout événement plus
  vieux que la limite en jours **ou** au-delà des N plus récents.
- **RG-036-03** — Bornes : jours 1–365, événements 100–100 000 ; hors bornes → 400, réglage inchangé.
- **RG-036-04** — Purge à la fin de chaque synchro et à l'enregistrement des réglages ; un échec de purge est un
  avertissement logué, pas une erreur de synchro.
- **RG-036-05** *(arbitré)* — La suppression d'un projet ou d'une connexion supprime son historique et sa file
  (cascade). La désactivation d'un projet conserve l'historique.
- **RG-036-06** — Le « reset » des Paramètres (US-015) ne vide pas l'historique. ✅ hypothèse.

### US-037 — Page Historique
- **RG-037-01** — Route dédiée, accessible depuis la navigation principale ; timeline du plus récent au plus
  ancien, groupée par jour ✅ hypothèse.
- **RG-037-02** — Chaque entrée : acteur (avatar/initiales, RG-G12), type, MR (lien forge, RG-G11), projet
  (couleur RG-025), date relative + date exacte au survol, ancienne → nouvelle valeur, extrait pour un commentaire.
- **RG-037-03** — Chargement paginé par curseur (50 par page ✅ hypothèse), « Charger plus ».
- **RG-037-04** — États : chargement, vide, erreur ; textes en clés i18n (fr/en, US-022).
- **RG-037-05** — Acteur inconnu affiché « Inconnu » (avatar neutre) ; un événement `provisional` en attente
  d'enrichissement n'est pas distingué visuellement ✅ hypothèse.

### US-038 — Filtres
- **RG-038-01** — Filtres : recherche texte (titre de la MR, cohérent US-026), type d'action (multi), acteur
  (multi), projet (multi), période (de / à). ✅ « auteur » = **acteur de l'événement**.
- **RG-038-02** — ET entre filtres, OU au sein d'un même filtre (RG-G14).
- **RG-038-03** — Filtres reflétés dans l'URL (RG-G15), filtrage côté serveur.
- **RG-038-04** — Valeur de paramètre inconnue → 400 (comme `fav` / `toReview`).

## 5. Maquettes de référence

Aucune maquette de l'historique dans `docs/design/` : la page Historique (nouvel écran, nouvelle entrée de
navigation, timeline) et la section « Historique » des Paramètres sont à concevoir par l'agent `ux-ui.md`
(**D9**, validation visuelle systématique). À réutiliser : filtres du tableau, avatar / initiales, pastille projet,
sections de la page Paramètres.

## 6. Critères d'Acceptation

```gherkin
Scenario: Renommage détecté puis confirmé
  Given la MR !12 s'intitule "Fix login"
  When la synchronisation reçoit "Fix login redirect"
  Then un événement title_changed provisoire est créé (acteur inconnu, date de la synchro)
  And la MR !12 est placée dans la file
  When le worker traite la MR !12 et la forge indique que "alice" a renommé la MR à 10:42
  Then l'événement est mis à jour : acteur "alice", date 10:42, statut confirmé

Scenario: Une MR n'apparaît qu'une fois dans la file
  Given la MR !12 est déjà dans la file
  When une synchronisation détecte un nouveau changement sur la MR !12
  Then la file contient toujours une seule entrée pour la MR !12
  And cette entrée est actualisée

Scenario: Un seul appel forge pour plusieurs changements
  Given trois changements détectés sur la MR !12 avant traitement
  When le worker traite la file
  Then la forge est interrogée une seule fois pour la MR !12
  And les trois événements sont mis à jour

Scenario: Nouveau commentaire
  Given la MR !12 compte 2 commentaires
  When la synchronisation reçoit 3 commentaires
  Then la MR est mise en file
  And après traitement un événement commented existe avec l'auteur, la date et l'extrait du commentaire

Scenario: Événement forge sans événement provisoire
  Given la forge rapporte une approbation par "bob" que la comparaison n'avait pas vue (deux changements entre deux synchros)
  When le worker traite la MR
  Then un événement approved confirmé est créé pour "bob"

Scenario: Traitement idempotent
  When la même MR est traitée deux fois et la forge renvoie les mêmes événements
  Then aucun doublon n'est créé

Scenario: Aucune différence, aucun événement
  Given une MR inchangée
  When une synchronisation s'exécute
  Then aucun événement n'est créé et la MR n'est pas mise en file

Scenario: Première synchronisation d'un projet
  Given un projet vient d'être ajouté
  When la première synchronisation importe 40 MRs
  Then aucun événement ni entrée de file n'est créé

Scenario: Fusion d'une MR qui disparaît
  Given la MR !12 est absente de la réponse du projet
  When la synchronisation s'exécute
  Then la MR disparaît du tableau et est mise en file
  And après traitement, la forge indique qu'elle est fusionnée par "bob" le 2026-11-10 à 14:03
  And un événement merged daté 2026-11-10 14:03, acteur "bob", est consultable

Scenario: Fermeture
  Given la forge indique que la MR !12 est fermée par "carol"
  When la file est traitée
  Then un événement closed est créé avec l'acteur "carol" et la date exacte

Scenario: MR introuvable (404)
  Given la MR !12 disparaît et la forge répond 404
  When la file est traitée
  Then un événement deleted est créé avec l'acteur inconnu

Scenario: Forge injoignable pendant le traitement
  Given la forge ne répond pas
  When le worker échoue 5 fois sur la MR !12 disparue
  Then un événement de repli disappeared est créé
  And les synchronisations n'ont jamais échoué à cause de la file

Scenario: Reprise après redémarrage
  Given des MRs sont en file et l'application redémarre
  When elle redémarre
  Then les entrées sont toujours en file et sont traitées

Scenario: Projet désactivé
  Given le projet "api" est désactivé
  When la synchronisation s'exécute
  Then aucune mise en file ni événement de clôture n'est créé pour ses MRs

Scenario: Réouverture
  Given la MR !12 a un événement closed
  When elle réapparaît ouverte
  Then un événement reopened est créé (et non created)

Scenario: Rétention cumulative
  Given history_retention_days = 60 et history_max_events = 5000
  When la purge s'exécute avec 5 010 événements dont un de 61 jours
  Then l'événement de 61 jours est supprimé
  And les événements au-delà des 5 000 plus récents sont supprimés

Scenario: Réglage hors bornes
  When l'utilisateur enregistre history_max_events = 5
  Then l'API répond 400 et le réglage n'est pas modifié

Scenario: Suppression d'un projet
  When l'utilisateur supprime le projet "api"
  Then son historique et ses entrées de file sont supprimés

Scenario: Timeline
  Given des événements du 8, 9 et 10 novembre
  When j'ouvre la page Historique
  Then ils sont listés du plus récent au plus ancien, groupés par jour

Scenario: Filtre combiné
  Given des événements de types variés sur deux projets
  When je filtre sur le type "approved" et le projet "api"
  Then seuls les événements approved du projet "api" sont affichés
  And l'URL reflète ces filtres

Scenario: Historique vide
  Given aucun événement
  When j'ouvre la page Historique
  Then l'état vide s'affiche
```

## 7. Hors périmètre

- Notifications (navigateur, badge) basées sur l'historique.
- Pushs / nouveaux commits, pipelines et statut de mergeabilité.
- Modification ou suppression d'un commentaire (suivi du contenu).
- Reconstitution des modifications antérieures à l'activation de la fonctionnalité.
- Export / import du journal ; rétention par projet ; recherche plein texte dans les valeurs.
- Indicateur visuel d'événements « en attente d'enrichissement » et supervision de la file dans l'UI.

## 8. Décisions et points ouverts

#### 🛑 Bloquant — arbitrage humain requis
- Aucun.

#### ✅ Hypothèses retenues (non bloquant, modifiables après coup)
- Table dédiée sans FK vers `merge_requests` / `users`, instantané dénormalisé (2.2).
- Événements provisoires créés immédiatement par la comparaison, puis mis à jour par le worker (conforme à la demande « crée / met à jour »).
- File persistée en base, unique par `(project_id, mr_iid)`, parallélisme 2, 5 tentatives avec attente croissante.
- Commentaires : extrait de 200 caractères stocké (réversible : ne stocker aucun contenu si jugé sensible).
- Baseline silencieuse à la 1re synchro ; pas de rattrapage du passé.
- Un événement par changement atomique ; MRs masquées par label ignoré journalisées.
- « Nom » = titre de la MR ; « auteur » = acteur ; filtres dans l'URL ; pagination par curseur (50).
- « Administration » = page Paramètres existante (instance mono-utilisateur, RG-G18).
- Le « reset » des Paramètres ne vide pas l'historique ; la désactivation d'un projet conserve son historique.
- Page Historique, navigation et section Paramètres : relèvent de l'UX/UI (**D9**).

## Décisions
### Prises en autonomie
- Pas de FK vers `merge_requests` → tables autonomes avec instantané — suppression physique des MRs — réversible : oui avant livraison
- Événement provisoire + enrichissement par la file → conserve toute modification même si la forge échoue — réversible : oui
- Extrait de commentaire de 200 caractères → utilité de la timeline vs sensibilité — réversible : oui
- Parallélisme 2 et 5 tentatives → valeurs prudentes — réversible : oui
- Découpage en 6 US (033–038) → livraisons indépendantes, notifications exclues — réversible : oui
- Aucune modification du roadmap `README.md` à ce stade — réversible : oui
### Arbitrées par l'humain
- Acteur et date exacte → **B** : enrichissement forge via une file asynchrone, une seule entrée par MR, actualisée à chaque nouvel événement ; la synchro d'une MR récupère les événements réels (qui, quoi, commentaires) et crée / met à jour les événements d'historique
- Catalogue → commentaires et 404 (`deleted`) **ajoutés** ; pushs et pipelines **exclus**
- Rétention → plafonds cumulatifs, historique supprimé avec le projet / la connexion, plafond par défaut **5 000** (recommandation validée)
