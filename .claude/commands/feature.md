<!-- .claude/commands/feature.md -->

# Workflow Feature — Orchestrateur autonome

Tu exécutes les 7 phases **d'une seule traite**, sans demander de validation
entre les phases.

Tu appliques le **Protocole d'autonomie** de `CLAUDE.md` : la seule raison valable
de t'arrêter est un critère D1→D9. Les phases où une décision humaine est
*probable* sont la Phase 1 (PO), la Phase 2 (UX/UI) et la Phase 3 (Architecte) —
mais même là, tu ne t'arrêtes que s'il y a
réellement quelque chose à arbitrer (sauf D9, qui se déclenche systématiquement pour tout
changement graphique majeur, cf. `ux-ui.md`).

Annonce chaque phase par un en-tête `━━━ PHASE n/7 — Rôle ━━━`, puis continue.

La feature demandée : $ARGUMENTS

> Si `$ARGUMENTS` est un identifiant d'US existant (ex: `US-010`), le dossier
> `docs/features/US-010-<slug>/` existe déjà avec ses specs : la Phase 1 consiste alors
> à relire et compléter ces specs plutôt qu'à les créer.
> Si `$ARGUMENTS` contient `[strict]`, retrouve le comportement pas-à-pas (STOP + validation à chaque phase).

---

## Phase 1/7 : Product Owner

Adopte le rôle décrit dans `.claude/commands/po.md`.
Lis ce fichier et applique ses instructions avec le besoin ci-dessus, en cohérence
avec `docs/features/README.md` (règles de gestion transverses, glossaire, roadmap).

Écris le résultat dans `docs/features/<id-us>-<slug-feature>/specs.md`.

**Porte de décision fonctionnelle** — évalue tes « Questions ouvertes » :

- Question **bloquante** (D1/D2/D5 : elle change le comportement livré) →
  regroupe TOUTES les questions bloquantes dans un seul bloc `🛑 DÉCISION REQUISE` et STOP.
- Question **non bloquante** → tranche toi-même, inscris-la comme
  `✅ Hypothèse retenue` dans `specs.md`, et **enchaîne sans t'arrêter**.

## Phase 2/7 : UX/UI

Adopte le rôle décrit dans `.claude/commands/ux-ui.md`, en te basant sur
`docs/features/<id-us>-<slug-feature>/specs.md` produit en Phase 1 et sur `docs/design/`.

Écris, si le changement est classé « majeur » (cf. ux-ui.md) :
- `docs/tech/<id-us>-<slug-feature>/design.md`

**Porte de décision visuelle** — STOP systématiquement en cas de changement « majeur »
(**D9** : nouvel écran, nouvelle section, refonte, nouveau menu, nouveau tableau, écart par
rapport à `docs/design/`) avec l'artefact de maquette à valider. Pour un changement « simple »
(bouton, label, micro-ajustement de style) : documente en `✅ Hypothèse retenue` et
**enchaîne sans t'arrêter**. Si l'US n'a pas de composante UI, passe directement à la Phase 3.

## Phase 3/7 : Architecte

Adopte le rôle décrit dans `.claude/commands/architect.md`.
Lis ce fichier et applique ses instructions en te basant sur les specs produites par le PO :
- `docs/features/<id-us>-<slug-feature>/specs.md`
- `docs/tech/<id-us>-<slug-feature>/design.md` s'il a été produit en Phase 2
- `docs/design/` (prototype, wireframes, design system)

Écris le résultat dans :
- `docs/tech/<id-us>-<slug-feature>/archi.md`
- `docs/tech/<id-us>-<slug-feature>/design.md` (uniquement si absent de la Phase 2 et utile, cf. architect.md)

**Porte de décision technique** — STOP uniquement en cas de D3, D4 ou D5
(choix structurant irréversible, breaking change, impact sécurité).
Sinon : documente les arbitrages en `✅ Hypothèse retenue` et **enchaîne**.

---

## Phase 4/7 : Développeur

Adopte le rôle décrit dans `.claude/commands/dev.md`.
Lis ce fichier et implémente en te basant sur :
- `docs/features/<id-us>-<slug-feature>/specs.md`
- `docs/tech/<id-us>-<slug-feature>/archi.md`
- `docs/tech/<id-us>-<slug-feature>/design.md`

Pas de validation du plan d'implémentation, pas de validation backend → frontend :
tu enchaînes. Rapport dans `docs/tech/<id-us>-<slug-feature>/dev-report.md`.

---

## Phase 5/7 : QA

Adopte le rôle décrit dans `.claude/commands/qa.md`.
Lis ce fichier et teste l'implémentation de la Phase 3.

Écris le rapport dans `docs/features/<id-us>-<slug-feature>/qa-report.md`.

**Boucle de correction autonome** — pour chaque bug trouvé :

| Cause du bug | Action |
|--------------|--------|
| Défaut d'implémentation `[IMPL]` / test erroné `[TEST]` | Repasse en rôle Dev, corrige, relance les tests. Max **2 itérations**, puis D7 → STOP |
| Spec ambiguë ou manquante `[SPEC]` | D1/D2 → STOP avec bloc `🛑 DÉCISION REQUISE` |
| Écart d'archi `[ARCHI]` | D6 → STOP |

Tant que les bugs sont de simples défauts d'implémentation, tu corriges et tu continues.

---

## Phase 6/7 : Revue de code

Adopte le rôle décrit dans `.claude/commands/review.md`.
Lis ce fichier et fais la revue de tout le code produit en Phase 3.

- 🔴 Bloquant et 🟡 Important → **corrige immédiatement**, sans demander validation,
  puis relance les tests.
- 🟢 Suggestion → liste-les dans le rapport final sans les appliquer
  (sauf si le coût est nul et le risque nul).
- Une correction qui remettrait en cause l'archi validée → D6 → STOP.

---

## Phase 7/7 : Finalisation

1. Lance les tests complets → tout doit être vert :
   ```bash
   cd backend && rtk npm run lint && rtk npm test && rtk npm run test:e2e && rtk npm run build
   cd frontend && rtk npx tsc --noEmit && rtk npx ng test --no-watch
   ```
2. **Mets à jour `frontend/public/changelog.json`** : ajoute une entrée `{ "date": "<YYYY-MM-DD>", "type": "feat", "user-story": "<id-us>", "title": "<description courte en une phrase>" }` en tête du tableau (ordre décroissant).
3. Mets à jour le statut de l'US dans la roadmap de `docs/features/README.md` (☐ → ✅).
4. Crée un commit avec le message : `feat: [<id-us>] <description courte>`
5. Affiche le rapport de clôture :

```
🏁 FEATURE LIVRÉE — [id-us] [nom-us]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Phases       : 7/7 ✅
Tests        : back [X unit + Y e2e ✅] / front [Z ✅]
Fichiers     : [n créés, m modifiés]
Maquette      : [lien artefact, si Phase 2 majeure] — validée
Commit       : [hash] feat: ...

🛑 DÉCISIONS ARBITRÉES PAR L'HUMAIN
  - [sujet] → [choix]

✅ DÉCISIONS PRISES EN AUTONOMIE
  - [sujet] → [choix] (réversible)

🟢 SUGGESTIONS NON APPLIQUÉES (revue)
  - [...]

⚠️ À SURVEILLER
  - [...]
```
