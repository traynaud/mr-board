# US-013 — Actualisation automatique

## 1. Reformulation

Le backend synchronise périodiquement les MRs selon une fréquence choisie dans les paramètres (1, 5, 15, 30 minutes ou
manuel). Le tableau se met à jour automatiquement après chaque synchronisation. Une option permet de suspendre le
rafraîchissement du tableau quand l'onglet n'est pas visible.

> ℹ️ **Validation Phase 1** : le code existant anticipe déjà cette US, sans conflit à trancher (contrairement à
> US-011/US-012) :
> - `SyncStatusResponseDto.nextRunAt` et `SyncTrigger = 'manual' | 'scheduled'` **existent déjà**, avec un
>   commentaire explicite « toujours `null`/jamais `'scheduled'` jusqu'à US-013 » — seule leur alimentation réelle
>   manque.
> - **RG-013-04 est déjà implémentée** : l'effet de `BoardPageComponent` qui recharge les MRs à la fin d'une
>   synchronisation ne distingue pas manuel/planifié (RG-005-06, déjà en place depuis US-005). Aucun code
>   frontend nouveau nécessaire pour ce point précis — seulement le vérifier avec un déclenchement `'scheduled'`
>   réel une fois le planificateur backend en place.
> - `docs/tech/architecture-backend.md` §7 anticipe déjà la conception cible : un `SyncScheduler` utilisant un
>   intervalle **dynamique** de `@nestjs/schedule`, reprogrammé à chaque sauvegarde des paramètres — repris tel
>   quel en Phase 2.
> - La numérotation « 04 · Actualisation » (RG-013-06) est confirmée libre (sections existantes : 01 Moi,
>   02 Connexion GitLab, 03 Repos à scanner) ; le flag `[last]="true"` actuellement sur la section Repos devra
>   migrer vers la nouvelle section.
> - L'entité `Settings` ne porte aujourd'hui aucun champ de rafraîchissement — migration TypeORM nécessaire pour
>   `refresh_interval_min` et `pause_when_hidden` (RG-013-01/05).

## 2. User Stories

- **US-013** : En tant qu'utilisateur, je veux que le tableau se mette à jour automatiquement à la fréquence de mon choix,
  afin de ne pas avoir à rafraîchir manuellement.
    - Priorité : Should
    - Complexité estimée : M
    - Dépendances : US-004

## 3. Règles de gestion

- **RG-013-01** : Paramètre `refreshIntervalMin` ∈ {0, 1, 5, 15, 30}, défaut 5. `0` = « Manuel » (aucune synchronisation planifiée). Toute autre valeur → 400.
- **RG-013-02** : Le planificateur backend (`@nestjs/schedule`) déclenche `SyncService.run('scheduled')` à l'intervalle configuré, à partir du démarrage de l'application. La modification du paramètre reprogramme immédiatement l'intervalle (sans redémarrage). Une synchronisation planifiée est sautée si une synchronisation est déjà en cours ou si aucun jeton n'est configuré.
- **RG-013-03** : Une synchronisation manuelle (« Rafraîchir ») réinitialise le compte à rebours de la prochaine synchronisation planifiée.
- **RG-013-04** : Frontend : le store de synchronisation interroge `GET /sync/status` (RG-004-06) ; lorsque `lastRun.finishedAt` change, la liste des MRs et les facets sont rechargées avec les filtres courants, sans vider le tableau ni perdre la position de défilement.
- **RG-013-05** : Paramètre `pauseWhenHidden` (défaut `true`) : quand l'onglet est masqué (`document.visibilityState === 'hidden'`), le frontend suspend le polling de statut et le rechargement ; au retour de l'onglet, il recharge immédiatement. Le backend, lui, continue de synchroniser (le cache reste à jour pour les autres onglets / le retour).
- **RG-013-06** : UI Paramètres, section `04 · Actualisation` : groupe radio « 1 min / 5 min / 15 min / 30 min / Manuel » et `mat-slide-toggle` « Mettre en pause quand l'onglet est inactif ». Note explicative : « Synchro automatique ; le bouton Rafraîchir force toujours. »
- **RG-013-07** : `GET /sync/status` renvoie aussi `nextRunAt` (null en manuel) ; le tooltip du statut toolbar affiche « Prochaine synchro à HH:mm » ou « Synchronisation manuelle ».

## 4. Maquettes de référence

- Wireframe **1c** — section `04 · Actualisation` (segment de fréquence, case « Mettre en pause quand l'onglet est inactif »)
- Prototype — `freqOpts`, `pauseHidden`

## 5. Critères d'acceptation

```gherkin
Scenario: Synchronisation planifiée
  Given refreshIntervalMin = 1 et un jeton valide
  When 60 secondes s'écoulent
  Then une synchronisation « scheduled » est exécutée et tracée dans sync_runs

Scenario: Mode manuel
  Given refreshIntervalMin = 0
  When 30 minutes s'écoulent
  Then aucune synchronisation planifiée n'est exécutée
  And GET /api/v1/sync/status renvoie nextRunAt = null

Scenario: Reprogrammation à chaud
  Given refreshIntervalMin = 30
  When j'enregistre refreshIntervalMin = 1
  Then la synchronisation suivante a lieu dans ≤ 60 s sans redémarrage

Scenario: Valeur invalide
  When j'enregistre refreshIntervalMin = 7
  Then l'API répond 400

Scenario: Sync planifiée sautée si sync en cours
  Given une synchronisation manuelle est en cours
  When l'intervalle planifié échoit
  Then aucune seconde synchronisation n'est lancée

Scenario: Sync planifiée sautée sans jeton
  Given aucun jeton n'est configuré et refreshIntervalMin = 1
  When 60 secondes s'écoulent
  Then aucune synchronisation n'est exécutée et aucune erreur n'est tracée

Scenario: Rechargement automatique du tableau
  Given le tableau est ouvert avec le filtre « Projet : api »
  When une synchronisation planifiée se termine et ajoute une MR sur api
  Then la nouvelle MR apparaît sans action de ma part
  And les filtres et la position de défilement sont conservés

Scenario: Pause quand l'onglet est masqué
  Given pauseWhenHidden = true et l'onglet est masqué
  When une synchronisation se termine
  Then aucun appel GET /api/v1/merge-requests n'est effectué
  When l'onglet redevient visible
  Then le statut et la liste sont rechargés immédiatement

Scenario: Pas de pause
  Given pauseWhenHidden = false et l'onglet est masqué
  When une synchronisation se termine
  Then la liste est rechargée

Scenario: Tooltip prochaine synchro
  Given refreshIntervalMin = 5 et la dernière synchro à 10:02
  When je survole le statut de la toolbar
  Then le tooltip affiche « Prochaine synchro à 10:07 »
```

## 6. Questions ouvertes

- QO-013-01 : Faut-il un intervalle libre (saisie numérique) plutôt qu'une liste fixe ? Hypothèse : liste fixe (maquette).
- QO-013-02 : Faut-il ralentir automatiquement la fréquence en cas de 429 GitLab répétés ? Hypothèse : non en v1, log d'avertissement.

## 7. Hors périmètre

- Webhooks / push
- Synchronisation différenciée par projet
