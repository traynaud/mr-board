# Design — US-010 Filtres composables

## Référence maquettes

- `docs/design/MR Board - Prototype.dc.html`, lignes 60-81 : markup des pastilles (`md-input-chip` + `md-menu`) et
  du bouton « Ajouter un filtre » (`md-assist-chip` + `md-menu`) ; lignes 373-409 : logique de comptage
  (`applyAllBut`, `optsFor`) — référence de comportement, pas de composant (le prototype utilise Material Web
  Components `md-*`, le projet utilise Angular Material `mat-*`).
- Wireframe **1b** — menu « Affecté à » ouvert : recherche, Nobody coché en premier, compteurs alignés à droite.
- Wireframe **1a**/**1b** — pastille avec libellé, chevron, séparateur interne, croix.

## Écrans / Vues concernés

| Écran | Route Angular | Composant principal |
|-------|---------------|----------------------|
| Tableau | `/` | `FilterBarComponent` → `FilterPillComponent` (×N actives) + `AddFilterMenuComponent` |

## Correspondance maquette → Angular Material

| Élément de la maquette | Composant Material | Personnalisation nécessaire |
|---|---|---|
| Pastille (`md-input-chip`) | **Pas de `mat-chip`** — voir note ci-dessous | `<button>` custom avec libellé + chevron + croix |
| Menu de pastille (`md-menu`) | `mat-menu` | Contenu libre (pas que des `mat-menu-item`) pour le multi-sélection |
| Case à cocher d'option | `mat-checkbox` | Aucune |
| Compteur d'option | `<span>` texte, 11px gris | `color: var(--color-neutral-600)`, identique au compteur de difficulté (US-006) |
| Champ recherche | `mat-form-field` (`appearance="outline"` dense) + `matInput` | Densité compacte, placeholder « Rechercher… » |
| Bouton « Ajouter un filtre » | `mat-menu` trigger, item désactivé+coché pour un filtre déjà actif | `mat-menu-item[disabled]` + icône coche |

### Pourquoi pas `mat-chip` pour la pastille

Une pastille de filtre combine trois zones cliquables indépendantes (corps → ouvre le menu, croix → retire le
filtre) que `mat-chip-option`/`mat-chip-row` ne modélisent pas proprement (une seule action primaire par chip côté
Material, la « remove action » de `mat-chip-row` est prévue pour ça mais le corps du chip n'est alors plus un
déclencheur de menu générique sans complexité supplémentaire). Cohérent avec la décision déjà prise pour les
en-têtes triables (US-008) : rendu custom léger (`<span>`/`<button>`) quand le composant Material generic ne colle
pas exactement à l'interaction demandée, plutôt que de le forcer. Les chips « Drafts »/« Mes MRs » (US-009,
purement toggle, une seule action) restent `mat-chip-option` — pas de remise en cause de cette décision-là.

## Éléments visuels spécifiques

### Couleurs
- Pastille avec menu ouvert : bordure pleine `--color-accent` (RG-010-04).
- Option grisée (compteur 0, ou filtre déjà actif dans le menu « Ajouter un filtre ») : `--color-neutral-400`,
  cohérent avec les états désactivés déjà utilisés (chip « Mes MRs » désactivé, US-009).
- Compteurs : `--color-neutral-600`.

### Typographie
- Titre de menu : 11px, majuscules, `letter-spacing` léger — repris du prototype (`text-transform:uppercase`,
  `font-size:11px`, `letter-spacing:.08em`), déjà le style des titres de section Paramètres (`01 · Moi`).

### Layout et structure
- Pastille : `display:inline-flex; align-items:center; gap:6px`, padding cohérent avec les autres chips de la
  barre (US-009).
- Menu multi-sélection : largeur mini 250px (repris du prototype), liste scrollable si beaucoup d'options (pas de
  limite explicite dans les specs — `max-height` raisonnable, ex. 320px, à ajuster en dev).
- Champ recherche : uniquement si > 6 options (RG-010-05), en haut du menu sous le titre.

### États et comportements conditionnels
| État | Condition | Rendu |
|---|---|---|
| Pastille, menu fermé | — | Libellé « <Filtre> : <valeur> », chevron bas |
| Pastille, menu ouvert | clic sur la pastille | Bordure accent pleine, chevron haut, menu affiché |
| Option à 0 | compteur = 0 | Grisée, reste cliquable (peut être sélectionnée même à 0, RG-010-08 ne l'interdit pas) |
| Recherche active | > 6 options + texte saisi | Liste filtrée par sous-chaîne insensible à la casse |
| Menu « Ajouter un filtre », filtre déjà actif | `active.includes(f)` | Item grisé, coche visible, non cliquable (RG-010-03) |
| Bouton « Ajouter un filtre » désactivé | 5/5 filtres actifs | `disabled`, pas de menu |
| État vide avec filtres | 0 ligne, ≥1 filtre actif (composable ou `mine`) | « Aucune MR ne correspond aux filtres. » + « Effacer les filtres » (étend RG-009's état vide à tous les filtres, RG-010-10) |

### Interactions et animations
- Multi-sélection : clic sur une option coche/décoche sans fermer le menu (RG-010-05).
- Booléen : clic sur « Oui »/« Non » ferme le menu ; recliquer l'option déjà sélectionnée la désélectionne
  (RG-010-06) — bascule gérée côté `FiltersStore` (valeur → `null` si on reclique la même).
- Retrait de pastille : clic sur la croix, sans ouvrir le menu (zone cliquable distincte du corps de la pastille).
- Clavier : `mat-menu` gère nativement Échap/clic extérieur ; navigation Tab entre checkboxes à l'intérieur du
  panneau.

## Assets nécessaires
- Icônes chevron (`chevron-down`, déjà dans `shared/icons`) et croix (`x`, déjà présent) — aucun nouvel asset.
- Icône coche pour le menu « Ajouter un filtre » : `check` (déjà présent, déjà utilisé pour Approved).
