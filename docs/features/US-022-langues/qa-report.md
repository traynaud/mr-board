# Rapport QA — US-022 Support d'autres langues (anglais)

Testeur : agent QA. Périmètre testé : `docs/features/US-022-langues/specs.md` (v1.1), implémentation décrite dans
`docs/tech/US-022-langues/dev-report.md`.

> **Mise à jour post-correctif** : BUG-001 (§4) a été corrigé et revalidé (§8). Conclusion finale : **GO** (§9).
> Les sections ci-dessous, jusqu'à §7, sont conservées telles qu'écrites lors du premier passage de QA (avant
> correctif), pour garder la trace de ce qui a été trouvé et comment.

## 1. Tests automatisés

| Suite | Résultat |
|-------|----------|
| Backend lint (`eslint`) | ✅ 0 erreur |
| Backend unitaires (`npm test`) | ✅ 414 passed / 0 failed |
| Backend e2e (`npm run test:e2e`) | ✅ 114 passed / 0 failed |
| Backend couverture (`npm run test:cov`) | ✅ 99,32 % statements global ; module `settings` à 100 % |
| Frontend lint (`ng lint`) | ✅ 0 erreur |
| Frontend typecheck (`tsc` app + spec) | ✅ 0 erreur |
| Frontend unitaires (`ng test --no-watch --coverage`) | ✅ 637 passed / 0 failed |
| Frontend couverture | ✅ 96,85 % statements global ; `translate.service.ts`, `translate.pipe.ts`, `language.service.ts`, `language-storage.ts`, `provide-language.ts`, `format-date.ts`, `format-number.ts` à 100 % |
| Frontend build (`ng build`) | ✅ succès |

**Observation** : malgré une couverture élevée, le bug bloquant décrit en §4 n'a été détecté par **aucun** test
automatisé — chaque test unitaire crée un composant frais et vérifie le rendu avec une langue déjà stable au moment
du premier `detectChanges()` ; aucun test n'exerçait le scénario « la langue change pendant qu'un composant reste
monté et affiche un texte via un `computed()` autre que celui du pipe `translate` ». Seul le test de régression du
pipe (`translate.pipe.spec.ts`) couvrait ce scénario, et seulement pour un texte lié directement par `| translate`
dans un template — pas pour un texte préparé par un `computed()` de composant appelant `TranslateService.translate()`
directement.

## 2. Tests API manuels

Backend démarré isolément (SQLite en mémoire, port dédié) ; instance de développement de l'utilisateur non affectée
(vérifié après coup : serveurs 3000/4200 intacts).

| Requête | Résultat |
|---------|----------|
| `GET /api/v1/settings` (défaut) | ✅ `language: "fr"` |
| `PUT /api/v1/settings` avec `language: "en"` | ✅ `200`, persisté, relu à l'identique |
| `PUT /api/v1/settings` avec `language: "de"` | ✅ `400` |
| `GET /api/v1/settings/export` | ✅ `settings.language` présent |
| `POST /api/v1/settings/import` avec `language: "fr"` | ✅ `200`, valeur appliquée |

## 3. Vérification UI contre les maquettes

Aucune maquette n'existe pour cette US (déjà signalé par le PO et l'architecte). Vérifié contre le pattern du
contrôle « Thème » : position, style, comportement d'aperçu immédiat — conforme, en thème clair (non re-testé en
sombre, sans régression attendue vu la nature du changement).

Frontend et backend démarrés isolément, navigation manuelle sur `/settings` avec bascule Français → English.

| Élément | Constaté |
|---------|----------|
| Contrôle « Langue » sous « Thème » | ✅ conforme, endonymes « Français »/« English » non traduits |
| Titres de sections, boutons Save/Cancel/Reset, cases à cocher | ✅ traduits immédiatement (« 01 · Me », « 06 · Miscellaneous », etc.) |
| Texte « Aucun jeton » sous le champ jeton GitLab | 🔴 **reste en français** après bascule vers English, alors que tout le reste de l'écran est traduit — voir BUG-001 |

