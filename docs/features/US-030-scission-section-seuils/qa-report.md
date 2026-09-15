# QA report — US-030 Scission de la section Seuils

## 1. Tests automatisés

### Backend

| Suite | Résultat |
|---|---|
| `npm test` (unitaires) | ✅ 633 passed, 0 failed (53 suites) |
| `npm run test:e2e` | ✅ 162 passed, 0 failed (7 suites) — voir BUG-001 ci-dessous |
| `npm run test:cov` | ✅ seuils respectés (aucun changement, US purement frontend) |

### Frontend

| Suite | Résultat |
|---|---|
| `tsc --noEmit` | ✅ aucune erreur |
| `ng lint` | ✅ aucune erreur |
| `ng test --no-watch --coverage` | ✅ 837 passed, 0 failed (68 fichiers) |
| Couverture globale | 96.3 % statements / 94.65 % branches / 91.39 % fonctions / 98.56 % lignes |
| Couverture des fichiers créés | `difficulty-section.component` : 96.73 / 100 / 100 / 97.67 % ; `ready-delay-section.component` : couverture équivalente — tous au-dessus du seuil de 80 % |

## 2. Bugs trouvés

### BUG-001 (bloquant, corrigé en séance) — Binding natif `better-sqlite3` corrompu, suite e2e backend 100 % en échec

Au premier lancement de `npm run test:e2e`, les 162 tests échouaient (`Error: error: 193 ...better_sqlite3.node`,
`TypeOrmModule` incapable de se connecter). Cause : `node_modules/backend/better-sqlite3/build/Release/better_sqlite3.node`
était un binaire **Linux (ELF)** au lieu de **Windows (PE32+)** — résidu d'une session Docker antérieure (test de
l'approbation `allowScripts` avec le dossier `backend/` monté dans un conteneur Linux, qui a reconstruit le module
natif pour Linux directement sur l'hôte).

**Sans lien avec US-030** (aucun fichier backend touché par cette US). Corrigé en réinstallant le module
(`rm -rf node_modules/better-sqlite3 && npm install better-sqlite3@12.11.1`) : le binaire Windows correct est
revenu, les 162 tests e2e passent. `package.json`/`package-lock.json` non impactés (vérifié par diff après coup).
Signalé ici par transparence sur l'état de l'environnement, sans action de suivi nécessaire pour cette US.

Aucun autre bug trouvé.

## 3. Vérification UI contre les maquettes

Testé en conditions réelles (`ng serve` + `nest start:dev`, navigateur Chrome) sur `/settings` :

- ✅ Sections `04 · Difficulté` et `05 · Temps depuis Ready` affichées séparément, sans sous-titre redondant
  (contenu identique à l'ancien bloc unique, juste réparti)
- ✅ `06 · Divers` correctement renumérotée
- ✅ Design system respecté : Archivo, accent `#ec3013` sur les numéros/erreurs, carrés de couleur (vert/orange/rouge,
  vert/orange/rouge), aucun arrondi, règles 2 px entre sections
- ✅ Message d'erreur croisée « Doit être supérieur à Easy » vérifié en direct sur `04 · Difficulté` (saisie
  `hardFiles = 3` avec `easyFiles = 5`)
- ✅ Message d'erreur croisée « Doit être supérieur à Vert » vérifié en direct sur `05 · Temps depuis Ready` (saisie
  `readyOrangeDays = 1` avec `readyGreenDays = 1`)
- ✅ Les deux sections restent indépendantes : modifier un champ de l'une ne perturbe pas l'autre (même `FormGroup`
  partagé, contrôles distincts)
- ✅ Dialog « Abandonner les modifications ? » (Material, pas de dialog navigateur) toujours fonctionnel après le
  découpage

## 4. Vérification des critères d'acceptation (specs.md §5)

| # | Scénario | Statut |
|---|----------|--------|
| 1 | Sections distinctes affichées | ✅ Validé (test automatisé + vérification visuelle) |
| 2 | Modification indépendante des seuils de difficulté | ✅ Validé (même `FormGroup`/validateurs qu'avant US-030, RG-006 non touchée ; indépendance des deux nouvelles sections confirmée visuellement) |
| 3 | Réinitialisation globale inchangée après la scission | ✅ Validé (`resetSettingsFormToDefaults` non modifiée par cette US, tests `settings-form.spec.ts` inchangés et toujours au vert) |
| 4 | Renumérotation de la section Divers | ✅ Validé (test automatisé + vérification visuelle : `06 · Divers`) |

**4/4 critères validés.**

## 5. Conformité aux maquettes

✅ Conforme. Aucune maquette dédiée à cette US (réutilisation du wireframe 1c existant, cf. archi.md) ; le rendu
obtenu respecte la structure générique des sections `app-settings-section` déjà utilisée par les autres sections de
l'écran.

## 6. Recommandations

- Aucune action bloquante.
- BUG-001 n'appelle pas de correctif dans le code du projet (environnement local uniquement) ; à garder en tête si
  une session future remonte `node_modules` via un conteneur Linux avec bind mount sur cette machine Windows.
- QO-030-02 (texte des descriptions de section) reste une proposition du dev, non validée formellement par le PO —
  impact nul sur le comportement, à ajuster librement si besoin en review.

## 7. Synthèse finale

**Prêt pour la Phase 5 (revue de code).** Aucun bug fonctionnel, tous les tests automatisés et critères
d'acceptation sont au vert, conformité UI confirmée visuellement en conditions réelles.
