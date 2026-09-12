# US-016 — Notifications navigateur et badge d'onglet — Rapport QA

## 1. Tests automatisés

| Suite | Résultat |
|---|---|
| Backend unitaire (`npm test`) | ✅ 354 passés / 354 |
| Backend e2e (`npm run test:e2e`) | ✅ 97 passés / 97 |
| Backend couverture (`npm run test:cov`) | ✅ 99.27 % lignes (seuil 80 %) |
| Frontend (`ng test --no-watch --coverage`) | ✅ 534 passés / 534 |
| Frontend couverture | ✅ 96.86 % lignes (seuil 80 %) — `browser-notification.service.ts` et `assignment-diff.ts` à 100 % |

Tous les critères Gherkin de la section 5 des specs sont couverts par au moins un test automatisé :

- « Activer les notifications » / « Permission refusée » → `miscellaneous-section.component.spec.ts` (`notify assigned checkbox` describe : grant/deny/uncheck).
- « Nouvelle affectation » / « Pas de notification au premier chargement » / « Pas de doublon » / « Draft ignoré » → `assignment-diff.spec.ts` (fonction pure) + `merge-requests.store.spec.ts` (`describe('notifications', …)`, 4 cas).
- « Badge d'onglet » / « Badge désactivé » → `board-page.component.spec.ts` (`describe('tab title badge (RG-016-04)', …)`, 4 cas incluant la restauration au `destroy`).

## 2. Tests API manuels

Serveur backend lancé localement (SQLite `:memory:`) contre `/api/v1/settings` :

- `GET /settings` → 200, renvoie `notifyAssigned: false, tabBadge: false` par défaut. ✅
- `PUT /settings` avec `{notifyAssigned: true, tabBadge: true}` → 200, valeurs persistées, relues à l'identique par un `GET` suivant. ✅
- `PUT /settings` avec un champ inconnu (`hack: true`) → 400 `"property hack should not exist"` (whitelist globale). ✅
- `PUT /settings` avec `notifyAssigned` en tableau (`[true]`) → 400 `"notifyAssigned must be a boolean value"`. ✅
- `GET /settings/export` → inclut `notifyAssigned`/`tabBadge`, jamais le jeton. ✅
- Jeton jamais présent en clair dans les réponses testées. ✅

**Observation (pas un bug introduit par cette US)** : comme pour `pauseWhenHidden`/`workdaysOnly`/`openInNewTab` déjà en production, envoyer une chaîne non vide (ex. `"garbage"`) ou un nombre pour un champ booléen est accepté et silencieusement coercé en `true` par `class-transformer` avant que `@IsBoolean()` ne s'exécute (conversion implicite `Boolean(value)`), au lieu d'être rejeté par 400. Comportement préexistant, identique sur tous les booléens du DTO — signalé en recommandation, hors périmètre de correction de cette US.

## 3. Vérification UI (contre les maquettes)

Backend + frontend lancés en local (`ng serve` + `nest start`, base SQLite volatile) :

- Section « 06 · Divers » : les 2 cases sont désormais actives, plus de `disabled`/tooltip « Bientôt disponible ». Rendu conforme au design system (Material `mat-checkbox`, Archivo, aucun arrondi). ✅
- Case « Badge de compteur sur l'onglet » (`formControlName="tabBadge"`) : cochage → bouton « Enregistrer » activé → sauvegarde → `GET /settings` confirme `tabBadge: true` persisté. ✅
- Titre d'onglet avec `tabBadge = true` et 0 MR rouge (pas de jeton configuré dans cet environnement de test) → reste « MR Board », conforme à RG-016-04 (N = 0). ✅ (le cas N > 0 est couvert par les tests automatisés du composant, non reproductible manuellement sans jeu de données GitLab réel).
- Case « Notification navigateur… » : cliquer déclenche bien `Notification.requestPermission()` (case survolée en état "coché" pendant la requête, comme attendu d'une interception manuelle `[checked]`/`(change)`).

## 4. Limite environnementale constatée (pas un bug applicatif)

La case « Notification navigateur » n'a pas pu être validée de bout en bout via l'automatisation du navigateur (Claude in Chrome / CDP) : Chrome exige un geste utilisateur réellement « de confiance » pour résoudre `Notification.requestPermission()`, ce qu'un clic simulé via CDP ne fournit pas de façon fiable — la promesse est restée bloquée en `default` sans qu'aucun choix ne soit proposé, et l'écran de capture s'est brièvement figé (comportement cohérent avec l'apparition d'une invite native bloquante). C'est exactement la limite déjà anticipée dans `archi.md`/le rapport de dev (« non testable en jsdom/Vitest, à valider dans un vrai navigateur ») — elle s'étend à l'automatisation CDP, pas seulement aux tests unitaires. La logique applicative elle-même (granted → coché + dirty ; denied → décoché + message ; décoché → pas de nouvel appel de permission) est entièrement couverte par les tests de composant (mock de `BrowserNotificationService`).

**Recommandation** : conserver une vérification manuelle humaine (clic réel dans un navigateur) avant la mise en production, comme indiqué dans le rapport de dev — aucun changement de code requis.

## 5. Critères d'acceptation

| Scénario | Statut |
|---|---|
| Activer les notifications | ✅ Validé (tests composant) ; ⚠️ non rejouable en navigateur automatisé (voir §4) |
| Permission refusée | ✅ Validé (tests composant) ; ⚠️ idem |
| Nouvelle affectation | ✅ Validé (`assignment-diff.spec.ts`, `merge-requests.store.spec.ts`) |
| Pas de notification au premier chargement | ✅ Validé |
| Pas de doublon | ✅ Validé |
| Draft ignoré | ✅ Validé |
| Badge d'onglet | ✅ Validé (tests + vérification manuelle du cas N=0) |
| Badge désactivé | ✅ Validé |

**8/8 critères validés** (2 avec la réserve environnementale documentée en §4, sans impact sur la couverture logique).

## 6. Bugs trouvés

Aucun bug bloquant. Un point d'observation (§2, coercition booléenne implicite) est préexistant et transverse à tout `UpdateSettingsDto`, pas spécifique à US-016.

## 7. Recommandations

- **R-1** (hors périmètre US-016) : envisager de retirer la conversion implicite `class-transformer` sur les champs booléens du DTO (ou d'ajouter un validateur plus strict) pour que `PUT /settings` rejette explicitement une valeur non booléenne au lieu de la coercer silencieusement. Concerne tous les booléens existants, pas seulement `notifyAssigned`/`tabBadge` — à traiter dans un refactoring dédié si jugé prioritaire.
- **R-2** : dans une future itération, envisager un test Playwright (E2E réel navigateur, hors Vitest/jsdom) pour la case « Notification navigateur » avec permission pré-accordée via les capacités CDP dédiées (`Browser.setPermission`), qui contournent l'exigence de geste utilisateur — plus fiable que l'automatisation clic par clic tentée ici.
