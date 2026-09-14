# US-024 — Repli sur les initiales quand l'image d'avatar ne charge pas

## 1. Reformulation

Quand l'URL d'avatar renvoyée par une forge existe mais que l'image ne se charge pas côté navigateur (lien mort,
avatar supprimé côté forge, latence/erreur réseau, contenu bloqué), `AvatarComponent` affiche aujourd'hui l'icône
d'image cassée du navigateur au lieu de retomber sur les initiales — alors que ce repli existe déjà quand
`avatarUrl` est absent dès le départ (RG-G12). Cette US comble cet écart : un échec de chargement de l'image doit
produire exactement le même rendu qu'une absence d'URL.

## 2. User Stories

- **US-024** : En tant qu'utilisateur du tableau, je veux voir les initiales d'un utilisateur quand son avatar ne
  charge pas, afin de ne jamais voir une icône d'image cassée dans l'interface.
    - Priorité : Should
    - Complexité estimée : S
    - Dépendances : aucune (amende RG-G12, US-005)

## 3. Règles de gestion

- **RG-024-01** : `AvatarComponent` (RG-G12 amendée) : si le chargement de l'`<img>` échoue (évènement `error` du
  navigateur — 404, timeout, contenu bloqué, etc.), l'avatar bascule immédiatement sur le même rendu « initiales »
  que lorsque `avatarUrl` est `null` dès le départ (carré, mêmes classes, même tooltip). Aucune tentative de
  rechargement automatique de l'image.
- **RG-024-02** : Le repli est mémorisé **par instance du composant** pour l'URL actuellement affichée : tant que
  l'`avatarUrl` fourni ne change pas, on ne retente jamais de charger une image qu'on sait cassée (pas de clignotement
  ni de flot de requêtes réseau en cas de re-rendu). Si l'`avatarUrl` change (ex. re-synchronisation avec une
  nouvelle URL), l'`<img>` est retentée une fois pour cette nouvelle URL.
- **RG-024-03** : Comportement inchangé par ailleurs : tooltip (nom complet, éventuel suffixe « (moi) »), variante
  `filled`/`outlined`, anneau `highlighted`, calcul des initiales (RG-G12) — seul le déclencheur du repli est étendu
  (absence d'URL **ou** échec de chargement).
- **RG-024-04** : S'applique partout où `AvatarComponent` est utilisé sans modification supplémentaire : tableau
  (auteur, reviewer, affecté) et aperçu d'identité de la section Paramètres › Moi — un seul composant partagé, un
  seul correctif.

## 4. Maquettes de référence

Aucune maquette dédiée : le rendu cible (carré avec initiales) est déjà celui de RG-G12 / US-005, seul le
déclencheur change. Pas d'écart avec les maquettes.

## 5. Critères d'acceptation

```gherkin
Scenario: Image d'avatar valide
  Given un utilisateur avec un avatarUrl qui charge correctement
  When la ligne s'affiche
  Then l'image s'affiche normalement, sans initiales

Scenario: Avatar absent dès le départ
  Given un utilisateur sans avatarUrl (null)
  When la ligne s'affiche
  Then les initiales s'affichent (comportement RG-G12 inchangé)

Scenario: Lien d'avatar cassé
  Given un utilisateur avec un avatarUrl non nul dont le chargement échoue (404 ou erreur réseau)
  When le navigateur déclenche l'évènement d'erreur de chargement de l'image
  Then l'image cassée disparaît et les initiales de l'utilisateur s'affichent à la place
  And le tooltip continue d'afficher le nom complet

Scenario: Pas de nouvelle tentative en boucle
  Given un avatar déjà tombé en repli sur les initiales pour une URL donnée
  When le composant est réévalué (changement de détection) sans que l'URL change
  Then aucune nouvelle requête image n'est émise et les initiales restent affichées

Scenario: Nouvelle URL après un précédent échec
  Given un avatar en repli sur les initiales pour l'URL A
  When l'utilisateur reçoit une nouvelle URL B lors d'une resynchronisation
  Then MR Board retente de charger l'image B avant de retomber à nouveau sur les initiales en cas de nouvel échec

Scenario: Repli appliqué dans tous les contextes d'utilisation
  Given un avatar cassé pour un auteur, un reviewer, un affecté dans le tableau, et pour l'identité dans Paramètres › Moi
  Then chacun affiche ses initiales sans modification spécifique à son contexte d'affichage
```

## 6. Questions ouvertes

Aucune — comportement de repli déjà spécifié par RG-G12, cette US ne fait qu'en élargir le déclencheur à l'échec de
chargement, sans introduire de nouveau concept produit.

## 7. Hors périmètre

- Nouvelle tentative automatique de rechargement de l'image après un délai (retry)
- Mise en cache ou pré-vérification des URLs d'avatar côté backend
- Any changement du calcul des initiales lui-même (RG-G12 inchangée sur ce point)
