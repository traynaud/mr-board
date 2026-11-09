# US-039 → US-042 — Notifications de l'historique

> **Statut : specs arbitrées (Q1 = C, Q2 = A).** Voir section 8.
> Suite de l'épique « Historique » (US-033 → US-038), dont les notifications étaient explicitement hors périmètre
> (voir `US-033-historique-modifications/specs.md`).

## 1. Reformulation

Le journal des modifications (US-033 → US-037) est consultable mais passif : l'utilisateur doit penser à ouvrir la page
Historique. On ajoute un **panneau de notifications** qui lui présente les événements récents qu'il n'a pas encore
**fermés**, et un **compteur** sur l'accueil qui lui rappelle combien il en a manqué. La liste est rafraîchie à
chaque rechargement de page, à chaque fin de synchronisation et à chaque **résolution d'un événement provisoire**
(passage « confirmé »). Dans les Paramètres, l'utilisateur choisit **par type d'événement** ceux qui alimentent son
panneau. Le nombre de réglages devenant trop important, l'écran Paramètres est **réorganisé en onglets**.

Deux points ambigus (périmètre des événements, notion de « vu » vs « fermé ») ont été arbitrés : voir section 8.

## 2. User Stories

- **US-039** : En tant qu'utilisateur, je veux que les événements du journal soient suivis comme « à traiter » ou
  « fermés » et que cet état persiste d'un navigateur à l'autre, afin de ne pas revoir ce que j'ai déjà écarté.
    - Priorité : Must — Complexité : M — Dépendances : US-033, US-034, US-037

- **US-040** : En tant qu'utilisateur, je veux un panneau listant les événements que je n'ai pas encore fermés et un
  compteur sur l'accueil, afin de savoir d'un coup d'œil ce qui s'est passé en mon absence.
    - Priorité : Must — Complexité : L — Dépendances : US-039, US-037 (**maquette D9 requise**)

- **US-041** : En tant qu'utilisateur, je veux choisir, par type d'événement, ceux qui apparaissent dans mon
  panneau, afin de ne pas être noyé par les événements qui ne m'intéressent pas.
    - Priorité : Must — Complexité : M — Dépendances : US-039, US-015

- **US-042** : En tant qu'utilisateur, je veux que les Paramètres soient organisés en onglets, afin de retrouver
  facilement un réglage maintenant que l'écran est chargé.
    - Priorité : Should — Complexité : M — Dépendances : US-015, US-041 (**maquette D9 requise**)

Ordre de livraison conseillé : US-039 → US-041 → US-040 → US-042 (le panneau consomme l'état et les préférences ;
les onglets absorbent la nouvelle section « Notifications » en dernier).

## 3. Règles de gestion

### État des notifications (US-039)

- **RG-039-01** — Une notification **est** un événement d'historique (`merge_request_events`) : pas de seconde
  source de vérité. Un événement est soit **à traiter**, soit **fermé**.
- **RG-039-02** — Seuls les événements **détectés après la mise en service de la fonctionnalité** peuvent être
  « à traiter ». Les événements déjà présents au déploiement sont considérés comme fermés (pas d'afflux de l'historique
  existant). ✅ Hypothèse retenue
- **RG-039-03** — Un événement fermé le reste définitivement : il ne revient jamais dans le panneau, même si sa
  ligne est enrichie ou confirmée ensuite (voir RG-040-06).
- **RG-039-04** — L'état est stocké **côté backend** (instance mono-utilisateur, RG-G18) : il est identique quel que
  soit le navigateur ou l'onglet. Précédent : favoris (US-027). ✅ Hypothèse retenue
- **RG-039-05** — Quand un événement est purgé par la rétention (US-036), il disparaît du panneau et du compteur.
- **RG-039-06** — Un événement provisoire supprimé sans correspondance forge (RG-034-06) disparaît du panneau et du
  compteur.

### Panneau et compteur (US-040)

- **RG-040-01** — Le panneau liste, du plus récent au plus ancien, les événements **à traiter** dont le type est
  activé dans les préférences (RG-041-01) et qui respectent le périmètre (RG-041-06) : tous les événements par défaut,
  ou seulement ceux sur mes MRs si l'option est cochée.
- **RG-040-02** — Chaque entrée reprend le rendu d'une ligne de la timeline (heure, acteur, phrase, projet, lien MR,
  détail — US-037, y compris l'affichage « provisoire ») et porte une action **Fermer** (« marquer comme vu »).
  Une action **« Tout marquer comme vu »** ferme **toutes** les entrées éligibles (RG-040-01), y compris celles au-delà
  des 50 affichées, et remet le compteur à 0. Elle est désactivée quand le panneau est vide. ✅ Hypothèse retenue
  (portée = toutes les entrées éligibles, pas seulement les 50 visibles ; les types désactivés et les événements
  hors périmètre « Mes MRs » ne sont **pas** fermés).
