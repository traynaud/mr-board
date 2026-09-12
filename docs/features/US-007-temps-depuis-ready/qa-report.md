# Rapport QA — US-007 Temps depuis Ready

## 1. Tests automatisés

| Suite | Résultat |
|---|---|
| Backend unit (`npm test`) | ✅ 231 passed / 0 failed (27 suites) |
| Backend e2e (`npm run test:e2e`) | ✅ 54 passed / 0 failed (5 suites, dont 8 sur `merge-requests.e2e-spec.ts`) |
| Backend couverture (`npm run test:cov`) | ✅ 99,12 % lignes / 86,42 % branches — module `merge-requests` : 100 % lignes/fonctions, `calculate-ready-delay.ts` 100 %/100 %/100 % — au-dessus du seuil 80 % |
| Frontend (`ng test --no-watch --coverage`) | ✅ 234 passed / 0 failed (35 fichiers) |
| Frontend couverture | ✅ 99,12 % statements / 93,96 % branches / 98,7 % fonctions / 98,95 % lignes (global) — `shared/ready-delay` : 96,87 % stmts / 93,54 % branches ; `shared/format/format-date.ts` : 100 %/100 % — au-dessus du seuil 80 % |

Note technique : la première tentative de mesure de couverture frontend via `rtk npx ng test --coverage` n'affichait
aucun tableau (le filtre `rtk` semble avaler ce format de sortie) — contourné en lançant `npx ng test --coverage`
sans le wrapper `rtk` pour obtenir les chiffres ci-dessus.

## 2. Tests API manuels

Aucune instance GitLab réelle n'étant disponible dans cet environnement, les scénarios de synchronisation complets
(champs `draft`/`createdAt`/`readyAt`/`readyDays`/`readyLevel`/`openedDays` après un vrai sync) sont couverts par la
suite e2e (`merge-requests.e2e-spec.ts`, GitLab mocké), qui effectue de véritables requêtes HTTP contre l'application
NestJS complète — c'est l'équivalent automatisé du test manuel demandé par le process QA. En complément, un smoke
test manuel a été fait sur un serveur local (`DB_PATH=:memory:`, port 3010, arrêté après test) :

- `GET /api/v1/health` → 200, `{"status":"ok","database":"up",...}`
- `GET /api/v1/merge-requests` avant toute synchro → 200, `[]` (conforme à l'état vide)
- `PUT /api/v1/settings` avec un jeton factice, puis `GET /api/v1/settings` → le jeton n'apparaît jamais en clair
  (seulement `tokenConfigured: true` et `tokenHint: "cdef"`), conforme à RG-G17.

## 3. Vérification UI contre les maquettes

Pas de vérification visuelle en navigateur : sans instance GitLab réelle, le tableau ne peut afficher de MR ni donc
de pastille « Depuis Ready » en conditions réelles. Vérification faite par **revue de code contre `design.md`** :

- Carré 8 px, `gap: 6px`, libellé en gras, couleur du carré = couleur du texte (`currentColor`) → conforme
- Couleurs `--color-success`/`--color-warning`/`--color-accent` réutilisées à l'identique d'US-006 → conforme
- Draft : 12 px, `--color-neutral-600`, pas de carré, pas de tooltip → conforme (vérifié par
  `ready-delay.component.spec.ts`)
- Colonne positionnée après `approved`, avant l'emplacement réservé à « Ouverte » (US-012) → conforme

⚠️ Recommandation : faire une vérification visuelle rapide en navigateur (`ng serve` + jeton réel ou fixtures) avant
la mise en production, aucune US précédente n'ayant nécessité de vraie instance GitLab pour ce projet de démo.

## 4. Critères d'acceptation (specs.md §5)

| Scénario | Statut | Détail |
|---|---|---|
| Niveau selon le délai (6 exemples calendaires) | ✅ Validé | `calculate-ready-delay.spec.ts` reprend les 6 couples `readyAt`/`jours` exacts de la table, avec le même `now` |
| Libellés (« aujourd'hui » / « 6 j » rouge) | ✅ Validé | `ready-delay.component.spec.ts` |
| Draft (« ouverte il y a 12 j », gris, `readyDays`/`readyLevel` null) | ✅ Validé unitairement (backend + composant), mêmes valeurs (12 j) que l'exemple | ⚠️ Non atteignable en conditions réelles : `listOpen()` exclut toujours les drafts (`draft: false`), décision actée en Phase 2 — visible seulement après US-009 |
| Jours ouvrés (vendredi 17h → lundi 0 j / mardi 1 j) | ✅ Validé unitairement, valeurs identiques à l'exemple | ⚠️ Non activable en conditions réelles : `workdaysOnly` est câblé en dur à `false`, aucun réglage en base avant US-014 (conforme à `specs.md` §7 « Hors périmètre ») |
| Tooltip (« Prête depuis le 05/09/2026 16:30 ») | ✅ Validé (algorithme de conversion locale correct, testé via des dates locales reconstruites) | ℹ️ Le test ne fige pas le fuseau Europe/Paris (dépendrait de la TZ de la machine CI) — la valeur exacte « 16:30 » de l'exemple n'est donc pas littéralement rejouée, comportement volontaire et documenté dans `format-date.spec.ts` |
| Rechargement au changement de jour | ⚠️ Partiellement validé | Aucune tâche dédiée dans cette US (décision actée en Phase 2, archi.md « Points de vigilance ») : le calcul est fait à la lecture, donc correct à chaque rechargement, mais aucun timer minuit n'est implémenté — dépend d'un futur mécanisme de polling (US-013) |

**5/6 scénarios validés sans réserve technique, 1 scénario (rechargement minuit) partiellement validé par
conception (hors périmètre technique de cette US, déjà discuté et accepté).**

## 5. Bugs trouvés

Aucun bug détecté.

## 6. Recommandations

1. Avant merge, faire une vérification visuelle rapide de la colonne « Depuis Ready » dans un navigateur (le code a
   été relu contre `design.md` mais jamais rendu à l'écran faute de données GitLab réelles).
2. Garder en tête, pour US-009, que le branchement de l'inclusion des drafts dans `listOpen()` est le seul morceau
   qui rendra RG-007-05 visible en conditions réelles — actuellement seulement testé en isolation.
3. Pour US-014, `workdaysOnly` devra être lu depuis les settings au lieu de la constante `false` codée en dur dans
   `merge-requests.service.ts` (`toReadyFields`).
