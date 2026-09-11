<!-- .claude/commands/refacto.md -->

# Workflow Refactoring Technique

Tu es un tech lead expérimenté. Tu vas conduire un refactoring en suivant
ce processus rigoureux. L'objectif est de modifier la structure du code
SANS changer le comportement fonctionnel.

## Phase 1 : Diagnostic

Analyse le code concerné et produis un rapport :

### 1.1 État des lieux
- Fichiers concernés (liste exhaustive avec chemins)
- Nombre de lignes impactées (estimation)
- Couplages identifiés (qui dépend de quoi)

### 1.2 Problèmes identifiés
Pour chaque problème :
- 📍 Localisation (fichier:ligne)
- 🏷️ Catégorie : Duplication | Couplage | Complexité | Nommage | Performance | Dette technique
- 📝 Description du problème
- 💡 Solution proposée

### 1.3 Risques
- Ce qui pourrait casser
- Les zones à tester en priorité après refacto

Écris le diagnostic dans `docs/refacto/<nom-refacto>/diagnostic.md`.

**STOP** → Demande validation avant de toucher au code.

---

## Phase 2 : Plan d'exécution

Après validation du diagnostic :
- Découpe le refacto en étapes ATOMIQUES (chacune doit compiler)
- Chaque étape = 1 commit possible
- Ordonne les étapes pour minimiser les risques

Format :
```
Étape 1 : [description] → fichiers touchés : [liste]
Étape 2 : [description] → fichiers touchés : [liste]
```

Écris le plan dans `docs/refacto/<nom-refacto>/plan.md`.

**STOP** → Demande validation du plan.

---

## Phase 3 : Filet de sécurité

Avant de refactorer :
1. Lance les tests existants (`mvn test` + `ng test`)
2. Note le nombre de tests passants (c'est la baseline)
3. Si la couverture est faible sur la zone à refactorer,
   ÉCRIS D'ABORD des tests de non-régression
4. Relance les tests pour confirmer qu'ils passent

**STOP** → Affiche la baseline de tests. Demande confirmation pour continuer.

---

## Phase 4 : Exécution

Pour CHAQUE étape du plan :
1. Applique la modification
2. Lance `mvn clean verify` (ou `ng test` si frontend)
3. Si un test casse → corrige IMMÉDIATEMENT ou rollback
4. Affiche : "Étape X/Y ✅ - tests : XX passés / 0 échoués"

Règles strictes :
- JAMAIS changer un test pour le faire passer (sauf si le test était faux)
- JAMAIS modifier le comportement fonctionnel
- JAMAIS ajouter de feature "en passant"
- Un seul pattern de refacto par étape (Extract Method OU Rename OU Move, pas les 3)

---

## Phase 5 : Vérification finale

1. Lance TOUS les tests (backend + frontend)
2. Compare avec la baseline de la Phase 3
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
```

Écris dans docs/refacto/<nom-refacto>/report.md.

## Phase 6 : Finalisation

**Mets à jour `frontend/public/changelog.json`** : ajoute une entrée `{ "date": "<YYYY-MM-DD>", "type": "refacto", "title": "<description courte en une phrase>" }` en tête du tableau (ordre décroissant).

Crée un commit : refactor: <description courte>

Refactoring demandé : $ARGUMENTS

---