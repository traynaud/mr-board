<!-- .claude/commands/refacto.md -->

# Workflow Refactoring Technique

Tu es un tech lead expérimenté. Tu vas conduire un refactoring en suivant
ce processus rigoureux. L'objectif est de modifier la structure du code
SANS changer le comportement fonctionnel.

Tu appliques le **Protocole d'autonomie** de `CLAUDE.md`. Un refacto a **une seule**
porte de décision légitime : le **périmètre**. Une fois le périmètre acté, tu exécutes
d'une traite.

## Phase 1 : Diagnostic & plan (fusionnés)

Analyse le code concerné et produis en une passe le diagnostic ET le plan :

### 1.1 État des lieux
- Fichiers concernés (liste exhaustive avec chemins)
- Nombre de lignes impactées (estimation)
- Couplages identifiés (qui dépend de quoi : modules NestJS, providers, stores Angular, composants)

### 1.2 Problèmes identifiés
Pour chaque problème :
- 📍 Localisation (fichier:ligne)
- 🏷️ Catégorie : Duplication | Couplage | Complexité | Nommage | Performance | Dette technique
- 📝 Description du problème
- 💡 Solution proposée

### 1.3 Risques
- Ce qui pourrait casser
- Les zones à tester en priorité après refacto

### 1.4 Plan d'exécution
- Découpe le refacto en étapes ATOMIQUES (chacune doit compiler)
- Chaque étape = 1 commit possible
- Ordonne les étapes pour minimiser les risques

Format :
```
Étape 1 : [description] → fichiers touchés : [liste]
Étape 2 : [description] → fichiers touchés : [liste]
```

Écris le diagnostic dans `docs/tech/refacto/<nom-refacto>/diagnostic.md` et le plan dans
`docs/tech/refacto/<nom-refacto>/plan.md`.

### 1.5 Porte de décision — périmètre

- Le refacto reste **dans le périmètre demandé** et n'affecte **aucun contrat
  public** (API REST, signature de service partagé, schéma de base) →
  affiche le plan **à titre informatif** et **enchaîne**.
- Le refacto déborde (nouveaux fichiers hors zone, changement de contrat, migration,
  > ~15 fichiers non anticipés) → **D3/D4** → 🛑 `DÉCISION REQUISE` avec une option
  « périmètre réduit » et une option « périmètre complet », chiffrées.
- Le refacto change significativement le **rendu visuel** (refonte d'écrans, nouveau pattern
  de composant, écart vis-à-vis de `docs/design/`) → **D9**, cf. `ux-ui.md` : maquette validée avant exécution. Un simple retint de tokens
  sans changement de structure reste autonome.

---

## Phase 2 : Filet de sécurité

Avant de refactorer :
1. Lance les tests existants :
   ```bash
   cd backend && rtk npm test && rtk npm run test:e2e && rtk npm run build
   cd frontend && rtk npx ng test --no-watch
   ```
2. Note le nombre de tests passants (c'est la baseline)
3. Si la couverture est faible sur la zone à refactorer,
   ÉCRIS D'ABORD des tests de non-régression
4. Relance les tests pour confirmer qu'ils passent

▶️ Affiche la baseline et **enchaîne**.
🛑 STOP uniquement si la baseline est **déjà rouge** avant tout changement :
un refacto est alors dangereux — propose de corriger d'abord (`/project:bugfix`).

---

## Phase 3 : Exécution

Pour CHAQUE étape du plan :
1. Applique la modification
2. Lance `rtk npm run lint && rtk npm test` (backend) ou `rtk npx tsc --noEmit && rtk npx ng test --no-watch` (frontend)
3. Si un test casse → corrige IMMÉDIATEMENT ; après 2 tentatives → rollback de l'étape, puis **D7** → STOP
4. Affiche : "Étape X/Y ✅ - tests : XX passés / 0 échoués"

Règles strictes :
- JAMAIS changer un test pour le faire passer (sauf si le test était faux — à justifier explicitement dans le rapport)
- JAMAIS modifier le comportement fonctionnel
- JAMAIS ajouter de feature "en passant"
- Un seul pattern de refacto par étape (Extract Method OU Rename OU Move, pas les 3)
- Si le schéma SQLite change → migration TypeORM dédiée, jamais de modification d'une migration existante

---

## Phase 4 : Vérification finale

1. Lance TOUS les tests (backend unit + e2e, frontend)
2. Compare avec la baseline de la Phase 2
3. Vérifie que le nombre de tests est >= à la baseline
4. Génère un résumé :

```markdown
## Résumé du Refactoring

### Avant / Après
| Métrique          | Avant | Après |
|-------------------|-------|-------|
| Fichiers modifiés |       |       |
| Lignes ajoutées   |       |       |
| Lignes supprimées |       |       |
| Tests passants    |       |       |
| Complexité réduite|       |       |

### Ce qui a changé
- [liste des changements structurels]

### Ce qui n'a PAS changé
- Le comportement fonctionnel (garanti par les tests)

### Décisions
- ✅ Autonomes : [...]
- 🛑 Humaines : [...]
```

Écris dans `docs/tech/refacto/<nom-refacto>/report.md`.

## Phase 5 : Finalisation

**Mets à jour `frontend/public/changelog.json`** : ajoute une entrée `{ "date": "<YYYY-MM-DD>", "type": "refacto", "user-story": "", "title": "<description courte en une phrase>" }` en tête du tableau (ordre décroissant).

Crée un commit : `refactor: <description courte>`

Refactoring demandé : $ARGUMENTS

---
