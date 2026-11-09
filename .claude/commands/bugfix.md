<!-- .claude/commands/bugfix.md -->

# Workflow Correction de Bug

Tu appliques le **Protocole d'autonomie** de `CLAUDE.md` : les 3 phases s'enchaînent
sans validation intermédiaire. Un bugfix est par nature un travail d'exécution —
la décision (« il faut corriger ça ») a déjà été prise en te lançant la commande.

## Phase 1 : Reproduction & Diagnostic

1. Comprends le bug décrit par l'utilisateur
2. Identifie le(s) fichier(s) concerné(s) (backend NestJS `backend/src/modules/*`, frontend Angular `frontend/src/app/*`)
3. Cherche la cause racine (pas juste le symptôme)
4. Écris un test qui REPRODUIT le bug (le test doit être ROUGE)

```typescript
// Backend (Jest) ou frontend (Vitest) — même style
it('should_fail_when_bug_reproduced', () => {
  // Ce test prouve que le bug existe
});
```

Adapte selon le contexte : test unitaire (`*.spec.ts`), test e2e backend (`backend/test/*.e2e-spec.ts`) ou test de composant Angular.

▶️ Affiche le diagnostic et le test rouge, puis **enchaîne sur la Phase 2**.

🛑 STOP uniquement si :
- **Tu n'arrives pas à reproduire** le bug → expose tes hypothèses et demande des
  précisions (étapes, données, environnement)
- **Le comportement « bugué » est peut-être le comportement attendu** → question de
  spec (**D1**) : présente les deux lectures et demande l'arbitrage
- **La cause racine exige un changement structurant** (modèle de données, contrat
  d'API, dépendance) → **D3** : propose 2 options, correction de surface vs correction
  de fond, avec les coûts respectifs
- **La correction implique un changement graphique majeur** (nouvel écran/section,
  refonte, nouveau menu/tableau, écart vis-à-vis de `docs/design/`) → **D9**

## Phase 2 : Correction

1. Corrige le code (correction minimale, pas de refacto)
2. Le test rouge doit passer au VERT
3. Lance tous les tests → 0 régression

▶️ Affiche le diff, puis **enchaîne sur la Phase 3**.
Si les tests ne passent toujours pas après 2 tentatives → **D7** → STOP.

## Phase 3 : Vérification

1. Lance tous les tests backend + frontend :
   ```bash
   cd backend && rtk npm test && rtk npm run test:e2e && rtk npm run build
   cd frontend && rtk npx ng test --no-watch
   ```
2. Si le bug est lié à une API, teste avec curl (`rtk curl http://localhost:3000/api/v1/...`)
3. Si le bug est visuel, compare avec les maquettes de `docs/design/`
4. Vérifie qu'il n'y a pas d'autres occurrences du même pattern bugué
   - Occurrences **identiques et triviales** → corrige-les dans le même commit
   - Occurrences **nombreuses ou risquées** → ne les touche pas, signale-les
     comme dette et propose un `/project:refacto`

Résumé :

- Cause racine : [explication]
- Correction : [ce qui a été changé]
- Tests ajoutés : [nombre]
- Régression : aucune
- Occurrences similaires : [corrigées / signalées]
- ✅ Décisions autonomes : [...]
- 🛑 Décisions humaines : [...]

**Mets à jour `frontend/public/changelog.json`** : ajoute une entrée `{ "date": "<YYYY-MM-DD>", "type": "fix", "user-story": "<US concernée ou vide>", "title": "<description courte en une phrase>" }` en tête du tableau (ordre décroissant).

Commit : `fix: <description du bug corrigé>`

Bug à corriger : $ARGUMENTS

---
