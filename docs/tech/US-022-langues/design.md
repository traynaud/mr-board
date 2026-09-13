# Design — US-022 Support d'autres langues (anglais)

## Référence maquettes

Aucune maquette ne montre le contrôle « Langue » ni l'interface en anglais (écart déjà signalé dans
`docs/features/US-022-langues/specs.md` §5). Référence retenue : le contrôle « Thème » existant
(`docs/design/MR Board - Wireframes.dc.html`, écran 1c, section `06 · Divers`), reproduit à l'identique.

## Écrans / Vues concernés

| Écran | Route Angular | Composant principal |
|-------|----------------|----------------------|
| Paramètres — section Divers | `/settings` | `MiscellaneousSectionComponent` (`features/settings/sections/miscellaneous`) |
| Toute l'application (texte) | `/`, `/settings` | `TranslatePipe` / `TranslateService` (transverse) |

## Correspondance maquette → Angular Material

| Élément | Composant Material | Personnalisation nécessaire |
|---------|---------------------|------------------------------|
| Contrôle « Langue » | `mat-radio-group` + `mat-radio-button` (×2) | Aucune : copie exacte du contrôle « Thème » existant (même classe `.theme-field`/`.language-field`, même `block-title`) |

## Éléments visuels spécifiques

### Couleurs et thème

Aucun nouveau token : le contrôle reprend `--color-neutral-700` (titre de bloc) et les styles par défaut de
`mat-radio-button` (accent `#ec3013` déjà configuré globalement par le thème Material). Fonctionne à l'identique
en thème clair et sombre, comme le contrôle « Thème » voisin.

### Typographie

Les libellés « Français » et « English » sont des textes **non traduits** (endonymes, RG-022-02) — seul le titre
du bloc (« Langue » / « Language ») est une clé i18n normale.

### Layout et structure

- Le bloc `.language-field` se place **immédiatement après** `.theme-field` dans la section Divers, avant les
  cases à cocher (`notifyAssigned`, `tabBadge`, `openInNewTab`, `ignoreWip`).
- Largeur : les deux options tiennent sur une ligne (comme les 3 options du thème) ; `flex-wrap: wrap` existant sur
  `mat-radio-group` gère le repli en cas d'espace réduit (mobile/fenêtre étroite), sans changement de layout
  spécifique à prévoir.
- Aucun impact sur les autres largeurs de colonnes ou de menus **sauf** : les libellés anglais plus longs que le
  français (ex. « Assigned to (Reviewer OR Assignee) » vs « Affecté à (Reviewer OU Affecté) ») doivent être
  vérifiés en QA dans les menus de filtre et les en-têtes de colonnes existants (US-012), qui ont des largeurs
  ajustables mais des largeurs par défaut calibrées sur le français.

### États et comportements conditionnels

| État | Rendu |
|------|-------|
| `language = fr` (défaut) | Option « Français » sélectionnée ; toute l'interface en français |
| `language = en` | Option « English » sélectionnée ; toute l'interface en anglais |
| Changement de langue (aperçu) | Toute l'interface bascule en quelques dizaines de ms (le temps du fetch `en.json` la première fois) ; aucun état de chargement visible à ajouter (RG-022-03) |
| Clé absente du dictionnaire actif | Repli silencieux sur la valeur française (RG-022-07) — aucun indicateur visuel, uniquement un avertissement en console (dev) |
| « Annuler » / navigation hors de `/settings` | La langue effective revient à la valeur enregistrée (comme le thème) |
| « Réinitialiser » | Seule l'option du formulaire repasse à « Français » ; l'aperçu live ne change pas tant que l'utilisateur ne reclique pas sur une option ou n'enregistre pas (même comportement que le thème, US-018) |

### Interactions et animations

Aucune animation. Le changement de langue applique immédiatement le nouveau texte, sans transition — même
principe que le thème (l'application immédiate est son propre retour visuel, cf. QO-022-05).

## Assets nécessaires

Aucun. Pas de drapeau ni d'icône associée aux langues (choix délibéré : les libellés textuels « Français »/« English »
suffisent, cohérent avec la sobriété du design system — aucune maquette ne suggère de drapeaux).
