# MR Board

MR Board est une application web qui permet à une équipe de suivre, en un coup d'œil, les Merge Requests (GitLab)
et Pull Requests (GitHub) ouvertes sur plusieurs projets. Elle remplace la navigation projet par projet dans
GitLab/GitHub par un **tableau unique, filtrable et triable**, qui met en avant ce qui attend une relecture depuis
le plus longtemps et ce qui est le plus simple à relire.

MR Board est **strictement en lecture seule** : elle n'approuve, n'assigne, ne commente et ne fusionne jamais rien
sur vos forges — elle se contente de synchroniser périodiquement leurs API et de mettre en forme le résultat.

---

## Sommaire

- [Fonctionnalités](#fonctionnalités)
- [Aperçu des écrans](#aperçu-des-écrans)
- [Paramétrage](#paramétrage)
- [Démarrer avec Docker](#démarrer-avec-docker)
- [Variables d'environnement](#variables-denvironnement)
- [Développement local (sans Docker)](#développement-local-sans-docker)
- [Documentation complémentaire](#documentation-complémentaire)
- [Licence](#licence)

---

## Fonctionnalités

- **Multi-forges** : GitLab (gitlab.com ou instance auto-hébergée) et GitHub (github.com ou GitHub Enterprise
  Server), plusieurs connexions simultanées de types différents.
- **Tableau unique** : Projet, Auteur, Titre, Difficulté, Commentaires, Reviewer, Affecté, Approved, Statut,
  Depuis Ready — avec, dès qu'il y a plusieurs connexions, une icône de forge sur le tag projet et une infobulle
  précisant la connexion d'origine.
- **Difficulté de relecture** calculée automatiquement (Easy / Medium / Hard) à partir du nombre de fichiers et de
  lignes modifiés, seuils personnalisables.
- **Temps depuis Ready** : délai écoulé depuis que la MR est sortie de l'état brouillon, avec code couleur
  (vert / orange / rouge) et option « jours ouvrés uniquement ».
- **Statut de mergeabilité** : pipeline en échec, conflits, approbations manquantes, discussions non résolues —
  affiché, jamais relancé.
- **Filtres composables** (Connexion, Projet, Auteur, Affecté à, Approved, Commenté) combinables entre eux, plus les
  raccourcis « Drafts » et « Mes MRs » ; l'état complet (filtres, tri, colonnes) est reflété dans l'URL et donc
  partageable ou à mettre en favori.
- **Synchronisation automatique** à fréquence réglable, ou manuelle via le bouton Rafraîchir.
- **Notifications navigateur** et badge sur l'onglet quand une MR m'est assignée ou passe en zone rouge.
- **Thème** clair / sombre / système et **langue** français / anglais.
- **Anneau visuel** autour de mes avatars (auteur, reviewer, affecté) pour repérer mes MRs d'un coup d'œil.
- **Export / import** de toute la configuration (hors jetons) au format JSON, et réinitialisation aux valeurs par
  défaut.

## Aperçu des écrans

### Tableau (`/`)

Toolbar (statut de synchro, bouton Rafraîchir, bascule de thème, accès aux paramètres) → bandeau d'alerte si aucune
connexion ou aucun jeton n'est configuré → barre de filtres → tableau des MRs → pied de page récapitulant les
règles d'affichage actives.

### Paramètres (`/settings`)

Cinq sections, dans l'ordre où elles apparaissent à l'écran :

| # | Section | Rôle |
|---|---------|------|
| 01 | Moi | Mon identité (voir [Paramétrage](#01--moi)) |
| 02 | Connexions | Mes forges et leurs dépôts (voir [Paramétrage](#02--connexions)) |
| 03 | Actualisation | Fréquence de synchronisation |
| 04 | Seuils | Règles de calcul Difficulté / Depuis Ready |
| 05 | Divers | Thème, langue, notifications, export/import |

Rien n'est perdu par erreur : un bandeau de confirmation apparaît si vous quittez l'écran avec des modifications non
enregistrées (les connexions et les dépôts, eux, sont enregistrés immédiatement, indépendamment du bouton
« Enregistrer »).

## Paramétrage

### 01 · Moi

| Paramètre | Rôle |
|-----------|------|
| Nom d'utilisateur (par connexion) | Mon identifiant sur **cette** forge ; sert à calculer « Mes MRs » et l'anneau visuel. Une ligne apparaît par connexion configurée. |
| Email (optionnel) | Identité de repli, utilisée uniquement si une forge n'expose pas mon nom d'utilisateur d'auteur. |
| Surligner mes MRs dans le tableau | Active/désactive l'anneau visuel autour de mes avatars (activé par défaut). |

### 02 · Connexions

Chaque connexion représente **une forge** : GitLab ou GitHub, une URL d'instance, un jeton d'accès, et — depuis la
même fiche, une fois dépliée — la liste de ses propres dépôts (aucun réglage global des dépôts : chacun est
toujours rattaché à sa connexion).

| Champ | Rôle |
|-------|------|
| Type | GitLab ou GitHub (figé après création). |
| Nom | Nom libre affiché dans l'app (ex. « gitlab.com », « GitLab interne »). Unique, ne peut contenir ni virgule ni point-virgule. |
| URL | Adresse de l'instance (`https://gitlab.com`, `https://github.com`, ou une instance auto-hébergée / GitHub Enterprise Server). |
| Jeton d'accès personnel | Un *Personal Access Token* en lecture seule (`read_api` sur GitLab ; scope `repo` ou permissions fine-grained *Pull requests* / *Commit statuses* / *Checks* sur GitHub). Chiffré au repos, jamais renvoyé en clair par l'API. |
| Dépôts de cette connexion | `groupe/projet` (GitLab) ou `owner/repo` (GitHub) à surveiller, chacun avec un alias court affiché dans le tableau. |

Le bouton « Tester » vérifie le jeton sans l'enregistrer ; « Supprimer » retire la connexion, ses dépôts et leurs
MRs du tableau après confirmation.

### 03 · Actualisation

| Paramètre | Valeur par défaut | Rôle |
|-----------|--------------------|------|
| Fréquence de synchronisation | 5 min | 1, 5, 15, 30 min, ou « Manuel » (0 = seul le bouton Rafraîchir déclenche une synchro). |
| Mettre en pause quand l'onglet est inactif | Activé | Suspend le polling automatique tant que l'onglet n'est pas au premier plan. |

### 04 · Seuils

| Paramètre | Valeur par défaut | Rôle |
|-----------|--------------------|------|
| Difficulté Easy | < 5 fichiers **et** < 100 lignes | En dessous de ces deux seuils, une MR est classée Easy. |
| Difficulté Hard | > 20 fichiers **ou** > 800 lignes | Au-delà de l'un des deux seuils, une MR est classée Hard (Medium sinon). |
| Délai Ready — vert | ≤ 1 jour | Temps depuis Ready considéré comme récent. |
| Délai Ready — orange | ≤ 3 jours | Au-delà : rouge. |
| Compter uniquement les jours ouvrés | Désactivé | Exclut les week-ends du calcul du délai Ready (jours fériés non gérés). |

### 05 · Divers

| Paramètre | Valeur par défaut | Rôle |
|-----------|--------------------|------|
| Thème | Système | Clair / Sombre / Système (suit les préférences du système d'exploitation). |
| Langue | Français | Français ou anglais, s'applique immédiatement à toute l'interface. |
| Notification navigateur | Désactivé | Notifie quand une MR m'est assignée (reviewer ou affecté) ; demande la permission du navigateur à l'activation. |
| Badge de compteur sur l'onglet | Désactivé | Affiche `(N)` dans le titre de l'onglet pour le nombre de MRs en zone rouge. |
| Ouvrir les MRs dans un nouvel onglet | Désactivé | Change le comportement du clic sur le titre d'une MR. |
| Ignorer les MRs avec le label wip / on-hold | Aucun label ignoré | Liste de labels dont les MRs sont totalement exclues du tableau et des compteurs. |
| Exporter / Importer la config (JSON) | — | Sauvegarde ou restaure connexions (sans jeton), dépôts et préférences ; les jetons sont à ressaisir après import. |
| Réinitialiser | — | Restaure toutes les valeurs par défaut de cet écran, sans toucher aux connexions ni aux dépôts, et sans rien enregistrer tant que vous ne cliquez pas sur « Enregistrer ». |

## Démarrer avec Docker

Une seule image construit le frontend Angular et l'API NestJS, puis exécute **un seul process Node** qui sert
l'API sur `/api/v1` et l'interface sur `/` — un seul port, pas de nginx.

```bash
cp .env.example .env            # copier le modèle...
# ... puis éditer .env et renseigner APP_SECRET (voir ci-dessous)
docker compose up -d --build    # construit l'image et démarre le container
```

L'application est ensuite accessible sur **http://localhost:3000** (ou le port choisi via `MR_BOARD_PORT`). Il ne
reste plus qu'à ouvrir `/settings` et déclarer une première connexion (voir [Paramétrage](#02--connexions)).

```bash
docker compose logs -f          # suivre les logs
docker compose down             # arrêter — la base SQLite est conservée sur l'hôte
```

**Persistance** : le fichier SQLite vit dans `./data/mr-board.sqlite`, sur l'hôte (bind mount), donc en dehors du
cycle de vie du container — il survit à `docker compose down`, à un `docker rm` ou à la suppression de l'image.

**Build et lancement séparés** : `docker-compose.yml` référence l'image `mr-board:local` ; si elle existe déjà,
`docker compose up` (sans `--build`) la relance sans reconstruire, ce qui permet de séparer les deux étapes :

```bash
docker build -t mr-board:local .   # construit et tague l'image
docker compose up -d               # démarre ce tag avec les variables de ./.env
```

> ⚠️ Ne lancez jamais l'image avec un `docker run` direct (ni via l'action « Run Dockerfile » d'un IDE) :
> contrairement à `docker compose`, `docker run` ne lit pas `.env` automatiquement et `APP_SECRET` sera absent, ce
> qui empêche l'API de démarrer. Passez toujours par `docker compose up`, ou par
> `docker run --env-file .env ...` si un lancement hors compose est vraiment nécessaire.

Détails complets (étapes du Dockerfile, migration depuis un ancien volume nommé, choix d'architecture) dans
[`docs/tech/docker.md`](docs/tech/docker.md).

## Variables d'environnement

Variables lues par `docker compose` (fichier `.env`, jamais committé — voir `.env.example`) :

| Variable | Défaut | Rôle |
|----------|--------|------|
| `APP_SECRET` | *(obligatoire)* | Clé de chiffrement des jetons stockés en base (≥ 16 caractères). À générer une fois, par exemple avec `openssl rand -hex 32`, et à conserver : la changer rend les jetons déjà enregistrés illisibles. |
| `MR_BOARD_PORT` | `3000` | Port exposé sur l'hôte. |
| `CORS_ORIGIN` | `http://localhost:3000` | Origine autorisée par CORS — à faire correspondre à l'URL réellement utilisée pour accéder à l'application. |
| `LOG_LEVEL` | `log` | Niveau de log NestJS (`error` \| `warn` \| `log` \| `debug` \| `verbose`). |

Le container fixe par ailleurs `DB_PATH=/app/data/mr-board.sqlite`, `STATIC_DIR=/app/public` et
`NODE_ENV=production`, et tourne avec un utilisateur non-root.

## Développement local (sans Docker)

Prérequis : Node.js 22 (aucune CLI globale requise, on utilise `npx nest` / `npx ng`).

```bash
# Backend — API sur http://localhost:3000 (préfixe /api/v1)
cd backend
npm install
cp .env.example .env    # renseigner au moins APP_SECRET
npm run start:dev

# Frontend — http://localhost:4200 (proxy /api vers :3000)
cd frontend
npx npm@11 install      # npm 10.9 échoue sur ce projet (bug Arborist avec Vitest 4)
npm start
```

> Sous Windows, `npm run test:e2e` (backend) et `ng test` (frontend) sont également disponibles ; voir
> [`CLAUDE.md`](CLAUDE.md) et [`docs/tech/testing.md`](docs/tech/testing.md) pour le détail des commandes de test
> et des seuils de couverture.

## Documentation complémentaire

- [`docs/features/README.md`](docs/features/README.md) — vision produit, glossaire, règles de gestion et roadmap
  détaillée de chaque fonctionnalité (User Stories)
- [`docs/tech/architecture-backend.md`](docs/tech/architecture-backend.md) et
  [`docs/tech/architecture-frontend.md`](docs/tech/architecture-frontend.md) — architecture technique
- [`docs/tech/docker.md`](docs/tech/docker.md) — déploiement Docker en détail
- [`docs/design/`](docs/design/) — prototype, wireframes et design system de référence

## Licence

Distribuée sous licence [Apache License 2.0](LICENSE).
