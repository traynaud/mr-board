# Architecture — US-030 Scission de la section Seuils

## Résumé fonctionnel
La section « 04 · Seuils » de l'écran Paramètres est scindée en deux sections indépendantes — « 04 · Difficulté »
et « 05 · Temps depuis Ready » —, décalant « Divers » de 05 à 06. Purement frontend, aucun champ ni comportement
métier ne change (RG-030-04).

---

## Backend

Aucun impact. `SettingsDto`, `SettingsService`, les endpoints `GET/PUT /api/v1/settings` et les fonctions de calcul
(`calculate-difficulty.ts`, `calculate-ready-delay.ts`) restent inchangés.

---

## Frontend

### Intégration dans les features existantes

Feature `features/settings`, aucune nouvelle route. Le composant `ThresholdsSectionComponent` (dossier
`sections/thresholds/`) est **remplacé par deux composants** présentationnels, sur le modèle exact de
`RefreshSectionComponent` (un seul bloc de champs, pas de wrapper `.block`/`.block-title` puisque le titre est
désormais porté par `app-settings-section`) :

- `sections/difficulty/difficulty-section.component.{ts,html,scss,spec.ts}` → sélecteur `app-difficulty-section`
- `sections/ready-delay/ready-delay-section.component.{ts,html,scss,spec.ts}` → sélecteur `app-ready-delay-section`

Le dossier `sections/thresholds/` est supprimé.

Les deux composants restent des composants **présentationnels purs** recevant `form = input.required<SettingsForm>()`
(comme aujourd'hui) : le même `FormGroup` partagé (`settings-form.ts`, inchangé) est simplement projeté dans deux
templates au lieu d'un, chacun ne touchant que ses propres `formControlName`. Aucun changement sur `settings-form.ts`
(`DEFAULT_THRESHOLDS`, validateurs croisés `mustExceedEasy`/`mustExceedReadyGreen` déjà indépendants par champ).

### Composants réutilisables et Angular Material

| Composant | Origine | Usage prévu |
|-----------|---------|-------------|
| `app-settings-section` | `shared/settings-section` | Inchangé : deux instances au lieu d'une, chacune avec son propre `number`/`titleKey`/`descriptionKey` |
| `MatFormField`, `MatInput`, `MatSlideToggle` | Angular Material | Repris à l'identique depuis `thresholds-section.component.html`, répartis entre les deux nouveaux templates |

### Détail du découpage du template et du style existants

`thresholds-section.component.html` contient déjà deux blocs bien délimités (voir specs RG-030-01) : il suffit de
couper le fichier en deux sans réécrire son contenu.

- **`difficulty-section.component.html`** = contenu actuel de `.block` #1 (`difficulty-rows` : Easy/Medium/Hard),
  **sans** le `<div class="block-title">` (RG-030-01 : titre porté par la section, donc supprimé ici)
- **`ready-delay-section.component.html`** = contenu actuel de `.block` #2 (`ready-rows` + `mat-slide-toggle`
  `workdaysOnly`), **sans** son `<div class="block-title">`

`thresholds-section.component.scss` se répartit ainsi :
- `difficulty-section.component.scss` reprend `.rows`/`.difficulty-rows`/`.row-label`/`.square` (variantes
  `.easy`/`.medium`/`.hard`)/`.between`/`mat-form-field` (règle `.difficulty-rows mat-form-field`)
- `ready-delay-section.component.scss` reprend `.rows`/`.ready-rows`/`.row-label`/`.square` (variantes
  `.green`/`.orange`/`.red`)/`.between` (règle `.ready-rows .between`)/`.workdays-toggle`/`mat-form-field`
