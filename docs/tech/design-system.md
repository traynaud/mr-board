# Design system et thème Angular Material

Source de vérité visuelle : `docs/design/`
- `MR Board - Prototype.dc.html` — prototype interactif (écrans Tableau et Paramètres, états, comportements)
- `MR Board - Wireframes.dc.html` — wireframes 1a (tableau par défaut), 1b (drafts + menus ouverts), 1c (paramètres)
- `design-system/readme.md` + `design-system/styles.css` — design system « Modernist » (tokens, composants)

Toute US avec de l'UI doit être confrontée à ces fichiers pendant la conception (`/project:architect`), le développement
(`/project:dev`) et la QA (`/project:qa`).

---

## 1. Principes du design « Modernist »

- **Plat et architectural** : aucun arrondi (`radius: 0` partout), pas de décoration, alignements et règles fortes
- **Règles 2 px** (`--color-divider`) entre les grandes sections (toolbar, barre de filtres, sections Paramètres)
- **Tout flush left** : titres, textes, libellés de boutons (jamais centrés)
- **Police Archivo** pour titres et corps (fallback `system-ui, sans-serif`)
- **Une seule couleur d'accent** (`#ec3013`), utilisée avec parcimonie : action primaire, tri actif, pastilles de filtre, emphase
- **Icônes Lucide** en SVG inline (`currentColor`)
- Ombres uniquement pour les surfaces flottantes (menus, toasts) : `--shadow-md` / `--shadow-lg`

---

## 2. Tokens

