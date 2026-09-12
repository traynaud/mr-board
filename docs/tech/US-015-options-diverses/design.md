# Design — US-015 Paramètres : options diverses

## Référence maquettes
`docs/design/MR Board - Prototype.dc.html`, section 06 « Divers » (lignes ~199-206). Wireframe **1c**.

⚠️ Le bouton « Importer » n'existe pas dans le prototype (voir specs.md §4) : sa présentation ci-dessous est une
extrapolation cohérente avec le reste de la section, pas une maquette validée.

## Écrans / Vues concernés

| Écran | Route Angular cible | Composant principal |
|-------|----------------------|------------------------------------------------|
| Paramètres | `/settings` | `MiscellaneousSectionComponent` (nouveau) + toolbar de `SettingsPageComponent` (bouton Réinitialiser) |
| Tableau | `/` | `MrTableComponent` (lien titre `target`) |

## Correspondance maquette → Angular Material

| Élément de la maquette | Composant Material | Personnalisation nécessaire |
|--------------------------|----------------------|---------------------------------|
| `md-checkbox` (notify/badge/newTab/ignoreWip) | `mat-checkbox` | Les 2 premières (`notify`/`badge`, US-016) rendues `disabled` avec `matTooltip="settings.misc.comingSoon"` |
| `md-outlined-button` Export / Réinitialiser | `mat-stroked-button` | Identique au bouton « Tester la connexion » déjà utilisé dans `gitlab-connection-section` |
| (absent du prototype) bouton Import | `mat-stroked-button` | Même style que Export ; à côté de lui |
| (absent du prototype) `<input type="file">` | natif, `hidden`, déclenché par le bouton Import via `ViewChild`/référence de template (`#fileInput`, `(click)="fileInput.click()"`) | Accepter uniquement `.json` (`accept=".json,application/json"`) |
| Dialog de confirmation import | `ConfirmDialogComponent` (étendu) | Message interpolé (voir archi.md) |

## Éléments visuels spécifiques

### Layout et structure
- Reprendre le layout du prototype : `display:flex; flex-direction:column; gap:12px` pour les 4 cases, puis une
  ligne `display:flex; gap:8px` pour les boutons d'action (Export, **Import**, Réinitialiser) — le prototype ne
  groupe que Export + Réinitialiser sur cette ligne ; Import s'intercale entre les deux pour rester visuellement
  groupé avec Export (les deux manipulent le fichier de config).
- Le bouton global « Réinitialiser » de la toolbar (RG-015-05) est **distinct** de ce bouton de section : il vit
  dans `settings-page.component.html`, à côté de « Annuler »/« Enregistrer », pas dans la section Divers — car il
  agit sur tout le formulaire, pas seulement sur cette section. Le prototype le place dans la section Divers,
  mais l'architecture (une seule fonction `resetSettingsFormToDefaults` opérant sur `SettingsForm` entier) est
  plus simple à exposer depuis la page qui possède déjà le formulaire complet ; en pratique, visuellement, ce
  bouton peut être rendu dans le corps de la section Divers en appelant une méthode exposée par la page via un
  `output()` (`resetRequested`), pour rester fidèle à l'emplacement du prototype tout en gardant la logique dans
  `SettingsPageComponent`. Choix laissé au développeur ; les deux emplacements sont visuellement acceptables.

### États et comportements conditionnels
- Case décochée par défaut pour `openInNewTab`/`ignoreWip` (RG-015-01/02).
- Cases `notify`/`badge` (US-016) : toujours désactivées en v1, `matTooltip` « Bientôt disponible » — ne pas les
  lier à un `FormControl` réel tant qu'elles ne font rien (éviter du code mort ; un simple `disabled` statique
  dans le template suffit, sans `formControlName`).
- Bouton Import désactivé pendant la lecture du fichier / l'appel réseau (`saving`-like signal local au
  composant, cohérent avec `store.saving()` ailleurs).
- Message d'erreur "Fichier de configuration invalide" : toast (comme les autres erreurs de la page), pas de
  `mat-error` inline (il n'y a pas de champ de formulaire associé).
- Dialog de confirmation : `confirmKey`/`cancelKey` = « Importer »/« Annuler », `messageKey` interpolé avec
  `{settingsCount, totalRepos, newRepos}`.

### Interactions et animations
- Export : aucun aller-retour visuel particulier, le fichier se télécharge immédiatement (pas de toast de
  succès nécessaire — le téléchourage lui-même est la confirmation).
- Import : sélection fichier → (si invalide) toast d'erreur immédiat, flux interrompu → (si valide) dialog de
  confirmation → (si annulé) rien ne se passe → (si confirmé) appel réseau → toast de succès, et un second
  toast listant les repos ignorés s'il y en a.
- Réinitialiser : effet immédiat sur le formulaire (pas de confirmation — RG-015-05 ne le demande pas), toast
  « Valeurs par défaut restaurées (non enregistrées) ».

## Assets nécessaires
Aucun nouvel icône nécessaire (les boutons Material utilisent du texte, comme Export/Réinitialiser dans le
prototype). Si le développeur souhaite une icône pour le bouton Import (ex. `upload`), vérifier sa présence dans
`shared/icons/provide-icons` avant d'en ajouter une nouvelle.
