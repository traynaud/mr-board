# US-002 — Paramètres : Identité « Moi »

## 1. Reformulation

L'utilisateur indique qui il est sur GitLab (nom d'utilisateur, éventuellement email) afin que MR Board puisse
reconnaître ses rôles (auteur, reviewer, affecté) sur chaque MR. Cette identité alimente le filtre « Mes MRs »
(US-009) et les notifications (US-016). L'écran affiche un aperçu de l'identité résolue, en s'appuyant sur le
dernier test de connexion réussi de la session (US-001) — aucune résolution serveur de « qui est ce username »
n'est effectuée en dehors de ce test.

## 2. User Stories

- **US-002** : En tant qu'utilisateur, je veux définir mon identité GitLab (username, email) afin que l'application
  identifie les MRs où j'ai un rôle.
    - Priorité : Must
    - Complexité estimée : S
    - Dépendances : US-001

## 3. Règles de gestion

- **RG-002-01** : Le nom d'utilisateur GitLab (`username`, sans `@`) est le champ principal. L'email est optionnel et sert de repli pour la correspondance (RG-G09).
- **RG-002-02** : Le username et l'email sont stockés trimés. Une chaîne vide efface la valeur existante (stockée `null`) ; un champ absent du corps de la requête laisse la valeur existante inchangée (voir contrat API §4). La comparaison avec les utilisateurs GitLab (RG-G09, RG-002-03) est insensible à la casse.
- **RG-002-03** : Un aperçu affiche l'identité résolue à partir du champ « Nom d'utilisateur GitLab » **tel que saisi à l'écran** (pas besoin d'enregistrer pour la voir) et du dernier test de connexion réussi de la session (US-001, transitoire — non persisté). Quatre états, évalués dans cet ordre :
  1. **Non configurée** : le champ username est vide → aucun aperçu, juste la description de section.
  2. **Détectée via le jeton** : le champ n'est pas vide ET un test de connexion a réussi dans la session ET son `username` correspond (insensible à la casse) au champ → avatar/nom complet du résultat du test, tag « détecté via le jeton ».
  3. **Ne correspond pas** : le champ n'est pas vide ET un test a réussi ET son `username` ne correspond pas au champ → initiales calculées depuis le champ (RG-002-03bis), pas de nom complet, tag « ne correspond pas au jeton ».
  4. **Saisie manuelle** : le champ n'est pas vide ET aucun test n'a réussi dans la session → initiales calculées depuis le champ, pas de nom complet, tag « saisi manuellement ».
- **RG-002-03bis** (précision de RG-G12) : quand le nom complet n'est pas connu (états « ne correspond pas » / « saisi manuellement »), les initiales sont calculées depuis le champ username lui-même, en découpant sur espace, `.`, `-` et `_` (ex. `marie.dupont` → « MD », `jean-paul` → « JP », `mdupont` → « M »). Chaîne vide → `?`.
- **RG-002-04** : Après un test de connexion réussi (RG-001-04), si le champ username est vide, il est pré-rempli avec le username retourné par GitLab (le formulaire passe en modifié, non enregistré). Un username déjà saisi n'est jamais écrasé automatiquement.
- **RG-002-05** : Le username peut être vide : dans ce cas le filtre « Mes MRs » sera désactivé avec un tooltip « Configurez votre identité dans les paramètres » (comportement spécifié et réalisé par US-009 ; hors périmètre ici).
- **RG-002-06** : L'email, s'il est saisi, doit être un email valide ; un champ vide est accepté (efface la valeur existante, RG-002-02).

## 4. Contrat API (extension de US-001)

- `GET /api/v1/settings` et `PUT /api/v1/settings` renvoient désormais aussi `meUsername: string | null` et `meEmail: string | null`.
- `PUT /api/v1/settings` accepte deux champs supplémentaires optionnels dans le corps :
  - `meUsername?: string` — absent = inchangé ; `""` = efface (stocké `null`) ; sinon stocké trimé.
  - `meEmail?: string` — mêmes règles ; doit être un email valide quand non vide (400 sinon).
- Contrairement à `gitlabToken` (secret jamais pré-rempli, RG-001-02), ces deux champs sont des données visibles à l'écran : le frontend les envoie systématiquement avec la valeur courante du formulaire (vide comprise) à chaque enregistrement.

## 5. Maquettes de référence

