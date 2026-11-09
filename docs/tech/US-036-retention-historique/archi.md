# Architecture — US-036 Rétention de l'historique

## Résumé fonctionnel
> Deux réglages (âge maximal en jours, nombre maximal d'événements) dans les Paramètres ; la purge s'applique après
> chaque synchronisation et à l'enregistrement des réglages.

## Backend
- **Données** : `settings` + `history_retention_days` (défaut 60) et `history_max_events` (défaut 5 000) — migration
  `AddHistoryRetentionSettings1757602400000` (`ALTER … ADD COLUMN … NOT NULL DEFAULT`, sans reconstruction).
- **Contrat** : `GET/PUT /api/v1/settings` + 2 champs (DTO `@IsInt @Min @Max`, bornes 1–365 et 100–100 000 → 400
  hors bornes, ValidationPipe existant) ; export / import de configuration : champs optionnels (anciens fichiers valides).
- **Purge** : `HistoryRetentionService.purge()` — `DELETE … WHERE occurred_at < :limite` puis
  `DELETE … WHERE id NOT IN (SELECT id … ORDER BY occurred_at DESC, id DESC LIMIT :N)` ; ne lève jamais (warning logué).
- **Déclencheurs** : `SyncService.run` (fin de chaque synchro, y compris en échec) et enregistrement des réglages via
  `SettingsService.onChange(listener)` (mise à jour **et** import). Le listener évite une dépendance
  `SettingsModule → HistoryModule` (cycle) ; `HistoryModule` importe `SettingsModule`.
- **Cascade** (RG-036-05) : déjà assurée par `ON DELETE CASCADE` sur `project_id` (US-033). Désactivation d'un projet :
  rien à faire (pas de bascule `enabled`). « Reset » des Paramètres : ne touche pas l'historique (le formulaire remet
  seulement les deux réglages à leur défaut).

## Frontend
- `settings-form.ts` : 2 contrôles (`required`, `min`, `max`, `integerValidator`), défauts, reset, `toUpdateRequest`.
- Nouveau `HistorySectionComponent` (`features/settings/sections/history/`) : copie du pattern « Temps depuis Ready »
  (`mat-form-field` outline + préfixe `≤` + suffixe d'unité), aucun nouveau composant ni token.
- Page : section `05 · Historique` insérée avant `06 · Divers` (clé `settings.misc.number` : `05` → `06`) ;
  clés i18n `settings.history.*` en `fr.json` et `en.json`.

## Points de vigilance
- **Événements anciens à la création** : un `created` a pour date la création de la MR ; une MR créée il y a plus de
  *N* jours et vue pour la première fois est donc purgée aussitôt — conforme à la règle cumulative, assumé.
- **Tri de purge** par `occurred_at` : un événement confirmé tardivement avec une ancienne date peut être purgé tout de suite.
- **Concurrence** : la purge s'exécute dans le même processus ; SQLite sérialise les écritures.
- **Sécurité** : aucune donnée sensible nouvelle ; bornes validées côté serveur (le front n'est qu'une aide).

## Décisions
### 🛑 Arbitrage humain requis
Aucun.
### ✅ Prises en autonomie
| Sujet | Choix | Justification | Réversible |
|-------|-------|---------------|------------|
| Changement visuel | **Simple** : pattern existant dupliqué, pas de maquette | Aucun nouveau composant, token ni écran ; annoncé au précédent compte rendu | oui |
| Numérotation | Historique = 05, Divers = 06 | Divers reste en dernier | oui |
| Déclencheur « enregistrement » | Callback `onChange` | Évite un cycle de modules | oui |
| Purge en échec de synchro | Appliquée quand même | Bornes toujours respectées | oui |
