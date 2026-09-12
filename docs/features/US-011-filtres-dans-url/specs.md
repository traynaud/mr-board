# US-011 — Filtres, tri et colonnes propagés dans l'URL

## 1. Reformulation

L'état complet du tableau (filtres rapides, pastilles, tri, colonnes visibles) est reflété dans les query params de
l'URL. Un rafraîchissement, un favori ou un lien partagé restaure exactement la même vue.

## 2. User Stories

- **US-011** : En tant qu'utilisateur, je veux que mes filtres et mon tri soient conservés dans l'URL, afin de retrouver
  ma vue après un rafraîchissement et de la partager avec mes collègues.
    - Priorité : Must
    - Complexité estimée : M
    - Dépendances : US-010

## 3. Règles de gestion

- **RG-011-01** : Format des query params (ordre stable) :
  `?drafts=0|1&mine=0|1&project=a,b&author=u1,u2&assigned=nobody,u1&approved=0|1&commented=0|1&sort=ready:asc&cols=opened`
  - `drafts`, `mine`, `sort` sont toujours présents
  - Un filtre composable actif est présent même sans valeur (`author=`) afin de conserver sa pastille ; un filtre absent n'a pas de pastille
  - `cols` liste les colonnes optionnelles visibles (seule « opened » existe en v1, RG-011-09) ; absent si aucune
