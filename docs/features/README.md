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

Dans les US, le persona « utilisateur » désigne indifféremment les deux ; « moi » désigne mon identité — un nom
d'utilisateur par connexion et un email global (US-019) — configurée dans les paramètres.

---

## 3. Glossaire

| Terme                | Définition                                                                                              |
|----------------------|---------------------------------------------------------------------------------------------------------|
| **MR**               | Merge Request (GitLab) ou Pull Request (GitHub) ouverte ; désignées indifféremment « MR » dans l'application et cette documentation |
| **Draft**            | MR marquée comme brouillon par sa forge (`draft` sur GitLab, anciennement WIP)                          |
| **Ready**            | MR ouverte et non draft                                                                                 |
| **Date Ready**       | Date à laquelle la MR est devenue Ready (voir RG-G05)                                                   |
| **Temps depuis Ready** | Délai écoulé entre la date Ready et maintenant, en jours                                              |
| **Difficulté**       | Estimation de l'effort de relecture (Easy / Medium / Hard) calculée sur les fichiers et lignes modifiés |
| **Reviewer**         | Utilisateur positionné comme reviewer de la MR sur sa forge                                             |
| **Affecté** (assignee) | Utilisateur positionné comme assignee de la MR sur sa forge                                           |
| **Approved**         | MR ayant reçu au moins une approbation                                                                  |
| **Statut**           | Mergeabilité d'une MR : `mergeable` / `blocked` / `unknown`, avec la liste ordonnée des raisons de blocage (US-017) |
| **Forge**            | Plateforme hébergeant des MRs : `gitlab` ou `github` (US-020) — voir Connexion (US-019)                  |
| **Connexion**        | Instance d'une forge configurée (type, nom, URL, jeton, mon nom d'utilisateur sur cette forge) ; possède des repos (US-019) |
| **PR**               | Pull Request GitHub, traitée comme une MR dans tout MR Board (US-020)                                    |
| **Projet / Repo**    | Dépôt d'une connexion (`groupe/projet` sur GitLab, `owner/repo` sur GitHub) configuré pour être scanné    |
| **Alias**            | Nom court d'un projet, choisi par l'utilisateur, affiché dans le tableau et les filtres                 |
| **Synchronisation**  | Récupération des MRs depuis l'API de chaque connexion et mise à jour du cache local (SQLite)            |
| **Moi**              | Identité de l'utilisateur courant : un nom d'utilisateur **par connexion** (US-019) et un email global, utilisée par « Mes MRs » |
| **Jeton**            | Personal Access Token d'une connexion, stocké chiffré côté backend, jamais renvoyé en clair              |
| **Thème**            | Préférence d'affichage `system` / `light` / `dark` (US-018)                                             |
| **Langue**           | Langue de l'interface, `fr` (défaut) ou `en` ; préférence backend, dictionnaire `i18n/<langue>.json` (US-022) |
| **Anneau « moi »**   | Liseré accent autour de mon avatar (auteur, reviewer, affecté) dans le tableau, désactivable via `highlightMe` (US-023) |

---

## 4. Écrans

Maquettes : `docs/design/MR Board - Wireframes.dc.html` (1a, 1b, 1c) et `docs/design/MR Board - Prototype.dc.html`.

### 4.1 Tableau (route `/`)

Zones, de haut en bas :
1. **Toolbar** : brand « MR Board », statut de synchronisation (« Synchronisé il y a 2 min » / « Synchronisation en cours… »), bouton « Rafraîchir », bascule rapide clair/sombre (US-018), icône « Paramètres »
2. **Barre de progression** 2 px pendant une synchronisation
3. **Bandeau** « Aucune connexion configurée » (si aucune connexion, RG-019-17), ou « Aucun jeton configuré pour <connexions> » (si au moins une connexion sans jeton), avec bouton « Configurer » (si applicable)
4. **Barre de filtres** : chips « Drafts » et « Mes MRs » (toujours visibles, à gauche), séparateur, pastilles de filtres actifs (Projet, Auteur, Affecté à, Approved, Commenté), bouton « + Ajouter un filtre », compteur « 7 MRs · 2 projets », bouton « Effacer »
5. **Tableau** des MRs avec colonnes : Projet, Auteur, Titre, Difficulté (triable), Commentaires, Reviewer, Affecté, Approved, Statut (visible par défaut, US-017), Depuis Ready (triable), Ouverte (masquée par défaut), menu colonnes ; anneau accent autour de mon avatar dans les colonnes Auteur/Reviewer/Affecté (US-023, désactivable)
6. **Pied** : rappel des règles (drafts après les ready, Mes MRs = auteur/reviewer/affecté, anneau « moi » si actif — US-023)
7. **État vide** : « Aucune MR ne correspond aux filtres. » + « Effacer les filtres »

