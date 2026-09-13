# EPIC-001 — Support de plusieurs forges (GitLab + GitHub)

Version : 1.1 — 2026-09-14 (relecture PO au lancement de l'épique : US-017, US-018, US-022 et US-023 ont été
livrées depuis la rédaction initiale — voir US-019 §3 « Cohérence avec les US livrées depuis » pour le détail des
ajustements ; impacts ci-dessous mis à jour en conséquence).
Statut : proposition PO, à valider avant `/project:feature US-019`.

---

## 1. Objectif

MR Board ne connaît aujourd'hui qu'**une** instance GitLab, avec **un** jeton et **une** identité. L'épique permet de
suivre dans le **même tableau** des Merge Requests GitLab et des Pull Requests GitHub, provenant de plusieurs
« connexions » (instances / comptes), sans dégrader l'expérience actuelle : un utilisateur GitLab seul ne doit
voir aucune complexité supplémentaire.

Principes :
- **Vocabulaire produit inchangé** : une Pull Request GitHub est une « MR » dans MR Board (glossaire mis à jour).
  Toutes les règles transverses (RG-G01 → RG-G20) s'appliquent à l'identique ; chaque US précise le mapping.
- **Une connexion = une forge + une URL + un jeton + mon identité sur cette forge.** Les repos sont rattachés à une
  connexion.
- **Intégration fluide** dans les Paramètres : la section « Connexion GitLab » devient « Connexions », liste
  compacte avec ajout / test / suppression, et le reste de l'écran s'adapte (repos, identité) sans nouvelle page.
- **Backend forge-agnostique** : un contrat `ForgeClient` par type de forge, un modèle de données commun ; les
  calculs (`domain/`) ne connaissent pas la forge.

## 2. Découpage

| US     | Titre                                                        | Priorité | Complexité | Dépend de              | Contenu                                                                                                  |
|--------|--------------------------------------------------------------|----------|------------|------------------------|----------------------------------------------------------------------------------------------------------|
| US-019 | Connexions multi-forges (socle, GitLab uniquement)           | Must     | L          | US-015 → US-023         | Entité `connections`, migration de la config existante, écran « 02 · Connexions », repos rattachés, identité par connexion, abstraction `ForgeClient`, export v2. **Aucune nouvelle forge** : refonte à iso-fonctionnalité pour un utilisateur GitLab. |
| US-020 | Connexion GitHub (github.com et GitHub Enterprise)           | Must     | L          | US-019, US-017         | Type « GitHub » sélectionnable, test de connexion, résolution `owner/repo`, synchronisation GraphQL, mapping PR → MR, statut de mergeabilité, limites de débit. |
| US-021 | Forges dans le tableau (indicateur, infobulle, filtre)       | Should   | S          | US-020, US-010         | Icône de forge sur le tag projet, infobulle « connexion · chemin », filtre composable « Connexion », messages de synchro nommant la connexion. |

Ordre d'implémentation : US-019 → US-020 → US-021. US-017 (colonne Statut) est prérequise à US-020 pour que le
mapping GitHub de la mergeabilité soit spécifié une seule fois (codes génériques de RG-017-04).

## 3. Glossaire ajouté

| Terme          | Définition                                                                                                        |
|----------------|-------------------------------------------------------------------------------------------------------------------|
| **Forge**      | Plateforme d'hébergement de code exposant des MRs/PRs : `gitlab` ou `github` (type technique d'une connexion)      |
| **Connexion**  | Couple (forge, URL) + jeton + identité « moi » sur cette forge ; nommée par l'utilisateur ; possède 0..n repos     |
| **PR**         | Pull Request GitHub ; traitée comme une MR dans tout MR Board                                                      |
| **Identifiant distant** | Identifiant d'un objet sur sa forge (`remoteId`) ; entier chez GitLab, chaîne (`node_id`) chez GitHub    |

## 4. Modèle cible