- **RG-011-02** : Au chargement, l'URL est la source de vérité : le store des filtres est initialisé depuis les query params. Sans query params, les valeurs par défaut s'appliquent (`drafts=0&mine=0&sort=ready:asc`) et l'URL est complétée (`replaceState`, sans entrée d'historique).
- **RG-011-03** : Chaque modification de l'état met à jour l'URL via `router.navigate` avec `queryParams`, `replaceUrl: true` (pas d'empilement d'historique à chaque clic).
- **RG-011-04** : Les valeurs invalides sont ignorées et remplacées par le défaut (`sort=foo` → `ready:asc`, `approved=x` → filtre présent sans valeur). Les valeurs de liste inconnues sont conservées jusqu'au premier chargement des facets puis nettoyées (RG-010-09) et l'URL mise à jour.
- **RG-011-05** : Navigation vers `/settings` puis retour : l'URL du tableau est restaurée (le lien « retour » et « Annuler » reviennent à la dernière URL du tableau, conservée en mémoire dans le store).
- **RG-011-06** : Le pied de page affiche la query string courante en monospace (aide au partage), comme dans le prototype (`showUrl`).
- **RG-011-07** : Le bouton « Effacer » ramène l'URL à `?drafts=<inchangé>&mine=0&sort=<inchangé>` (RG-009-05).
- **RG-011-08** : Le mapping URL ↔ état est une fonction pure (`core/url-state/query-params.mapper.ts`) testée dans les deux sens (encode / decode / idempotence).
- **RG-011-09** : Menu « Colonnes » (icône colonnes en bout de tableau, RG-005-02) : titre uppercase « Colonnes », une seule option « Date d'ouverture » avec case à cocher (RG-G19 non applicable ici, pas de compteur). Cocher/décocher affiche/masque immédiatement la colonne, sans fermer le menu (même comportement que les menus multi-sélection de US-010). Décoché par défaut. **Anticipe une partie du périmètre de US-012** (« Colonnes redimensionnables et colonne Date d'ouverture ») : seule la visibilité de la colonne est traitée ici, le redimensionnement des colonnes reste dans US-012.
- **RG-011-10** : Colonne « Ouverte » (visible seulement si activée via RG-011-09) : affiche la date d'ouverture GitLab (`createdAt`) au format `JJ/MM/AAAA` (`formatShortDate`, déjà utilisé ailleurs dans l'app). Positionnée après la colonne « Depuis Ready », comme dans le prototype.
- **RG-011-11** : La visibilité de la colonne « Ouverte » n'est persistée nulle part ailleurs que l'URL (`cols=opened`) — pas de `localStorage` (cohérent avec l'hypothèse de QO-011-01), pas de préférence serveur. Un rafraîchissement sans `cols` dans l'URL revient à la colonne masquée par défaut.

## 4. Maquettes de référence

- Wireframe **1a** — barre d'URL `?drafts=0&mine=0&project=api,web&assigned=nobody&sort=ready:asc`
- Wireframe **1b** — `?drafts=1&mine=1&assigned=nobody,mdu&approved=0&sort=ready:asc`
- Prototype — `parseHash`, `query`, `syncUrl`, pied de page `?{{ query }}` (lignes 124-128) ; menu « Colonnes » en bout de tableau (`data-anchor="cols"`, icône colonnes, un item « Date d'ouverture » à cocher, lignes 95-101) ; colonne « Ouverte » conditionnelle (ligne 94)

## 5. Critères d'acceptation

```gherkin
Scenario: URL complétée par défaut
  When j'ouvre « / » sans query params
  Then l'URL devient « /?drafts=0&mine=0&sort=ready:asc » sans nouvelle entrée d'historique

Scenario: Restauration depuis l'URL
  When j'ouvre « /?drafts=1&mine=1&project=api,web&assigned=nobody,mdupont&approved=0&sort=diff:desc&cols=opened »
  Then « Drafts » et « Mes MRs » sont sélectionnés
  And les pastilles « Projet : api, web », « Affecté à : Nobody, MD », « Approved : Non » sont présentes
  And le tri est diff:desc
  And la colonne « Ouverte » est visible
  And GET /api/v1/merge-requests est appelé avec exactement ces paramètres

Scenario: Mise à jour de l'URL à chaque changement
  Given l'URL est « /?drafts=0&mine=0&sort=ready:asc »
  When j'ajoute le filtre Projet et je coche « api »
  Then l'URL devient « /?drafts=0&mine=0&project=api&sort=ready:asc »
  And l'historique du navigateur n'a pas gagné d'entrée

Scenario: Filtre actif sans valeur
  When j'ajoute le filtre Auteur sans cocher d'option
  Then l'URL contient « author= »
  When je rafraîchis la page
  Then la pastille « Auteur : tous » est présente

Scenario: Valeur invalide
  When j'ouvre « /?sort=title:asc&approved=maybe »
  Then le tri est ready:asc et la pastille « Approved : — » est présente
  And l'URL est corrigée

Scenario: Aller-retour Paramètres
  Given l'URL du tableau est « /?drafts=1&mine=0&project=api&sort=ready:asc »
  When j'ouvre les paramètres puis je clique sur « Annuler »
  Then je reviens sur « /?drafts=1&mine=0&project=api&sort=ready:asc »

Scenario: Alias renommé
  Given l'URL contient « project=api » et l'alias « api » a été renommé « back »
  When la page se charge
  Then la sélection « api » est retirée et l'URL devient « project= »

Scenario: Pied de page
  Then le pied de page affiche « ?drafts=0&mine=0&sort=ready:asc » en monospace

Scenario: Mapper pur
  Given un état de filtres quelconque
  When je l'encode en query params puis je décode
  Then j'obtiens le même état (idempotence)

Scenario: Afficher la colonne Date d'ouverture
  Given la colonne « Ouverte » est masquée
  When j'ouvre le menu « Colonnes » et je coche « Date d'ouverture »
  Then la colonne « Ouverte » apparaît après « Depuis Ready », au format JJ/MM/AAAA
  And le menu reste ouvert
  And l'URL devient « …&cols=opened »
  When je décoche « Date d'ouverture »
  Then la colonne disparaît et « cols » n'apparaît plus dans l'URL
```

## 6. Questions ouvertes

- QO-011-01 : Faut-il aussi mémoriser la dernière vue en `localStorage` pour un utilisateur qui ouvre « / » sans params ? Hypothèse : non, l'URL suffit (les favoris du navigateur font office de vues sauvegardées).

## 7. Hors périmètre

- Vues nommées / sauvegardées
- Redimensionnement des colonnes (US-012) — seule la **visibilité** de la colonne « Date d'ouverture » est traitée ici (RG-011-09/10/11), anticipée depuis US-012 pour que `cols` dans l'URL ait un effet réel
- Largeurs de colonnes dans l'URL (localStorage, US-012)
- Toute autre colonne optionnelle au-delà de « Date d'ouverture »