- La règle `.blocks` (grid 2 colonnes) et `.block-title` disparaissent : chaque composant n'a plus qu'un seul bloc de
  contenu, sur le modèle de `refresh-section.component.scss` (`display: flex; flex-direction: column`, ou grid seule
  selon le rendu visuel souhaité — au choix du dev, aucune maquette dédiée ne l'impose)
- Le media query `@media (max-width: 640px) { .blocks { grid-template-columns: 1fr; } }` devient sans objet et est
  supprimé (plus de grid à 2 colonnes à empiler)

### Nouvelles tâches techniques

| Tâche | Type | Description |
|-------|------|-------------|
| Créer `difficulty-section.component.ts/.html/.scss` | Composant | Contenu du bloc Difficulté (RG-030-01), sans sous-titre |
| Créer `ready-delay-section.component.ts/.html/.scss` | Composant | Contenu du bloc Temps depuis Ready (RG-030-01), sans sous-titre |
| Créer `difficulty-section.component.spec.ts` | Test unitaire | Cf. répartition des tests ci-dessous |
| Créer `ready-delay-section.component.spec.ts` | Test unitaire | Cf. répartition des tests ci-dessous |
| Ajouter clés `settings.difficulty.*`, `settings.readyDelay.*` | i18n (`fr.json` + `en.json`) | Voir détail ci-dessous |

### Modifications sur l'existant

| Élément modifié | Nature de la modification | Risque | Solution proposée |
|-----------------|---------------------------|--------|--------------------|
| `sections/thresholds/*` (4 fichiers) | Suppression | Faible | Contenu entièrement repris dans les deux nouveaux composants (aucune perte) |
| `settings-page.component.ts` | Remplace l'import/l'enregistrement de `ThresholdsSectionComponent` par `DifficultySectionComponent` + `ReadyDelaySectionComponent` | Faible | — |
| `settings-page.component.html` | Le bloc `<app-settings-section>` unique « Seuils » (lignes ~61-67) devient deux blocs consécutifs `<app-difficulty-section>` / `<app-ready-delay-section>`, avec `number`/`titleKey`/`descriptionKey` = `settings.difficulty.*` puis `settings.readyDelay.*` ; le bloc `misc` suivant hérite automatiquement du numéro `06` via la clé i18n (pas de changement de code, juste de valeur i18n) | Faible | — |
| `settings-page.component.spec.ts` (`should_number_the_sections_01_to_05_with_no_separate_repos_section_us_021_0`) | Le tableau attendu passe de 5 à 6 entrées ; renommer le test (ex. `should_number_the_sections_01_to_06_after_the_us_030_thresholds_split`) et mettre à jour son commentaire | Faible | Remplacer `04 · thresholds.title` / `05 · misc.title` par `04 · difficulty.title` / `05 · readyDelay.title` / `06 · misc.title` |
| `fr.json` / `en.json` | Namespace `settings.thresholds` scindé en `settings.difficulty` + `settings.readyDelay` ; `settings.misc.number` passe de `"05"` à `"06"` | Faible | Détail ci-dessous — attention à la parité fr/en (`dictionary-parity.spec.ts`, automatique si les deux fichiers restent en miroir) |
| `docs/tech/architecture-frontend.md` (commentaire d'arborescence ligne ~69) | `thresholds` remplacé par `difficulty, ready-delay` dans la liste d'exemple | Nul | Simple mise à jour de commentaire |

#### Détail de la restructuration i18n (`fr.json` / `en.json`)

Remplacer le bloc `"thresholds": { ... }` (clés `number`, `title`, `description`, `difficulty.*`, `ready.*`,
`workdaysOnly`, `errors.*`) par deux blocs indépendants au même niveau (sœurs de `refresh`/`misc`) :

```jsonc
"difficulty": {
  "number": "04",
  "title": "Difficulté",           // en: "Difficulty" — repris tel quel de l'ancien thresholds.difficulty.title
  "description": "…",              // QO-030-02 : nouvelle description dédiée, ex. « Règles de calcul de la difficulté d'une MR. »
  "easy": "Easy", "medium": "Medium", "hard": "Hard",
  "filesSuffix": "fich.", "linesSuffix": "l.", "between": "entre les deux",
  "errors": {
    "min": "Doit être un entier ≥ {{min}}.",
    "integer": "Doit être un nombre entier.",
    "mustExceedEasy": "Doit être supérieur à Easy"
  }
},
"readyDelay": {
  "number": "05",
  "title": "Temps depuis Ready",    // en: "Time since Ready" — repris tel quel de l'ancien thresholds.ready.title
  "description": "…",              // QO-030-02 : ex. « Seuils de couleur du délai depuis Ready. »
  "green": "Vert", "orange": "Orange", "red": "Rouge",
  "daysSuffix": "jours", "beyond": "au-delà",
  "workdaysOnly": "Compter uniquement les jours ouvrés",
  "errors": {
    "min": "Doit être un entier ≥ {{min}}.",
    "integer": "Doit être un nombre entier.",
    "mustExceedReadyGreen": "Doit être supérieur à Vert"
  }
}
```

Points d'attention :
- `errors.min` et `errors.integer` sont des messages génériques partagés aujourd'hui entre les deux blocs
  (`settings.thresholds.errors.*`) : ils sont **dupliqués à l'identique** dans `difficulty.errors` et
  `readyDelay.errors` pour que chaque section reste autonome (RG-030-01), plutôt que de garder une dépendance croisée
  entre les deux nouvelles sections pour trois chaînes génériques.
- `thresholds.errors.required` n'est référencé nulle part dans le code actuel (vérifié) : **ne pas le reporter**,
  c'est une clé morte.
- Les valeurs anglaises existent déjà dans `en.json` (lignes 279-308) : les reprendre telles quelles, seule la
  structure change (voir table de correspondance ci-dessus).

---

## Points de vigilance globaux

- **QO-030-02 non tranchée** : les deux nouvelles clés `description` (difficulty/readyDelay) n'ont pas de texte
  validé. Le dev peut proposer un texte court cohérent avec le style des autres sections (ex. `refresh.description`
  = « Fréquence de synchronisation automatique avec les forges. ») ; à faire valider en QA si besoin, impact nul sur
  le comportement.
- Le lien « Valeurs par défaut » par section mentionné dans les specs originelles de US-014 (RG-014-05) n'existe pas
  dans le code actuel (confirmé par lecture de `settings-form.ts`/`settings-page.component.ts`) : seul le bouton
  global « Réinitialiser » de l'en-tête existe (RG-015-05) et n'est pas affecté par la scission (RG-030-03 corrigée
  en ce sens dans les specs).
- Pas de risque de régression sur `RG-006`/`RG-007` (calcul difficulté/délai Ready) : les `formControlName` et le
  `FormGroup` sous-jacent ne changent pas, seule leur répartition entre templates change.

---

## Ordre de réalisation suggéré

1. i18n : restructurer `fr.json` et `en.json` (`settings.thresholds` → `settings.difficulty` + `settings.readyDelay`,
   `settings.misc.number` → `"06"`)
2. Créer `difficulty-section.component.{ts,html,scss}` (contenu repris de `thresholds-section.component.html`,
   bloc Difficulté, sans sous-titre)
3. Créer `ready-delay-section.component.{ts,html,scss}` (bloc Temps depuis Ready, sans sous-titre)
4. Mettre à jour `settings-page.component.ts` et `settings-page.component.html` (deux nouvelles sections, plus
   `ThresholdsSectionComponent`)
5. Supprimer `sections/thresholds/*`
6. Écrire `difficulty-section.component.spec.ts` et `ready-delay-section.component.spec.ts` (répartition des tests
   de `thresholds-section.component.spec.ts` par champ concerné — cf. tableau ci-dessous)
7. Mettre à jour `settings-page.component.spec.ts` (test de numérotation des sections, 5 → 6 entrées)
8. Mettre à jour le commentaire d'arborescence dans `docs/tech/architecture-frontend.md`
9. Validation manuelle contre le wireframe 1c (aucune maquette dédiée nouvelle)

### Répartition des tests existants de `thresholds-section.component.spec.ts`

| Test actuel | Destination |
|--------------|-------------|
| `should_render_the_seven_threshold_fields_with_default_values` | Scindé : assertions `easyFiles`/`easyLines`/`hardFiles`/`hardLines` → `difficulty-section.component.spec.ts` ; `readyGreenDays`/`readyOrangeDays`/`mat-slide-toggle` → `ready-delay-section.component.spec.ts` |
| `should_render_the_block_titles_and_labels` | Supprimé (les titres ne sont plus rendus par ces composants, RG-030-01 — à couvrir uniquement par le test de numérotation de `settings-page.component.spec.ts`) ; l'assertion sur `workdaysOnly` (libellé du toggle) est conservée dans `ready-delay-section.component.spec.ts` |
| `should_update_the_form_when_a_field_is_edited` | Dupliqué/adapté dans les deux specs (un champ de chaque) |
| `should_show_the_cross_field_error_on_hard_files` | → `difficulty-section.component.spec.ts` |
| `should_show_the_cross_field_error_on_ready_orange_days` | → `ready-delay-section.component.spec.ts` |
| `describe.each` validation `easyFiles`/`easyLines` (+ `hardFiles`/`hardLines` guardé) | → `difficulty-section.component.spec.ts` |
| `describe.each` validation `readyGreenDays` (+ `readyOrangeDays` guardé) | → `ready-delay-section.component.spec.ts` |
