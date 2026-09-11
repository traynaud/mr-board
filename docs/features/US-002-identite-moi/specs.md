# US-002 — Paramètres : Identité « Moi »

## 1. Reformulation

L'utilisateur indique qui il est sur GitLab (nom d'utilisateur, éventuellement email) afin que MR Board puisse
reconnaître ses rôles (auteur, reviewer, affecté) sur chaque MR. Cette identité alimente le filtre « Mes MRs »
(US-009) et les notifications (US-016).

## 2. User Stories

- **US-002** : En tant qu'utilisateur, je veux définir mon identité GitLab (username, email) afin que l'application
  identifie les MRs où j'ai un rôle.
    - Priorité : Must
    - Complexité estimée : S
    - Dépendances : US-001

## 3. Règles de gestion

- **RG-002-01** : Le nom d'utilisateur GitLab (`username`, sans `@`) est le champ principal. L'email est optionnel et sert de repli pour la correspondance (RG-G09).
- **RG-002-02** : Le username est stocké tel que saisi, trimé ; la comparaison avec les utilisateurs GitLab est insensible à la casse.
- **RG-002-03** : Un aperçu affiche l'identité résolue : avatar/initiales + nom complet + statut. Statut « détecté via le jeton » si le username correspond à l'utilisateur du jeton (test de connexion, US-001) ; « non trouvé » si aucune correspondance connue ; « saisi manuellement » sinon.
- **RG-002-04** : Après un test de connexion réussi (RG-001-08), si le champ username est vide, il est pré-rempli avec le username retourné par GitLab et l'aperçu passe à « détecté via le jeton ».
- **RG-002-05** : Le username peut être vide : dans ce cas le filtre « Mes MRs » est désactivé avec un tooltip « Configurez votre identité dans les paramètres » (US-009).
- **RG-002-06** : L'email, s'il est saisi, doit être un email valide (validation DTO `@IsEmail`).

## 4. Maquettes de référence

- Wireframe **1c** — section `01 · Moi` (champs « Nom d'utilisateur GitLab », « Email (optionnel) », aperçu avec avatar « MD Marie Dupont · détecté via le jeton »)
- Prototype — vue « Paramètres », `meIni` / `meName` / `meStatus`

## 5. Critères d'acceptation

```gherkin
Scenario: Saisir et enregistrer mon identité
  Given je suis sur /settings
  When je saisis « mdupont » dans « Nom d'utilisateur GitLab » et j'enregistre
  Then GET /api/v1/settings renvoie meUsername = « mdupont »

Scenario: Pré-remplissage après test de connexion
  Given le champ username est vide
  When le test de connexion réussit avec l'utilisateur « mdupont » (Marie Dupont)
  Then le champ username vaut « mdupont »
  And l'aperçu affiche « MD », « Marie Dupont » et le tag « détecté via le jeton »

Scenario: Ne pas écraser un username déjà saisi
  Given le champ username vaut « kbenali »
  When le test de connexion réussit avec l'utilisateur « mdupont »
  Then le champ username reste « kbenali »
  And l'aperçu affiche le tag « saisi manuellement »

Scenario: Email invalide
  When je saisis « marie@ » dans le champ email et j'enregistre
  Then l'API répond 400
  And le champ email est en erreur

Scenario: Identité vide
  Given le username est vide et enregistré
  When j'ouvre le tableau
  Then le chip « Mes MRs » est désactivé avec un tooltip invitant à configurer l'identité

Scenario: Initiales calculées
  Given l'utilisateur résolu s'appelle « Léa Rousseau »
  Then l'aperçu affiche les initiales « LR »
  Given l'utilisateur résolu s'appelle « Ana »
  Then l'aperçu affiche « A »
```

## 6. Questions ouvertes

- QO-002-01 : Faut-il permettre de choisir « Moi » dans une liste des utilisateurs rencontrés lors des synchronisations (autocomplétion) ? Hypothèse : non en v1, saisie libre + pré-remplissage.
- Voir QO-G01.

## 7. Hors périmètre

- Plusieurs identités / alias
- Résolution de l'identité par email via l'API GitLab (`/users?search=`)