## 4. Bug trouvé

### 🔴 BUG-001 (bloquant) — Les textes préparés par un `computed()` de composant via `TranslateService.translate()` direct ne se mettent pas à jour quand la langue change en cours de session

**Reproduction** : sur `/settings`, section « 02 · GitLab connection », sans jeton configuré, texte affiché sous le
champ jeton : « Aucun jeton ». Cliquer sur l'option « English » du nouveau contrôle « Langue ». **Constaté** : tout
le reste de l'écran bascule immédiatement en anglais (titres, boutons, cases), **sauf** ce texte, qui reste
« Aucun jeton » au lieu de « No token ». Capture d'écran prise pendant la QA, comportement confirmé et reproductible.

**Cause racine** : le correctif de réactivité (RG-022-12) n'a été appliqué qu'à `TranslatePipe.transform()`
(lecture du signal `TranslateService.language()`), pas à `TranslateService.translate()` elle-même. Or de nombreux
composants appellent `this.i18n.translate(...)` **directement dans un `computed()`**, sans passer par le pipe
`| translate` du template — ces `computed()` ne lisent alors **aucun** signal lié à la langue et ne sont donc jamais
invalidés quand elle change, même si `translate()` (une fois rappelée plus tard pour une tout autre raison) renverrait
la bonne valeur.

