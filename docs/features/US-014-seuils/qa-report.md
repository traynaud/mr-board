# Rapport QA — US-014 Paramètres : seuils de difficulté et de délai Ready

## 1. Tests automatisés

| Suite | Résultat |
|-------|----------|
| Backend unit (`npm test`) | ✅ 323 passed / 0 failed |
| Backend e2e (`npm run test:e2e`) | ✅ 85 passed / 0 failed |
| Backend coverage (`npm run test:cov`) | ✅ seuil 80 % respecté — 99.21 % stmts / 88.32 % branches / 98.41 % funcs / 99.27 % lines (global) |
| Frontend unit (`ng test --no-watch`) | ✅ 457 passed / 0 failed |
| Frontend coverage (`ng test --coverage`) | ✅ seuil 80 % respecté globalement — 95.4 % stmts / 94.39 % branches / 91.29 % funcs / 98.44 % lines |

Détail des fichiers de la feature (frontend) :

| Fichier | Stmts | Branches |
|---------|-------|----------|
| `settings-form.ts` | 97.91 % | 87.09 % |
| `settings-page.component.ts` | 98.68 % | 93.18 % |
| `sections/thresholds/thresholds-section.component.html` | 79.54 % | 75 % |

✅ **R-1 appliquée** : `easyFiles`/`easyLines` n'avaient aucun `mat-error` (gap fonctionnel, pas seulement de
couverture — un `easyLines` non entier ne montrait aucun message). Ajout des blocs d'erreur manquants +
12 nouveaux tests (`describe.each` sur les 6 champs numériques, avec isolement de l'erreur `mustExceed` pour
`hardFiles`/`hardLines`/`readyOrangeDays` en abaissant temporairement le seuil de référence). Couverture du
dossier `sections/thresholds` passée de 80.85 %/89.47 % à **98.11 % stmts / 100 % branches**.

### Correspondance avec les critères d'acceptation Gherkin

| Scénario (specs.md §5) | Couverture automatisée |
|--------------------------|----------------------------|
| Modifier les seuils de difficulté | `merge-requests.service.spec.ts` → `should_apply_the_configured_difficulty_thresholds` ✅ |
| Seuils incohérents | `settings.service.spec.ts` → `should_reject_hard_files_not_greater_than_easy_files` ; `settings.e2e-spec.ts` → `should_reject_hard_files_not_greater_than_easy_files` ✅ |
| Modifier les seuils de délai | `merge-requests.service.spec.ts` → `should_apply_the_configured_ready_delay_thresholds` ✅ |
| readyOrange ≤ readyGreen | `settings.service.spec.ts` / `settings.e2e-spec.ts` → `should_reject_ready_orange_not_greater_than_ready_green` ✅ |
| Valeur non entière | Backend : `settings.e2e-spec.ts` → `should_reject_a_non_integer_threshold` ; Frontend : `settings-form.spec.ts` → `should_reject_a_non_integer_value`, `integerValidator` ✅ |
| Jours ouvrés | `merge-requests.service.spec.ts` → `should_count_only_workdays_when_configured` ✅ |
| Valeurs par défaut | `thresholds-section.component.spec.ts` → `should_reset_to_default_thresholds_and_mark_the_form_dirty` ✅ |

**7/7 scénarios Gherkin couverts par au moins un test automatisé.**

## 2. Tests API manuels

Backend relancé sur une base SQLite `:memory:` isolée (`APP_SECRET` temporaire, jamais commité) pour repartir des
valeurs par défaut.

```
GET /api/v1/settings                                    → 200, easyFiles=5/easyLines=100/hardFiles=20/hardLines=800/readyGreenDays=1/readyOrangeDays=3/workdaysOnly=false
PUT { easyFiles:5, hardFiles:3 }                         → 400 code=settings.hardFilesTooLow
PUT { readyGreenDays:3, readyOrangeDays:3 }              → 400 code=settings.readyOrangeTooLow
PUT { easyLines:2.5 }                                    → 400 message=["easyLines must be an integer number"]
PUT { easyLines:100, hardLines:90 }                      → 400 code=settings.hardLinesTooLow
PUT { easyFiles:10 } (seul champ valide envoyé)          → 200, easyFiles=10, reste inchangé aux défauts
GET /api/v1/settings (relecture)                         → 200, identique à la réponse du PUT précédent
```

