# MR Board — Documentation fonctionnelle

Version : 1.0 — 2026-09-11
Statut : référence produit. Chaque User Story (US) est détaillée dans `docs/features/US-xxx-<slug>/specs.md`.

---

## 1. Vision

MR Board est une application web permettant à une équipe de développement de suivre, en un coup d'œil, les Merge
Requests (MR) ouvertes sur un ou plusieurs projets GitLab. Elle remplace la navigation projet par projet dans GitLab
par un tableau unique, filtrable et triable, qui met en avant ce qui attend une relecture depuis le plus longtemps et
ce qui est le plus simple à relire.

Objectifs :
- Réduire le délai de relecture des MRs en rendant visibles les MRs « prêtes » les plus anciennes
- Aider chacun à trouver rapidement les MRs qui le concernent (auteur, reviewer, affecté)
- Rester simple, rapide et agréable : un tableau, une barre de filtres, un écran de paramètres

Non-objectifs : MR Board ne modifie jamais rien sur GitLab (lecture seule), ne remplace pas l'interface de revue, et
ne gère pas d'issues ni de commentaires. Depuis US-017, l'état de la pipeline de tête est **affiché** comme une des
raisons de blocage de la colonne Statut, sans jamais lister les jobs ni relancer quoi que ce soit.

---

## 2. Personas

| Persona                    | Besoin principal                                                                                   |
|----------------------------|----------------------------------------------------------------------------------------------------|
| **Membre de l'équipe**     | Voir les MRs ouvertes de l'équipe, repérer celles qui l'attendent (reviewer/affecté), choisir une MR à relire |
| **Tech lead / mainteneur** | Surveiller les MRs qui stagnent (délai Ready élevé), équilibrer les relectures, configurer l'outil |

Dans les US, le persona « utilisateur » désigne indifféremment les deux ; « moi » désigne l'identité GitLab
configurée dans les paramètres.

---

## 3. Glossaire

| Terme                | Définition                                                                                              |
|----------------------|---------------------------------------------------------------------------------------------------------|
| **MR**               | Merge Request GitLab à l'état `opened`                                                                  |
| **Draft**            | MR marquée comme brouillon sur GitLab (flag `draft`, anciennement WIP)                                  |
| **Ready**            | MR ouverte et non draft                                                                                 |
| **Date Ready**       | Date à laquelle la MR est devenue Ready (voir RG-G05)                                                   |
| **Temps depuis Ready** | Délai écoulé entre la date Ready et maintenant, en jours                                              |
| **Difficulté**       | Estimation de l'effort de relecture (Easy / Medium / Hard) calculée sur les fichiers et lignes modifiés |
| **Reviewer**         | Utilisateur GitLab positionné comme reviewer de la MR                                                   |
| **Affecté** (assignee) | Utilisateur GitLab positionné comme assignee de la MR                                                 |
| **Approved**         | MR ayant reçu au moins une approbation                                                                  |
| **Statut**           | Mergeabilité d'une MR : `mergeable` / `blocked` / `unknown`, avec la liste ordonnée des raisons de blocage (US-017) |
| **Projet / Repo**    | Projet GitLab (`groupe/projet`) configuré pour être scanné                                              |
| **Alias**            | Nom court d'un projet, choisi par l'utilisateur, affiché dans le tableau et les filtres                 |
| **Synchronisation**  | Récupération des MRs depuis l'API GitLab et mise à jour du cache local (SQLite)                         |
| **Moi**              | Identité GitLab de l'utilisateur courant (username, email) utilisée par « Mes MRs »                     |
| **Jeton**            | Personal Access Token GitLab (scope `read_api`) utilisé par le backend                                  |
| **Thème**            | Préférence d'affichage `system` / `light` / `dark` (US-018)                                             |

---

## 4. Écrans

Maquettes : `docs/design/MR Board - Wireframes.dc.html` (1a, 1b, 1c) et `docs/design/MR Board - Prototype.dc.html`.

### 4.1 Tableau (route `/`)

Zones, de haut en bas :
1. **Toolbar** : brand « MR Board », statut de synchronisation (« Synchronisé il y a 2 min » / « Synchronisation en cours… »), bouton « Rafraîchir », bascule rapide clair/sombre (US-018), icône « Paramètres »
2. **Barre de progression** 2 px pendant une synchronisation
3. **Bandeau** « Aucun jeton GitLab configuré » avec bouton « Configurer » (si applicable)
4. **Barre de filtres** : chips « Drafts » et « Mes MRs » (toujours visibles, à gauche), séparateur, pastilles de filtres actifs (Projet, Auteur, Affecté à, Approved, Commenté), bouton « + Ajouter un filtre », compteur « 7 MRs · 2 projets », bouton « Effacer »
5. **Tableau** des MRs avec colonnes : Projet, Auteur, Titre, Difficulté (triable), Commentaires, Reviewer, Affecté, Approved, Statut (visible par défaut, US-017), Depuis Ready (triable), Ouverte (masquée par défaut), menu colonnes
6. **Pied** : rappel des règles (drafts après les ready, Mes MRs = auteur/reviewer/affecté)
7. **État vide** : « Aucune MR ne correspond aux filtres. » + « Effacer les filtres »

