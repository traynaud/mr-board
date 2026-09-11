# Design — US-002 Paramètres : Identité « Moi »

## Référence maquettes
- `docs/design/MR Board - Wireframes.dc.html` — écran **1c**, section `01 · Moi`
- `docs/design/MR Board - Prototype.dc.html` — vue « Paramètres », rendu `meIni` / `meName` / `meStatus`
- `docs/tech/design-system.md` §4 — ligne « Avatar auteur »

## Écrans / Vues concernés
| Écran | Route Angular cible | Composant principal |
|-------|-------------------|-------------------|
| Paramètres | `/settings` | `SettingsPageComponent` → `MeSectionComponent` (nouvelle section `01`, avant `02 · Connexion GitLab`) |

## Correspondance maquette → Angular Material
| Élément de la maquette | Composant Material / custom | Personnalisation nécessaire |
|------------------------|------------------------------|------------------------------|
| Titre `01 · Moi` + description « Utilisé par « Mes MRs » et pour repérer mes rôles. » | `SettingsSectionComponent` (existant, US-001) | Aucune — réutilisation directe |
| Champ « Nom d'utilisateur GitLab » | `mat-form-field appearance="outline"` + `matInput` | Identique au style des champs de la section Connexion GitLab |
| Champ « Email (optionnel) » | `mat-form-field appearance="outline"` + `matInput type="email"` | `mat-error` sous le champ si `Validators.email` échoue |
| Ligne d'aperçu (avatar + nom + tag) | `AvatarComponent` (nouveau, `shared/avatar/`) + `<span>` + `<span class="tag">`-like | Carré 28 px, fond `neutral-800` (variant `filled`), texte 13 px, tag neutre en 12 px `--color-neutral-600` |

## Éléments visuels spécifiques

### Couleurs et thème
- Avatar `filled` (utilisé ici) : fond `--color-neutral-800`, texte blanc, 11 px / 600, carré sans arrondi (`--radius-*: 0`)
- Aucune couleur d'état sur les 3 tags de statut (« détecté via le jeton », « ne correspond pas au jeton », « saisi manuellement ») : texte neutre `--color-neutral-600`, cohérent avec le tag `meStatus` du prototype (pas de sémantique succès/erreur ici, juste de l'information)

### Typographie
- Nom / libellé de l'identité : 13 px, poids 600 (comme les avatars auteur du tableau, cohérence anticipée avec US-005)
- Tag de statut : 12 px, `--color-neutral-600`

### Layout et structure
- Champs username/email dans la même grille `1fr 1fr` que la section Connexion GitLab (`gap: var(--space-4)`), via la même classe `.fields` réutilisée ou dupliquée à l'identique dans `me-section.component.scss`
- Ligne d'aperçu sur `grid-column: 1 / -1`, `display: flex; align-items: center; gap: var(--space-2)`, visible uniquement quand `identity.status !== 'unset'`
- En dessous de 640 px : une seule colonne (media query identique à la section Connexion GitLab)

### États et comportements conditionnels
| État (`MeIdentity.status`) | Rendu de la ligne d'aperçu |
|------------------------------|----------------------------|
| `unset` (champ vide) | Ligne absente |
| `matched` | `AvatarComponent` (avatar réel ou initiales du nom complet du test), `<span>{{ identity.name }}</span>`, tag « détecté via le jeton » |
| `mismatch` | `AvatarComponent` avec `name = '@' + username` (pas de nom complet connu → tooltip = username lui-même), initiales calculées sur le username, tag « ne correspond pas au jeton » |
| `manual` | Identique à `mismatch` sans lien avec un test, tag « saisi manuellement » |

### Interactions et animations
- Aucune animation spécifique. La ligne d'aperçu apparaît/disparaît instantanément avec le `@if` Angular au gré de la frappe dans le champ username (pas de debounce nécessaire, calcul synchrone et bon marché).
- Le pré-remplissage automatique du champ username (RG-002-04) déclenche le style « modifié » standard de Material (indicateur de champ `dirty`, aucun style additionnel requis).

## Assets nécessaires
- Aucune nouvelle icône. `AvatarComponent` n'utilise pas d'icône Lucide, uniquement texte ou `<img>`.
