# US-001 — Paramètres : Connexion GitLab

## 1. Reformulation

L'utilisateur doit pouvoir indiquer à MR Board l'instance GitLab à interroger et le jeton d'accès personnel à
utiliser, puis vérifier que la connexion fonctionne. Cette US pose aussi le squelette de l'écran Paramètres
(en-tête, Annuler / Enregistrer, retour au tableau, toast de confirmation) et le module backend `settings`
sur lequel s'appuient toutes les autres sections de paramètres.

## 2. User Stories

- **US-001** : En tant qu'utilisateur, je veux configurer l'URL de mon instance GitLab et mon jeton d'accès, et tester
  la connexion, afin que MR Board puisse récupérer mes Merge Requests.
    - Priorité : Must
    - Complexité estimée : M
    - Dépendances : TECH-001, TECH-002

## 3. Règles de gestion

- **RG-001-01** : L'URL de l'instance est obligatoire, au format `https://hôte[:port]` sans chemin final ni `/` de fin (normalisée à l'enregistrement). Valeur par défaut : `https://gitlab.com`.
- **RG-001-02** : Le jeton est une chaîne non vide (typiquement `glpat-…`), saisie dans un champ masqué avec bouton « afficher / masquer ». Il est enregistré uniquement s'il a été saisi ; un champ laissé vide à l'enregistrement conserve le jeton existant.
- **RG-001-03** : Le jeton n'est jamais renvoyé par l'API (voir RG-G17). L'écran affiche à la place un indicateur « Jeton configuré (…xxxx) » avec les 4 derniers caractères, ou « Aucun jeton ».
- **RG-001-04** : « Tester la connexion » utilise l'URL et le jeton **tels que saisis à l'écran** (non encore enregistrés). Le backend appelle `GET /api/v4/user` et `GET /api/v4/personal_access_tokens/self`. Succès : affiche « ✓ Connecté · <nom complet> · expire le JJ/MM/AAAA » (ou « sans expiration »). Échec : « Échec : jeton refusé (401) », « Échec : instance injoignable », « Échec : scope insuffisant (read_api requis) ».
- **RG-001-05** : Le bouton « Tester la connexion » est désactivé si l'URL ou le jeton est vide, et pendant le test (libellé « Connexion… »).
- **RG-001-06** : « Enregistrer » persiste l'ensemble du formulaire Paramètres (toutes sections), affiche un toast « Paramètres enregistrés », retourne au tableau et déclenche une synchronisation (US-004). « Annuler » et le bouton retour abandonnent les modifications et retournent au tableau.
- **RG-001-07** : Si une modification non enregistrée existe, « Annuler » / retour demande confirmation (dialog Material « Abandonner les modifications ? »).
- **RG-001-08** : Le test de connexion réussi propose de renseigner automatiquement l'identité « Moi » (US-002) avec le username retourné, si le champ est vide.
- **RG-001-09** : Les paramètres sont un singleton côté backend (`settings.id = 1`), créés avec les valeurs par défaut au premier démarrage (migration).
- **RG-001-10** : Le backend chiffre le jeton avant stockage (AES-256-GCM, clé `APP_SECRET`). Si `APP_SECRET` change, le jeton devient illisible : l'API renvoie alors `tokenConfigured: false` et un avertissement est loggé.

## 4. Maquettes de référence

- Wireframe **1c** — section `02 · Connexion GitLab`, en-tête Paramètres (retour, Annuler, Enregistrer)
- Prototype — vue « Paramètres », comportement du bouton « Tester la connexion », toast « Paramètres enregistrés »

## 5. Critères d'acceptation

```gherkin
Scenario: Accéder à l'écran Paramètres depuis le tableau
  Given je suis sur le tableau
  When je clique sur l'icône « Paramètres »
  Then la route /settings s'affiche avec l'en-tête « Paramètres », les boutons « Annuler » et « Enregistrer »
  And la section « 02 · Connexion GitLab » présente les champs « URL de l'instance » et « Jeton d'accès personnel »

Scenario: Valeurs par défaut au premier lancement
  Given aucun paramètre n'a jamais été enregistré
  When j'ouvre /settings
  Then l'URL vaut « https://gitlab.com »
  And le champ jeton est vide et l'indicateur affiche « Aucun jeton »

Scenario: Enregistrer un jeton valide
  Given je saisis « https://gitlab.exemple.fr » et un jeton « glpat-abcd…wxyz »
  When je clique sur « Enregistrer »
  Then un toast « Paramètres enregistrés » s'affiche
  And je suis redirigé vers le tableau
  And une synchronisation est déclenchée
  And GET /api/v1/settings renvoie gitlabUrl = « https://gitlab.exemple.fr », tokenConfigured = true, tokenHint = « wxyz »
  And la réponse ne contient jamais le jeton en clair

Scenario: Conserver le jeton existant si le champ est vide
  Given un jeton est déjà configuré
  When je modifie uniquement l'URL et j'enregistre sans ressaisir le jeton
  Then le jeton précédent est conservé (tokenConfigured reste true)

Scenario: Normaliser l'URL
  When j'enregistre l'URL « https://gitlab.exemple.fr/ »
  Then l'URL stockée est « https://gitlab.exemple.fr »

Scenario: Refuser une URL invalide
  When j'enregistre l'URL « gitlab.exemple.fr » (sans schéma)
  Then l'API répond 400 avec un message de validation
  And le champ est marqué en erreur avec le libellé i18n correspondant

Scenario: Tester la connexion avec succès
  Given l'URL et un jeton valides sont saisis (non enregistrés)
  When je clique sur « Tester la connexion »
  Then le bouton affiche « Connexion… » et est désactivé pendant l'appel
  And le résultat « ✓ Connecté · Marie Dupont · expire le 12/03/2027 » s'affiche en vert

Scenario: Tester la connexion avec un jeton refusé
  Given GitLab répond 401
  When je clique sur « Tester la connexion »
  Then le message « Échec : jeton refusé (401) » s'affiche en rouge

Scenario: Tester la connexion avec une instance injoignable
  Given l'hôte ne répond pas dans le délai de 15 s
  When je clique sur « Tester la connexion »
  Then le message « Échec : instance injoignable » s'affiche

Scenario: Bouton de test désactivé sans jeton
  Given le champ jeton est vide
  Then le bouton « Tester la connexion » est désactivé

Scenario: Afficher / masquer le jeton
  Given le champ jeton contient une valeur masquée
  When je clique sur l'icône œil
  Then le jeton est affiché en clair
  When je clique à nouveau
  Then le jeton est masqué

Scenario: Annuler des modifications
  Given j'ai modifié l'URL sans enregistrer
  When je clique sur « Annuler »
  Then une confirmation « Abandonner les modifications ? » s'affiche
  When je confirme
  Then je reviens au tableau et l'URL précédente est conservée

Scenario: Jeton illisible après changement de clé
  Given un jeton a été enregistré avec un APP_SECRET différent
  When j'appelle GET /api/v1/settings
  Then tokenConfigured = false
  And un avertissement est loggé côté backend sans exposer le jeton
```

## 6. Questions ouvertes

- QO-001-01 : Faut-il supporter des jetons de groupe/projet (`glpat` de group access token) en plus des jetons personnels ? Hypothèse : oui implicitement, seul `read_api` importe ; l'identité « Moi » est alors saisie manuellement.
- QO-001-02 : Faut-il vérifier explicitement le scope `read_api` (l'endpoint `personal_access_tokens/self` renvoie `scopes`) ? Hypothèse : oui, message dédié si absent.
- Voir QO-G01 (déploiement mono/multi-utilisateur).

## 7. Hors périmètre

- Sections 01, 03, 04, 05, 06 de l'écran Paramètres (US-002, US-003, US-013, US-014, US-015)
- OAuth GitLab
- Multi-instances GitLab