### 4.2 Paramètres (route `/settings`)

En-tête : retour, titre « Paramètres », « Annuler », « Enregistrer ». Corps en deux colonnes (titre de section à gauche,
contenu à droite), sections :
- `01 · Moi` — nom d'utilisateur GitLab, email (optionnel), aperçu de l'identité détectée
- `02 · Connexion GitLab` — URL de l'instance, jeton (masqué, affichable), « Tester la connexion »
- `03 · Repos à scanner` — tableau chemin / alias / supprimer, ligne d'ajout
- `04 · Actualisation` — fréquence (1, 5, 15, 30 min, Manuel), pause quand l'onglet est inactif
- `05 · Seuils` — difficulté (Easy < N fichiers & < N lignes, Hard > N fichiers ou > N lignes), délai Ready (vert ≤ N j, orange ≤ N j), jours ouvrés
- `06 · Divers` — thème (système / clair / sombre, US-018), notification navigateur, badge d'onglet, ouvrir dans un nouvel onglet, ignorer les labels `wip` / `on-hold`, exporter / importer / réinitialiser la config

---

## 5. Règles de gestion transverses (RG-G)

Ces règles s'appliquent à toutes les US. Chaque US les référence par identifiant et n'en redéfinit aucune.

| ID       | Règle                                                                                                                                                                                                                                                                                                                                                                       |
|----------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| RG-G01   | **Périmètre** : seules les MRs à l'état `opened` des projets configurés et activés sont affichées. Une MR fermée, fusionnée ou dont le projet est supprimé disparaît à la synchronisation suivante.                                                                                                                                                                             |
| RG-G02   | **Draft** : une MR est draft si GitLab la marque `draft: true`. Aucune détection par préfixe de titre côté MR Board (GitLab le fait déjà).                                                                                                                                                                                                                                       |
| RG-G03   | **Difficulté** : `lignes` = additions + suppressions ; `fichiers` = nombre de fichiers modifiés. Easy si `fichiers < easyFiles` **ET** `lignes < easyLines` ; Hard si `fichiers > hardFiles` **OU** `lignes > hardLines` ; Medium sinon. Défauts : easyFiles = 5, easyLines = 100, hardFiles = 20, hardLines = 800. Couleurs : Easy vert `#2f8f4e`, Medium orange `#d98a1f`, Hard rouge (accent). |
| RG-G04   | **Temps depuis Ready** : `jours` = nombre de jours entiers écoulés entre la date Ready et maintenant (`floor`). Vert si `jours ≤ readyGreen` (défaut 1), orange si `readyGreen < jours ≤ readyOrange` (défaut 3), rouge au-delà. Libellés : « aujourd'hui » (0), « N j ». Option « jours ouvrés » : ne compter que lundi→vendredi (jours fériés ignorés).                          |
| RG-G05   | **Date Ready** : GitLab n'expose pas cette date. Règle : si la MR a été créée non-draft, date Ready = `created_at` ; sinon date Ready = date de la première synchronisation où la MR est vue non-draft. Si une MR repasse en draft, la date Ready est effacée puis recalculée lors du prochain passage en Ready. Les drafts n'ont pas de date Ready.                                |
| RG-G06   | **Reviewer / Affecté** : GitLab permet plusieurs reviewers et assignees. MR Board affiche le premier (ordre GitLab) et indique « +N » avec la liste complète au survol. Les filtres et « Mes MRs » considèrent **tous** les reviewers/assignees.                                                                                                                                  |
| RG-G07   | **Approved** : une MR est approuvée si elle a au moins une approbation (`approved_by` non vide), indépendamment des règles d'approbation du projet.                                                                                                                                                                                                                              |
| RG-G08   | **Commentaires** : nombre de notes utilisateur (`user_notes_count`), hors notes système.                                                                                                                                                                                                                                                                                       |
| RG-G09   | **Mes MRs** : une MR est « à moi » si mon username (ou, à défaut, mon email) correspond à l'auteur, à l'un des reviewers ou à l'un des assignees. Comparaison insensible à la casse.                                                                                                                                                                                             |
| RG-G10   | **Tri par défaut** : MRs Ready par date Ready croissante (la plus ancienne en haut). Si les drafts sont affichés, ils viennent **après** toutes les MRs Ready, triés par date d'ouverture croissante. Un seul tri de colonne actif à la fois ; le tri de colonne ne s'applique qu'au bloc Ready, le bloc Drafts garde son ordre.                                                    |
| RG-G11   | **Titre** : tronqué avec ellipse sur une ligne, titre complet au survol ; le clic ouvre la page GitLab de la MR (même onglet par défaut, nouvel onglet si l'option est activée).                                                                                                                                                                                                 |
| RG-G12   | **Identité visuelle des utilisateurs** : avatar GitLab (carré 28 px) si disponible, sinon initiales (2 lettres max, majuscules, première lettre de chaque mot du nom). Nom complet au survol.                                                                                                                                                                                    |
| RG-G13   | **Filtre Affecté à** : filtre en OU sur Reviewer et Affecté (`reviewer ∈ sélection OU assignee ∈ sélection`). L'option « Nobody » retient les MRs sans reviewer **et** sans assignee. Plusieurs valeurs sélectionnées sont combinées en OU.                                                                                                                                       |
| RG-G14   | **Combinaison des filtres** : les différents filtres se combinent en ET ; les valeurs d'un même filtre multi-sélection en OU. Un filtre actif sans valeur (« tous ») n'exclut rien.                                                                                                                                                                                             |
| RG-G15   | **URL** : l'état des filtres, du tri et des colonnes visibles est reflété dans les query params de l'URL et restauré au chargement (voir US-011).                                                                                                                                                                                                                                 |
| RG-G16   | **Synchronisation** : une seule synchronisation à la fois ; le bouton « Rafraîchir » force toujours une synchronisation immédiate ; les synchronisations planifiées suivent la fréquence configurée (0 = manuel). Une erreur sur un projet n'empêche pas la synchronisation des autres.                                                                                          |
| RG-G17   | **Sécurité du jeton** : le jeton GitLab est stocké côté backend (chiffré au repos), jamais renvoyé en clair par l'API (seulement « configuré » + 4 derniers caractères), jamais loggé. Scope minimal `read_api`.                                                                                                                                                                  |
| RG-G18   | **Instance mono-utilisateur** (hypothèse v1) : une instance de MR Board sert un utilisateur (son jeton, son identité). Voir QO-G01.                                                                                                                                                                                                                                             |
| RG-G19   | **Compteurs de filtres** : dans chaque menu de filtre, le nombre affiché à côté d'une option est le nombre de MRs qui seraient visibles en sélectionnant cette option, tous les autres filtres actifs étant appliqués (le filtre courant exclu).                                                                                                                                  |
| RG-G20   | **Compteur global** : « N MR(s) · M projet(s) » = nombre de lignes affichées et nombre de projets distincts parmi ces lignes.                                                                                                                                                                                                                                                    |

---

## 6. Modèle conceptuel

```
Settings (singleton) ──── Projects (1..n) ──── MergeRequests (0..n) ──┬── author   : User
                                                                       ├── reviewers: User (0..n)
                                                                       └── assignees: User (0..n)
SyncRuns (historique des synchronisations)
```

Attributs d'une MR affichée (DTO `MergeRequestView`) : `id`, `projectAlias`, `iid`, `title`, `webUrl`, `draft`,
`author`, `reviewers[]`, `assignees[]`, `approved`, `commentsCount`, `changedFiles`, `changedLines`, `difficulty`
(`easy|medium|hard`), `createdAt`, `readyAt`, `readyDays`, `readyLevel` (`green|orange|red`), `isMine`, `labels[]`.

---

## 7. Roadmap et découpage en User Stories

Ordre logique d'implémentation : socle technique → configuration (sans laquelle rien ne fonctionne) → synchronisation →
affichage → calculs → tri → filtres → confort → options avancées. Chaque US est livrable et testable indépendamment
une fois ses dépendances réalisées.

### Prérequis techniques (via `/project:puretech`)

| ID       | Tâche                                                                                                           | Statut |
|----------|-----------------------------------------------------------------------------------------------------------------|--------|
| TECH-001 | Initialiser `backend/` : NestJS 11, TypeORM + better-sqlite3, config/env, migrations, Jest unit + e2e, ESLint, `.env.example`, préfixe `/api/v1`, endpoint `GET /health` | ✅ (voir `docs/tech/TECH-001-init-backend.md`) |
| TECH-002 | Initialiser `frontend/` : Angular 21, Angular Material (thème Modernist, Archivo, radius 0), `@ngrx/signals`, i18n custom, routing (`/`, `/settings`), proxy API, Vitest, ESLint, `changelog.json` | ✅ (voir `docs/tech/TECH-002-init-frontend.md`) |
| TECH-003 | Docker : `Dockerfile` backend et frontend, `docker-compose.yml` (volume SQLite)                                 | ☐ |

### User Stories

| ID     | Titre                                                    | Priorité | Complexité | Dépend de              | Statut |
|--------|----------------------------------------------------------|----------|------------|------------------------|--------|
| US-001 | Paramètres — Connexion GitLab (URL, jeton, test)         | Must     | M          | TECH-001, TECH-002     | ✅ |
| US-002 | Paramètres — Identité « Moi »                            | Must     | S          | US-001                 | ✅ |
| US-003 | Paramètres — Repos à scanner avec alias                  | Must     | M          | US-001                 | ✅ |
| US-004 | Synchronisation des MRs depuis GitLab                    | Must     | L          | US-001, US-003         | ✅ |
| US-005 | Tableau des MRs — colonnes de base                       | Must     | L          | US-004                 | ✅ |
| US-006 | Difficulté de la MR                                      | Must     | S          | US-005                 | ✅ |
| US-007 | Temps depuis Ready                                       | Must     | M          | US-005                 | ✅ |
| US-008 | Tri par défaut et tri sur colonnes                       | Must     | S          | US-006, US-007         | ✅ |
| US-009 | Filtres rapides « Drafts » et « Mes MRs »                | Must     | S          | US-002, US-008         | ✅ |
| US-010 | Filtres composables (Projet, Auteur, Affecté à, Approved, Commenté) | Must | L      | US-009                 | ✅ |
| US-011 | Filtres, tri et colonnes propagés dans l'URL             | Must     | M          | US-010                 | ✅ |
| US-012 | Colonnes redimensionnables                               | Should   | M          | US-005, US-011         | ✅ |
| US-013 | Actualisation automatique                                | Should   | M          | US-004                 | ✅ |
| US-014 | Paramètres — Seuils de difficulté et de délai Ready      | Should   | S          | US-006, US-007         | ✅ |
| US-015 | Paramètres — Options diverses (nouvel onglet, labels ignorés, export/import/reset) | Could | M | US-011, US-014 | ✅ |
| US-016 | Notifications navigateur et badge d'onglet               | Could    | M          | US-009, US-013         | ✅ |
| US-017 | Colonne « Statut » (mergeabilité : pipeline, conflits, approbations, discussions) | Should | M | US-004, US-011, US-012 | ✅ |
| US-018 | Thème sombre (système / clair / sombre)                  | Could    | M          | US-015                 | ✅ |
| US-019 | Connexions multi-forges — socle (GitLab uniquement)      | Must*    | L          | US-015, US-016         | ☐ |
| US-020 | Connexion GitHub (github.com et GitHub Enterprise)       | Must*    | L          | US-019, US-017         | ☐ |
| US-021 | Forges dans le tableau (icône, infobulle, filtre « Connexion ») | Should | S      | US-020, US-010         | ☐ |

\* Priorité **au sein de l'épique** `EPIC-001-multi-forges` (`docs/features/EPIC-001-multi-forges/README.md`,
inventaire complet des impacts sur le code) ; l'épique elle-même est une évolution post-MVP.

