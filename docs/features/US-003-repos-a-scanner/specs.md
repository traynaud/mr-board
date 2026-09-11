# US-003 — Paramètres : Repos à scanner avec alias

## 1. Reformulation

L'utilisateur constitue la liste des projets GitLab à surveiller. Chaque projet reçoit un alias court qui sera affiché
dans la colonne « Projet » du tableau et dans le filtre « Projet ». Le backend valide l'existence et l'accessibilité du
projet auprès de GitLab au moment de l'ajout.

## 2. User Stories

- **US-003** : En tant qu'utilisateur, je veux gérer la liste des repos GitLab à scanner et leur donner un alias, afin de
  suivre les MRs de plusieurs projets dans un seul tableau avec des noms courts lisibles.
    - Priorité : Must
    - Complexité estimée : M
    - Dépendances : US-001

## 3. Règles de gestion

- **RG-003-01** : Un repo est saisi soit par son chemin `groupe/sous-groupe/projet`, soit par l'URL complète de sa page GitLab (`https://gitlab.exemple.fr/groupe/projet`, éventuellement suivie de `/-/…`). L'URL est ramenée au chemin ; le `/` final est retiré.
- **RG-003-02** : À l'ajout, le backend résout le projet via `GET /api/v4/projects/:path_encoded` avec le jeton configuré, et stocke `gitlab_project_id`, `path_with_namespace`, `web_url`. Sans jeton configuré, l'ajout est refusé avec un message « Configurez d'abord le jeton GitLab » (409).
- **RG-003-03** : Si GitLab ne trouve pas le projet ou refuse l'accès (404/403), l'ajout est refusé avec « Projet introuvable ou inaccessible avec ce jeton ».
- **RG-003-04** : L'alias est obligatoire, 1 à 20 caractères, unique (insensible à la casse) parmi les repos configurés. S'il n'est pas saisi, il est proposé par défaut = dernier segment du chemin (`equipe/backend-api` → `backend-api`).
- **RG-003-05** : Un même projet (`gitlab_project_id`) ne peut être ajouté qu'une fois (409 « Projet déjà configuré »).
- **RG-003-06** : L'alias est modifiable en ligne dans le tableau des repos ; la modification est persistée à l'enregistrement global (RG-001-06). Les alias sont propagés immédiatement au tableau et au filtre Projet (une sélection de filtre portant sur un alias renommé ou supprimé est nettoyée, voir US-011).
- **RG-003-07** : La suppression d'un repo demande confirmation (dialog) et supprime en cascade ses MRs en base. Le tableau ne les affiche plus dès le retour.
- **RG-003-08** : La liste est affichée dans l'ordre d'ajout. La ligne d'ajout est toujours en bas ; le bouton « Ajouter » est désactivé tant que le chemin est vide.
- **RG-003-09** : L'ajout et la suppression sont effectifs immédiatement côté backend (`POST /projects`, `DELETE /projects/:id`), indépendamment du bouton « Enregistrer » qui ne concerne que les champs de formulaire (alias, autres sections). L'écran l'indique par un toast « Repo ajouté » / « Repo supprimé ».
- **RG-003-10** : Un repo ajouté déclenche une synchronisation de ce seul projet (US-004) pour que ses MRs apparaissent sans attendre.

## 4. Maquettes de référence

- Wireframe **1c** — section `03 · Repos à scanner` (tableau Chemin du projet / Alias / ✕, ligne d'ajout « groupe/projet ou URL GitLab » + « alias » + « Ajouter »)
- Prototype — vue « Paramètres », actions `add-repo`, `del-repo`, saisie `alias`

## 5. Critères d'acceptation

```gherkin
Scenario: Ajouter un repo par son chemin
  Given un jeton valide est configuré
  When je saisis « equipe/backend-api » et l'alias « api » puis je clique sur « Ajouter »
  Then POST /api/v1/projects répond 201 avec { pathWithNamespace: "equipe/backend-api", alias: "api", gitlabProjectId: 42 }
  And la ligne apparaît dans le tableau des repos
  And un toast « Repo ajouté » s'affiche
  And une synchronisation du projet est déclenchée

Scenario: Ajouter un repo par son URL
  When je saisis « https://gitlab.exemple.fr/equipe/front-web/-/merge_requests » sans alias
  Then le chemin résolu est « equipe/front-web »
  And l'alias proposé et enregistré est « front-web »

Scenario: Alias en doublon
  Given un repo avec l'alias « api » existe
  When j'ajoute un autre repo avec l'alias « API »
  Then l'API répond 400 « Alias déjà utilisé »
  And le champ alias est en erreur

Scenario: Projet déjà configuré
  Given « equipe/backend-api » est déjà configuré
  When je l'ajoute à nouveau sous un autre alias
  Then l'API répond 409 « Projet déjà configuré »

Scenario: Projet introuvable
  Given GitLab répond 404 pour « equipe/inexistant »
  When je l'ajoute
  Then un message « Projet introuvable ou inaccessible avec ce jeton » s'affiche
  And aucun repo n'est créé

Scenario: Ajout sans jeton
  Given aucun jeton n'est configuré
  When j'ajoute un repo
  Then l'API répond 409 « Configurez d'abord le jeton GitLab »

Scenario: Modifier un alias
  Given le repo « equipe/backend-api » a l'alias « api »
  When je modifie l'alias en « back » et je clique sur « Enregistrer »
  Then PUT /api/v1/projects/:id est appelé avec { alias: "back" }
  And la colonne Projet du tableau affiche « back » pour ses MRs

Scenario: Supprimer un repo
  Given le repo « plateforme/infra-terraform » a 3 MRs en base
  When je clique sur ✕ puis je confirme
  Then DELETE /api/v1/projects/:id répond 204
  And ses 3 MRs sont supprimées
  And le tableau ne les affiche plus

Scenario: Bouton Ajouter désactivé
  Given le champ chemin est vide
  Then le bouton « Ajouter » est désactivé

Scenario: Alias trop long
  When je saisis un alias de 21 caractères
  Then l'API répond 400 et le champ est en erreur
```

## 6. Questions ouvertes

- QO-003-01 : Faut-il un flag « activé / désactivé » par repo pour le suspendre sans le supprimer ? Hypothèse : colonne `enabled` prévue en base, non exposée dans l'UI en v1.
- QO-003-02 : Faut-il permettre l'ajout d'un groupe entier (tous ses projets) ? Hypothèse : non en v1.

## 7. Hors périmètre

- Ajout par groupe, découverte automatique des projets
- Réordonnancement des repos
- Couleur par projet
