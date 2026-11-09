# Rapport de livraison — US-036 Rétention de l'historique

## Backend
**Créés** : migration `AddHistoryRetentionSettings` ; `history/history-retention.service.ts` (+ spec).
**Modifiés** : `Settings` (entité, DTO réponse / mise à jour / import, service : `getHistoryRetention`, `onChange`),
`HistoryModule`, `SyncService` (purge en fin de synchro), specs et e2e (`settings`, `settings-transfer`, `history`).
**Tests** : 783 unitaires, e2e verts (history : 18, settings : 32), lint / `tsc` / build OK.

## Frontend
**Créés** : `sections/history/history-section.component.{ts,html,scss,spec.ts}`.
**Modifiés** : `settings.model.ts`, `settings-form.ts` (+ spec), page Paramètres (section 05, Divers → 06), `fr.json` / `en.json`,
fixtures des specs. **Tests** : 846 passés, `tsc`, lint et build OK.

## Risques traités
- ✅ Bornes hors plage → 400, réglage inchangé (e2e) ; formulaire bloque l'enregistrement.
- ✅ Purge cumulative (jours **ou** nombre), appliquée en fin de synchro et à l'enregistrement (e2e).
- ✅ Purge qui échoue : warning, jamais d'erreur de synchro ni d'enregistrement.
- ✅ Anciens fichiers d'export sans les 2 champs : toujours acceptés.
- ✅ Projet supprimé : historique et file supprimés (cascade US-033).

## Écarts par rapport au plan
Aucun.

## Points d'attention pour la review
- Rendu visuel de la section non vérifié dans un navigateur (tests de composant uniquement) : à contrôler à l'œil.
- Un `created` d'une MR plus ancienne que la rétention est purgé immédiatement (conforme à la règle, voir archi).

## Décisions
### Prises en autonomie
- Section classée « simple » (pattern dupliqué) → pas de maquette — réversible : oui
- Callback `onChange` plutôt qu'une dépendance Settings → History — réversible : oui
### Arbitrées par l'humain
- Voir `docs/features/US-033-historique-modifications/specs.md` §Décisions (rétention cumulative, défaut 5 000, cascade)