Périmètre **v1 (MVP)** : TECH-001 → US-011. **v1.1** : US-012 → US-014. **v1.2** : US-015, US-016.
**v2** : US-017 (livrée) puis, **propositions à valider**, US-018 → US-021, ordre conseillé :
US-018 → US-019 → US-020 → US-021 (US-017 avant US-020 pour que le mapping GitHub de la mergeabilité réutilise les
codes de RG-017-04).

> La visibilité de la colonne « Date d'ouverture » (menu « Colonnes », case à cocher) est traitée par **US-011**
> (RG-011-09/10/11), pas US-012, afin que le paramètre `cols` de l'URL ait un effet réel dès US-011. US-012 ne
> couvre plus que le redimensionnement des colonnes.

---

## 8. Questions ouvertes globales (QO-G)

| ID     | Question                                                                                                                                                                                    | Hypothèse retenue en attendant                                                                 |
|--------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|------------------------------------------------------------------------------------------------|
| QO-G01 | L'application est-elle déployée **par développeur** (instance locale / Docker, jeton personnel) ou **partagée** par l'équipe sur un serveur ? En mode partagé, « Moi » devrait être stocké par navigateur et le jeton serait un jeton d'équipe. | Instance mono-utilisateur (RG-G18). Tous les paramètres sont stockés en backend.                |
| QO-G02 | En cas de plusieurs reviewers/assignees, faut-il afficher tous les avatars ou seulement le premier ?                                                                                        | Premier + « +N » (RG-G06).                                                                     |
| QO-G03 | Faut-il reconstituer la date Ready exacte via l'historique GitLab (notes système « marked this merge request as ready ») pour les MRs déjà Ready au premier scan ?                          | Non en v1 (RG-G05) ; amélioration possible.                                                    |
| QO-G04 | Source des statistiques de lignes : l'API REST ne donne pas additions/suppressions par MR sans parcourir les diffs ; l'API GraphQL (`diffStatsSummary`) les donne directement.               | Utiliser GraphQL pour `additions`, `deletions`, `fileCount` ; REST pour le reste.              |
| QO-G05 | Les jours fériés doivent-ils être exclus en mode « jours ouvrés » ?                                                                                                                         | Non (lundi→vendredi uniquement).                                                               |
| QO-G06 | Faut-il une authentification devant MR Board ?                                                                                                                                              | Non en v1 (réseau de confiance / instance locale).                                             |
| QO-G07 | Le tri de colonne doit-il s'appliquer aussi au bloc Drafts ?                                                                                                                                | Non (RG-G10), les drafts restent triés par date d'ouverture.                                   |
| QO-G08 | (v2) Une pipeline en échec doit-elle rendre une MR « non fusionnable » même si le projet n'exige pas de pipeline verte ?                                                                     | Oui (RG-017-03, QO-017-01).                                                                    |
| QO-G09 | (v2) Le thème est-il une préférence backend (exportable) ou par navigateur ?                                                                                                                | Backend, `localStorage` comme cache anti-flash (QO-018-03).                                    |
| QO-G10 | (v2) Avec plusieurs forges, l'identité « moi » est-elle globale ou par connexion ?                                                                                                          | Username par connexion, email global en repli (RG-019-07 ; RG-G09 à amender à la livraison).   |
| QO-G11 | (v2) Sur GitHub, un reviewer ayant déjà soumis sa revue disparaît de `reviewRequests` : faut-il le garder dans la colonne Reviewer ?                                                        | Oui, reviewers demandés ∪ reviewers ayant répondu (RG-020-08, QO-020-02).                       |