- **RG-040-03** — Le **compteur** de l'accueil = nombre d'événements affichables dans le panneau (RG-040-01). Il
  vaut 0 → aucun compteur affiché. Au-delà de 99, il s'affiche « 99+ ».
- **RG-040-04** — Le panneau est accessible depuis l'écran Tableau (toolbar). Fermer une entrée décrémente le
  compteur immédiatement (mise à jour optimiste, annulée avec message d'erreur si l'appel échoue).
- **RG-040-05** — Rafraîchissement : le panneau et le compteur sont recalculés (a) au chargement / rechargement de
  la page, (b) à la fin de chaque synchronisation (planifiée ou « Rafraîchir »), (c) lorsqu'un événement provisoire
  est résolu (passage à « confirmé », ou suppression).
- **RG-040-06** — Résolution d'un provisoire : l'événement confirmé **conserve l'état** du provisoire. Un provisoire
  fermé reste fermé après confirmation ; un provisoire à traiter reste à traiter, mis à jour en place (acteur, date,
  détail), sans double comptage. Les événements supplémentaires créés par la forge (inserts) naissent « à traiter ».
- **RG-040-07** — La liste du panneau est paginée / limitée à **50** entrées les plus récentes ; le compteur reste
  exact au-delà. ✅ Hypothèse retenue
- **RG-040-08** — États : chargement, vide (« Rien de nouveau »), erreur (clé i18n, bouton réessayer). Tous les
  textes passent par i18n (fr + en).
- **RG-040-09** — Les réglages existants « Notification navigateur » et « Badge d'onglet » (US-016) ne changent pas
  de comportement et restent indépendants du panneau. ✅ Hypothèse retenue

### Préférences par type (US-041)

- **RG-041-01** — Une préférence booléenne par type d'événement du journal (les 18 types de RG-033-03 : créée,
  titre modifié, passée en draft / prête, approuvée / approbation retirée, reviewer ajouté / retiré, affecté
  ajouté / retiré, label ajouté / retiré, commentée, fusionnée, fermée, rouverte, supprimée, disparue).
- **RG-041-02** — Valeur par défaut : **tous les types activés**. ✅ Hypothèse retenue
- **RG-041-03** — Désactiver un type masque ses événements du panneau et du compteur **sans les fermer** : les
  réactiver les fait réapparaître. Ils restent toujours visibles dans la page Historique (US-037).
- **RG-041-04** — Les préférences sont enregistrées avec le bouton « Enregistrer » des Paramètres (comportement
  d'`Annuler` / `Réinitialiser` identique aux autres sections, US-015), incluses dans l'export / import de la config
  (US-015) ; un import ancien sans ces clés applique les valeurs par défaut.
- **RG-041-06** — **Périmètre** (arbitrage Q1 = C) : deux options dans la section Notifications, enregistrées et
  exportées comme les types :
  - « Seulement mes MRs » (défaut **décochée**) : ne retient que les événements dont la MR est « à moi »
    (auteur, reviewer ou affecté, RG-G09). Sans identité résolue sur la connexion de la MR, l'événement n'est pas
    retenu (même règle que « Mes MRs ») et un avertissement s'affiche à côté de l'option.
  - « Exclure mes propres actions » (défaut **décochée**) : écarte les événements dont l'acteur est moi. Un
    événement provisoire (acteur inconnu) n'est jamais exclu ; il peut le devenir une fois confirmé (alors il quitte
    le panneau et le compteur).
  Comme les types, ces options masquent sans fermer (RG-041-03).
- **RG-041-05** — Raccourcis : « Tout cocher » / « Tout décocher ». Les types sont regroupés par thème pour la
  lisibilité (cycle de vie, relecture, approbation, labels/commentaires). ✅ Hypothèse retenue

### Paramètres en onglets (US-042)

- **RG-042-01** — Les sections actuelles (01 Connexions, 02 Actualisation, 03 Difficulté, 04 Temps depuis Ready,
  05 Historique, 06 Divers) et la nouvelle section **Notifications** sont réparties en onglets. Le découpage exact
  est proposé par l'agent UX/UI (voir section 4).
