# Specs — US-029 Infobulle des approbateurs sur la colonne Approved

Statut : validé (Phase 1 PO). QO-029-04 tranchée par l'utilisateur : texte brut, sans préfixe.

---

## 1. Reformulation

Quand une MR a été approuvée (colonne **Approved** cochée, RG-G07), l'utilisateur veut savoir **qui** l'a approuvée
sans quitter le tableau. Au survol (ou focus clavier) de la coche ✓ de la colonne Approved, une infobulle affiche le
nom complet du ou des utilisateurs ayant donné leur approbation — sur le même principe que l'infobulle « +N » déjà
affichée sur les colonnes Reviewer et Affecté (RG-G06).

Aucune approbation n'étant possible sans que la MR soit approuvée, cette infobulle n'apparaît que sur les lignes où
`approved = true` ; les autres lignes ne portent aucune coche et donc aucune infobulle (comportement inchangé).

---

## 2. User Story

- **US-029** : En tant que membre de l'équipe, je veux voir le nom des personnes ayant approuvé une MR en survolant
  la coche de la colonne Approved, afin de savoir sans clic supplémentaire qui a déjà validé la MR et qui manque
  encore, sans changer d'écran.
    - Priorité : Should
    - Complexité estimée : L (nouvelle donnée à faire remonter des deux forges — GitLab et GitHub — et à persister,
      en plus de l'affichage)
    - Dépendances : US-005 (tableau, colonne Approved), US-017 (colonne Statut, raison `not_approved` déjà calculée
      sur des données voisines), US-019/US-020 (support multi-forges)

---

## 3. Règles de gestion

- **RG-029-01 — Définition des approbateurs** : `approvedBy` est la liste des utilisateurs ayant explicitement
  approuvé la MR — **exactement** les utilisateurs qui font que `approved = true` selon RG-G07 (donc, côté GitLab,
  hors l'auteur lui-même s'il apparaissait dans la liste brute de la forge ; côté GitHub, l'auto-approbation n'étant
  pas permise par la forge, la question ne se pose pas). `approvedBy` est une liste indépendante de `reviewers` :
  un utilisateur peut y figurer sans être dans `reviewers` (retiré de la revue après avoir approuvé), et
  inversement un reviewer peut ne jamais y figurer (n'a pas encore approuvé, ou a demandé des changements).
- **RG-029-02 — Affichage** : quand `approved = true`, la coche ✓ de la colonne Approved porte une infobulle
  listant les noms complets (`name`) des utilisateurs de `approvedBy`, séparés par une virgule, dans l'ordre
  renvoyé par la forge (même format que le tooltip Reviewer/Affecté, RG-G06 — voir `summarizeUsers` côté frontend).
  Quand `approved = false`, aucune coche n'est affichée (inchangé) et donc aucune infobulle.
- **RG-029-03 — Un seul approbateur** : `approvedBy` peut contenir un seul nom ; l'infobulle affiche alors ce seul
  nom, sans mention particulière (pas de pluriel/singulier à gérer côté texte, un nom seul est un tooltip valide).
- **RG-029-04 — MRs approuvées avant la livraison de cette US** : une MR déjà `approved = true` mais synchronisée
  avant la livraison de cette US n'a pas encore de `approvedBy` en base (liste vide, absente de la réponse
  précédente à la nouvelle synchronisation). Dans ce cas, ne pas afficher d'infobulle vide : la coche reste
  affichée normalement, sans tooltip, jusqu'à la prochaine synchronisation qui peuplera `approvedBy` (même logique
  que RG-017-11 pour la colonne Statut avant US-017).
- **RG-029-05 — Ordre non garanti côté GitLab** : contrairement à GitHub, où les approbations proviennent des
  revues dans leur ordre chronologique de soumission, GitLab ne garantit pas d'ordre chronologique pour
  `approvedBy` côté API — l'ordre affiché est celui renvoyé par l'API, sans signification particulière côté
  GitLab (à documenter comme limitation connue, comme RG-G06 le fait déjà pour reviewers/assignees).

---

## 4. Maquettes de référence

Aucune maquette dédiée dans `docs/design/` pour cette interaction (ajout après la dernière US documentée, US-028).
Le pattern visuel à reprendre à l'identique est déjà présent dans le prototype/wireframes actuels : le tooltip
« liste de noms séparés par une virgule » utilisé sur les colonnes **Reviewer** et **Affecté** (zone 5 du tableau,
`docs/design/MR Board - Wireframes.dc.html`, `docs/tech/design-system.md` pour le composant tooltip Material). La
colonne **Approved** elle-même (icône ✓ seule, sans infobulle actuellement) est visible dans le même wireframe.

---

## 5. Critères d'acceptation

