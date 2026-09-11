<!-- .claude/commands/bugfix.md -->

# Workflow Correction de Bug

## Phase 1 : Reproduction & Diagnostic

1. Comprends le bug décrit par l'utilisateur
2. Identifie le(s) fichier(s) concerné(s)
3. Cherche la cause racine (pas juste le symptôme)
4. Écris un test qui REPRODUIT le bug (le test doit être ROUGE)

```java

@Test
void should_fail_when_bug_reproduced() {
  // Ce test prouve que le bug existe
}
```

Adapte selon le contexte backend/frontend

**STOP** → Montre le diagnostic et le test rouge. Demande validation.

## Phase 2 : Correction

1. Corrige le code (correction minimale, pas de refacto)
2. Le test rouge doit passer au VERT
3. Lance tous les tests → 0 régression

**STOP** → Montre le diff de la correction.

## Phase 3 : Vérification

1. Lance tous les tests backend + frontend
2. Si le bug est lié à une API, teste avec curl
3. Vérifie qu'il n'y a pas d'autres occurrences du même pattern bugué

Résumé :

- Cause racine : [explication]
- Correction : [ce qui a été changé]
- Tests ajoutés : [nombre]
- Régression : aucune

**Mets à jour `frontend/public/changelog.json`** : ajoute une entrée `{ "date": "<YYYY-MM-DD>", "type": "fix", "title": "<description courte en une phrase>" }` en tête du tableau (ordre décroissant).

Commit : fix: <description du bug corrigé>

Bug à corriger : $ARGUMENTS

---