Vérifié : aucun des 4 PUT rejetés (400) n'a modifié l'état persisté (la relecture après le PUT valide ne montre
aucune trace des tentatives précédentes) — la validation de cohérence s'exécute avant la sauvegarde, comme prévu.
Aucun jeton GitLab dans les réponses (RG-G17, hors périmètre US-014 mais vérifié par ricochet).

## 3. Vérification UI contre les maquettes

Backend + frontend lancés en local, section « 05 · Seuils » ouverte dans Chrome (`/settings`) :

- ✅ Layout 2 colonnes (Difficulté / Temps depuis Ready) conforme au prototype (`MR Board - Prototype.dc.html`
  lignes 182-197)
- ✅ Carrés colorés Easy/Vert = vert (`--color-success`), Medium/Orange = orange (`--color-warning`),
  Hard/Rouge = rouge (`--color-accent`) — tokens du design system, aucune couleur en dur
- ✅ Champs numériques avec préfixe (`<`, `>`, `≤`) et suffixe (`fich.`, `l.`, `jours`) via `matTextPrefix`/
  `matTextSuffix`
- ✅ `mat-slide-toggle` « Compter uniquement les jours ouvrés »
- ✅ Lien « Valeurs par défaut » : réinitialise les 7 champs, marque le formulaire modifié, n'enregistre pas
  tant que « Enregistrer » n'est pas cliqué (vérifié : le bouton Enregistrer passe actif après le clic, et
  `GET /settings` ne change qu'après un clic explicite sur Enregistrer)
- ✅ Erreur croisée affichée en direct sous le champ Hard fich. (« Doit être supérieur à Easy ») dès que
  `hardFiles = easyFiles`, sans re-saisie du champ Hard lui-même — confirme que modifier `easyFiles` revalide
  `hardFiles`
- ✅ Bouton « Enregistrer » désactivé tant qu'une erreur de seuils est présente
- **BUG-001 trouvé et corrigé pendant le développement** (avant remise en QA) : les champs à suffixe « fich. »
  (`easyFiles`/`hardFiles`) étaient rognés à 12 px de large. Corrigé par `min-width: 132px` sur
  `.difficulty-rows mat-form-field`. Revérifié : `input.clientWidth === input.scrollWidth` sur les 6 champs
  numériques après correction (aucune troncature). Aucune régression trouvée après correction — considéré
  résolu, pas de nouveau bug ouvert.

Aucun bug non résolu trouvé lors de cette passe QA.

## 4. Critères d'acceptation

7/7 scénarios validés ✅ (voir tableau §1). Aucun écart fonctionnel par rapport aux specs.

## 5. Conformité aux maquettes

✅ Conforme — voir §3.

## 6. Bugs trouvés

Aucun bug ouvert. BUG-001 (rognage visuel des champs « fich. ») a été trouvé et corrigé avant cette passe QA
(voir `dev-report.md`, section Écarts) ; revérifié ci-dessus, résolu.

## 7. Recommandations

- **R-1 — appliquée** : `easyFiles`/`easyLines` affichent désormais un `mat-error` (`integer`/`min`), comme les
  4 autres champs. 12 tests ajoutés à `thresholds-section.component.spec.ts`. Couverture du dossier passée à
  98.11 % stmts / 100 % branches. Suites complètes revalidées après coup : backend 323 unit + 85 e2e ✅,
  frontend 469 unit ✅ (+12 vs la précédente passe), lint/tsc/build verts des deux côtés.
- **R-2 (information, non appliquée — hors code produit)** : `rtk npx ng test --no-watch --coverage` n'a produit
  aucun rapport de couverture lors de cette QA (le dossier `coverage/` n'était pas régénéré, sans message
  d'erreur) ; le rapport de couverture cité ci-dessus a été obtenu en appelant directement
  `./node_modules/.bin/ng test --no-watch --coverage`, en contournant le wrapper `rtk`. Signalé séparément comme
  piste d'amélioration de l'outillage `rtk`, hors périmètre de cette US.