---

## 10. Évolutions v2 (propositions)

Spécifiées en septembre 2026, non validées (à l'exception de **US-017** et **US-018**, livrées — leurs termes
« Statut » et « Thème » ont rejoint le glossaire, §3). Les termes ci-dessous rejoindront le glossaire à la livraison
des US concernées.

| Terme          | Définition                                                                                                  | US     |
|----------------|-------------------------------------------------------------------------------------------------------------|--------|
| **Forge**      | Plateforme hébergeant des MRs/PRs : `gitlab` ou `github`                                                     | US-019 |
| **Connexion**  | Forge + URL + jeton + mon nom d'utilisateur sur cette forge ; possède des repos                              | US-019 |
| **PR**         | Pull Request GitHub, traitée comme une MR dans tout MR Board                                                 | US-020 |

Impacts documentaires déjà appliqués : US-017 — §1 (non-objectif « pipelines » nuancé), §3 (glossaire, terme
« Statut »), §4.1 (colonne Statut), §9 (retrait de « pipelines / conflits ») ; US-018 — §3 (glossaire, terme
« Thème »), §4.1 (bascule toolbar), §4.2 (option Thème en 06), §9 (retrait de « Thème sombre »), §7 roadmap (✅).

Impacts documentaires restant prévus à la livraison des US suivantes : §4.2 (sections 01/02/03 des Paramètres),
RG-G09/G17/G18 (jetons et identités au pluriel), §6 (modèle : `Connections`), §9 (retrait de « GitHub »).

---

## 9. Hors périmètre v1

- Actions d'écriture sur GitLab (approuver, assigner, commenter, fusionner)
- Détail des jobs de pipeline, lien vers la pipeline, relance de pipeline (écriture) ; issues liées à une MR : hors
  périmètre (QO-017-04). L'**affichage** de la mergeabilité (pipeline, conflits, approbations, discussions) est
  livré par **US-017** (colonne Statut).
- Multi-utilisateurs avec comptes et rôles
- Historique / statistiques (temps moyen de relecture…)
- Support d'autres forges → **GitHub proposé en v2 : EPIC-001 (US-019 → US-021)** ; Bitbucket, Gitea, Azure DevOps : hors périmètre (QO-E01-03)