### 4.2 Paramètres (route `/settings`)

En-tête : retour, titre « Paramètres », « Annuler », « Enregistrer ». Corps en deux colonnes (titre de section à gauche,
contenu à droite), sections :
- `01 · Moi` — un nom d'utilisateur **par connexion** configurée (US-019), email (optionnel), aperçu de l'identité détectée par ligne, case « Surligner mes MRs dans le tableau » (US-023, activée par défaut)
- `02 · Connexions` — liste des connexions (type, nom, URL, état du jeton), chaque ligne repliable ; dépliée, elle affiche le formulaire de la connexion (tester/modifier/supprimer) **suivi de son propre tableau de repos** (chemin, alias, supprimer, ligne d'ajout) — les repos sont rattachés à leur connexion dans l'UI, il n'existe pas de section « Repos à scanner » séparée (US-019 corrigée par US-021, voir US-021 §0)
- `03 · Actualisation` — fréquence (1, 5, 15, 30 min, Manuel), pause quand l'onglet est inactif
- `04 · Seuils` — difficulté (Easy < N fichiers & < N lignes, Hard > N fichiers ou > N lignes), délai Ready (vert ≤ N j, orange ≤ N j), jours ouvrés
- `05 · Divers` — thème (système / clair / sombre, US-018), langue (français / anglais, US-022, sous le thème), notification navigateur, badge d'onglet, ouvrir dans un nouvel onglet, ignorer les labels `wip` / `on-hold`, exporter / importer / réinitialiser la config

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
| RG-G06   | **Reviewer / Affecté** : GitLab permet plusieurs reviewers et assignees. MR Board affiche le premier (ordre GitLab) et indique « +N » avec la liste complète au survol. Les filtres et « Mes MRs » considèrent **tous** les reviewers/assignees. Amendé par **US-023** (RG-023-06) : quand l'anneau « moi » est actif (RG-023-01) et que je figure parmi les reviewers/assignees sans être le premier, mon avatar est promu en position affichée ; le « +N » et l'infobulle restent en ordre GitLab.                                                                                                                                  |
| RG-G07   | **Approved** : une MR est approuvée si elle a au moins une approbation (`approved_by` non vide), indépendamment des règles d'approbation du projet.                                                                                                                                                                                                                              |
| RG-G08   | **Commentaires** : nombre de notes utilisateur (`user_notes_count`), hors notes système.                                                                                                                                                                                                                                                                                       |
| RG-G09   | **Mes MRs** : une MR est « à moi » si mon nom d'utilisateur **sur la connexion de son projet** (US-019 ; ou, à défaut, mon email global en repli quand la forge l'expose) correspond à l'auteur, à l'un des reviewers ou à l'un des assignees. Comparaison insensible à la casse. Un même username sur deux connexions différentes désigne deux identités distinctes.               |
| RG-G10   | **Tri par défaut** : MRs Ready par date Ready croissante (la plus ancienne en haut). Si les drafts sont affichés, ils viennent **après** toutes les MRs Ready, triés par date d'ouverture croissante. Un seul tri de colonne actif à la fois ; le tri de colonne ne s'applique qu'au bloc Ready, le bloc Drafts garde son ordre.                                                    |
| RG-G11   | **Titre** : tronqué avec ellipse sur une ligne, titre complet au survol ; le clic ouvre la page GitLab de la MR (même onglet par défaut, nouvel onglet si l'option est activée).                                                                                                                                                                                                 |
| RG-G12   | **Identité visuelle des utilisateurs** : avatar GitLab (carré 28 px) si disponible, sinon initiales (2 lettres max, majuscules, première lettre de chaque mot du nom). Nom complet au survol. Amendée par **US-024** : le repli sur les initiales s'applique aussi quand l'URL existe mais que l'image échoue à charger (lien mort), pas seulement quand elle est absente.       |
| RG-G13   | **Filtre Affecté à** : filtre en OU sur Reviewer et Affecté (`reviewer ∈ sélection OU assignee ∈ sélection`). L'option « Nobody » retient les MRs sans reviewer **et** sans assignee. Plusieurs valeurs sélectionnées sont combinées en OU.                                                                                                                                       |
| RG-G14   | **Combinaison des filtres** : les différents filtres se combinent en ET ; les valeurs d'un même filtre multi-sélection en OU. Un filtre actif sans valeur (« tous ») n'exclut rien.                                                                                                                                                                                             |
| RG-G15   | **URL** : l'état des filtres, du tri et des colonnes visibles est reflété dans les query params de l'URL et restauré au chargement (voir US-011).                                                                                                                                                                                                                                 |
| RG-G16   | **Synchronisation** : une seule synchronisation à la fois ; le bouton « Rafraîchir » force toujours une synchronisation immédiate ; les synchronisations planifiées suivent la fréquence configurée (0 = manuel). Une erreur sur un projet n'empêche pas la synchronisation des autres.                                                                                          |
| RG-G17   | **Sécurité des jetons** : le jeton de chaque connexion (US-019) est stocké côté backend (chiffré au repos), jamais renvoyé en clair par l'API (seulement « configuré » + 4 derniers caractères), jamais loggé. Scope minimal en lecture seule pour chaque forge (`read_api` pour GitLab).                                                                                        |
| RG-G18   | **Instance mono-utilisateur** (hypothèse v1) : une instance de MR Board sert un utilisateur (ses connexions, leurs jetons, ses identités par connexion). Voir QO-G01.                                                                                                                                                                                                            |
| RG-G19   | **Compteurs de filtres** : dans chaque menu de filtre, le nombre affiché à côté d'une option est le nombre de MRs qui seraient visibles en sélectionnant cette option, tous les autres filtres actifs étant appliqués (le filtre courant exclu).                                                                                                                                  |
| RG-G20   | **Compteur global** : « N MR(s) · M projet(s) » = nombre de lignes affichées et nombre de projets distincts parmi ces lignes.                                                                                                                                                                                                                                                    |

---

## 6. Modèle conceptuel

```
Settings (singleton, préférences globales) ── Connections (1..n, US-019) ──── Projects (1..n) ──── MergeRequests (0..n) ──┬── author   : User
                                                                                                                           ├── reviewers: User (0..n)
                                                                                                                           └── assignees: User (0..n)
SyncRuns (historique des synchronisations)
```

Chaque `Connection` (type, nom, URL, jeton chiffré, mon nom d'utilisateur sur cette forge) possède ses propres
`Projects` et `Users` (US-019) ; `Settings` ne porte plus que les préférences globales (email de repli, seuils,
thème, langue…), jamais l'URL, le jeton ou un nom d'utilisateur.

Attributs d'une MR affichée (DTO `MergeRequestView`) : `id`, `projectAlias`, `connection` (`{ id, name, type }`,
US-019), `iid`, `title`, `webUrl`, `draft`, `author`, `reviewers[]`, `assignees[]`, `approved`, `commentsCount`,
`changedFiles`, `changedLines`, `difficulty` (`easy|medium|hard`), `createdAt`, `readyAt`, `readyDays`, `readyLevel`
(`green|orange|red`), `isMine`, `labels[]`. Chaque utilisateur embarqué (`author`, `reviewers[]`, `assignees[]`)
porte aussi `isMe` (US-023, RG-023-05, résolu par connexion depuis US-019) ; le paramètre `Settings.highlightMe`
(défaut `true`) contrôle uniquement l'affichage de l'anneau, pas le calcul.

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
| US-019 | Connexions multi-forges — socle (GitLab uniquement)      | Must*    | L          | US-015, US-016         | ✅ |
| US-020 | Connexion GitHub (github.com et GitHub Enterprise)       | Must*    | L          | US-019, US-017         | ✅ |
| US-021 | Forges dans le tableau (icône, infobulle, filtre « Connexion ») | Should | S      | US-020, US-010         | ✅ |
| US-022 | Support d'autres langues (anglais, choix dans « Divers ») | Should   | M          | US-015, US-018         | ✅ |
| US-023 | Surbrillance de « moi » dans le tableau (anneau accent sur mes avatars, option dans « Moi ») | Should | S | US-002, US-009, US-015, US-018 | ✅ |
| US-024 | Repli sur les initiales quand l'image d'avatar ne charge pas (lien cassé)          | Should   | S          | US-005                 | ✅ |
| US-025 | Couleur d'arrière-plan par repo dans la colonne Projet et le filtre associé        | Should   | M          | US-003, US-005, US-021 | ✅ |
| US-026 | Recherche libre sur le titre des MRs                                               | Should   | S          | US-005, US-010, US-011 | ☐ |
| US-027 | Favoris : suivre une MR en particulier (étoile + filtre rapide)                    | Should   | M          | US-004, US-005, US-009, US-011, US-015 | ☐ |
| US-028 | Labels dans le tableau : colonne optionnelle et filtre                             | Should   | M          | US-005, US-010, US-011, US-012, US-015 | ☐ |

\* Priorité **au sein de l'épique** `EPIC-001-multi-forges` (`docs/features/EPIC-001-multi-forges/README.md`,
inventaire complet des impacts sur le code) ; l'épique elle-même est une évolution post-MVP.

