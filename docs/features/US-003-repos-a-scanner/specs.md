# US-003 — Paramètres : Repos à scanner avec alias

## 1. Reformulation

L'utilisateur constitue la liste des projets GitLab à surveiller. Chaque projet reçoit un alias court qui sera affiché
dans la colonne « Projet » du tableau et dans le filtre « Projet ». Le backend valide l'existence et l'accessibilité du
projet auprès de GitLab au moment de l'ajout. L'ajout et la suppression d'un repo sont immédiats ; le renommage d'un
alias, lui, suit le cycle Enregistrer/Annuler du reste de l'écran Paramètres (comportement du prototype de référence).

## 2. User Stories

- **US-003** : En tant qu'utilisateur, je veux gérer la liste des repos GitLab à scanner et leur donner un alias, afin de
  suivre les MRs de plusieurs projets dans un seul tableau avec des noms courts lisibles.
    - Priorité : Must
    - Complexité estimée : M
    - Dépendances : US-001

## 3. Règles de gestion

- **RG-003-01** : Un repo est saisi soit par son chemin `groupe/sous-groupe/projet`, soit par l'URL complète de sa page GitLab (`https://gitlab.exemple.fr/groupe/projet`, éventuellement suivie de `/-/…`). L'URL est ramenée au chemin (suppression du schéma/hôte, de tout suffixe `/-/…`, et des `/` de bordure). Aucune autre validation de format n'est appliquée sur le chemin : c'est la résolution auprès de GitLab (RG-003-03) qui fait autorité.
- **RG-003-02** : À l'ajout, le backend résout le projet via l'API GitLab (avec le jeton configuré) et stocke `gitlab_project_id`, `path_with_namespace`, `web_url`. Sans jeton configuré, l'ajout est refusé avec « Configurez d'abord un jeton GitLab dans les paramètres » (409, code partagé avec RG-001-04 : `settings.tokenMissing`).
- **RG-003-03** : Si GitLab ne trouve pas le projet ou refuse l'accès (401/403/404), l'ajout est refusé avec « Projet introuvable ou inaccessible avec ce jeton » (400, code `projects.notFound`). Une panne ou un délai dépassé côté GitLab renvoie l'erreur générique de connexion (502, `gitlab.unavailable`), pas ce message.
- **RG-003-04** : L'alias, une fois résolu (saisi ou dérivé, RG-003-05), doit faire 1 à 20 caractères parmi lettres, chiffres, `.`, `-`, `_` (pas d'espace ni de virgule, pour rester compatible avec l'encodage CSV des filtres dans l'URL, RG-011-01). Il est unique parmi les repos configurés, comparaison insensible à la casse.
- **RG-003-05** : Si l'alias n'est pas saisi à l'ajout, il est dérivé du dernier segment du chemin (`equipe/backend-api` → `backend-api`). Si cet alias dérivé entre en conflit avec un alias déjà configuré, l'ajout est refusé avec la même erreur qu'un alias explicite en doublon (400, `projects.aliasDuplicate`) — aucune désambiguïsation automatique (pas de suffixe `-2`), l'utilisateur doit saisir un alias explicite.
- **RG-003-06** : Un même projet GitLab (`gitlab_project_id`) ne peut être configuré qu'une fois (409, `projects.alreadyConfigured`), même sous un chemin ou un alias différent.
- **RG-003-07** : L'alias d'un repo déjà configuré est modifiable en ligne dans le tableau des repos, mais la modification n'est envoyée au serveur (`PUT /api/v1/projects/:id`) qu'au clic sur le bouton global « Enregistrer » de l'écran Paramètres (comme les autres sections, RG-001-06) — pas de sauvegarde au blur. Une modification d'alias non enregistrée compte comme une modification du formulaire (déclenche la confirmation d'abandon, RG-001-07, et active « Enregistrer »). Si un repo est ajouté ou supprimé pendant qu'une modification d'alias est en cours sur une autre ligne, la liste des lignes est reconstruite à partir de l'état serveur à jour et cette modification d'alias non enregistrée est perdue (cas rare : l'utilisateur vient d'agir sur la liste elle-même).
- **RG-003-08** : La suppression d'un repo (icône ✕) demande confirmation (dialog « Supprimer ce repo ? », réutilise le composant de confirmation de US-001) et est immédiate (`DELETE /api/v1/projects/:id`, indépendant du bouton Enregistrer). Le repo et toute donnée qui lui est propre en base cessent d'exister ; le tableau ne l'affiche plus dès le retour. Les MRs de ce projet ne seront modélisées qu'à partir de US-004 : leur suppression en cascade sera garantie par une contrainte de clé étrangère posée à cette occasion, pas testable dans le périmètre de cette US.
- **RG-003-09** : La liste des repos est affichée dans l'ordre d'ajout (identifiant croissant). La ligne d'ajout est toujours en bas ; le bouton « Ajouter » est désactivé tant que le champ chemin est vide ou qu'un ajout est déjà en cours.
- **RG-003-10** : L'ajout et la suppression sont effectifs immédiatement côté backend, indépendamment du bouton « Enregistrer ». L'écran l'indique par un toast (« Repo ajouté » / « Repo supprimé »), distinct du toast « Paramètres enregistrés » qui suit un clic sur « Enregistrer ».
- **RG-003-11** : Un repo ajouté déclenche une synchronisation de ce seul projet dès que US-004 existe (point d'extension, sans effet observable tant que US-004 n'est pas livrée).

## 4. Contrat API

| Méthode | Route | Body | Réponse | Codes |
|---------|-------|------|---------|-------|
| GET | `/api/v1/projects` | — | `ProjectResponseDto[]`, ordre d'ajout | 200 |
| POST | `/api/v1/projects` | `{ path: string, alias?: string }` | `ProjectResponseDto` | 201, 400 (`projects.notFound`, `projects.aliasDuplicate`, ou validation de format), 409 (`settings.tokenMissing`, `projects.alreadyConfigured`), 502 (`gitlab.unavailable`) |
| PUT | `/api/v1/projects/:id` | `{ alias: string }` | `ProjectResponseDto` | 200, 400 (`projects.aliasDuplicate` ou validation de format), 404 (repo inconnu) |
| DELETE | `/api/v1/projects/:id` | — | — | 204, 404 (repo inconnu) |

`ProjectResponseDto` : `{ id: number, pathWithNamespace: string, alias: string, gitlabProjectId: number }`. `id` est
l'identifiant interne (à utiliser pour `PUT`/`DELETE`), distinct de `gitlabProjectId` (identifiant GitLab).

## 5. Maquettes de référence

- Wireframe **1c** — section `03 · Repos à scanner` (tableau Chemin du projet / Alias / ✕, ligne d'ajout « groupe/projet ou URL GitLab » + « alias » + « Ajouter »)
- Prototype — vue « Paramètres », actions `add-repo`, `del-repo`, saisie `alias` (état différé, appliqué uniquement au clic sur `save`)

## 6. Critères d'acceptation

```gherkin
Scenario: Lister les repos configurés
  Given 2 repos sont configurés
  When j'ouvre /settings
  Then GET /api/v1/projects renvoie les 2 repos dans leur ordre d'ajout
  And le tableau des repos affiche leur chemin et leur alias

Scenario: Ajouter un repo par son chemin
  Given un jeton valide est configuré
  When je saisis « equipe/backend-api » et l'alias « api » puis je clique sur « Ajouter »
  Then POST /api/v1/projects répond 201 avec { id: 1, pathWithNamespace: "equipe/backend-api", alias: "api", gitlabProjectId: 42 }
  And la ligne apparaît dans le tableau des repos
  And un toast « Repo ajouté » s'affiche
  And le champ chemin et le champ alias de la ligne d'ajout sont vidés

Scenario: Ajouter un repo par son URL
  When je saisis « https://gitlab.exemple.fr/equipe/front-web/-/merge_requests » sans alias
  Then le chemin résolu est « equipe/front-web »
  And l'alias proposé et enregistré est « front-web »

Scenario: Alias en doublon (saisi explicitement)
  Given un repo avec l'alias « api » existe
  When j'ajoute un autre repo avec l'alias « API »
  Then l'API répond 400 avec le code projects.aliasDuplicate
  And le champ alias de la ligne d'ajout est en erreur

Scenario: Alias par défaut en doublon
  Given un repo avec l'alias « backend-api » existe
  When j'ajoute « autre-equipe/backend-api » sans préciser d'alias
  Then l'API répond 400 avec le code projects.aliasDuplicate
  And aucun repo n'est créé

Scenario: Alias avec une virgule refusé
  When j'ajoute un repo avec l'alias « api,web »
  Then l'API répond 400 (format d'alias invalide)

Scenario: Projet déjà configuré
  Given « equipe/backend-api » est déjà configuré
  When je l'ajoute à nouveau sous un autre alias
  Then l'API répond 409 avec le code projects.alreadyConfigured

Scenario: Projet introuvable
  Given GitLab répond 404 pour « equipe/inexistant »
  When je l'ajoute
  Then l'API répond 400 avec le code projects.notFound
  And un message « Projet introuvable ou inaccessible avec ce jeton » s'affiche
  And aucun repo n'est créé

Scenario: GitLab injoignable pendant la résolution
  Given GitLab ne répond pas dans le délai imparti
  When j'ajoute un repo
  Then l'API répond 502 avec le code gitlab.unavailable

Scenario: Ajout sans jeton
  Given aucun jeton n'est configuré
  When j'ajoute un repo
  Then l'API répond 409 avec le code settings.tokenMissing

Scenario: Modifier un alias
  Given le repo « equipe/backend-api » a l'alias « api »
  When je modifie l'alias en « back » dans le tableau
  Then le bouton « Enregistrer » s'active (le formulaire est modifié)
  And PUT /api/v1/projects/:id n'est PAS encore appelé
  When je clique sur « Enregistrer »
  Then PUT /api/v1/projects/:id est appelé avec { alias: "back" }
  And un toast « Paramètres enregistrés » s'affiche
  And la colonne Projet du tableau affiche « back »

Scenario: Modifier un alias vers un doublon
  Given les repos ont les alias « api » et « web »
  When je renomme « web » en « API » et je clique sur « Enregistrer »
  Then PUT /api/v1/projects/:id répond 400 avec le code projects.aliasDuplicate
  And un toast d'erreur s'affiche, l'alias en cours d'édition n'est pas perdu

Scenario: Modification d'alias perdue après action sur la liste
  Given je modifie l'alias d'un repo sans enregistrer
  When j'ajoute un autre repo (action immédiate)
  Then la modification d'alias non enregistrée est abandonnée
  And le formulaire redevient non modifié pour cette section

Scenario: Supprimer un repo
  Given le repo « plateforme/infra-terraform » est configuré
  When je clique sur ✕ puis je confirme dans le dialog
  Then DELETE /api/v1/projects/:id répond 204
  And le tableau ne l'affiche plus
  And un toast « Repo supprimé » s'affiche

Scenario: Annuler la suppression
  When je clique sur ✕ puis je clique sur « Rester » (annuler) dans le dialog
  Then aucun appel DELETE n'est effectué
  And le repo reste dans le tableau

Scenario: Bouton Ajouter désactivé
  Given le champ chemin est vide
  Then le bouton « Ajouter » est désactivé
  Given un ajout est en cours (requête en vol)
  Then le bouton « Ajouter » est désactivé

Scenario: Alias trop long
  When je saisis un alias de 21 caractères
  Then l'API répond 400 (validation de format)
  And le champ est en erreur
```

## 7. Questions ouvertes

- QO-003-01 : Faut-il un flag « activé / désactivé » par repo pour le suspendre sans le supprimer ? Hypothèse : colonne `enabled` prévue en base, non exposée dans l'UI en v1.
- QO-003-02 : Faut-il permettre l'ajout d'un groupe entier (tous ses projets) ? Hypothèse : non en v1.
- QO-003-03 : Faut-il permettre de renommer un alias vers la même valeur (no-op) sans passer par la vérification d'unicité (puisqu'elle ne rentre pas en conflit avec elle-même) ? Hypothèse : oui, la vérification d'unicité exclut la ligne éditée elle-même.

## 8. Hors périmètre

- Ajout par groupe, découverte automatique des projets
- Réordonnancement des repos
- Couleur par projet
- Suppression en cascade des MRs (garantie structurelle posée par US-004, non testable ici)
- Désambiguïsation automatique d'un alias par défaut en conflit (RG-003-05)
