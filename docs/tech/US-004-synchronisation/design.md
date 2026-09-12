# Design — US-004 Synchronisation des MRs depuis GitLab

## Référence maquettes

- `docs/design/MR Board - Wireframes.dc.html` — vues **1a** (`#1a`, toolbar "Synchronisé il y a 2 min", bouton
  Rafraîchir actif) et **1b** (`#1b`, toolbar "Synchronisation en cours…", bouton Rafraîchir désactivé, icône
  accent).
- `docs/design/MR Board - Prototype.dc.html` — script de rendu de l'écran `board` : variables `syncLabel`,
  `syncing`, `refreshDisabled`, `noToken` (bandeau sans-jeton), bloc `<sc-if value="{{ syncing }}">` avec
  `<md-linear-progress indeterminate>` sous la toolbar.
- Bandeau "Aucun jeton" : présent uniquement dans le prototype (pas dans les wireframes statiques), lignes 49-54 du
  script — fond `--color-accent-100`, bordure basse 2 px `--color-accent`, texte `--color-accent-800`.
- Aucun état "aucun repo configuré" n'est représenté dans le prototype ni les wireframes (le jeu de données de démo
  a toujours des repos) : traité par analogie avec les autres états vides du design system (texte centré + bouton),
  §"États et comportements conditionnels" ci-dessous.

## Écrans / Vues concernés

| Écran | Route Angular | Composant principal |
|-------|---------------|----------------------|
| Tableau | `/` | `BoardPageComponent` (toolbar, bandeau, état vide — le tableau lui-même reste le placeholder US-005) |

## Correspondance maquette → Angular Material

| Élément de la maquette | Composant Material | Personnalisation nécessaire |
|---|---|---|
| `<span class="nav-brand">MR Board</span>` | Texte simple (déjà en place) | Aucune |
| `{{ syncLabel }}` (texte statut, 12px, `--color-neutral-600`) | Texte simple dans `BoardToolbarComponent` | Couleur accent (`--color-accent-700`/`800`) quand `syncing` ou `error`, sinon neutre — cf. wireframe 1b où le texte + l'icône passent en accent pendant la synchro |
| Icône "en cours" (flèche partielle, `stroke-width 2`) devant le texte de statut pendant la synchro | `mat-icon svgIcon="refresh-cw"` | Réutilisation de l'icône déjà enregistrée (pas de nouvelle icône), taille réduite (13-14px) et couleur accent, alignée avec le texte |
| `<md-outlined-button data-act="refresh">` | `mat-stroked-button` + `mat-icon svgIcon="refresh-cw"` | `[disabled]` piloté par `noToken() \|\| running()` |
| `<md-linear-progress indeterminate style="height:2px;margin-top:-2px">` | `mat-progress-bar mode="indeterminate"` | Hauteur forcée à 2 px via CSS du composant (`::ng-deep` documenté ici comme autorisé, cf. règle `architecture-frontend.md` "sauf documentation dans design.md") ; positionné immédiatement sous la toolbar, sans décaler le contenu (`margin-top: -2px` ou position absolue) |
| Bandeau `noToken` (`background: --color-accent-100`, `border-bottom: 2px solid --color-accent`) | `div` custom (pas de composant Material dédié) + `mat-icon svgIcon="alert-circle"` + `button mat-button` | Bloc de template simple dans `board-page.component.html`, sur le modèle exact des couleurs du prototype |
| `<md-text-button data-act="goto" data-view="settings">Configurer</md-text-button>` | `a mat-button routerLink="/settings"` | Identique au lien Paramètres déjà présent dans la toolbar |
| État vide "Aucun repo configuré" | `div` custom centré + `button mat-stroked-button routerLink="/settings"` | Pas de maquette de référence directe : reprend le gabarit texte + bouton déjà utilisé pour les erreurs de chargement des sections Paramètres (`settings-page`), centré verticalement dans la zone tableau |

## Éléments visuels spécifiques

### Couleurs et thème
- Statut normal (`success`/`partial` passé, ou "Jamais synchronisé") : `--color-neutral-600`, comme le texte
  `syncLabel` par défaut du prototype.
