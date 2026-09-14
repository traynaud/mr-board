# Design — US-021 Forges dans le tableau

## Référence maquettes
- Wireframe **1a/1b** (`MR Board - Wireframes.dc.html`) : tag projet, pastille de filtre multi-sélection (pattern
  réutilisé pour « Connexion »)
- Wireframe **2a/2b** (mêmes fichiers, section ajoutée par le commit `36cd4b4`) : écran Paramètres « 02 · Connexions
  & dépôts » (§0) et tableau multi-connexions
- `docs/tech/design-system.md` : tokens de couleur/espacement, règles 2 px, aucun arrondi

## Écrans / Vues concernés
| Écran | Route Angular | Composant principal |
|-------|---------------|----------------------|
| Tableau | `/` | `MrTableComponent`, `FilterBarComponent`, `BoardToolbarComponent` |
| Paramètres | `/settings` | `ConnectionsSectionComponent` (absorbe `RepositoriesSectionComponent`) |

## Correspondance maquette → Angular Material
| Élément de la maquette | Composant Material | Personnalisation nécessaire |
|-------------------------|---------------------|------------------------------|
| Icône de forge dans le tag projet (2b) | `mat-icon` (`svgIcon="gitlab"/"github"`, déjà enregistrées) | 12 px (vs 16 px standard des icônes de connexion) — `width/height: 12px` inline dans `.tag`, `opacity: .75` comme dans le wireframe |
| Pastille de filtre « Connexion » (2b) | `FilterPillComponent` existant | Aucune — déjà générique sur `FilterKey` |
| Menu « + Ajouter un filtre » | `AddFilterMenuComponent` existant | Ajout conditionnel de l'entrée (nouvel `input`) |
| Ligne de connexion repliable/dépliée (2a) | Pattern maison (pas `mat-expansion-panel`, voir ci-dessous) | Chevron rotatif, zone dépliée = formulaire + tableau repos |
| Tableau « Dépôts de cette connexion » (2a) | `<table class="repos-table">` existant (`repositories-section`) | Retrait de la colonne/du sélecteur « Connexion » |

### Pourquoi pas `mat-expansion-panel`
Le wireframe 2a n'a pas la géométrie d'un accordéon Material standard (pas d'ombre, pas de radius, en-tête qui
mélange icône/nom/URL/tag/statut/chevron sur une seule ligne avec des colonnes alignées comme le tableau actuel).
Réutiliser le pattern déjà en place (`.connections-table` + une zone dépliée en dessous, cf.
`connections-section.component.scss` actuel) est plus proche du design system que d'introduire
`mat-expansion-panel` (qui apporte transitions/ombres à neutraliser). Recommandation : garder une structure de
liste (une `<div class="connection-row">` par connexion, pas de `<table>` classique dès qu'une ligne peut contenir
un bloc dépliable — un `<tr>` ne peut pas contenir un `<div>` de mise en page libre proprement).

## Éléments visuels spécifiques

### Couleurs et thème
- Icône de forge dans le tag : `currentColor` (hérite de `.tag-neutral`), pas de couleur dédiée — cohérent avec
  RG-021-01 (« discrète »).
- Ligne de connexion dépliée : bordure `1px solid var(--color-divider)` au repos, `1px solid var(--color-accent)`
  quand dépliée (repris du wireframe 2a, qui distingue déjà la connexion « GitHub » en cours d'édition par une
  bordure accent).
- Message « Configurez d'abord le jeton de cette connexion » : `color: var(--color-accent-700)`, même style que les
  autres messages d'erreur bloquants de la section (cf. `.status.error` existant).

### Typographie
Inchangée — tailles/poids déjà définis par `.connections-table`/`.repos-table` existants, réutilisés tels quels.

### Layout et structure
- **Ligne de connexion, état replié** : icône forge (16 px) · nom (600) · hôte de l'URL (`neutral-600`) · tag
  `tag-neutral` « N dépôts » · état du jeton · chevron (`chevron-down`, rotation 180° si dépliée via `[class.open]`).
  Toute la ligne est cliquable (`role="button"`, `tabindex="0"`) sauf si un dialog de confirmation d'abandon
  intercepte le clic (RG-019-11, formulaire modifié).
- **État déplié** : sous la ligne d'en-tête, dans l'ordre — formulaire de connexion (markup actuel de
  `.connection-form`, inchangé) puis, séparés par une règle 2 px (`border-top: 2px solid var(--color-divider)`), le
  tableau des repos de cette connexion (markup actuel de `.repos-table`, sans colonne/sélecteur « Connexion ») et le
  lien « Supprimer cette connexion » aligné à droite en pied de carte.
- **Une seule connexion dépliée à la fois** (RG-021-00a) : déplier une ligne referme la précédente, avec la même
  confirmation d'abandon que le formulaire actuel si des champs ont été modifiés sans être enregistrés.
- **Bouton « + Ajouter une connexion »** : déplie une carte vide en fin de liste (comportement identique à
  l'ouverture du formulaire d'ajout actuel), sans tableau de repos tant que la connexion n'est pas créée
  (RG-019-12) ; le tableau apparaît dès la création réussie, la carte restant dépliée (RG-021-00a).

### États et comportements conditionnels
| État | Affichage |
|------|-----------|
| Connexion repliée | En-tête seul, aucun formulaire ni tableau de repos monté (évite de charger N formulaires inutilement) |
| Connexion dépliée, avec jeton | Formulaire + tableau de repos + ligne d'ajout |
| Connexion dépliée, sans jeton | Formulaire + message bloquant à la place de la ligne d'ajout (RG-021-00b) ; les repos déjà existants restent listés (suppression/renommage toujours possibles) |
| Une seule connexion configurée | Filtre « Connexion » absent du menu, icône de forge absente du tag projet — écran Paramètres inchangé par ailleurs (une seule ligne, dépliable comme les autres) |
| ≥ 2 connexions, 1 seul type de forge | Filtre « Connexion » présent (RG-021-03/QO-021-02), icône de forge absente (RG-021-01) |
| Dernière synchro `partial`/`error` | Tooltip du libellé de synchro = `lastRun.errorMessage` (RG-021-06) ; sinon tooltip « prochaine synchro » (RG-013-07) inchangé |

### Interactions et animations
- Chevron : rotation CSS `transform: rotate(180deg)` sur `.open`, transition `150ms ease` (cohérent avec les autres
  micro-transitions déjà présentes dans l'app, ex. barre de progression).
- Pas d'animation d'expansion en hauteur (`height` transition) — insertion/retrait direct du bloc via `@if`, comme
  le reste de l'application (aucun autre composant n'anime une expansion de contenu aujourd'hui).

## Assets nécessaires
Aucun. `gitlab`/`github` (Lucide, `shared/icons/provide-icons.ts`) sont déjà enregistrées et utilisées ailleurs dans
l'écran Paramètres — simple réemploi dans le tag projet du tableau.
