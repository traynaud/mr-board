# Design — US-014 Paramètres : seuils de difficulté et de délai Ready

## Référence maquettes
`docs/design/MR Board - Prototype.dc.html`, lignes 182-197 (section « 05 · Seuils »). Wireframe **1c**.

## Écrans / Vues concernés

| Écran | Route Angular cible | Composant principal |
|-------|----------------------|------------------------------------------------|
| Paramètres | `/settings` | `ThresholdsSectionComponent` (nouveau) dans `SettingsPageComponent` |

## Correspondance maquette → Angular Material

| Élément de la maquette | Composant Material | Personnalisation nécessaire |
|--------------------------|----------------------|---------------------------------|
| `md-outlined-text-field` avec `prefix-text`/`suffix-text` (ex. `< [N] fich.`) | `mat-form-field appearance="outline"` + `input matInput type="number"` | Texte statique via `matTextPrefix`/`matTextSuffix` (ex. `<span matTextPrefix>&lt;&nbsp;</span>`, `<span matTextSuffix>&nbsp;fich.</span>`), champ compact (`subscriptSizing="dynamic"`, largeur fixe ~90-100px) |
| Carré coloré 10×10 devant Easy/Medium/Hard et Vert/Orange/Rouge | `<i>`/`<span>` inline, pas de composant Material | `display:inline-block; width:10px; height:10px` + couleur via variable CSS (voir ci-dessous), pas d'arrondi (design system) |
| `md-switch` « jours ouvrés » | `mat-slide-toggle` | Identique au toggle déjà utilisé dans `refresh-section` |
| Lien texte « Valeurs par défaut » | `button mat-button` (variante texte, pas d'élévation) ou `<a>` stylé comme lien | Taille de police 12-13px, couleur `--color-accent`, pas de fond |

## Éléments visuels spécifiques

### Couleurs et thème
- Easy / Vert → `var(--color-success)` (`#2f8f4e`)
- Medium / Orange → `var(--color-warning)` (`#d98a1f`)
- Hard / Rouge → `var(--color-accent)` (`#ec3013`), déjà exposé aussi comme `--color-danger`
- Ne jamais coder ces trois couleurs en dur dans le composant : réutiliser les variables globales (`styles.scss`),
  comme le fait déjà `difficulty-badge.component.scss`.

### Typographie
- Labels de ligne (Easy/Medium/Hard, Vert/Orange/Rouge) : 13px, cohérent avec le reste des sections Paramètres
  (`me-section`, `gitlab-connection-section`).
- Texte « entre les deux » / « au-delà » (ligne Medium/Rouge, non éditable) : 12px, `color-neutral-600`.

### Layout et structure
- Reprendre le layout 2 colonnes du prototype : un bloc `grid-template-columns: 1fr 1fr` au niveau de la section
  (comme `me-section.component.scss`/`gitlab-connection-section.component.scss`), colonne gauche = Difficulté,
  colonne droite = Temps depuis Ready.
- À l'intérieur de chaque bloc, une grille `grid-template-columns: auto 1fr 1fr` (Difficulté, 2 champs par ligne) ou
  `auto 1fr` (Temps depuis Ready, 1 champ par ligne), `gap: 8px 10px`, `align-items: center` — copie directe des
  règles inline du prototype (lignes 185, 191).
- En dessous du bloc Temps depuis Ready : le `mat-slide-toggle` jours ouvrés (`margin-top: 14px` dans le prototype).
- Sous les deux blocs (ou en pied de section) : le lien « Valeurs par défaut ».
- Responsive (< 640px, cf. `me-section`/`gitlab-connection-section` qui repassent en `grid-template-columns: 1fr`) :
  empiler les deux blocs Difficulté / Temps depuis Ready.

### États et comportements conditionnels
- Champ en erreur (`Validators.min`, validateur croisé) : bordure/texte d'erreur standard Material
  (`mat-error` sous le `mat-form-field`), message via les clés `settings.thresholds.errors.*`.
- Bouton « Enregistrer » de la page (déjà piloté par `canSave()`) se désactive automatiquement si un des 7 champs
  est invalide — aucun état spécifique à gérer dans le composant lui-même.
- Ligne Medium et ligne Rouge : pas de champ, texte informatif seul (« entre les deux » / « au-delà ») — ne pas
  créer de `FormControl` fantôme pour ces lignes.

### Interactions et animations
- Aucune animation spécifique. Le clic sur « Valeurs par défaut » met à jour les 7 champs immédiatement
  (`patchValue`), sans confirmation ni transition.

## Assets nécessaires
Aucun nouvel icône : la section n'utilise que des carrés de couleur en CSS pur (pas de SVG).
