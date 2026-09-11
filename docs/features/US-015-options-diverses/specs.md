# US-015 — Paramètres : Options diverses

## 1. Reformulation

La section « Divers » des paramètres regroupe des options de confort : ouvrir les MRs dans un nouvel onglet, ignorer
les MRs portant certains labels (`wip`, `on-hold`), exporter / importer la configuration en JSON et réinitialiser
tous les paramètres.

## 2. User Stories

- **US-015** : En tant qu'utilisateur, je veux régler quelques options de confort et pouvoir sauvegarder / restaurer ma
  configuration, afin d'adapter l'outil à mes habitudes et de le réinstaller facilement.
    - Priorité : Could
    - Complexité estimée : M
    - Dépendances : US-011, US-014

## 3. Règles de gestion

- **RG-015-01** : `openInNewTab` (défaut `false`) : si vrai, le lien du titre (RG-G11) porte `target="_blank" rel="noopener"`.
- **RG-015-02** : `ignoredLabels` (défaut `[]`, présenté par la case « Ignorer les MRs avec le label `wip` / `on-hold` » qui positionne `["wip", "on-hold"]`) : les MRs portant au moins un de ces labels (comparaison insensible à la casse) sont exclues de `GET /merge-requests` et des facets, mais restent synchronisées en base. Stocké en JSON.
- **RG-015-03** : « Exporter la config (JSON) » : télécharge `mrboard-config.json` contenant tous les paramètres **sauf le jeton** et la liste des repos (`{ version: 1, settings: {…}, projects: [{ pathWithNamespace, alias }] }`). Endpoint `GET /settings/export`.
- **RG-015-04** : « Importer » : sélection d'un fichier JSON, validation du schéma (`version`, champs connus), puis `POST /settings/import`. Les paramètres sont remplacés, les repos sont fusionnés (ajout des manquants par chemin, mise à jour des alias, aucun repo supprimé). Le jeton n'est jamais importé. Un dialog de confirmation résume « N paramètres, M repos (K nouveaux) ». Fichier invalide → message d'erreur, rien n'est modifié.
- **RG-015-05** : « Réinitialiser » : remet dans le formulaire toutes les valeurs par défaut de toutes les sections (identité vide, URL `https://gitlab.com`, fréquence 5, seuils par défaut, options désactivées) **sans toucher au jeton ni aux repos** ; toast « Valeurs par défaut restaurées (non enregistrées) ». Rien n'est persisté avant « Enregistrer ».
- **RG-015-06** : Les options `notifyAssigned` et `tabBadge` sont affichées dans cette section mais spécifiées par US-016 ; en attendant elles sont désactivées avec le tooltip « Bientôt disponible ».

## 4. Maquettes de référence

- Wireframe **1c** — section `06 · Divers` (cases, boutons « Exporter la config (JSON) » et « Importer »)
- Prototype — `newTab`, `ignoreWip`, actions `export`, `reset`, `linkTarget`

## 5. Critères d'acceptation

```gherkin
Scenario: Ouvrir dans un nouvel onglet
  Given openInNewTab = true
  When je clique sur un titre de MR
  Then la page GitLab s'ouvre dans un nouvel onglet (target=_blank, rel=noopener)

Scenario: Ignorer les labels
  Given 2 MRs portent le label « WIP » et 1 le label « on-hold »
  When j'active « Ignorer les MRs avec le label wip / on-hold » et j'enregistre
  Then ces 3 MRs ne sont plus affichées
  And elles ne comptent plus dans les facets
  And elles restent présentes en base

Scenario: Export
  When je clique sur « Exporter la config (JSON) »
  Then un fichier mrboard-config.json est téléchargé
  And il contient settings (sans gitlabToken) et projects avec pathWithNamespace et alias
  And version = 1

Scenario: Import valide
  Given un fichier d'export contenant 2 repos dont 1 déjà configuré avec un autre alias
  When je l'importe et je confirme « 12 paramètres, 2 repos (1 nouveau) »
  Then les paramètres sont remplacés
  And le repo existant a son alias mis à jour, le nouveau est ajouté et résolu via GitLab
  And le jeton est inchangé

Scenario: Import invalide
  Given un fichier JSON sans champ version
  When je l'importe
  Then un message « Fichier de configuration invalide » s'affiche et rien n'est modifié

Scenario: Import de repo introuvable
  Given le fichier contient un repo que GitLab ne trouve pas
  When je l'importe
  Then les autres éléments sont importés et un toast liste le repo ignoré

Scenario: Réinitialiser
  Given des paramètres personnalisés et un jeton configuré
  When je clique sur « Réinitialiser »
  Then tous les champs du formulaire reprennent leurs valeurs par défaut
  And le jeton et la liste des repos sont inchangés
  And un toast « Valeurs par défaut restaurées (non enregistrées) » s'affiche
  When je clique sur « Annuler »
  Then aucun paramètre n'a été modifié en base
```

## 6. Questions ouvertes

- QO-015-01 : Faut-il rendre la liste des labels ignorés éditable (champ libre) plutôt qu'une case fixe ? Hypothèse : case fixe en v1, le modèle de données (`ignoredLabels: string[]`) permet l'évolution.
- QO-015-02 : L'import doit-il pouvoir supprimer les repos absents du fichier ? Hypothèse : non (fusion additive).

## 7. Hors périmètre

- Notifications et badge (US-016)
- Import du jeton
