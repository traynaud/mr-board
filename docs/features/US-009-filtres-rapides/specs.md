# US-009 — Filtres rapides « Drafts » et « Mes MRs »

## 1. Reformulation

Deux filtres booléens toujours visibles à gauche de la barre de filtres : « Drafts » (afficher ou masquer les MRs
draft, masquées par défaut) et « Mes MRs » (ne garder que les MRs où j'ai au moins un rôle : auteur, reviewer ou
affecté). Cette US pose la structure de la barre de filtres (chips, séparateur, compteur, bouton « Effacer »).

## 2. User Stories

- **US-009** : En tant qu'utilisateur, je veux afficher ou masquer les drafts et ne voir que mes MRs en un clic, afin de
  me concentrer sur ce qui est prêt et ce qui me concerne.
    - Priorité : Must
    - Complexité estimée : S
    - Dépendances : US-002, US-008

## 3. Règles de gestion

- **RG-009-01** : Chip « Drafts » (`mat-chip-option`) : désélectionné par défaut → seules les MRs Ready sont affichées ; sélectionné → les drafts sont ajoutés après le bloc Ready (RG-G10). Paramètre API : `drafts=0|1`.
- **RG-009-02** : Chip « Mes MRs » (avec icône utilisateur) : désélectionné par défaut ; sélectionné → seules les MRs où je suis auteur, reviewer ou assignee (RG-G09) sont renvoyées. Paramètre API : `mine=0|1`. Le backend résout « moi » à partir des paramètres (RG-002) ; si l'identité est vide, `mine=1` est ignoré et la réponse porte `warnings: ["identity.missing"]`.
- **RG-009-03** : Si l'identité est vide, le chip « Mes MRs » est désactivé avec un tooltip « Configurez votre identité dans les paramètres » (RG-002-05).
- **RG-009-04** : Les deux chips sont toujours affichés en tête de la barre, suivis d'un séparateur vertical, puis (US-010) des pastilles de filtre. À droite : compteur (RG-G20) et bouton texte « Effacer ».
- **RG-009-05** : « Effacer » remet « Mes MRs » à désélectionné et supprime toutes les pastilles de filtre (US-010) ; il **ne modifie pas** « Drafts » (préférence d'affichage plutôt que filtre). Il est masqué si rien n'est à effacer.
- **RG-009-06** : Le champ `isMine` est renvoyé pour chaque MR par l'API (utilisé pour un léger marquage visuel : avatar de mon rôle souligné en accent) — optionnel visuellement, mais le champ est requis.
- **RG-009-07** : Le compteur et le pied de page se mettent à jour immédiatement après tout changement de filtre ; chaque changement déclenche un `GET /merge-requests` avec les paramètres courants (débounce 150 ms).

## 4. Maquettes de référence

- Wireframe **1a** — segment « Ready / + Drafts » et bouton « Mes MRs » (état par défaut)
- Wireframe **1b** — « + Drafts » actif, « Mes MRs » actif (bouton primaire), lignes draft en bas
- Prototype — `md-filter-chip` « Drafts » et « Mes MRs », action `toggle`, action `clear`

## 5. Critères d'acceptation

```gherkin
Scenario: Drafts masqués par défaut
  Given 7 MRs Ready et 2 drafts synchronisées
  When j'ouvre le tableau
  Then 7 lignes sont affichées et le chip « Drafts » est désélectionné
  And GET /api/v1/merge-requests est appelé avec drafts=0

Scenario: Afficher les drafts
  When je sélectionne le chip « Drafts »
  Then 9 lignes sont affichées
  And les 2 drafts sont après les 7 MRs Ready, triés par date d'ouverture croissante
  And le compteur indique « 9 MRs · 3 projets »

Scenario: Mes MRs
  Given mon identité est « mdupont » et je suis auteur de 1 MR, reviewer de 2 et assignee de 1 (dont une où je suis reviewer et assignee)
  When je sélectionne « Mes MRs »
  Then 3 lignes sont affichées
  And chacune a mdupont comme auteur, reviewer ou assignee

Scenario: Mes MRs avec plusieurs reviewers
  Given une MR dont les reviewers sont « tgirard » puis « mdupont »
  When je sélectionne « Mes MRs »
  Then cette MR est affichée

Scenario: Identité non configurée
  Given l'identité est vide
  Then le chip « Mes MRs » est désactivé avec le tooltip « Configurez votre identité dans les paramètres »
  When j'appelle GET /api/v1/merge-requests?mine=1
  Then la réponse contient toutes les MRs et warnings = ["identity.missing"]

Scenario: Combinaison Drafts + Mes MRs
  Given « Drafts » et « Mes MRs » sont sélectionnés
  Then les drafts où j'ai un rôle sont affichés après mes MRs Ready

Scenario: Effacer
  Given « Mes MRs » et « Drafts » sont sélectionnés
  When je clique sur « Effacer »
  Then « Mes MRs » est désélectionné
  And « Drafts » reste sélectionné

Scenario: Bouton Effacer masqué
  Given aucun filtre actif hormis « Drafts »
  Then le bouton « Effacer » n'est pas affiché
```

## 6. Questions ouvertes

- QO-009-01 : « Effacer » doit-il aussi réinitialiser « Drafts » ? Hypothèse : non (RG-009-05), à confirmer.

## 7. Hors périmètre

- Filtres composables (US-010), propagation URL (US-011)