```
Settings (singleton : me_email, seuils, options)
Connections (1..n) ──── Projects (0..n) ──── MergeRequests (0..n) ──┬── author   : User
   │  type, name, url,                                              ├── reviewers: User (0..n)
   │  token (chiffré), me_username                                  └── assignees: User (0..n)
   └── Users (0..n, uniques par (connection, remote_user_id))
SyncRuns
```

Changements de schéma (détail dans US-019 §3) :

| Table            | Avant                                       | Après                                                                                     |
|------------------|---------------------------------------------|-------------------------------------------------------------------------------------------|
| `settings`       | `gitlab_url`, `gitlab_token_encrypted`, `me_username` | colonnes supprimées (migrées vers `connections`) ; `me_email` conservé (global)  |
| `connections`    | —                                           | `id`, `type`, `name`, `url`, `token_encrypted`, `me_username`, `created_at`, `updated_at` |
| `projects`       | `gitlab_project_id` (int)                   | `connection_id` (FK cascade), `remote_project_id` (text) ; unique (`connection_id`, `path_with_namespace`) |
| `users`          | `gitlab_user_id` (int, unique)              | `connection_id`, `remote_user_id` (text) ; unique (`connection_id`, `remote_user_id`)      |
| `merge_requests` | `gitlab_mr_id` (int)                        | `remote_id` (text) ; `iid` conservé (numéro GitHub = `number`)                            |

## 5. Impacts sur le code actuel (inventaire)

Inventaire établi par recherche de `gitlab` dans le code (hors tests). Chaque ligne indique l'US qui porte le
changement.

### Backend

| Fichier / zone                                                   | Impact                                                                                                     | US     |
|------------------------------------------------------------------|------------------------------------------------------------------------------------------------------------|--------|
| `modules/gitlab/gitlab-client.service.ts` (+ `types/`, `mappers/`) | Devient l'implémentation GitLab d'une interface `ForgeClient` (`modules/forges/forge-client.ts`) : `testConnection`, `resolveProject`, `fetchOpenMergeRequests`. Le mapper produit un type commun `ForgeMergeRequest`. | US-019 |
| `modules/forges/` (nouveau)                                      | `ForgeClientFactory(type)`, types communs (`ForgeUser`, `ForgeProject`, `ForgeMergeRequest`, `ForgeTokenInfo`), `GithubClientService` | US-019 / US-020 |
| `common/exceptions/business.exception.ts`                        | `GitlabAuthException` / `GitlabUnavailableException` / `GitlabTimeoutException` → `ForgeAuthException` / `ForgeUnavailableException` / `ForgeTimeoutException` ; codes i18n `gitlab.*` → `forge.*` (avec le nom de connexion en paramètre) | US-019 |
| `modules/settings/*` (entity, service, DTOs `gitlab-credentials`, `test-connection`, `update-settings`, `settings-response`, `domain/normalize-gitlab-url`, `domain/check-token-scopes`) | Retrait de l'URL, du jeton et du `meUsername` ; `POST /settings/test-connection` déplacé vers `POST /connections/test` ; `PUT /settings` reçoit `identities[]` (username par connexion) | US-019 |
| `modules/connections/` (nouveau)                                 | Entité, service, controller (`GET/POST/PUT/DELETE /connections`, `POST /connections/test`), DTOs, chiffrement réutilisé (`common/crypto/token-cipher.service.ts`) | US-019 |
| `modules/projects/*` (entity, service, DTOs, `domain/normalize-project-path`) | `connectionId` obligatoire à l'ajout (implicite si une seule connexion), résolution via le `ForgeClient` de la connexion, `remoteProjectId`, unicité (`connection`, chemin) ; normalisation du chemin par forge (`owner/repo` pour GitHub) | US-019 / US-020 |
| `modules/users/*`                                                | Upsert par (`connectionId`, `remoteUserId`)                                                                | US-019 |
| `modules/merge-requests/*` (entity, service, `domain/is-mine`, `domain/resolve-ready-at`, DTO view) | `remoteId` texte ; `isMine` **et** `isMe` (US-023, livrée) comparent avec le `me_username` **de la connexion du projet**, résolu par MR et non plus une seule fois globalement ; DTO enrichi de `connection: { id, name, type }` | US-019 / US-021 |
| `modules/sync/*`                                                 | Boucle par connexion puis par projet ; client obtenu via la factory ; erreurs d'auth agrégées par connexion ; message d'erreur nommant la connexion | US-019 |
| `modules/settings-transfer/*`                                    | Export `version: 2` avec `connections[]` (sans jeton) et `projects[].connection` ; import v1 et v2                 | US-019 |
| `database/migrations/`                                           | Migration `CreateConnectionsAndMigrateGitlabConfig` (création, copie de la config existante, rattachement des repos, renommages) | US-019 |
| Logger / masquage des secrets                                    | Motifs à masquer étendus : `ghp_*`, `github_pat_*`, `Authorization: Bearer`                                  | US-020 |
| `config/helmet-options.ts`                                       | Aucun changement (`img-src https:` couvre déjà `avatars.githubusercontent.com`)                             | —      |
| Tests e2e (`test/`)                                              | Mock GitLab → mocks par forge ; fixtures de connexions                                                     | US-019 / US-020 |