Périmètre **v1 (MVP)** : TECH-001 → US-011. **v1.1** : US-012 → US-014. **v1.2** : US-015, US-016.
**v2** : US-017, US-018, US-019, US-020, US-021, US-022 et US-023 — toutes livrées (épique multi-forges compris,
voir `docs/features/EPIC-001-multi-forges/README.md`). US-022 ayant été livrée avant l'épique, les libellés de
US-019 → US-021 ont été traduits en anglais dès leur ajout à `en.json`. US-017 est passée avant US-020 pour que le
mapping GitHub de la mergeabilité réutilise les codes de RG-017-04.

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
| QO-G12 | (v2) La langue de l'interface doit-elle suivre celle du navigateur au premier lancement ?                                                                                                  | Non, défaut `fr` explicite, préférence backend comme le thème (RG-022-05, QO-022-01).            |
| QO-G13 | (v2) Quand je suis reviewer / affecté sans être le premier (RG-G06), mon avatar doit-il être promu en tête de cellule pour porter l'anneau ?                                                | Oui (RG-023-06, QO-023-01) ; RG-G06 à amender à la livraison de US-023.                           |

---

## 10. Évolutions v2 (propositions)

Spécifiées en septembre 2026, non validées à l'exception de **US-017**, **US-018**, **US-019**, **US-020**,
**US-021**, **US-022** et **US-023**, livrées — leurs termes « Statut », « Thème », « Langue »,
« Forge »/« Connexion »/« PR » et « Anneau « moi » » ont rejoint le glossaire, §3. Aucun terme en attente pour le
moment.

