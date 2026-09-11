# US-008 — Tri par défaut et tri sur colonnes

## 1. Reformulation

Le tableau est trié par défaut par « Depuis Ready » croissant (la MR la plus ancienne en haut). L'utilisateur peut
changer le tri en cliquant sur les en-têtes « Difficulté » ou « Depuis Ready », un seul tri étant actif à la fois.
Les drafts, quand ils sont affichés, restent toujours regroupés après les MRs Ready.

## 2. User Stories

- **US-008** : En tant qu'utilisateur, je veux trier le tableau par difficulté ou par temps depuis Ready, afin de trouver
  rapidement la MR la plus urgente ou la plus accessible.
    - Priorité : Must
    - Complexité estimée : S
    - Dépendances : US-006, US-007

## 3. Règles de gestion

- **RG-008-01** : Tri par défaut : `ready:asc` — MRs Ready par `readyAt` croissant (RG-G10). Égalité : par difficulté croissante, puis `iid` croissant.
- **RG-008-02** : Colonnes triables : « Difficulté » (`diff`) et « Depuis Ready » (`ready`). Les autres en-têtes ne sont pas cliquables.
- **RG-008-03** : Clic sur un en-tête triable : si la colonne n'est pas active → tri croissant sur cette colonne ; si elle est active en croissant → décroissant ; si active en décroissant → croissant. Il n'existe pas d'état « sans tri » : une colonne est toujours active.
- **RG-008-04** : Tri `diff` : easy < medium < hard ; égalité départagée par `readyAt` croissant (puis `iid`). Tri `ready` : `readyAt` croissant = plus ancienne en haut ; égalité par difficulté croissante (puis `iid`). En décroissant, l'ordre complet est inversé.
- **RG-008-05** : Le bloc Drafts est toujours placé après le bloc Ready et trié par `createdAt` croissant, quel que soit le tri actif (RG-G10, QO-G07).
- **RG-008-06** : Rendu de l'en-tête : colonne active en couleur accent avec flèche `↑` (asc) ou `↓` (desc) ; colonne triable inactive avec `↕` à 50 % d'opacité ; curseur pointeur et libellé accent au survol.
- **RG-008-07** : Le tri est appliqué côté backend (`GET /merge-requests?sort=ready:asc|ready:desc|diff:asc|diff:desc`) pour garantir une règle unique ; le frontend ne retrie pas. Valeur de `sort` invalide → 400.
- **RG-008-08** : Le tri est propagé dans l'URL (US-011) ; en attendant US-011 il est conservé dans le store le temps de la session.

## 4. Maquettes de référence

- Wireframe **1a** — en-tête « Depuis Ready ↑ » en accent, « Difficulté ↕ »
- Prototype — `sort`, `arrow`, `diffHeadColor` / `readyHeadColor`

## 5. Critères d'acceptation

```gherkin
Scenario: Tri par défaut
  Given des MRs Ready prêtes depuis 6, 5, 3, 2, 1, 1, 0 jours
  When j'ouvre le tableau
  Then les lignes sont dans l'ordre 6, 5, 3, 2, 1, 1, 0 jours
  And l'en-tête « Depuis Ready » est en accent avec « ↑ »
  And l'en-tête « Difficulté » affiche « ↕ »

Scenario: Trier par difficulté
  When je clique sur l'en-tête « Difficulté »
  Then GET /api/v1/merge-requests?sort=diff:asc est appelé
  And les lignes sont ordonnées easy → medium → hard
  And à difficulté égale, la MR prête depuis le plus longtemps est en premier
  And l'en-tête « Difficulté » est en accent avec « ↑ » et « Depuis Ready » repasse à « ↕ »

Scenario: Inverser le tri
  Given le tri est diff:asc
  When je clique à nouveau sur « Difficulté »
  Then le tri est diff:desc et l'en-tête affiche « ↓ »
  When je clique encore
  Then le tri est diff:asc

Scenario: Drafts toujours en bas
  Given les drafts sont affichés et le tri est ready:desc
  Then toutes les MRs Ready précèdent tous les drafts
  And les drafts sont ordonnés par date d'ouverture croissante

Scenario: Un seul tri actif
  Given le tri est ready:asc
  When je clique sur « Difficulté »
  Then une seule colonne porte une flèche « ↑ » ou « ↓ »

Scenario: Valeur de tri invalide
  When j'appelle GET /api/v1/merge-requests?sort=title:asc
  Then l'API répond 400

Scenario: En-têtes non triables
  When je clique sur l'en-tête « Auteur »
  Then rien ne change
```

## 6. Questions ouvertes

- QO-008-01 : Faut-il un tri secondaire explicite (ex : par projet) ? Hypothèse : non.

## 7. Hors périmètre

- Tri sur d'autres colonnes
- Tri multi-colonnes
