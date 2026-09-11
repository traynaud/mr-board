# US-016 — Notifications navigateur et badge d'onglet

## 1. Reformulation

Quand une MR m'est nouvellement affectée (reviewer ou assignee), le navigateur affiche une notification. Le titre de
l'onglet porte un badge avec le nombre de MRs Ready en rouge (délai critique) parmi les MRs visibles, pour surveiller
le tableau sans le regarder.

## 2. User Stories

- **US-016** : En tant qu'utilisateur, je veux être notifié quand une MR m'est affectée et voir dans l'onglet combien de
  MRs sont critiques, afin de réagir sans surveiller le tableau en permanence.
    - Priorité : Could
    - Complexité estimée : M
    - Dépendances : US-009, US-013

## 3. Règles de gestion

- **RG-016-01** : `notifyAssigned` (défaut `false`) : après chaque rechargement de la liste (US-013), le frontend compare avec la liste précédente : toute MR où je deviens reviewer ou assignee (RG-G09) alors que je ne l'étais pas (ou MR nouvelle) déclenche une `Notification` navigateur « MR Board — <alias> !<iid> » / « <titre> » ; le clic ouvre la MR sur GitLab.
- **RG-016-02** : L'activation de la case demande la permission `Notification.requestPermission()` ; si refusée, la case reste décochée et un message « Notifications bloquées par le navigateur » s'affiche sous la case. Si l'API n'existe pas, la case est désactivée.
- **RG-016-03** : Aucune notification n'est émise au premier chargement d'une session ni pour les drafts. Au plus une notification par MR et par changement d'affectation.
- **RG-016-04** : `tabBadge` (défaut `false`) : le titre de l'onglet devient « (N) MR Board » où N = nombre de MRs Ready de niveau `red` parmi les lignes actuellement affichées (filtres appliqués) ; « MR Board » si N = 0. Mis à jour à chaque rechargement.
- **RG-016-05** : Les deux options sont persistées en backend (`settings`) et affichées dans la section `06 · Divers`.
- **RG-016-06** : La détection des changements d'affectation est une fonction pure (`domain/assignment-diff.ts` côté frontend) testée unitairement.

## 4. Maquettes de référence

- Wireframe **1c** — section `06 · Divers` : « Notification navigateur quand une MR m'est affectée », « Badge de compteur sur l'onglet (MRs en rouge) »
- Prototype — `notify`, `badge`

## 5. Critères d'acceptation

```gherkin
Scenario: Activer les notifications
  Given la permission n'a jamais été demandée
  When je coche « Notification navigateur quand une MR m'est affectée »
  Then Notification.requestPermission est appelé
  When j'accepte
  Then la case est cochée et notifyAssigned = true après enregistrement

Scenario: Permission refusée
  When je refuse la permission
  Then la case reste décochée et « Notifications bloquées par le navigateur » s'affiche

Scenario: Nouvelle affectation
  Given notifyAssigned = true, mon identité est mdupont et la MR api!412 n'a pas de reviewer
  When un rechargement renvoie api!412 avec mdupont en reviewer
  Then une notification « MR Board — api !412 » avec le titre de la MR est émise

Scenario: Pas de notification au premier chargement
  Given notifyAssigned = true
  When la page se charge avec 3 MRs où je suis reviewer
  Then aucune notification n'est émise

Scenario: Pas de doublon
  Given la MR api!412 m'a déjà été notifiée
  When un rechargement renvoie la même affectation
  Then aucune nouvelle notification n'est émise

Scenario: Draft ignoré
  When un rechargement renvoie un draft où je deviens assignee
  Then aucune notification n'est émise

Scenario: Badge d'onglet
  Given tabBadge = true et 2 MRs affichées sont en rouge
  Then le titre de l'onglet est « (2) MR Board »
  When je filtre pour n'en afficher qu'une
  Then le titre est « (1) MR Board »
  When plus aucune MR rouge n'est affichée
  Then le titre est « MR Board »

Scenario: Badge désactivé
  Given tabBadge = false et 2 MRs en rouge
  Then le titre est « MR Board »
```

## 6. Questions ouvertes

- QO-016-01 : Faut-il aussi notifier quand une de mes MRs est approuvée ou commentée ? Hypothèse : non en v1.
- QO-016-02 : Le badge doit-il compter toutes les MRs rouges ou seulement celles visibles avec les filtres ? Hypothèse : visibles (RG-016-04).

## 7. Hors périmètre

- Notifications par email / chat
- Son