- Statut "en cours" ou "en échec" : `--color-accent-700` (texte) — le wireframe 1b utilise `--color-accent-700` pour
  le texte "Synchronisation en cours…" ; réutilisé à l'identique pour "Dernière synchro en échec il y a N min"
  (RG-004-08), les deux étant des états qui appellent l'attention.
- Bandeau sans-jeton : fond `--color-accent-100`, bordure basse 2 px `--color-accent`, texte `--color-accent-800`
  (repris tel quel du prototype, lignes 50-52).

### Typographie
- Statut de synchro : 12px, poids normal (comme `syncLabel` dans le prototype) — pas de gras, contrairement au
  libellé "Aucun jeton GitLab configuré." du bandeau qui est en `font-weight:600` (prototype ligne 51).

### Layout et structure
- Toolbar : `mat-toolbar` existant inchangé dans sa structure (`nav-brand` / `spacer` / actions à droite) ; le
  libellé de statut s'insère entre `nav-brand` et le `spacer`, comme dans les wireframes (`syncLabel` juste après
  `nav-brand`, avant l'espace flexible qui pousse le bouton Rafraîchir et le lien Paramètres à droite).
- Barre de progression : hors flux normal de la toolbar (`position: absolute` ou marge négative), 2 px de hauteur,
  ne doit pas décaler le contenu sous elle de plus de 2 px au total (cohérent avec la règle `border-bottom: 2px` du
  reste du design system, wireframe : `border-bottom:2px solid var(--color-divider)` sur la toolbar elle-même).
- Bandeau : pleine largeur, sous la toolbar (et sous la barre de progression si les deux sont visibles
  simultanément — cas où l'utilisateur configure un jeton puis relance une synchro alors que le formulaire vient de
  charger : rare mais possible, l'ordre d'empilement toolbar → progress-bar → bandeau → contenu est celui du
  prototype).
- État vide : centré horizontalement et verticalement dans la zone qui contient aujourd'hui le `<p class="placeholder">`.

### États et comportements conditionnels
Quatre états de la toolbar (texte + icône + bouton), dérivés de `SyncStore` via `computeSyncStatusLabel` :

| État | Condition | Texte | Icône | Bouton Rafraîchir |
|---|---|---|---|---|
| En cours | `running()` | "Synchronisation en cours…" | `refresh-cw` accent | Désactivé |
| Jamais synchronisé | `!running() && lastRun === null` | "Jamais synchronisé" | Aucune | Actif (sauf si `noToken`) |
| Synchronisé | `!running() && lastRun.status ∈ {success, partial}` | "Synchronisé à l'instant" (< 1 min) ou "Synchronisé il y a N min" | Aucune, texte neutre | Actif (sauf si `noToken`) |
| Échec | `!running() && lastRun.status === 'error'` | "Dernière synchro en échec il y a N min" | Aucune, texte accent | Actif (sauf si `noToken`) — permet de relancer soi-même |

Bandeau et état vide sont mutuellement exclusifs (RG-004-10/11) : bandeau prioritaire dès qu'aucun jeton n'est
configuré, quel que soit le nombre de repos ; état vide seulement quand un jeton **est** configuré et qu'aucun repo
ne l'est.

### Interactions et animations
- Clic sur "Rafraîchir" : déclenche `trigger()`, le bouton passe en désactivé dès la résolution du `POST` (pas
  d'attente du prochain tick de polling, RG-004-09) — aucune animation propre, l'apparition de la barre de
  progression 2 px fait office de retour visuel immédiat.
- Toast d'erreur de fin de synchro : `MatSnackBar`, position/durée identiques à ceux de l'écran Paramètres
  (`horizontalPosition: 'start'`, classe `mrb-toast`, ~3.5 s) — cohérence transverse plutôt qu'un nouveau style de
  toast.

## Assets nécessaires
- Icônes déjà enregistrées, aucune nouvelle icône Lucide à ajouter : `refresh-cw` (bouton Rafraîchir + indicateur "en
  cours"), `alert-circle` (bandeau sans-jeton).
- Pas d'icône pour l'état vide "Aucun repo configuré" (non prévue par la maquette) : texte + bouton seuls, cohérent
  avec le minimalisme du design Modernist déjà appliqué ailleurs (ex. placeholder actuel du tableau, sans icône).
