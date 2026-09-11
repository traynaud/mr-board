<!-- .claude/commands/feature.md -->

# Workflow Feature - Orchestrateur

Tu vas suivre un processus en phases. Entre chaque phase, tu STOP et
attends la validation explicite de l'utilisateur ("ok", "go", "valide").

La feature demandée : $ARGUMENTS

---

## Phase 1 : Product Owner

Adopte le rôle décrit dans `.claude/commands/po.md`.
Lis ce fichier et applique ses instructions avec le besoin ci-dessus.

Quand tu as terminé, écris le résultat dans
`docs/features/<slug-feature>/specs.md`.

**STOP** - Affiche les specs. Attends validation.

## Phase  : Architecte

Adopte le rôle décrit dans `.claude/commands/architect.md`.
Lis ce fichier et applique ses instructions en te basant sur les specs produites par le PO:
- `docs/features/<slug-feature>/specs.md`

Quand tu as terminé, écris le résultat dans
- `docs/tech/<slug-feature>/archi.md`.
- `docs/tech/<slug-feature>/design.md`.

**STOP** - Affiche les specs. Attends validation.

---

## Phase 3 : Développeur

Adopte le rôle décrit dans `.claude/commands/dev.md`.
Lis ce fichier et implémente en te basant sur :
- `docs/features/<slug-feature>/specs.md`
- `docs/tech/<slug-feature>/archi.md`.
- `docs/tech/<slug-feature>/design.md`.

Quand tu as terminé, écris ton rapport dans:
- `docs/tech/<slug-feature>/dev-report.md`.

**STOP** - Affiche la liste des fichiers créés/modifiés. Attends validation.

---

## Phase 4 : QA

Adopte le rôle décrit dans `.claude/commands/qa.md`.
Lis ce fichier et teste l'implémentation de la Phase 3.

Écris le rapport dans `docs/features/<slug-feature>/qa-report.md`.

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

1. Lance `mvn test` et `ng test` → tout doit être vert
2. **Mets à jour `frontend/public/changelog.json`** : ajoute une entrée `{ "date": "<YYYY-MM-DD>", "type": "feat", ""user-story": "nom de la ou les us concernées", "title": "<description courte en une phrase>" }` en tête du tableau (ordre décroissant).
3. Crée un commit avec le message : `feat: [id user-story] <description courte>`
4. Affiche un résumé final de tout ce qui a été fait