- Wireframe **1c** — section `01 · Moi` (champs « Nom d'utilisateur GitLab », « Email (optionnel) », aperçu avec avatar « MD Marie Dupont · détecté via le jeton »)
- Prototype — vue « Paramètres », `meIni` / `meName` / `meStatus`
- `docs/tech/design-system.md` §4 — composant Avatar (carré 28 px, fond `neutral-800`, initiales blanches, tooltip nom complet)

## 6. Critères d'acceptation

```gherkin
Scenario: Saisir et enregistrer mon identité
  Given je suis sur /settings
  When je saisis « mdupont » dans « Nom d'utilisateur GitLab » et j'enregistre
  Then GET /api/v1/settings renvoie meUsername = « mdupont »

Scenario: Enregistrer un email valide
  When je saisis « marie@exemple.fr » dans « Email » et j'enregistre
  Then GET /api/v1/settings renvoie meEmail = « marie@exemple.fr »

Scenario: Email invalide
  When je saisis « marie@ » dans le champ email
  Then le champ est marqué en erreur et « Enregistrer » reste possible seulement une fois corrigé (formulaire invalide)
  And si l'appel est fait malgré tout (ex. curl), l'API répond 400

Scenario: Effacer mon identité
  Given meUsername = « mdupont » et meEmail = « marie@exemple.fr » sont enregistrés
  When je vide les deux champs et j'enregistre
  Then GET /api/v1/settings renvoie meUsername = null et meEmail = null

Scenario: Champ omis du corps de la requête
  Given meUsername = « mdupont » est enregistré
  When j'appelle PUT /api/v1/settings avec seulement { gitlabUrl }
  Then meUsername reste « mdupont » (inchangé)

Scenario: Aperçu — identité non configurée
  Given le champ username est vide
  Then aucun aperçu d'identité n'est affiché (seulement la description de section)

Scenario: Aperçu — pré-remplissage après test de connexion
  Given le champ username est vide
  When le test de connexion réussit avec l'utilisateur « mdupont » (Marie Dupont)
  Then le champ username vaut « mdupont » et le formulaire est modifié (non enregistré)
  And l'aperçu affiche l'avatar/initiales « MD », le nom « Marie Dupont » et le tag « détecté via le jeton »

Scenario: Aperçu — ne pas écraser un username déjà saisi
  Given le champ username vaut « kbenali »
  When le test de connexion réussit avec l'utilisateur « mdupont »
  Then le champ username reste « kbenali »
  And l'aperçu affiche le tag « ne correspond pas au jeton » (pas de nom complet, initiales « K »)

Scenario: Aperçu — saisie manuelle sans test
  Given aucun test de connexion n'a été lancé dans la session
  And le champ username vaut « lrousseau »
  Then l'aperçu affiche les initiales « L », pas de nom complet, et le tag « saisi manuellement »

Scenario Outline: Calcul des initiales sans nom complet connu
  Given le champ username vaut <username>
  Then les initiales affichées sont <initiales>

  Examples:
    | username        | initiales |
    | marie.dupont    | MD        |
    | jean-paul        | JP        |
    | mdupont          | M         |
    | l_rousseau       | LR        |

Scenario: Initiales calculées depuis un nom complet connu
  Given le test de connexion réussi retourne le nom complet « Léa Rousseau »
  And le champ username correspond
  Then l'aperçu affiche les initiales « LR »
  Given le test de connexion réussi retourne le nom complet « Ana »
  And le champ username correspond
  Then l'aperçu affiche les initiales « A »

Scenario: Avatar GitLab disponible
  Given le test de connexion réussi retourne un avatarUrl non nul et le username correspond
  Then l'aperçu affiche l'image de l'avatar (28 px carré) au lieu des initiales, avec le même tooltip (nom complet)
```

## 7. Questions ouvertes

- QO-002-01 : Faut-il permettre de choisir « Moi » dans une liste des utilisateurs rencontrés lors des synchronisations (autocomplétion) ? Hypothèse : non en v1, saisie libre + pré-remplissage. À revoir une fois US-004 (synchronisation) livrée et une table `users` peuplée.
- Voir QO-G01 (déploiement mono/multi-utilisateur — l'identité « Moi » est un paramètre serveur global, cohérent avec l'hypothèse mono-utilisateur retenue).

## 8. Hors périmètre

- Plusieurs identités / alias
- Résolution de l'identité par email ou par username via l'API GitLab (`/users?search=`) — l'aperçu ne s'appuie que sur le test de connexion de la session (RG-002-03)
- Désactivation effective du chip « Mes MRs » dans le tableau (US-009)
- Persistance de l'état « détecté via le jeton » entre deux sessions (il est recalculé côté client à chaque chargement, à partir d'un éventuel nouveau test)
