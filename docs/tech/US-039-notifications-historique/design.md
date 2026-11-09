# Design — Notifications de l'historique (US-040, US-041, US-042)

> **Statut : maquette soumise à validation (D9).** Source : `mockup.html` (même dossier), publiée en artefact.
> Référence : `docs/tech/design-system.md`, page Historique (US-037) pour le rendu des lignes.

## Classification

**Majeur** (D9) : nouveau composant de données (panneau), nouveau contrôle de navigation (cloche + compteur),
refonte de l'écran Paramètres (onglets), nouvelle section « Notifications ». Aucune de ces structures n'existe dans
`docs/design/`.

## 1. Cloche et compteur (toolbar du Tableau)

- Icône Lucide `bell` 22 px, bouton icône 40 × 40, placée entre « Rafraîchir » et l'icône « Historique ».
- Pastille compteur : fond `--color-accent`, texte blanc 11 px 800, hauteur 18 px, min 18 px, coin haut-droit. Absente à 0 ; « 99+ » au-delà de 99.
- Panneau ouvert : bouton plein accent, pastille `#201e1d`.
- Accessibilité : `aria-label` « Notifications, N non vues » ; `aria-expanded`.
- Composant Material : `MatIconButton` + `matBadge` ou badge custom `shared/` si le style Material ne convient pas.

## 2. Panneau

- **Tiroir à droite**, `MatSidenav` (`position="end"`, `mode="over"`), largeur 440 px (100 % sous 480 px), fond `--color-bg`, bordure gauche 2 px `--color-divider`, ombre `--shadow-lg`, voile 32 %.
- En-tête 56 px : titre « Notifications », badge du total, croix de fermeture. Règle 2 px dessous.
- Barre d'actions : bouton texte accent **« Tout marquer comme vu »** (icône `check-check`, désactivé si vide) à gauche ; lien « Voir tout l'historique » (→ `/history`) à droite. Règle 1 px dessous.
- Liste : lignes de la timeline (composant `HistoryEventRowComponent` réutilisé, rendu provisoire `~` inclus) + bouton croix 32 px « Marquer comme vu » à droite. Survol `--color-neutral-100`. Pas de groupement par jour (liste chronologique inverse, heure seule, la date exacte reste en tooltip).
- Pied : « N affichées sur M · les plus récentes en premier » quand M > 50.
- Fermeture : croix, clic sur le voile, `Échap`. Focus piégé dans le tiroir et rendu à la cloche.

### États

| État | Rendu |
|------|-------|
| Nominal | liste ci-dessus |
| Vide | icône `check` 32 px neutre, « Rien de nouveau », texte d'aide, lien « Régler les notifications » (→ `/settings?tab=notifications`), bouton « Tout marquer comme vu » désactivé |
| Chargement | barre 2 px accent sous l'en-tête + 5 lignes squelette (fond `--color-surface`) |
| Erreur | bandeau `accent-100` / règle 2 px accent / texte `accent-800` + « Réessayer » ; compteur = dernier total connu |
| Échec de fermeture | l'entrée revient, compteur restauré, toast « Impossible de marquer la notification comme vue. » |

## 3. Paramètres en onglets (US-042)

- `MatTabNav` / `MatTabGroup` sous l'en-tête : 4 onglets **Connexions · Données · Affichage · Notifications**. Actif : texte accent + trait 2 px accent ; inactif : `--color-neutral-600`.
- L'en-tête (retour, titre, Annuler, Réinitialiser, Enregistrer) reste commun et sticky ; un seul formulaire pour tous les onglets.
- Point 8 px accent sur l'onglet quand il contient une erreur de validation ou (onglet inactif) une modification non enregistrée.
- Onglet actif dans l'URL `?tab=` ; défaut Connexions ; valeur inconnue → défaut. Flèches ← → au clavier. Défilement horizontal sous 600 px.
- Répartition : Connexions (ex-01) · Données (ex-02 Actualisation, ex-05 Historique, export / import / réinitialiser) · Affichage (ex-03 Difficulté, ex-04 Temps depuis Ready, surbrillance, thème, langue, nouvel onglet, wip) · Notifications (nouveau + notification navigateur + badge d'onglet).
- La numérotation « 01 · » des sections repart à 01 dans chaque onglet.

## 4. Onglet « Notifications » (US-041)

- **01 · Périmètre** : deux `MatSlideToggle` (« Seulement mes MRs », « Exclure mes propres actions »), libellé 600 + aide 12 px `neutral-600`. Avertissement `accent-100` + liseré 2 px accent si « Seulement mes MRs » est coché sans identité résolue.
- **02 · Types d'événements** : 3 groupes (Cycle de vie · Relecture et approbation · Contenu), chacun avec titre uppercase 11 px + règle 1 px, liens « Tout cocher » / « Tout décocher » à droite, `MatCheckbox` en 2 colonnes. 18 types au total.
- **03 · Autres alertes** : notification navigateur et badge d'onglet (déplacés depuis « Divers », comportement inchangé, RG-040-09).

## 5. Tokens et composants

Uniquement des tokens existants (`--color-accent*`, `--color-neutral-*`, `--color-divider`, `--color-success`, `--space-*`). Aucun nouvel hex, aucun arrondi. Composants : `MatSidenav`, `MatIconButton`, `MatTabNav`, `MatSlideToggle`, `MatCheckbox`, `MatSnackBar`, `AppAvatar`, `HistoryEventRowComponent`.

## 6. Libellés i18n à créer (fr + en)

`notifications.title`, `notifications.markAllSeen`, `notifications.markSeen`, `notifications.viewHistory`, `notifications.empty.title`, `notifications.empty.hint`, `notifications.configure`, `notifications.error.load`, `notifications.error.markSeen`, `notifications.footer`, `notifications.badgeLabel`, `settings.tabs.*` (4), `settings.notifications.*` (périmètre, types, groupes, tout cocher / décocher, avertissement identité).

## Décisions
### Prises en autonomie
- Cloche entre « Rafraîchir » et « Historique » → cohérence avec la toolbar existante — réversible : oui
- Tiroir (mode « over ») plutôt que page ou menu déroulant → garde le contexte du tableau, pas de nouvelle route — réversible : oui
- Pas de groupement par jour dans le panneau → liste courte et récente — réversible : oui
- Découpage en 4 onglets (Connexions / Données / Affichage / Notifications) → regroupement par intention — réversible : oui
- Notification navigateur et badge d'onglet déplacés dans l'onglet Notifications → cohérence thématique, comportement inchangé — réversible : oui
### Arbitrées par l'humain
- Validation visuelle de la maquette → **en attente (D9)**