- **RG-042-02** — Aucune règle de gestion existante ne change : mêmes champs, mêmes validations, mêmes valeurs par
  défaut. Un seul « Enregistrer » / « Annuler » / « Réinitialiser » pour l'ensemble des onglets (un changement fait
  dans un onglet n'est pas perdu en changeant d'onglet).
- **RG-042-03** — L'onglet actif est restitué dans l'URL (cohérent avec RG-G15) ; sans paramètre, le premier onglet
  s'ouvre. Un onglet contenant une erreur de validation le signale.
- **RG-042-04** — Si des modifications non enregistrées existent, le comportement actuel de sortie de l'écran est
  conservé.

## 4. Maquettes de référence

- `docs/design/MR Board - Wireframes.dc.html` 1a/1b/1c (toolbar du Tableau : emplacement du compteur à côté de
  l'icône Historique) et écran Paramètres.
- Page Historique (US-037) : le rendu des lignes est **réutilisé** dans le panneau.
- ⚠️ Aucun panneau de notifications ni onglet de paramètres n'existe dans `docs/design/` : **écart** → maquette à
  produire et valider par l'agent UX/UI (**D9**, nouveau composant + refonte de navigation).

## 5. Critères d'acceptation

```gherkin
# US-039
Scenario: Les événements existants au déploiement ne sont pas notifiés
  Given 126 événements existent avant la mise en service
  When j'ouvre le panneau pour la première fois
  Then le compteur vaut 0 et le panneau affiche « Rien de nouveau »

Scenario: L'état fermé est partagé entre navigateurs
  Given j'ai fermé l'événement E dans le navigateur A
  When j'ouvre l'application dans le navigateur B
  Then E n'apparaît pas dans le panneau

Scenario: Un événement purgé disparaît
  Given l'événement E est à traiter
  When la rétention supprime E
  Then E n'est plus dans le panneau et le compteur est décrémenté

# US-040
Scenario: Nouvel événement après synchronisation
  Given le compteur vaut 2
  When une synchronisation détecte un nouveau titre modifié
  Then le compteur vaut 3 et l'événement est en tête du panneau

Scenario: Fermer une entrée
  Given le panneau contient 3 entrées
  When je ferme la deuxième
  Then elle disparaît, le compteur vaut 2 et elle ne revient pas après rechargement

Scenario: Tout marquer comme vu
  Given le panneau contient 5 entrées
  When je clique « Tout marquer comme vu »
  Then le panneau est vide, le compteur n'est plus affiché et rien ne réapparaît après rechargement

Scenario: Tout marquer comme vu au-delà de 50 entrées
  Given 120 événements éligibles sont à traiter
  When je clique « Tout marquer comme vu »
  Then les 120 sont fermés et le compteur vaut 0

Scenario: Tout marquer comme vu ne ferme pas les types masqués
  Given 3 événements « commentée » à traiter et le type « commentée » désactivé, 2 autres événements visibles
  When je clique « Tout marquer comme vu »
  Then les 2 visibles sont fermés ; si je réactive « commentée », les 3 réapparaissent

Scenario: Panneau vide
  Given aucun événement à traiter
  Then « Tout marquer comme vu » est désactivé

Scenario: Résolution d'un événement provisoire non fermé
  Given un événement provisoire à traiter est dans le panneau
  When il est confirmé par la forge
  Then la même entrée affiche l'acteur et l'heure exacts, sans doublon, et le compteur est inchangé

Scenario: Résolution d'un événement provisoire fermé
  Given j'ai fermé un événement provisoire
  When il est confirmé par la forge
  Then il ne réapparaît pas

Scenario: Provisoire supprimé sans correspondance
  Given un événement provisoire à traiter est dans le panneau
  When la file le supprime faute de correspondance forge
  Then il disparaît du panneau et le compteur est décrémenté

Scenario: Plus de 99 événements
  Given 120 événements sont à traiter
  Then le compteur affiche « 99+ » et le panneau liste les 50 plus récents

Scenario: Échec de la fermeture
  Given l'appel de fermeture échoue
  Then l'entrée réapparaît, le compteur est restauré et un message d'erreur s'affiche

Scenario: Rechargement
  When je recharge la page
  Then le compteur et le panneau reflètent l'état serveur

# US-041
Scenario: Désactiver un type
  Given 3 événements « commentée » sont à traiter
  When je désactive « commentée » et j'enregistre
  Then ils quittent le panneau et le compteur, mais restent visibles dans la page Historique

Scenario: Réactiver un type
  Given j'ai désactivé « commentée » puis fermé aucun événement
  When je le réactive et j'enregistre
  Then les événements « commentée » non fermés réapparaissent

Scenario: Import d'une ancienne configuration
  Given un fichier de config sans préférences de notification
  When je l'importe
  Then les 18 types sont activés

Scenario: Annuler
  Given je décoche des types sans enregistrer
  When je clique « Annuler »
  Then les cases reprennent leur valeur enregistrée

Scenario: Seulement mes MRs
  Given des événements sur mes MRs et sur celles d'un collègue
  When je coche « Seulement mes MRs » et j'enregistre
  Then seuls les événements sur mes MRs restent dans le panneau et le compteur

Scenario: Seulement mes MRs sans identité résolue
  Given aucune identité résolue
  When je coche « Seulement mes MRs »
  Then un avertissement s'affiche et le panneau est vide

Scenario: Exclure mes propres actions
  Given j'ai approuvé une MR (événement confirmé, acteur = moi)
  When je coche « Exclure mes propres actions »
  Then cet événement quitte le panneau et le compteur

# US-042
Scenario: Changer d'onglet sans perdre de modification
  Given j'ai modifié un seuil dans l'onglet « Difficulté » sans enregistrer
  When je passe à l'onglet « Notifications » puis j'enregistre
  Then les deux modifications sont enregistrées

Scenario: Onglet dans l'URL
  When j'ouvre /settings?tab=notifications
  Then l'onglet Notifications est actif

Scenario: Onglet inconnu
  When j'ouvre /settings?tab=xyz
  Then le premier onglet est actif

Scenario: Validation en erreur dans un onglet inactif
  Given une valeur invalide dans un onglet non affiché
  Then l'onglet est signalé en erreur et « Enregistrer » est désactivé
```

## 6. Données (aperçu — le détail revient à l'architecte)

- État par événement (à traiter / fermé) lié à `merge_request_events` ; conservé lors du passage provisoire →
  confirmé (RG-040-06).
- Préférences : 18 booléens (ou liste de types activés) dans les settings, exportés / importés.
- Contrat d'API : liste du panneau + compteur, fermeture unitaire, fermeture groupée.

## 7. Hors périmètre

- Notifications push / e-mail / système d'exploitation (le réglage navigateur US-016 reste inchangé).
- Marquage « lu » distinct de « fermé » (si option B retenue en question 2, voir section 8).
- Filtrage du panneau par projet / auteur / recherche (les filtres de la timeline relèvent d'US-038).
- Réglages par projet ou par connexion.
- Son, vibration, regroupement d'événements similaires.
- Notifications temps réel (WebSocket / SSE) : la mise à jour suit les 3 déclencheurs de RG-040-05.

## 8. Décisions et points ouverts

#### 🛑 Bloquant — arbitrage humain requis

Aucun. Les deux arbitrages sont rendus (voir ci-dessous).

#### ✅ Hypothèses retenues (non bloquant, modifiable après coup)

- Numérotation US-039 → US-042 (US-038 « filtres de la timeline » reste en roadmap, indépendante).
- Événements antérieurs au déploiement : fermés d'office (RG-039-02).
- État stocké côté serveur (RG-039-04, RG-G18).
- « Tout marquer comme vu » : toutes les entrées éligibles, pas seulement les 50 affichées (RG-040-02).
- « Exclure mes propres actions » : option ajoutée au périmètre C, décochée par défaut (RG-041-06).
- Provisoire résolu : même ligne, état conservé (RG-040-06).
- Liste limitée à 50 entrées, compteur plafonné à « 99+ » (RG-040-03/07).
- Tous les types activés par défaut (RG-041-02) ; regroupement thématique des types (RG-041-05).
- « Notification navigateur » et « Badge d'onglet » inchangés (RG-040-09).
- Le découpage en onglets et l'emplacement du panneau sont du ressort de l'agent UX/UI (D9 systématique).

## Décisions
### Prises en autonomie
- Numérotation US-039 → US-042 → ordre 039, 041, 040, 042 — dépendances de données — réversible : oui
- Événements historiques fermés au déploiement → pas d'afflux — réversible : oui
- État serveur plutôt que navigateur → mono-utilisateur (RG-G18), précédent favoris — réversible : non (modèle de données, à confirmer par l'architecte)
- Tous les types activés par défaut → réversible : oui
### Arbitrées par l'humain
- Instantané des personnes concernées stocké sur l'événement (archi, D3) → **A**
- Périmètre des événements du panneau (Q1) → **C** : tous par défaut + options « Seulement mes MRs » et « Exclure mes propres actions » (RG-041-06)
- Un ou deux états « vu » / « fermé » (Q2) → **A** : un seul état ; action « Tout marquer comme vu » demandée (RG-040-02)