Impacts documentaires déjà appliqués : US-017 — §1 (non-objectif « pipelines » nuancé), §3 (glossaire, terme
« Statut »), §4.1 (colonne Statut), §9 (retrait de « pipelines / conflits ») ; US-018 — §3 (glossaire, terme
« Thème »), §4.1 (bascule toolbar), §4.2 (option Thème, section « Divers »), §9 (retrait de « Thème sombre »), §7
roadmap (✅) ; US-022 — §3 (glossaire, terme « Langue »), §4.2 (option « Langue », section « Divers », sous
« Thème »), §6 (attribut `language` de `Settings`), `docs/tech/i18n.md` (un dictionnaire par langue, repli,
réactivité), §7 roadmap (✅) ; US-023 — §3 (glossaire, terme « Anneau « moi » »), §4.1 (zone 5 : anneau accent sur
mes avatars ; zone 6 : pied de page conditionnel), §4.2 (case « Surligner mes MRs » en 01), §5 (RG-G06 amendée par
RG-023-06), §6 (`isMe` sur `author`/`reviewers[]`/`assignees[]`, attribut `highlightMe` de `Settings`), §7 roadmap
(✅) ; US-019 — §3 (glossaire, termes « Forge »/« Connexion », généralisation de MR/Reviewer/Affecté/Projet/
Synchronisation/Moi/Jeton), §4.1 (bandeau différenciant absence de connexion / jeton manquant), §4.2 (section 01
« Moi » par connexion), §5 (RG-G09/G17/G18 au pluriel / par connexion), §6 (entité `Connections`, attribut
`connection` de `MergeRequestView`), §7 roadmap (✅) ; US-020 — §3 (glossaire, généralisation des termes « MR »/
« Forge »/« Projet / Repo », ajout du terme « PR »), §9 (retrait de « GitHub » de la liste des forges hors
périmètre), §7 roadmap (✅) ; US-021 — §4.2 (section 02 « Connexions » absorbant les repos, ex-« 03 · Repos à
scanner » supprimée, renumérotation 03/04/05 des sections suivantes — voir US-021 §0), §9 (retrait de la mention
des indicateurs de forge/filtre « Connexion » restant à livrer), §7 roadmap (✅).

Impacts documentaires restant prévus : RG-G09/G17/G18 (jetons et identités au pluriel dans leur formulation exacte),
§6 (modèle conceptuel : renommer `Connections` en toutes lettres si une future US y touche).

US-021 amende en outre RG-019-10/11/15 (US-019, livrée) : la section « 03 · Repos à scanner » disparaît, ses repos
étant désormais gérés dans la fiche dépliée de leur connexion (§4.2 mis à jour ci-dessus) ; voir US-021 §0 pour le
détail du correctif et sa justification (écart constaté avec le prototype mis à jour après la rédaction de US-019).

---

## 9. Hors périmètre v1

- Actions d'écriture sur GitLab (approuver, assigner, commenter, fusionner)
- Détail des jobs de pipeline, lien vers la pipeline, relance de pipeline (écriture) ; issues liées à une MR : hors
  périmètre (QO-017-04). L'**affichage** de la mergeabilité (pipeline, conflits, approbations, discussions) est
  livré par **US-017** (colonne Statut).
- Multi-utilisateurs avec comptes et rôles
- Historique / statistiques (temps moyen de relecture…)
- Support d'autres forges → GitLab et GitHub livrés (EPIC-001, US-019/US-020/US-021, épique complète) ; Bitbucket,
  Gitea, Azure DevOps : hors périmètre (QO-E01-03)
