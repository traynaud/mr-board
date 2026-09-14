# Architecture — US-024 Repli sur les initiales quand l'image d'avatar ne charge pas

## Résumé fonctionnel
Quand une image d'avatar existe (URL non nulle) mais échoue à charger dans le navigateur, `AvatarComponent` doit
basculer sur le même rendu « initiales » que lorsque l'URL est absente, au lieu de laisser l'icône d'image cassée
du navigateur.

---

## Backend

Aucun impact. Le problème est strictement un rendu côté navigateur (l'URL renvoyée par l'API est correcte au
moment de la synchronisation ; elle peut devenir invalide plus tard — avatar supprimé côté forge, lien expiré,
latence réseau — sans que le backend en soit informé). Aucune tâche backend.

---

## Frontend

### Intégration dans les features existantes
Un seul fichier concerné : `shared/avatar/avatar.component.ts` (+ son template inline). Comme c'est le seul
composant d'affichage d'avatar de l'application (RG-024-04), le corriger là suffit à corriger tous ses points
d'usage (`mr-table.component.html` pour auteur/reviewer/affecté, `me-section.component.html` pour l'aperçu
d'identité) — aucun de ces appelants n'a besoin d'être modifié.

### Composants réutilisables et Angular Material
Aucun nouveau composant. Réutilise le rendu « initiales » déjà existant (`@else { <span class="initials">... }`).

### Nouvelles tâches techniques
| Tâche | Type | Description |
|-------|------|-------------|
| Étendre `AvatarComponent` | Composant | Ajouter un `signal<boolean>` interne `imageFailed`, mis à `true` par un handler `(error)` sur `<img>` ; le template affiche les initiales dès que `!avatarUrl() \|\| imageFailed()` (RG-024-01) |
| Réinitialiser le repli au changement d'URL | Composant | Un `effect()` (ou équivalent) qui remet `imageFailed` à `false` chaque fois que `avatarUrl()` change, pour retenter le chargement d'une nouvelle URL (RG-024-02) |
| Tests unitaires | Test | `avatar.component.spec.ts` : émettre l'évènement `error` sur l'`<img>`, vérifier le repli sur les initiales, le tooltip inchangé, l'absence de nouvelle tentative sans changement d'URL, et la reprise d'essai après changement d'URL |

### Modifications sur l'existant
| Élément modifié | Nature de la modification | Risque | Solution proposée |
|-----------------|---------------------------|--------|--------------------|
| `avatar.component.ts` | Ajout d'un signal local + un effect | Faible | Composant déjà `OnPush`/autonome, aucun appelant à toucher ; les tests existants (rendu image / rendu initiales sans erreur) ne changent pas de comportement |

Aucune tâche pour `mr-table.component.*`, `me-section.component.*`, ni pour un quelconque store/service : ils
passent déjà `avatarUrl`/`name` à `AvatarComponent` sans rien connaître de son rendu interne.

---

## Points de vigilance globaux
- **Éviter la boucle de re-tentatives** (RG-024-02) : ne pas simplement changer `[src]` sur erreur (qui redéclenche
  un chargement et peut reboucler sur `(error)` indéfiniment si le lien est mort) — la solution retenue bascule le
  template entier sur le rendu « initiales » (l'`<img>` est retiré du DOM), donc plus aucune requête n'est émise
  tant que `avatarUrl()` ne change pas.
- **Signal vs `computed`** : `imageFailed` doit être un `signal` écrit par le handler `(error)`, pas un `computed`
  (un `computed` ne peut pas être déclenché par un évènement DOM). L'`effect()` de réinitialisation doit dépendre
  uniquement de `avatarUrl()` pour ne pas se redéclencher sur un changement de `name()`/`highlighted()`.

---

## Ordre de réalisation suggéré
1. `AvatarComponent` : signal `imageFailed`, handler `(error)`, effect de réinitialisation sur `avatarUrl()`
2. Tests unitaires (cas nominal image cassée, non-boucle, reprise sur nouvelle URL)
3. Validation manuelle : forcer une URL d'avatar invalide dans `ng serve` et vérifier le rendu
