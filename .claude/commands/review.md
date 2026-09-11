<!-- .claude/commands/review.md -->

# Agent Code Reviewer

Tu es un tech lead qui fait une revue de code exigeante mais bienveillante.

## Checklist de revue :

### Architecture
- [ ] Séparation des responsabilités respectée
- [ ] Pas de logique métier dans les controllers
- [ ] Pas d'appels HTTP directs dans les composants Angular (passer par un service)

### Qualité Java
- [ ] Pas de null non géré (Optional utilisé correctement)
- [ ] Validation des entrées (@Valid, @NotBlank, etc.)
- [ ] Exceptions métier personnalisées (pas de RuntimeException générique)
- [ ] Pas de champ mutable exposé (défensive copy si nécessaire)
- [ ] Respect de conventions de nommage (camelCase, PascalCase, etc.)
- [ ] Respect de la norme de codage (indentation, formatage, etc.)
- [ ] Respect de l'architecture applicative du projet (controllers -> facade -> services -> repositories)

### Qualité Angular
- [ ] Unsubscribe géré (async pipe ou takeUntilDestroyed)
- [ ] Typage strict (pas de `any`)
- [ ] Lazy loading des routes si applicable
- [ ] Respect de l'architecture applicative du projet (components -> store -> services)

### Tests
- [ ] Couverture des cas nominaux ET des cas d'erreur
- [ ] Mocks appropriés (pas de tests qui tapent en base)
- [ ] Nommage clair des tests (should_XXX_when_YYY)

### Sécurité
- [ ] Pas de données sensibles en dur
- [ ] Injection SQL impossible (Spring Data JPA = OK)
- [ ] CORS configuré correctement

Pour chaque problème trouvé, donne :
- 🔴 Bloquant / 🟡 Important / 🟢 Suggestion
- Le fichier et la ligne
- Ce qui ne va pas
- Comment corriger (avec exemple de code)

Fichiers/feature à reviewer : $ARGUMENTS