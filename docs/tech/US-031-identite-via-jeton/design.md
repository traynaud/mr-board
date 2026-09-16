# Design — US-031 Identité « Moi » résolue depuis le jeton

## Référence maquettes
Aucune maquette de `docs/design/` ne couvre l'affichage « Connecté en tant que » ni le déplacement de la case de
surbrillance — écart déjà signalé dans les specs PO (§5). Ce document propose un rendu qui réutilise strictement les
patterns déjà validés par le design system (`docs/tech/design-system.md`) plutôt que d'inventer un nouveau style.

## Écrans / Vues concernés

| Écran | Route Angular cible | Composant principal |
|-------|---------------------|----------------------|
| Paramètres | `/settings` | `SettingsPageComponent` (renumérotation des sections) |
| Paramètres › Connexions | `/settings#connections` | `ConnectionsSectionComponent` (nouveau bloc « Connecté en tant que ») |
| Paramètres › Divers | `/settings` (section 05) | `MiscellaneousSectionComponent` (case `highlightMe` ajoutée) |

## Correspondance maquette → Angular Material

| Élément | Composant | Personnalisation nécessaire |
|---------|-----------|------------------------------|
| Avatar « Connecté en tant que » | `AvatarComponent` (`shared/avatar`) | Style « auteur » (carré 28 px, plein, `neutral-800`), repris tel quel de l'ex-section Moi |
| Case de surbrillance déplacée | `mat-checkbox` | Aucune ; identique à son rendu actuel dans « 01 · Moi » |
| État « Identité non résolue » | texte simple | Couleur `neutral-600`, aucune icône (cohérent avec les états de texte discrets déjà utilisés, ex. tag `neutral-600` de la colonne URL) |

## Éléments visuels spécifiques

### Layout et structure

Le bloc « Connecté en tant que » est une **seconde ligne**, sous la ligne de résumé existante
(`.connection-summary`), à l'intérieur de `.connection-row` — donc visible sans déplier la connexion, cohérent avec
RG-031-06 (« chaque ligne de connexion affiche… »). Il ne s'ajoute pas comme colonne de plus dans la ligne flex
existante (icône / nom / URL / compteur repos / jeton / actions), déjà dense : une ligne dédiée évite le débordement
horizontal sur les noms/emails longs.

```
┌─────────────────────────────────────────────────────────────────────────┐
│ [icône] gitlab.com          https://gitlab.com    3 dépôts   Jeton (…wxyz) [⟳] [×] [⌄] │
│  [avatar] Connecté en tant que Marie Dupont (@mdupont) · marie.dupont@exemple.fr        │
└─────────────────────────────────────────────────────────────────────────┘
```

- Indentation alignée sur `.name-col` (même retrait horizontal que le nom de la connexion sur la ligne du dessus),
  avatar 20 px (plus petit que les 28 px du tableau des MRs, pour rester secondaire dans une liste de paramètres —
  cohérent avec la taille déjà réduite des icônes de forge 16 px de cette même liste, RG-019-10).
- Texte 12 px `neutral-600` pour le libellé « Connecté en tant que », nom complet en 12 px `neutral-800` (600),
  `@username` et email à sa suite, séparés par « · », même 12 px `neutral-600`.
- Cette ligne est **omise entièrement** quand `connection.tokenConfigured === false` (RG-031-06) — pas de hauteur
  réservée, pas de texte vide.

### États et comportements conditionnels

| État | Condition | Rendu |
|------|-----------|-------|
| Résolue | `identity !== null` | Avatar (photo ou initiales) + « Connecté en tant que <strong>Nom complet</strong> (@username) » + « · email » si non nul |
| Non résolue, jeton configuré | `tokenConfigured === true && identity === null` | Texte seul, `neutral-600` : « Identité non résolue » |
| Aucun jeton | `tokenConfigured === false` | Ligne absente |

Aucune animation : la ligne apparaît/disparaît avec le prochain rendu de la liste (rechargement `GET /connections`
après une résolution réussie, comme le reste de la liste des connexions).

### Couleurs et thème

Aucune nouvelle couleur : `--color-neutral-600` (texte secondaire) et `--color-neutral-800` (avatar plein, déjà
utilisé pour l'avatar auteur du tableau) suffisent, cohérents en clair comme en sombre (tokens existants,
`design-system.md` §Couleurs).

### Typographie

12 px partout sur cette ligne (taille des métadonnées secondaires déjà utilisée pour `token-col`/`url-col` de la
même liste), pas de majuscule forcée.

### Interactions et animations

Aucune — bloc statique, pas de tooltip supplémentaire (le nom complet est déjà affiché en clair, contrairement à
l'avatar du tableau des MRs qui doit économiser l'espace).

## Assets nécessaires
Aucun nouvel asset : réutilise `AvatarComponent` (déjà utilisé par l'ex-section Moi) et les icônes de forge Lucide
`gitlab`/`github` déjà en place sur la ligne de résumé.
