# US-027 — Favoris : suivre une MR en particulier

## 1. Reformulation

Au milieu d'un tableau qui peut compter plusieurs dizaines de MRs, on a souvent 2 ou 3 MRs qu'on suit de près
(la sienne en attente de relecture, celle d'un collègue qu'on doit relire, celle qui bloque une livraison). On veut
pouvoir les marquer d'une étoile et les retrouver instantanément via un filtre rapide « Favoris », sans rien
écrire sur GitLab/GitHub : c'est une annotation **locale**, propre à l'instance MR Board, dans le même esprit que
la couleur de repo (US-025).

## 2. User Story

- **US-027** : En tant que membre de l'équipe, je veux marquer certaines MRs comme favorites et pouvoir n'afficher
  qu'elles, afin de suivre au quotidien les quelques MRs qui me concernent vraiment sans dépendre du tri ni des
  filtres structurés.
    - Priorité : Should
    - Complexité estimée : M
    - Dépendances : US-004 (synchronisation), US-005 (tableau), US-009 (filtres rapides), US-011 (état dans l'URL),
      US-015 (export/import de configuration)

## 3. Règles de Gestion

### Marquage

- **RG-027-01** — Annotation locale : le favori est une donnée **propre à MR Board**, jamais écrite sur la forge
  (aucun appel en écriture vers GitLab/GitHub, conformément au non-objectif « lecture seule » du §1). Il n'a
  aucune correspondance avec les fonctionnalités natives des forges (todo, abonnement, réaction).
- **RG-027-02** — Portée : le favori est attaché à **une MR**, pas à un repo ni à un auteur. Une seule instance
  MR Board = un seul jeu de favoris (RG-G18, instance mono-utilisateur).
- **RG-027-03** — Persistance : les favoris sont stockés **côté backend** (comme toutes les préférences,
  QO-G01), pas dans le navigateur : ils survivent à un changement de navigateur/poste et sont inclus dans
  l'export de configuration (RG-027-12).
- **RG-027-04** — Identité stable : un favori est mémorisé par l'identité **stable** de la MR — son repo et son
  `iid` — et non par l'identifiant interne de la ligne. Justification : la synchronisation supprime les lignes de
  MRs absentes de la réponse de la forge (RG-004-03), donc une MR fermée puis rouverte réapparaît avec un
  identifiant interne différent ; un favori posé avant sa fermeture doit la retrouver telle quelle à son retour.
- **RG-027-05** — Cycle de vie : un favori qui ne correspond à aucune MR actuellement synchronisée est
  **conservé silencieusement** (invisible, sans effet sur le tableau ni sur les compteurs) et redevient actif si
  la MR réapparaît. Il n'est supprimé définitivement que lorsque son repo est retiré des Paramètres (RG-003-08) —
  suppression en cascade, comme les MRs du repo.
- **RG-027-06** — Aucun plafond du nombre de favoris, aucune expiration automatique.

### Affichage et interaction

- **RG-027-07** — Étoile dans le tableau : une colonne **étroite en tête de tableau** (avant « Projet »), sans
  libellé d'en-tête, contenant un bouton étoile par ligne : pleine (accent) si la MR est favorite, contour neutre
  sinon. Colonne **toujours visible** (elle n'est ni optionnelle au sens RG-011-09, ni redimensionnable au sens
  RG-012-01), largeur fixe 36 px.
- **RG-027-08** — Bascule : un clic (ou Entrée/Espace au clavier) bascule immédiatement l'état favori, sans
  confirmation et sans passer par le bouton « Enregistrer » des Paramètres. Le bouton porte un `aria-label`
  traduit indiquant l'action à venir (« Ajouter aux favoris » / « Retirer des favoris ») et le titre de la MR.
- **RG-027-09** — Retour immédiat : l'étoile bascule visuellement dès le clic (mise à jour optimiste) ; en cas
  d'échec de l'appel serveur, l'étoile revient à son état précédent et un toast d'erreur est affiché (même
  mécanique que les autres erreurs d'écriture de l'application).
- **RG-027-10** — Filtre rapide : un chip « Favoris » rejoint « Drafts » et « Mes MRs » en tête de la barre de
  filtres (zone 4), toujours visible, désactivé par défaut. Actif, il restreint le tableau aux MRs favorites ;
  il se combine en ET avec tous les autres filtres (RG-G14) et alimente les compteurs (RG-G19, RG-G20) comme
  n'importe quel filtre. Il ne porte pas de compteur propre.
- **RG-027-11** — URL et effacement : le filtre est reflété dans l'URL sous `fav=1` (RG-G15), restauré au
  chargement, et remis à zéro par le bouton « Effacer » — comme « Mes MRs », et contrairement à « Drafts » qui est
  une préférence d'affichage (RG-009-01, RG-010-11). Le marquage favori d'une MR, lui, n'est jamais affecté par
  « Effacer » : seul le filtre l'est.
- **RG-027-12** — Tri inchangé : les favoris ne remontent pas en tête du tableau ; le tri par défaut et les tris
  de colonne restent inchangés (RG-G10). Le favori est un moyen de **filtrer**, pas de réordonner (voir
  QO-027-02).
- **RG-027-13** — Drafts : une MR draft peut être mise en favori comme une autre ; elle reste soumise à la règle
  d'affichage des drafts (RG-009-01) — le filtre « Favoris » seul ne fait pas apparaître un draft masqué.
- **RG-027-14** — Labels ignorés : une MR masquée par un label ignoré (RG-015-02) reste masquée, même favorite —
  le favori ne contourne aucun filtrage global.

### Configuration

- **RG-027-15** — Export/Import (RG-015-04) : les favoris sont inclus dans l'export de configuration sous la forme
  `{ connexion, repo (chemin), iid }`. À l'import, un favori dont le repo n'existe pas (ou n'est pas importé) est
  **ignoré silencieusement**, sans faire échouer l'import (même principe que les repos non résolus, RG-019-19) ;
  l'import est additif (il n'efface jamais un favori existant).
- **RG-027-16** — Réinitialisation globale (RG-015-05) : la réinitialisation de la configuration efface aussi tous
  les favoris.

## 4. Maquettes de référence

Aucune maquette de `docs/design/` ne couvre les favoris (nouveauté postérieure aux wireframes). Références
existantes :
- zone 4 (barre de filtres) des wireframes 1a/1b : le chip « Favoris » reprend exactement le style des chips
  « Drafts »/« Mes MRs » (`mat-chip-option`, US-009) ;
- zone 5 (tableau) : la colonne étoile s'insère avant « Projet », symétrique de la colonne de menu « Colonnes »
  déjà présente en fin de tableau (colonne technique sans en-tête) ;
- l'étoile réutilise le style des icônes Lucide existantes (`mat-icon` + `svgIcon`, 18 px, `currentColor`), avec
  l'accent `#ec3013` pour l'état « favori » — cohérent avec l'emploi parcimonieux de l'accent du design system.

## 5. Critères d'Acceptation

```gherkin
Scenario: Marquer une MR comme favorite
  Given une MR non favorite dans le tableau
  When je clique sur son étoile
  Then l'étoile devient pleine (accent) immédiatement
  And le favori est enregistré côté serveur

Scenario: Retirer une MR des favoris
  Given une MR favorite
  When je clique sur son étoile
  Then l'étoile redevient un contour neutre
  And la MR n'est plus retenue par le filtre "Favoris"

Scenario: Le favori survit au rechargement de la page
  Given j'ai mis une MR en favori
  When je recharge la page
  Then cette MR est toujours affichée comme favorite

Scenario: Filtrer sur les favoris
  Given 10 MRs affichées dont 2 favorites
  When j'active le chip "Favoris"
  Then seules les 2 MRs favorites restent affichées
  And le compteur global indique 2 MRs

Scenario: Le filtre Favoris se combine avec les autres filtres
  Given le chip "Favoris" est actif
  And le filtre "Projet : api" est actif
  Then seules les MRs favorites du projet "api" sont affichées

Scenario: Le filtre Favoris est propagé dans l'URL et restauré
  Given le chip "Favoris" est actif
  When je recharge la page avec l'URL courante
  Then le chip "Favoris" est toujours actif et le tableau reste restreint aux favorites

Scenario: Le bouton Effacer désactive le filtre sans perdre les favoris
  Given le chip "Favoris" est actif et 2 MRs sont favorites
  When je clique sur "Effacer"
  Then le chip "Favoris" est désactivé et toutes les MRs réapparaissent
  And les 2 MRs concernées sont toujours marquées d'une étoile pleine

Scenario: Un favori survit à la disparition puis au retour de la MR
  Given une MR favorite d'iid 42 sur le repo "web/api"
  When cette MR est fermée sur la forge et disparaît à la synchronisation suivante
  And elle est rouverte puis resynchronisée plus tard
  Then elle réapparaît dans le tableau, toujours marquée comme favorite

Scenario: Supprimer un repo purge ses favoris
  Given une MR favorite sur le repo "web/api"
  When je supprime le repo "web/api" dans les Paramètres
  Then les favoris rattachés à ce repo sont supprimés

Scenario: Le tri n'est pas modifié par les favoris
  Given des MRs favorites et non favorites, triées par "Depuis Ready" croissant
  When je consulte le tableau sans filtre actif
  Then l'ordre des lignes est inchangé : les favorites ne sont pas remontées en tête

Scenario: Un draft favori reste soumis à l'affichage des drafts
  Given une MR draft favorite et les drafts masqués
  When j'active le chip "Favoris"
  Then la MR draft favorite n'apparaît pas
  And elle apparaît dès que j'active aussi le chip "Drafts"

Scenario: Les favoris sont conservés à l'export puis à l'import
  Given 2 MRs favorites
  When j'exporte la configuration puis je la réimporte sur une instance ayant les mêmes repos
  Then ces 2 MRs sont de nouveau marquées comme favorites

Scenario: Un favori importé pour un repo inconnu est ignoré
  Given un fichier de configuration contenant un favori sur un repo absent de l'instance
  When j'importe ce fichier
  Then l'import réussit, sans erreur, et ce favori est ignoré

Scenario: Échec serveur lors de la bascule
  Given une MR non favorite
  When je clique sur son étoile et que l'appel serveur échoue
  Then l'étoile revient à son état non favori
  And un message d'erreur est affiché
```

## 6. Questions ouvertes

- **QO-027-01** : le marquage doit-il être stocké côté backend ou par navigateur (`localStorage`) ? *Hypothèse
  retenue* : backend (RG-027-03) — cohérent avec toutes les autres préférences (QO-G01), exportable, et surtout
  indispensable pour que le filtre et les compteurs restent calculés côté serveur comme les autres filtres.
- **QO-027-02** : les MRs favorites doivent-elles être **épinglées en tête** du tableau plutôt que (ou en plus
  d'être) filtrables ? *Hypothèse retenue* : non en v1 (RG-027-12) — épingler casserait la promesse « la plus
  ancienne MR Ready en haut » (RG-G10) ; le filtre couvre le besoin principal.
- **QO-027-03** : faut-il une notification navigateur (US-016) quand une MR favorite change d'état (approuvée,
  nouveau commentaire) ? *Hypothèse retenue* : non en v1 (voir §7) — à reconsidérer si les favoris sont adoptés.
- **QO-027-04** : faut-il afficher un compteur de favoris sur le chip (« Favoris · 3 ») ? *Hypothèse retenue* :
  non — aucun chip n'en porte aujourd'hui, le compteur global (RG-G20) suffit.
- **QO-027-05** : faut-il une purge automatique des favoris « orphelins » (MR disparue depuis N mois) ?
  *Hypothèse retenue* : non (RG-027-05) — le volume est négligeable et la purge silencieuse ferait perdre un
  favori légitime sur une MR temporairement fermée.

## 7. Hors périmètre

- Toute écriture sur la forge (ajouter un todo GitLab, s'abonner à une PR GitHub) — RG-027-01.
- Épinglage en tête de tableau / tri spécifique aux favoris (QO-027-02).
- Notifications ou badge d'onglet spécifiques aux favoris (QO-027-03) — le badge reste celui de RG-016-04.
- Favoris partagés entre plusieurs utilisateurs ou listes de favoris nommées (instance mono-utilisateur, RG-G18).
- Annotations libres sur une MR (note personnelle, priorité, échéance) — seul un marquage binaire est couvert ici.
- Favoris sur un repo, une connexion ou un auteur — le favori porte uniquement sur une MR (RG-027-02).
