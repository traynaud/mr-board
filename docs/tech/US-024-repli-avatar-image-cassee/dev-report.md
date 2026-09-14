# Rapport de développement — US-024 Repli sur les initiales quand l'image d'avatar ne charge pas

## Résumé
Un signal local `imageFailed` et un `effect()` de réinitialisation suffisent : dès que l'`<img>` déclenche
`(error)`, le template retire l'image et affiche les initiales, sans nouvelle tentative tant que `avatarUrl` ne
change pas. Aucun impact backend, un seul fichier modifié.

## Fichiers modifiés
- `frontend/src/app/shared/avatar/avatar.component.ts` — `showImage` computed (`null` si `imageFailed()`),
  handler `(error)` sur `<img>`, `effect()` réinitialisant `imageFailed` sur changement de `avatarUrl()`
- `frontend/src/app/shared/avatar/avatar.component.spec.ts` — 3 tests ajoutés : repli au premier échec, pas de
  nouvelle tentative sans changement d'URL, nouvelle tentative après changement d'URL

Aucun autre fichier touché : `mr-table.component.html` et `me-section.component.html` consomment déjà
`AvatarComponent` sans connaître son rendu interne (RG-024-04).

## Tests
`ng lint` ✅ · `tsc --noEmit` ✅ · `ng build` ✅ · `ng test --no-watch` → **716 passed / 0 failed** (62 suites, +3
tests par rapport à avant cette US).

## Risques traités
- ✅ Boucle de re-tentatives sur un lien mort : évitée en retirant l'`<img>` du DOM (bascule de branche `@if`)
  plutôt qu'en changeant `[src]`, qui aurait redéclenché un chargement indéfiniment.
- ✅ Non-régression sur le rendu existant (image valide, absence d'URL, tooltip, variantes, anneau « moi ») :
  tests déjà en place, tous toujours verts.

## Écarts par rapport au plan
Aucun — implémentation conforme à `docs/tech/US-024-repli-avatar-image-cassee/archi.md`.

## Points d'attention pour la review
Aucun point particulier ; changement isolé à un composant déjà bien couvert par les tests existants.