| Token                  | Valeur                                       | Usage                                              |
|------------------------|----------------------------------------------|----------------------------------------------------|
| `--color-bg`           | `#f3f2f2`                                    | Fond de page                                       |
| `--color-surface`      | `#eae9e9`                                    | Surfaces secondaires (barre d'URL de maquette)     |
| `--color-text`         | `#201e1d`                                    | Texte principal                                    |
| `--color-accent`       | `#ec3013`                                    | Accent (primary Material)                          |
| `--color-accent-100..900` | `#fff2ef` … `#4d170e`                     | Tints (pastilles : fond 100, bordure 300, texte 800) |
| `--color-neutral-100..900` | `#f8f4f4` … `#2d2b2b`                    | Gris : hover lignes (100), texte secondaire (600), avatars auteur (800), toasts (900) |
| `--color-divider`      | `color-mix(in srgb, #201e1d 40%, transparent)` | Règles et bordures                              |
| `--color-success`      | `#2f8f4e`                                    | Vert : Easy, délai ≤ vert, coche Approved, connexion OK |
| `--color-warning`      | `#d98a1f`                                    | Orange : Medium, délai orange                      |
| `--color-danger`       | `var(--color-accent)`                        | Rouge : Hard, délai rouge, erreurs                 |
| `--font-heading` / `--font-body` | `"Archivo", system-ui, sans-serif` | Typographie                                        |
| `--space-1..8`         | 4 / 8 / 12 / 16 / 24 / 32 px                 | Espacements                                        |
| `--radius-*`           | `0px`                                        | Aucun arrondi                                      |
| `--shadow-sm/md/lg`    | voir `styles.css`                            | Élévations                                         |

Les couleurs sémantiques `success` / `warning` / `danger` ne sont pas dans le design system d'origine : elles sont
ajoutées dans `styles.scss` avec les valeurs utilisées par le prototype (`#2f8f4e`, `#d98a1f`, accent).

---

## 3. Thème Angular Material (M3)

Dans `frontend/src/styles.scss` :

1. Générer une palette à partir de l'accent : `npx ng generate @angular/material:theme-color --primary-color=#ec3013 --secondary-color=#444141 --neutral-color=#7d7979 --include-high-contrast=false` → `src/_theme-colors.scss`
2. Déclarer le thème :

```scss
@use '@angular/material' as mat;
@use './theme-colors' as theme;

html {
  @include mat.theme((
    color: (primary: theme.$primary-palette, tertiary: theme.$tertiary-palette, theme-type: light),
    typography: (plain-family: 'Archivo', brand-family: 'Archivo', bold-weight: 600),
    density: 0,
  ));
  color-scheme: light;
}
```

3. Surcharger les tokens système pour coller au design :

```scss
:root {
  --mat-sys-corner-none: 0px; --mat-sys-corner-extra-small: 0px; --mat-sys-corner-small: 0px;
  --mat-sys-corner-medium: 0px; --mat-sys-corner-large: 0px; --mat-sys-corner-extra-large: 0px; --mat-sys-corner-full: 0px;
  --mat-sys-surface: #f3f2f2; --mat-sys-on-surface: #201e1d; --mat-sys-on-surface-variant: #605d5d;
  --mat-sys-surface-container-lowest: #fff; --mat-sys-surface-container-low: #f3f2f2; --mat-sys-surface-container: #eae9e9;
  --mat-sys-surface-container-high: #e2e0e0; --mat-sys-surface-container-highest: #d7d3d3;
  --mat-sys-outline: #7d7979; --mat-sys-outline-variant: #bab6b6; --mat-sys-error: #ec3013;
}
```

4. Utiliser les overrides par composant Material (`mat.button-overrides`, `mat.chips-overrides`, `mat.form-field-overrides`,
   `mat.table-overrides`, `mat.menu-overrides`…) plutôt que `::ng-deep` pour : forme des chips (0 px), hauteur des
   lignes du tableau (compact, `padding: 6px 8px`, `font-size: 13px`), labels des boutons alignés à gauche.
5. Charger Archivo via `<link>` Google Fonts dans `index.html` (poids 400, 600, 800), avec fallback.

---

## 4. Composants visuels spécifiques (à implémenter dans `shared/`)

| Composant          | Rendu (prototype)                                                                                                    |
|--------------------|----------------------------------------------------------------------------------------------------------------------|
| Avatar auteur      | Carré 28 px, fond `neutral-800`, initiales blanches 11 px 600, `matTooltip` = nom complet ; si `avatar_url` GitLab dispo, l'afficher en 28 px carré avec le même tooltip |
| Avatar reviewer / affecté | Carré 28 px, bordure 1.5 px `neutral-800`, initiales 11 px 600 ; vide = tiret `—` en `neutral-400`          |
| Tag projet         | `.tag.tag-neutral` : fond neutre, texte 600, alias ; **US-025** : couleur optionnelle par repo, palette fermée de 10 teintes pastel (fond + texte fixes, indépendants du thème), pleine si Ready, éclaircie à 45 % si Draft — voir `shared/project-color/`, exception documentée au principe d'accent unique ci-dessous |
| Tag Draft          | `.tag.tag-outline` « Draft » devant le titre ; ligne à opacité 0.72                                                   |
| Jeton difficulté   | Carré 12 px couleur (`success` / `warning` / `danger`) + label `Easy` / `Medium` / `Hard` + méta `34 f · 1240 l` en 11 px `neutral-600` |
| Délai Ready        | Carré 8 px couleur + libellé 600 même couleur : `aujourd'hui`, `1 j`, `6 j` ; drafts : « ouverte il y a 12 j » en 12 px `neutral-600` |
| Approved           | SVG check Lucide 18 px, stroke `#2f8f4e` 2.6 ; sinon cellule vide                                                     |
| Pastille de filtre | Fond `accent-100`, bordure 1 px `accent-300` (accent plein si menu ouvert), texte `accent-800` 13 px : « Projet : api, web » + chevron + séparateur + croix |
| Menu de filtre     | Largeur ≥ 240 px, titre uppercase 11 px `neutral-600` avec règle 1 px, champ « Rechercher… », options avec checkbox et compteur à droite |
| Toolbar            | Brand « MR Board » (`.nav-brand`), statut « Synchronisé il y a 2 min » 12 px `neutral-600` (accent-700 + icône pendant la synchro), bouton `Rafraîchir` stroked, icône Paramètres |
| Bandeau sans jeton | Fond `accent-100`, règle 2 px accent en bas, texte `accent-800`, bouton texte « Configurer »                          |
| Toast              | Bas gauche, fond `neutral-900`, texte blanc 13 px, action « OK » en `accent-400` (via `MatSnackBar` stylé)            |
| Page Paramètres    | Largeur max 920 px centrée ; grille `200px / 1fr` ; sections numérotées `01 · Moi` … `06 · Divers` en `h6` accent ; règles 2 px entre sections ; en-tête avec retour, titre, Annuler, Enregistrer (primary) |

---

## 5. États à couvrir dans chaque écran

- **Chargement** : barre de progression 2 px sous la toolbar pendant la synchro ; bouton Rafraîchir désactivé
- **Vide** : ligne unique « Aucune MR ne correspond aux filtres. » + bouton texte « Effacer les filtres »
- **Non configuré** : bandeau « Aucun jeton GitLab configuré. Les données affichées sont celles du dernier cache. »
- **Erreur** : toast avec message i18n ; statut de synchro en erreur dans la toolbar
- **Hover ligne** : fond `neutral-100`
- **Tri actif** : en-tête en accent avec flèche `↑` / `↓` ; inactif `↕` à 50 % d'opacité
- **Focus clavier** : ring 2 px accent (`:focus-visible`), jamais le bleu navigateur

---

## 6. Interdits

- Aucun `border-radius` > 0
- Aucun hex en dur dans les composants (tokens uniquement)
- Aucun label de bouton centré dans un bouton large
- Pas d'image colorisée ni d'illustration décorative
- Pas de composant custom quand Angular Material fournit l'équivalent
