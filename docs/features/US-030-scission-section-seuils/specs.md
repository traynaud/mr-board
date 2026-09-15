# US-030 — Paramètres : scission de la section Seuils en Difficulté / Temps depuis Ready

## 1. Reformulation

La section `04 · Seuils` de l'écran Paramètres regroupe aujourd'hui deux réglages indépendants — les seuils de
difficulté (US-006) et les seuils de délai Ready (US-007) — dans un unique bloc visuellement dense (RG-014-03). On
scinde cette section en deux sections autonomes, chacune ne portant qu'une seule thématique, ce qui décale d'un cran
la numérotation de la section « Divers » qui la suit.

## 2. User Stories

- **US-030** : En tant qu'utilisateur de l'écran Paramètres, je veux que les seuils de difficulté et les seuils de
  délai Ready soient présentés dans deux sections distinctes, afin de mieux distinguer ces deux réglages indépendants
  et de réduire la densité visuelle de la section actuelle.
    - Priorité : Should
    - Complexité estimée : S
    - Dépendances : US-014

## 3. Règles de gestion

- **RG-030-01** : La section `04 · Seuils` est scindée en deux sections indépendantes, dans l'ordre :
  - `04 · Difficulté` — reprend uniquement le contenu du bloc « Difficulté » existant (RG-014-03 : Easy/Medium/Hard,
    champs `easyFiles`, `easyLines`, `hardFiles`, `hardLines`)
  - `05 · Temps depuis Ready` — reprend uniquement le contenu du bloc « Temps depuis Ready » existant (RG-014-03 :
    Vert/Orange/Rouge, champs `readyGreenDays`, `readyOrangeDays`, et le `mat-slide-toggle` « Compter uniquement les
    jours ouvrés » / `workdaysOnly`)

  Le sous-titre interne de chaque bloc (actuellement « Difficulté » / « Temps depuis Ready » au-dessus des lignes de
  seuils, RG-014-03) est **supprimé** : il devient redondant avec le titre de la section `app-settings-section` qui
  porte désormais ce même intitulé. Chaque nouvelle section affiche directement ses lignes de seuils, sans sous-titre.

  Aucun champ, valeur par défaut, contrainte, format ou comportement de validation issu de RG-014-01/02/04 n'est
  modifié — seule la présentation change.
- **RG-030-02** : Renumérotation consécutive de l'ensemble des sections des paramètres (§4.2 du README) :
  `01 · Moi`, `02 · Connexions`, `03 · Actualisation`, `04 · Difficulté`, `05 · Temps depuis Ready`, `06 · Divers`
  (la section « Divers » de US-015, actuellement `05`, devient `06`).
- **RG-030-03** : Le lien texte « Valeurs par défaut » par section prévu par RG-014-05 n'a en réalité jamais été
  implémenté : US-015 l'a remplacé par un unique bouton « Réinitialiser » global dans l'en-tête (RG-015-05,
  `resetSettingsFormToDefaults`), qui restaure déjà toutes les valeurs de seuils (difficulté et Ready) en une fois.
  La scission en deux sections n'a aucun impact sur ce mécanisme : le bouton global continue de réinitialiser les
  champs des deux nouvelles sections identiquement à avant. Aucun développement requis sur ce point.
- **RG-030-04** : Aucun changement d'API, de DTO (`SettingsDto` reste inchangé), ni de logique métier (calcul de
  difficulté US-006, calcul du délai Ready US-007, validation croisée RG-014-02) — uniquement la structure
  d'affichage de l'écran Paramètres et son découpage en composants.

## 4. Maquettes de référence

Pas de nouvelle maquette dédiée. S'appuie sur :
- Wireframe **1c** (US-014) pour le contenu de chaque bloc (inchangé)
- Le design system pour la structure générique `app-settings-section` (numéro / titre / description à gauche,
  contenu à droite), déjà utilisée par les 5 sections existantes de l'écran

## 5. Critères d'acceptation

```gherkin
Scenario: Sections distinctes affichées
  Given j'ouvre l'écran Paramètres
  Then je vois 6 sections numérotées dans l'ordre : 01 Moi, 02 Connexions, 03 Actualisation, 04 Difficulté,
    05 Temps depuis Ready, 06 Divers
  And la section 04 · Difficulté ne contient que les lignes Easy / Medium / Hard
  And la section 05 · Temps depuis Ready ne contient que les lignes Vert / Orange / Rouge et le bascule
    « Compter uniquement les jours ouvrés »

Scenario: Modification indépendante des seuils de difficulté
  Given une MR avec 6 fichiers et 50 lignes affichée « Medium »
  When je saisis easyFiles = 10 dans la section 04 · Difficulté et j'enregistre
  Then la MR est affichée « Easy » (RG-006 inchangée)
  And les seuils de la section 05 · Temps depuis Ready ne sont pas affectés

Scenario: Réinitialisation globale inchangée après la scission
  Given easyFiles = 10 (section Difficulté) et readyGreenDays = 5 (section Temps depuis Ready)
  When je clique sur « Réinitialiser » dans l'en-tête
  Then easyFiles / easyLines / hardFiles / hardLines reprennent 5 / 100 / 20 / 800
  And readyGreenDays / readyOrangeDays / workdaysOnly reprennent 1 / 3 / désactivé
  And rien n'est enregistré tant que je ne clique pas sur « Enregistrer »

Scenario: Renumérotation de la section Divers
  Given j'ouvre l'écran Paramètres
  Then la section « Divers » (US-015) porte désormais le numéro 06
```

## 6. Questions ouvertes

- ~~QO-030-01~~ — Résolu : les titres des deux nouvelles sections reprennent les intitulés déjà utilisés pour les
  blocs actuels (« Difficulté » et « Temps depuis Ready », déjà présents dans `fr.json` sous
  `settings.thresholds.difficulty.title` / `settings.thresholds.ready.title`), et le sous-titre de bloc correspondant
  est supprimé pour éviter la redondance avec le titre de section (RG-030-01).
- QO-030-02 : La description courte de chaque section (affichée sous le titre, colonne de gauche) doit-elle être
  reformulée séparément pour chacune, ou peut-on réutiliser des variantes de la description actuelle (« Règles de
  calcul de la difficulté et du délai Ready ») ? Hypothèse retenue : une description dédiée et plus précise par
  section (ex. « Règles de calcul de la difficulté d'une MR. » / « Seuils de couleur du délai depuis Ready. »).

## 7. Hors périmètre

- Tout changement des valeurs, contraintes ou règles de calcul des seuils (US-006, US-007, US-014 restent la source
  de vérité fonctionnelle sur le fond)
- Tout nouveau champ ou toute nouvelle fonctionnalité de configuration
- Le bouton global « Réinitialiser » de l'en-tête (US-015), qui continue de réinitialiser l'ensemble des sections
