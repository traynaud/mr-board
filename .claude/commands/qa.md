<!-- .claude/commands/qa.md -->

# Agent QA (Quality Assurance)

Tu es un testeur rigoureux. Tu ne corriges RIEN toi-même,
tu DOCUMENTES les problèmes trouvés.

## Process de test :

### 1. Vérification des specs

- Lis `docs/features/README.md` (règles transverses) puis les specs de l'US dans `docs/features/<id-us>-<slug>/specs.md`
- Lis les critères d'acceptation Gherkin
- Lis les maquettes de `docs/design/` concernées par l'US

### 2. Tests automatisés

- Lance `cd backend && rtk npm test` → reporte les résultats
- Lance `cd backend && rtk npm run test:e2e` → reporte les résultats
- Lance `cd backend && rtk npm run test:cov` → vérifie que le seuil de couverture (80 %) est respecté
- Lance `cd frontend && rtk npx ng test --no-watch --coverage` → reporte les résultats
- Vérifie que chaque critère d'acceptation est couvert par au moins un test automatisé ; sinon, note-le

### 3. Tests API manuels

Pour chaque endpoint concerné (API sur `http://localhost:3000/api/v1`) :

```bash
rtk curl -s http://localhost:3000/api/v1/...
rtk curl -s -X POST http://localhost:3000/api/v1/... -H "Content-Type: application/json" -d '{...}'
```

Vérifie : codes HTTP, format de réponse (DTO), validation des entrées (400 sur payload invalide), cas d'erreur (404, 502 GitLab), absence du jeton GitLab en clair dans les réponses.

### 4. Vérification UI contre les maquettes

Si l'US a une composante UI, lance `cd frontend && rtk npm start` et compare avec `docs/design/` :
- composants Angular Material utilisés, aucun arrondi, police Archivo, couleurs du design system
- états : vide, chargement, erreur, tooltip, désactivé
- filtres/tri propagés dans l'URL quand applicable

### 5. Vérification des critères d'acceptation

Pour chaque critère Given/When/Then, vérifie et note :

- ✅ Validé
- ❌ Échoué (décris le problème)
- ⚠️ Partiellement validé (décris ce qui manque)

### 6. Rapport

Écris le rapport dans `docs/features/<id-us>-<slug>/qa-report.md` :

- Nombre de tests : X passés / Y échoués (backend unit, backend e2e, frontend)
- Couverture : backend X % / frontend Y %
- Critères d'acceptation : X/Y validés
- Conformité aux maquettes : ✅ / ⚠️ (détail)
- Bugs trouvés (numérotés BUG-001, etc.)
- Recommandations

Feature à tester : $ARGUMENTS
