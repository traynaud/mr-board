# US-014 — Paramètres : Seuils de difficulté et de délai Ready

## 1. Reformulation

L'utilisateur ajuste, dans les paramètres, les seuils qui déterminent la difficulté d'une MR (fichiers / lignes) et
les niveaux de couleur du temps depuis Ready (jours), ainsi que l'option « jours ouvrés ». Les changements s'appliquent
immédiatement au tableau sans resynchronisation.

## 2. User Stories

- **US-014** : En tant que tech lead, je veux adapter les seuils de difficulté et de délai aux pratiques de mon équipe,
  afin que les indicateurs soient pertinents pour nous.
    - Priorité : Should
    - Complexité estimée : S
    - Dépendances : US-006, US-007

## 3. Règles de gestion

- **RG-014-01** : Paramètres et contraintes :
  | Paramètre        | Défaut | Contrainte                                  |
  |------------------|--------|---------------------------------------------|
  | `easyFiles`      | 5      | entier ≥ 1                                  |
  | `easyLines`      | 100    | entier ≥ 1                                  |
  | `hardFiles`      | 20     | entier > `easyFiles`                        |
  | `hardLines`      | 800    | entier > `easyLines`                        |
  | `readyGreenDays` | 1      | entier ≥ 0                                  |
  | `readyOrangeDays`| 3      | entier > `readyGreenDays`                   |
  | `workdaysOnly`   | false  | booléen                                     |
- **RG-014-02** : Validation côté DTO (`class-validator` + validateur croisé) ; violation → 400 avec le champ en cause. Le formulaire affiche l'erreur sous le champ (« Doit être supérieur à Easy »).
- **RG-014-03** : UI section `05 · Seuils`, deux blocs :
  - **Difficulté** : lignes Easy (carré vert) « < [N] fich. » « < [N] l. » ; Medium (carré orange) « entre les deux » ; Hard (carré rouge) « > [N] fich. » « > [N] l. »
  - **Temps depuis Ready** : Vert « ≤ [N] jours » ; Orange « ≤ [N] jours » ; Rouge « au-delà » ; `mat-slide-toggle` « Compter uniquement les jours ouvrés »
- **RG-014-04** : Les seuils sont lus à chaque `GET /merge-requests` (RG-006-01, RG-007-01) : après « Enregistrer », le tableau rechargé reflète les nouveaux seuils sans synchronisation GitLab (la synchronisation déclenchée par RG-001-06 reste sans impact sur ce point).
- **RG-014-05** : Le bouton « Réinitialiser » (US-015) remet ces valeurs par défaut ; en attendant US-015, un lien texte « Valeurs par défaut » dans la section rétablit les défauts du bloc (non enregistrés tant que « Enregistrer » n'est pas cliqué).

## 4. Maquettes de référence

- Wireframe **1c** — section `05 · Seuils`
- Prototype — champs `easyFiles`, `easyLines`, `hardFiles`, `hardLines`, `readyGreen`, `readyOrange`, `workdays`

## 5. Critères d'acceptation

```gherkin
Scenario: Modifier les seuils de difficulté
  Given une MR avec 6 fichiers et 50 lignes affichée « Medium »
  When je saisis easyFiles = 10 et j'enregistre
  Then la MR est affichée « Easy » sans nouvelle synchronisation GitLab
  And GET /api/v1/settings renvoie easyFiles = 10

Scenario: Seuils incohérents
  When je saisis hardFiles = 3 alors que easyFiles = 5 et j'enregistre
  Then l'API répond 400 sur hardFiles
  And le champ « Hard fich. » affiche « Doit être supérieur à Easy »

Scenario: Modifier les seuils de délai
  Given une MR prête depuis 3 jours affichée en orange
  When je saisis readyGreenDays = 3 et readyOrangeDays = 5 et j'enregistre
  Then la MR est affichée en vert

Scenario: readyOrange ≤ readyGreen
  When je saisis readyGreenDays = 3 et readyOrangeDays = 3
  Then l'API répond 400 sur readyOrangeDays

Scenario: Valeur non entière
  When je saisis easyLines = 2.5
  Then le champ est en erreur et « Enregistrer » est désactivé

Scenario: Jours ouvrés
  Given une MR prête depuis vendredi, nous sommes lundi
  When j'active « Compter uniquement les jours ouvrés » et j'enregistre
  Then la MR affiche « aujourd'hui »

Scenario: Valeurs par défaut
  Given easyFiles = 10
  When je clique sur « Valeurs par défaut » de la section Seuils
  Then les champs reprennent 5 / 100 / 20 / 800 / 1 / 3 / désactivé
  And rien n'est enregistré tant que je ne clique pas sur « Enregistrer »
```

## 6. Questions ouvertes

- QO-014-01 : Faut-il des seuils par projet ? Hypothèse : non, seuils globaux.

## 7. Hors périmètre

- Seuils par projet
- Pondérations avancées