```gherkin
Scenario: Survol d'une MR approuvée par une seule personne
  Given une MR a été approuvée par Karim Benali (approved = true, approvedBy = [Karim Benali])
  When je survole la coche ✓ de la colonne Approved de cette ligne
  Then une infobulle affiche "Karim Benali"

Scenario: Survol d'une MR approuvée par plusieurs personnes
  Given une MR a été approuvée par Karim Benali puis Léa Rousseau
  When je survole la coche ✓ de la colonne Approved de cette ligne
  Then une infobulle affiche "Karim Benali, Léa Rousseau" (ordre renvoyé par la forge, RG-029-05)

Scenario: MR non approuvée
  Given une MR n'a reçu aucune approbation (approved = false)
  Then aucune coche n'est affichée dans la colonne Approved pour cette ligne
  And il n'y a donc aucune infobulle à survoler

Scenario: Approbateur retiré de la liste des reviewers après avoir approuvé
  Given une MR a été approuvée par Karim Benali, puis Karim Benali a été retiré des reviewers de cette MR
  When je survole la coche ✓ de la colonne Approved de cette ligne
  Then l'infobulle affiche toujours "Karim Benali" (RG-029-01 : approvedBy indépendant de reviewers)

Scenario: MR approuvée avant la livraison de cette US, pas encore resynchronisée
  Given une MR est approved = true mais approvedBy est vide en base (synchronisée avant cette US)
  When je survole la coche ✓ de la colonne Approved de cette ligne
  Then aucune infobulle ne s'affiche (pas de tooltip vide, RG-029-04)

Scenario: Approbation sur une PR GitHub
  Given une PR GitHub a été approuvée par un reviewer dont la dernière revue soumise est à l'état APPROVED
  When je survole la coche ✓ de la colonne Approved de cette ligne
  Then l'infobulle affiche le nom de ce reviewer

Scenario: Accès clavier
  Given une MR approuvée est affichée dans le tableau
  When je navigue au clavier jusqu'à la coche ✓ de la colonne Approved et qu'elle reçoit le focus
  Then l'infobulle s'affiche au focus, au même titre qu'au survol (comportement standard `matTooltip`, cohérent
    avec les colonnes Reviewer/Affecté existantes)
```

---

## 6. Questions ouvertes

- **QO-029-01** : Pour GitLab, `approvedBy.nodes` ne fournit aujourd'hui que l'`id` de chaque approbateur (utilisé
  uniquement pour calculer le booléen `approved`, RG-G07) — la requête GraphQL devra être étendue pour récupérer
  aussi `username`/`name`/`avatarUrl`/`webUrl`, comme c'est déjà fait pour `reviewers`/`assignees`. Confirmé
  techniquement faisable (même nœud GraphQL, mêmes champs), à traiter en Phase 2 (architecture). Pas de
  changement d'approche fonctionnelle attendu.
- **QO-029-02** : Pour GitHub, si un reviewer soumet plusieurs revues successives (ex. `CHANGES_REQUESTED` puis
  `APPROVED`), seule la **dernière** revue de cet utilisateur compte (comportement déjà celui de
  `latestOpinionatedReviews`, utilisé pour le calcul actuel de `approved`) — à confirmer que cette même source
  suffit pour construire `approvedBy` sans requête GraphQL supplémentaire. Probable réponse : oui, à valider en
  Phase 2.
- **QO-029-03** : Faut-il persister `approvedBy` dans une table dédiée (comme `merge_request_reviewers`), ou
  suffit-il de le recalculer à la volée depuis une colonne déjà existante ? Décision technique laissée à
  l'architecte (aucun impact fonctionnel sur cette US).
- **QO-029-04** — ✅ **Tranchée par l'utilisateur** : l'infobulle reste un texte brut de noms séparés par une
  virgule, sans préfixe « Approuvé par : », cohérent avec le pattern existant des colonnes Reviewer/Affecté
  (RG-029-02). Aucune clé i18n dédiée à un préfixe n'est nécessaire.

---

## 7. Hors périmètre

- Modifier le comportement du calcul du booléen `approved` (RG-G07) : cette US ne fait qu'exposer **qui** sont les
  approbateurs déjà comptés par la règle existante, elle ne change pas la définition de « approuvé ».
- Afficher les avatars des approbateurs dans la cellule (seule la coche ✓ reste visible ; contrairement aux
  colonnes Reviewer/Affecté, pas d'avatar affiché à côté de la coche dans cette itération).
- Distinguer dans l'infobulle une approbation « encore valide » d'une approbation « obsolète » après un nouveau
  push (GitLab invalide parfois les approbations après un nouveau commit selon la configuration du projet) : hors
  périmètre, `approvedBy` reflète l'état renvoyé par la forge au moment de la synchronisation, sans historique.
- Filtre composable dédié « Approuvé par tel utilisateur » (le filtre `approved` existant reste un simple
  oui/non, RG-010) : non demandé, hors périmètre de cette itération.
- Notification ou badge lié à une nouvelle approbation : hors périmètre (voir US-016 pour les notifications
  existantes, non concernées par cette US).
