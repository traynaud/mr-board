# Design — US-019 Connexions multi-forges (socle)

## Référence maquettes

Aucune maquette ne couvre cet écran (écart documenté dans les specs, §4). Base de départ : wireframe **1c** (sections
`01 · Moi` / `02 · Connexion GitLab` / `03 · Repos à scanner`) et le tableau des repos du prototype
(`MR Board - Prototype.dc.html`, ligne ~163) pour le style de liste compacte et la ligne d'ajout. Composants
existants réutilisés strictement : tableau compact de `sections/repositories`, `mat-form-field` de l'ancienne
section 02, `mat-radio-group` de `sections/thresholds`, `ConfirmDialogComponent`, les toasts `mrb-toast`.

## Écrans / Vues concernés

| Écran | Route Angular cible | Composant principal |
|-------|---------------------|----------------------|
| Paramètres — section 02 | `/settings` (inchangée) | `ConnectionsSectionComponent` (nouveau) |
| Paramètres — section 01 | `/settings` (inchangée) | `MeSectionComponent` (adapté) |
| Paramètres — section 03 | `/settings` (inchangée) | `RepositoriesSectionComponent` (adapté) |

## Correspondance maquette → Angular Material

| Élément | Composant Material | Personnalisation |
|---------|---------------------|-------------------|
| Liste des connexions | Table HTML native + classes du design system (même pattern que le tableau des repos, **pas** `mat-table` — le tableau des repos existant n'en utilise pas non plus) | Aucun arrondi, règle 2 px entre lignes, `neutral-600` pour l'URL |
| Icône de forge par ligne | `mat-icon [svgIcon]="'gitlab'\|'github'"` | 16 px, `neutral-600` |
| 3 actions par ligne | `button mat-icon-button` (Tester / Modifier / Supprimer) | Identique au bouton Supprimer déjà utilisé sur les repos |
| Bouton « + Ajouter une connexion » | `button mat-stroked-button` | Identique au style du bouton d'ajout existant si présent, sinon cohérent avec les autres boutons secondaires de l'écran |
| Type de connexion | `mat-radio-group` horizontal (2 `mat-radio-button`) | Le bouton « GitHub » porte `[disabled]="true"` + `matTooltip="Bientôt disponible"` |
| Jeton masqué | `mat-form-field` + `input[type=password/text]` + bouton eye/eye-off | Copié tel quel de l'ancienne section 02 (`GitlabConnectionSectionComponent`) |
| Sélecteur de connexion (repos) | `mat-select` + `mat-option` | Uniquement rendu si ≥ 2 connexions (RG-019-15) |

## Éléments visuels spécifiques

### Layout et structure — section « 02 · Connexions »

```
02 · Connexions
Forges interrogées par MR Board. Jeton en lecture seule, stocké chiffré côté serveur.
┌─────────────────────────────────────────────────────────────────────────┐
│ [icône] gitlab.com          https://gitlab.com       Jeton configuré (…wxyz)   [Tester] [Modifier] [Supprimer] │
│ [icône] gitlab.exemple.fr   https://gitlab.exemple.fr Aucun jeton              [Tester] [Modifier] [Supprimer] │
└─────────────────────────────────────────────────────────────────────────┘
[+ Ajouter une connexion]

── (formulaire inline, ouvert sous la liste quand actif) ──────────────────
Type   ( ) GitLab   ( ) GitHub — bientôt disponible
Nom    [________________]
URL    [________________]
Jeton  [••••••••••••] [eye]     [Tester la connexion]
       <résultat du test ici>
[Valider]  [Annuler]
```

- Une seule ligne de formulaire ouverte à la fois : cliquer « Modifier » sur une autre ligne pendant qu'un
  formulaire est ouvert et modifié (`dirty`) déclenche la même confirmation d'abandon que le `unsavedChangesGuard`
  global (réutiliser `ConfirmDialogComponent` avec les clés `settings.unsaved.*` existantes, pas de nouvelles clés).
- État vide : la liste est remplacée par un seul message centré, `neutral-600`, italique n'est pas utilisé ailleurs
  dans le design system → texte simple : « Aucune connexion. Ajoutez votre première forge. » suivi du même bouton
  stroked.
- Le formulaire d'ajout pré-remplit `Type=GitLab`, `URL=https://gitlab.com`, `Nom=gitlab.com` (RG-019-02) dès son
  ouverture, avant toute saisie.

### États et comportements conditionnels

| État | Rendu |
|------|-------|
| 0 connexion | Message vide + bouton (pas de tableau) |
| 1 connexion | Tableau à une ligne ; section 03 sans sélecteur ni colonne « Connexion » |
| ≥ 2 connexions | Tableau complet ; section 03 avec sélecteur + colonne |
| Formulaire ouvert (ajout) | Valeurs par défaut RG-019-02, bouton « Valider » désactivé tant que Nom/URL/Jeton invalides |
| Formulaire ouvert (modification) | Nom/URL pré-remplis, Jeton vide avec placeholder « Laisser vide pour conserver le jeton actuel », Type affiché en lecture seule (pas de `mat-radio-group`, juste le libellé + icône — RG-019-11 : non modifiable) |
| Test en cours (liste ou formulaire) | Bouton « Tester » désactivé, libellé « Connexion… » (réutilise `settings.connections.testing`) |
| Test réussi | Toast si déclenché depuis la liste (« gitlab.com : ✓ Connecté · … ») ; résultat inline sous le champ si déclenché depuis le formulaire (identique au comportement actuel de `GitlabConnectionSectionComponent`) |
| Suppression | `ConfirmDialogComponent` avec le nombre de repos interpolé dans le message |

### Section « 01 · Moi » — déclinaison par connexion

```
01 · Moi
Utilisé par « Mes MRs » et pour repérer mes rôles.

Nom d'utilisateur sur gitlab.com          [________]  [avatar] détecté via le jeton
Nom d'utilisateur sur gitlab.exemple.fr   [________]  [avatar] saisi manuellement
Email (optionnel)                         [________]

[x] Surligner mes MRs dans le tableau (auteur, reviewer, affecté)
```

- Sans connexion : les deux premières lignes sont remplacées par un message « Ajoutez d'abord une connexion » +
  lien (`routerLink`/ancre vers la section 02, scroll simple, pas de changement de route). Le champ Email et la
  case `highlightMe` restent affichés et fonctionnels (RG-019-24).
- Chaque ligne réutilise exactement le pattern d'aperçu déjà livré par US-002 (`AvatarComponent` + tag de statut) —
  seule la boucle change, pas le contenu d'une ligne.

### Section « 03 · Repos à scanner » — sélecteur conditionnel

```
[mat-select Connexion ▾]  [chemin____________]  [alias____]  [Ajouter]
```
n'apparaît que si ≥ 2 connexions ; sinon la ligne actuelle (sans sélecteur) est inchangée à l'identique. La première
connexion de la liste est présélectionnée par défaut à l'ouverture de l'écran et après l'ajout d'une deuxième
connexion (RG-019 scénario « Sélecteur de connexion des repos »).

## Assets nécessaires

- Icônes Lucide `gitlab` et `github` (tracés SVG officiels, 24×24, style identique aux icônes déjà présentes dans
  `provide-icons.ts` : `fill="none" stroke="currentColor" stroke-width="2"`) à ajouter à `ICONS`.
