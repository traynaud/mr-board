<!-- .claude/commands/feature.md -->

# Workflow Feature - Orchestrateur

Tu vas suivre un processus en phases. Entre chaque phase, tu STOP et
attends la validation explicite de l'utilisateur ("ok", "go", "valide").

La feature demandée : $ARGUMENTS

> Si `$ARGUMENTS` est un identifiant d'US existant (ex: `US-010`), le dossier
> `docs/features/US-010-<slug>/` existe déjà avec ses specs : la Phase 1 consiste alors
> à relire, compléter et faire valider ces specs plutôt qu'à les créer.

---

## Phase 1 : Product Owner

Adopte le rôle décrit dans `.claude/commands/po.md`.
Lis ce fichier et applique ses instructions avec le besoin ci-dessus, en cohérence
avec `docs/features/README.md` (règles de gestion transverses, glossaire, roadmap).

Quand tu as terminé, écris le résultat dans
`docs/features/<id-us>-<slug-feature>/specs.md`.

**STOP** - Affiche les specs. Attends validation.

## Phase 2 : Architecte

Adopte le rôle décrit dans `.claude/commands/architect.md`.
Lis ce fichier et applique ses instructions en te basant sur les specs produites par le PO :
- `docs/features/<id-us>-<slug-feature>/specs.md`
- `docs/design/` (prototype, wireframes, design system)

Quand tu as terminé, écris le résultat dans
- `docs/tech/<id-us>-<slug-feature>/archi.md`
- `docs/tech/<id-us>-<slug-feature>/design.md` (si UI non triviale)

**STOP** - Affiche le rapport d'architecture. Attends validation.

---

## Phase 3 : Développeur

Adopte le rôle décrit dans `.claude/commands/dev.md`.
Lis ce fichier et implémente en te basant sur :
- `docs/features/<id-us>-<slug-feature>/specs.md`
- `docs/tech/<id-us>-<slug-feature>/archi.md`
- `docs/tech/<id-us>-<slug-feature>/design.md`

Quand tu as terminé, écris ton rapport dans :
- `docs/tech/<id-us>-<slug-feature>/dev-report.md`

**STOP** - Affiche la liste des fichiers créés/modifiés. Attends validation.

---

## Phase 4 : QA

Adopte le rôle décrit dans `.claude/commands/qa.md`.
Lis ce fichier et teste l'implémentation de la Phase 3.

Écris le rapport dans `docs/features/<id-us>-<slug-feature>/qa-report.md`.

**STOP** - Affiche le rapport QA. Attends validation.

---

## Phase 5 : Revue de code

Adopte le rôle décrit dans `.claude/commands/review.md`.
Lis ce fichier et fais la revue de tout le code produit en Phase 3.

Si des corrections sont nécessaires :
1. Liste les problèmes
2. Attends validation
3. Applique les corrections
4. Relance les tests

---

## Phase 6 : Finalisation

1. Lance les tests complets → tout doit être vert :
   ```bash
   cd backend && rtk npm run lint && rtk npm test && rtk npm run test:e2e && rtk npm run build
   cd frontend && rtk npx tsc --noEmit && rtk npx ng test --no-watch
   ```
2. **Mets à jour `frontend/public/changelog.json`** : ajoute une entrée `{ "date": "<YYYY-MM-DD>", "type": "feat", "user-story": "<id-us>", "title": "<description courte en une phrase>" }` en tête du tableau (ordre décroissant).
3. Mets à jour le statut de l'US dans la roadmap de `docs/features/README.md` (☐ → ✅).
4. Crée un commit avec le message : `feat: [<id-us>] <description courte>`
5. Affiche un résumé final de tout ce qui a été fait
