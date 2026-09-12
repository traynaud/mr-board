# Design — US-013 Actualisation automatique

## Référence maquettes

- Wireframe **1c** — section « 04 · Actualisation » : segment de fréquence, case « Mettre en pause quand l'onglet
  est inactif ».
- Prototype — `freqOpts`, `pauseHidden`.

## Écrans / Vues concernés

| Écran | Route Angular | Composant principal |
|-------|---------------|----------------------|
| Paramètres | `/settings` | `RefreshSectionComponent` (nouvelle section 04) |
| Tableau | `/` | `BoardToolbarComponent` (tooltip prochaine synchro) |

## Correspondance maquette → Angular Material

| Élément de la maquette | Composant Material | Personnalisation nécessaire |
|---|---|---|
| Segment de fréquence (1/5/15/30/Manuel) | `mat-radio-group` + `mat-radio-button` (première utilisation) | Aucune — layout en ligne (`display:flex; gap`), cohérent avec le reste du formulaire |
| Case « Mettre en pause… » | `mat-slide-toggle` | Aucune (déjà utilisé ailleurs dans Paramètres) |
| Note explicative | `<p class="hint">` texte 12px `neutral-600` | Cohérent avec les notes déjà présentes dans d'autres sections |
| Tooltip toolbar | `matTooltip` | Aucune |

## Éléments visuels spécifiques

### Typographie
- Radio group : labels 13px, cohérents avec le reste du formulaire Paramètres.
- Note explicative : 12px, `--color-neutral-600`, sous le groupe de contrôles (même style que les autres notes de
  section, ex. `gitlab-connection-section`).

### Layout et structure
- Section « 04 · Actualisation » suit le même gabarit que les 3 sections existantes
  (`app-settings-section [number] [titleKey] [descriptionKey]`), dernière du formulaire (`[last]="true"` déplacé
  depuis `repositories`).
- Radio group en ligne (`mat-radio-group` avec `display: inline-flex; gap: var(--space-4)` sur les
  `mat-radio-button`), au-dessus du `mat-slide-toggle`.

### États et comportements conditionnels

| État | Condition | Rendu |
|---|---|---|
| Option de fréquence sélectionnée | `form.controls.refreshIntervalMin.value` | Radio cochée, une seule sélection possible |
| Toggle pause | `form.controls.pauseWhenHidden.value` | On/off, défaut on (`true`) |
| Tooltip toolbar, mode planifié | `nextRunAt !== null` | « Prochaine synchro à HH:mm » |
| Tooltip toolbar, mode manuel | `nextRunAt === null` | « Synchronisation manuelle » |

### Interactions et animations
- Choisir une fréquence ou basculer le toggle marque le formulaire modifié (`form.dirty`), comme tous les autres
  champs de l'écran Paramètres — pas de sauvegarde immédiate, le bouton « Enregistrer » global s'applique
  (cohérent avec RG-001-06 déjà en place).
- Aucune animation spécifique au-delà du comportement standard de `mat-radio-group`/`mat-slide-toggle`.

## Assets nécessaires

Aucun nouvel asset.