### Frontend

| Fichier / zone                                                          | Impact                                                                                     | US     |
|-------------------------------------------------------------------------|--------------------------------------------------------------------------------------------|--------|
| `models/settings.model.ts`, `models/project.model.ts`, `models/merge-request.model.ts` | Retrait `gitlabUrl`/`tokenConfigured`/`tokenHint`/`meUsername` de `Settings` ; nouveau `models/connection.model.ts` ; `Project.connectionId` ; `MergeRequestView.connection` | US-019 / US-021 |
| `core/api/` : nouveau `connections.service.ts` ; `settings.service.ts`, `projects.service.ts` | Nouveaux endpoints ; `postProject` avec `connectionId`                                     | US-019 |
| `stores/` : nouveau `connections.store.ts` ; `settings.store.ts`, `projects.store.ts`, `sync.store.ts`, `merge-requests.store.ts` | Liste des connexions, ajout/test/suppression ; clés d'erreur `forge.*`                     | US-019 |
| `features/settings/sections/gitlab-connection/` → `connections/`         | Refonte complète de la section 02 (liste + formulaire inline)                              | US-019 |
| `features/settings/sections/me/`, `me-identity.ts`                      | Un champ username par connexion, email global                                              | US-019 |
| `features/settings/sections/repositories/`, `repos-form.ts`             | Colonne / sélecteur « Connexion », placeholder du chemin selon la forge                    | US-019 / US-020 |
| `features/settings/settings-form.ts`, `settings-page.component.*`, `config-transfer.ts` | Formulaire sans URL / jeton ; identités ; export v2                                         | US-019 |
| `features/board/board-page.component.*` (bandeau), `board-toolbar/`     | Bandeau « Aucune connexion configurée » ; statut de synchro nommant la connexion en échec  | US-019 / US-021 |
| `features/board/mr-table/`, `shared/avatar/`, `summarize-users.ts`      | Icône de forge sur le tag projet, infobulle ; commentaires de code « ordre GitLab » → « ordre de la forge » | US-021 |
| `features/board/filter-bar/`, `filters.store.ts`, `core/url-state/`     | Filtre composable « Connexion » (`connection=` dans l'URL)                                  | US-021 |
| `public/i18n/fr.json` **et** `public/i18n/en.json` (US-022, livrée) | Clés `settings.connection.*` → `settings.connections.*` ; textes « jeton GitLab » → neutres ; nouvelles clés GitHub — **toujours dans les deux fichiers**, sous peine d'échec de `dictionary-parity.spec.ts` | US-019 / US-020 |
| `shared/icons/`                                                         | Icônes Lucide `gitlab`, `github`                                                            | US-021 |

### Documentation et design

| Élément                                             | Impact                                                                                         | US     |
|-----------------------------------------------------|------------------------------------------------------------------------------------------------|--------|
| `docs/features/README.md`                           | Glossaire, écran Paramètres (sections 01/02/03), RG-G09 (identité par connexion), RG-G17/G18 (jetons au pluriel), QO-G, hors périmètre | US-019 |
| `docs/tech/architecture-backend.md`                 | Modèle de données §4, contrat API §5, module forges §6, sync §7                                | US-019 |
| `docs/tech/architecture-frontend.md`                | Organisation `settings/sections`, stores                                                       | US-019 |
| `docs/design/` (prototype, wireframe 1c)            | **Aucune maquette** pour la liste de connexions ni pour le sélecteur de connexion des repos : à produire en phase Architecte (voir US-019 §4) | US-019 |
| `docs/tech/docker.md`, `.env.example`               | Inchangés (`APP_SECRET` chiffre tous les jetons)                                               | —      |

## 6. Stratégie de migration des données

1. Créer `connections`.
2. Si `settings.gitlab_url` est renseignée (toujours vrai, défaut `https://gitlab.com`) : créer une connexion
   `{ type: 'gitlab', name: 'GitLab', url, token_encrypted, me_username }` — même sans jeton, pour que les repos
   existants restent rattachés à quelque chose et que l'écran affiche « Aucun jeton » plutôt que « Aucune
   connexion ». Cas particulier : si aucun repo n'existe **et** aucun jeton n'est configuré (installation vierge),
   ne créer aucune connexion.
3. Rattacher tous les `projects` à cette connexion ; convertir `gitlab_project_id` → `remote_project_id` (texte).
4. `users` : `connection_id` = cette connexion ; `gitlab_user_id` → `remote_user_id` (texte).
5. `merge_requests` : `gitlab_mr_id` → `remote_id` (texte).
6. Supprimer `settings.gitlab_url`, `settings.gitlab_token_encrypted`, `settings.me_username`.
7. `down` : opération inverse en ne conservant que la **première** connexion de type `gitlab` (documenté comme
   dégradant).

## 7. Risques et points d'attention

- **Reviewers GitHub** : GitHub retire un reviewer de `reviewRequests` dès qu'il a soumis sa revue. Sans règle
  dédiée, la colonne Reviewer se viderait après la première revue (voir RG-020-08 et QO-020-02).
- **Commentaires GitHub** : pas d'équivalent exact de `user_notes_count` ; approximation spécifiée (RG-020-07).
- **Identité** : `RG-G09` compare désormais le username de la connexion du projet ; l'email de repli n'est
  exploitable que sur GitLab (GitHub n'expose pas l'email des auteurs).
- **Renommages massifs** (`gitlab*` → `remote*` / `forge*`) : à faire dans US-019 en une seule fois, avec les tests,
  pour éviter une période mixte.
- **Coût GraphQL GitHub** : nœuds plus lourds (revues, checks) → pagination à 50 et budget 60 s par repo
  (RG-004-14) à surveiller sur les gros dépôts.
- **GitHub Enterprise Server** : disponibilité de certains champs GraphQL selon la version (QO-020-04).

## 8. Questions ouvertes de l'épique

- **QO-E01-01** : Un utilisateur qui n'a qu'une connexion GitLab doit-il voir le sélecteur de type et la colonne
  « Connexion » des repos ? Hypothèse : non — la liste des connexions est toujours visible (c'est la section 02),
  mais le sélecteur de connexion des repos et l'icône de forge dans le tableau n'apparaissent qu'à partir de deux
  connexions (RG-019-10, RG-021-01).
- **QO-E01-02** : Faut-il autoriser deux connexions sur la même URL (deux jetons, ex. personnel + groupe) ?
  Hypothèse : oui, l'unicité porte sur le **nom** de la connexion.
- **QO-E01-03** : Bitbucket / Gitea / Azure DevOps sont-ils envisagés à terme ? Hypothèse : non planifiés ; le
  contrat `ForgeClient` doit néanmoins les rendre possibles sans nouvelle migration du modèle.
- **QO-E01-04** : Faut-il un test automatique de toutes les connexions au démarrage / avant synchro (état
  « jeton expiré » visible sans cliquer « Tester ») ? Hypothèse : non, l'échec de synchro (statut `partial`/`error`
  nommant la connexion) suffit.