**Portée** — `computed()` identifiés appelant `i18n.translate(...)` directement, dont au moins une partie n'a
**aucune** autre dépendance à un signal changeant avec la langue (donc restent figés jusqu'à ce qu'un autre `input()`
non lié à la langue change) :
- `features/settings/sections/gitlab-connection/gitlab-connection-section.component.ts` — `tokenHintLabel` (reproduit ci-dessus), et la branche `noExpiry`/`unknownExpiry` de `resultLabel`
- `shared/avatar/avatar.component.ts` — `tooltip` (suffixe « (moi) »/« (me) », US-023)
- `shared/difficulty-badge/difficulty-badge.component.ts` — `label`, `meta` (seul `tooltip` est protégé, incidemment, par la lecture de `language()` qu'il fait déjà pour `formatThousands`)
- `shared/merge-status-icon/merge-status-icon.component.ts` — `tooltip` (« Fusionnable », raisons de blocage)
- `shared/ready-delay/ready-delay.component.ts` — `label` (« aujourd'hui »/« N j », seul `tooltip` est protégé de la même façon incidente)
- `features/board/filter-bar/filter-bar.component.ts` — `countLabel` (compteur « N MR(s) · M projet(s) »)
- `features/board/filter-bar/filter-pill/filter-pill.component.ts` — `filterName`, `menuTitle`, `valueLabel`, `removeAriaLabel`
- Probablement d'autres non listés ici (recherche par grep non exhaustive, voir recommandation) : tout composant
  appelant `i18n.translate(` en dehors d'un template.

**Recommandation de correctif** (non appliquée — hors périmètre du rôle QA) : déplacer la lecture du signal
`language` de `TranslatePipe.transform()` vers `TranslateService.translate()` elle-même (au tout début de la
méthode). Ainsi, **tout** appelant — via le pipe ou directement dans un `computed()` — dépend automatiquement du
signal, sans avoir à s'en souvenir individuellement. C'est un correctif centralisé, cohérent avec l'intention
initiale de l'architecture, et il aurait évité la totalité des occurrences listées ci-dessus.

**Impact sur les critères d'acceptation** : viole directement RG-022-03 (« aperçu immédiat... toute l'application »)
et le scénario Gherkin « Passer en anglais avec aperçu immédiat » — dès que l'écran contient un texte de ce type,
il ne bascule pas avec le reste.

## 5. Critères d'acceptation (Gherkin, specs.md §6)

| # | Scénario | Statut | Preuve / remarque |
|---|----------|--------|--------------------|
| 1 | Valeur par défaut | ✅ Validé | e2e, vérifié en direct |
| 2 | Passer en anglais avec aperçu immédiat | 🔴 Échoué | BUG-001 : certains textes de la page Paramètres elle-même ne basculent pas |
| 3 | Annuler l'aperçu | ✅ Validé | `settings-page.component.spec.ts` (mécanisme générique déjà testé pour le thème, répliqué pour la langue) |
| 4 | Tableau en anglais | ⚠️ Partiellement validé | Les colonnes/chips/pied de page liés par `| translate` dans le template basculent ; non vérifié en direct avec de vraies données (pas de jeton GitLab dans l'environnement de test, comme pour l'US-023) — le compteur (`filter-bar` `countLabel`) est concerné par BUG-001 s'il reste monté pendant un changement de langue, mais s'affiche correctement à un chargement frais (voir §4) |
| 5 | Menus de filtres et état vide en anglais | ⚠️ Partiellement validé | Les pastilles de filtre (`filter-pill`) sont concernées par BUG-001 dans le même scénario « déjà monté » |
| 6 | Erreurs backend traduites | ✅ Validé | Toasts imperatifs (`toast()`), appelés à la demande avec la langue courante au moment de l'appel — non concernés par BUG-001 |
| 7 | Notification navigateur en anglais | ⚠️ Non vérifié | Nécessite un vrai jeton GitLab et une synchronisation, non disponible dans cet environnement (comme pour l'US-023) |
| 8 | Formats localisés | ✅ Validé | `format-date.spec.ts`, `format-number.spec.ts` |
| 9 | Aucun flash de langue au chargement | ✅ Validé | `provide-i18n.ts`, `translate.service.spec.ts` |
| 10 | localStorage vide | ✅ Validé | `language.service.spec.ts` (`should_default_to_french_when_nothing_is_stored`) |
| 11 | Export / import | ✅ Validé | e2e backend, `settings-form.spec.ts` |
| 12 | Réinitialiser | ✅ Validé | `settings-form.spec.ts` |
| 13 | Valeur invalide | ✅ Validé | e2e backend |
| 14 | Parité des dictionnaires | ✅ Validé | `dictionary-parity.spec.ts` |
| 15 | Repli sur le français | ✅ Validé | `translate.service.spec.ts` (`should_fall_back_to_french...`) |
| 16 | Invariants (URL, export, titre d'onglet) | ✅ Validé | par construction, aucun code touché sur ces aspects |

**Bilan** : 9 critères validés, 4 partiellement validés ou non vérifiés (limitations d'environnement, pas de
défaut), **1 critère en échec** (le cœur même de l'aperçu immédiat, RG-022-03) à cause de BUG-001.

## 6. Recommandations

1. **Corriger BUG-001 avant toute fusion** — c'est le point central de cette US (« aperçu immédiat, sans attendre
   Enregistrer ») qui est concrètement en défaut sur plusieurs textes de l'écran Paramètres lui-même.
2. Après correctif, ajouter un test de régression par composant listé en §4 (ou, mieux, un test générique si le
   correctif centralisé dans `TranslateService.translate()` est adopté : un seul test sur le service suffirait à
   couvrir tous les appelants directs, en complément du test déjà présent sur le pipe).
3. Avant fusion, effectuer une nouvelle vérification visuelle manuelle de l'écran Paramètres en anglais après le
   correctif, en particulier la section « 02 · GitLab connection » avec et sans jeton configuré.
4. Recommandations déjà notées par le Dev (dev-report.md), toujours valables : relecture native de la traduction
   anglaise, confirmation du format de date ISO, vérification des largeurs de colonnes avec les libellés anglais
   plus longs.

## 7. Conclusion (avant correctif)

**NO-GO en l'état.** L'US-022 est fonctionnellement très proche du but — persistance, repli, parité des
dictionnaires, formats localisés et la quasi-totalité de l'interface basculent correctement — mais un bug bloquant
touche précisément le comportement central spécifié par RG-022-03 (aperçu immédiat) sur plusieurs textes, dont un
directement visible et reproduit sur l'écran Paramètres lui-même. Recommandation : retour en Phase 5 (revue de
code) pour appliquer le correctif centralisé proposé en §4, puis nouvelle passe de QA ciblée sur les composants
listés avant fusion.

---

## 8. Correctif appliqué et revalidation

**Correctif** (exactement celui recommandé en §4) : la lecture du signal `language` a été déplacée de
`TranslatePipe.transform()` vers `TranslateService.translate()` elle-même. Tout appelant — via le pipe `| translate`
ou directement dans un `computed()` de composant — dépend désormais automatiquement de ce signal. Fichiers touchés :
`translate.service.ts` (lecture ajoutée + JSDoc), `translate.pipe.ts` (lecture redondante retirée, commentaire mis à
jour), `docs/tech/i18n.md` (section « Réactivité au changement de langue » mise à jour pour refléter le bon endroit
du correctif).

**Contre-preuve** : le correctif a été retiré temporairement, la suite relancée pour confirmer que les nouveaux
tests échouaient bien dans ce cas, puis restauré :
- `translate.service.spec.ts` — nouveau test `should_make_any_computed_calling_translate_directly_reactive_to_a_language_change` : un `computed()` appelant `translate()` directement (hors pipe) se recalcule bien quand la langue change.
- `gitlab-connection-section.component.spec.ts` — nouveau test `should_update_the_no_token_hint_when_the_language_changes_while_mounted` : reproduit exactement le scénario observé manuellement (« Aucun jeton » → « No token » sans démontage du composant).
- Les trois tests (ces deux-là + le test de régression déjà existant sur le pipe) échouaient sans le correctif, passaient avec — confirmant qu'ils couvrent réellement le mécanisme corrigé, pas un artefact.

**Tests automatisés après correctif** :

| Suite | Résultat |
|-------|----------|
| Backend lint / unitaires / e2e | ✅ inchangé (414 + 114 passed) — aucun fichier backend touché par ce correctif |
| Frontend lint | ✅ 0 erreur |
| Frontend typecheck (app + spec) | ✅ 0 erreur |
| Frontend unitaires | ✅ 639 passed (637 + 2 nouveaux tests de régression) |
| Frontend couverture | ✅ `translate.service.ts` et `translate.pipe.ts` à 100 % statements |
| Frontend build | ✅ succès |

**Revalidation manuelle** : reproduction exacte du scénario du bug dans un environnement isolé (backend et frontend
dédiés, sans impact sur les serveurs de développement de l'utilisateur) — écran Paramètres, aucun jeton configuré,
bascule vers « English » sans naviguer ni enregistrer. **Constaté** : le texte sous le champ jeton passe
immédiatement de « Aucun jeton » à « No token », en même temps que le reste de l'écran. Capture d'écran prise avant
et après le clic, comportement conforme à RG-022-03.

## 9. Conclusion finale

**GO.** Le correctif centralisé élimine la classe entière de bugs identifiée en §4 (tous les appelants directs de
`translate()`, pas seulement celui reproduit), a été prouvé par contre-preuve, et revalidé à la fois par les tests
automatisés et par une reproduction manuelle du scénario exact du bug. L'ensemble des critères d'acceptation du
tableau §5 sont désormais considérés validés, à l'exception des points déjà signalés comme non vérifiables dans cet
environnement (notification navigateur nécessitant un vrai jeton GitLab — identique à la limitation déjà rencontrée
sur l'US-023) — aucun de ces points restants n'est un défaut constaté, seulement une limite d'environnement de
test. Recommandations n°3 et n°4 du §6 restent valables pour une passe de polish ultérieure (relecture native de la
traduction, vérification des largeurs de colonnes avec les libellés anglais), mais ne bloquent pas la fusion.
