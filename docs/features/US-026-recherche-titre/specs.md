# US-026 — Recherche libre sur le titre des MRs

## 1. Reformulation

En multi-repo, retrouver une MR précise dans le tableau impose aujourd'hui de la repérer à l'œil ou de bricoler
une combinaison de filtres (Projet + Auteur). On veut un champ de recherche libre, toujours visible dans la barre
de filtres, qui restreint le tableau aux MRs dont le titre contient les termes saisis. La recherche se combine
avec tous les filtres existants, alimente les mêmes compteurs, et se retrouve dans l'URL comme le reste de l'état
du tableau.

## 2. User Story

- **US-026** : En tant que membre de l'équipe suivant plusieurs repos, je veux filtrer le tableau en tapant
  quelques mots du titre d'une MR afin de la retrouver immédiatement sans passer par les filtres structurés.
    - Priorité : Should
    - Complexité estimée : S
    - Dépendances : US-005 (tableau), US-010 (filtres composables et facettes), US-011 (état dans l'URL)

## 3. Règles de Gestion

- **RG-026-01** — Emplacement : un champ texte permanent dans la barre de filtres (zone 4 du §4.1), placé après le
  séparateur qui suit les chips « Drafts »/« Mes MRs » et avant les pastilles de filtres composables. Ce n'est
  **pas** une pastille : il est toujours visible, ne s'ajoute pas via « + Ajouter un filtre » et ne se retire pas
  par une croix de pastille. Placeholder : « Rechercher un titre… ».
- **RG-026-02** — Portée : la recherche porte sur le **titre** de la MR (`title`). Elle ne porte ni sur la
  description, ni sur les commentaires, ni sur le nom de branche (non synchronisés — voir §7).
- **RG-026-03** — Correspondance multi-termes : la saisie est découpée sur les espaces ; **tous** les termes
  doivent être présents dans le titre (ET), dans n'importe quel ordre. Exemple : `refonte fact` retient
  « Refonte de la facturation ». Aucune recherche floue, aucune expression régulière, aucun opérateur (guillemets,
  `-exclusion`, `OR`) : les caractères spéciaux sont traités comme du texte ordinaire.
- **RG-026-04** — Insensibilité casse/accents : la comparaison est insensible à la casse **et** aux accents, des
  deux côtés (saisie et titre) — `refacto` retient « Réfacto », `RÉFACTO` aussi. Normalisation Unicode NFD avec
  suppression des diacritiques, sans autre translittération.
- **RG-026-05** — Recherche par numéro : si la saisie (après trim) correspond à `!42`, `#42` ou `42` (chiffres
  uniquement, préfixe `!` ou `#` optionnel), une MR est **aussi** retenue si son `iid` est exactement ce nombre —
  en **OU** avec la correspondance de titre (une MR dont le titre contient « 42 » reste retenue). Le préfixe ne
  restreint pas la forge : `!42` et `#42` se comportent identiquement, quelle que soit la forge de la MR.
- **RG-026-06** — Combinaison : la recherche se combine en **ET** avec tous les autres filtres (RG-G14) — filtres
  rapides (Drafts, Mes MRs) et composables. Elle s'applique aux MRs Ready **et** aux drafts affichés, sans
  modifier le tri (RG-G10) ni l'ordre des blocs Ready/Drafts.
- **RG-026-07** — Compteurs : la recherche est prise en compte dans les compteurs contextuels des menus de filtre
  (RG-G19) et dans le compteur global « N MRs · M projets » (RG-G20), exactement comme un filtre composable.
- **RG-026-08** — Normalisation de la saisie : les espaces de bordure sont ignorés ; une suite d'espaces internes
  vaut un seul séparateur ; une saisie vide (ou uniquement des espaces) équivaut à « pas de recherche » et
  n'exclut rien. La saisie est bornée à **100 caractères** (au-delà, la frappe est simplement ignorée).
- **RG-026-09** — Réactivité : la recherche est appliquée avec un délai anti-rebond de **300 ms** après la dernière
  frappe — jamais une requête par caractère. Une saisie qui redevient vide déclenche immédiatement le
  rechargement sans recherche.
- **RG-026-10** — URL : la recherche est reflétée dans l'URL (RG-G15) sous le paramètre `q`, et restaurée au
  chargement. Paramètre **absent** quand la recherche est vide (l'encodage reste l'inverse exact du décodage,
  RG-011-08). La valeur est encodée telle que saisie (espaces compris).
- **RG-026-11** — Effacement : le bouton « Effacer » de la barre de filtres (RG-009-05, RG-010-11) vide **aussi**
  la recherche, au même titre que « Mes MRs » et les pastilles. Une croix dans le champ lui-même le vide seul,
  sans toucher aux autres filtres. Le bouton « Effacer » reste visible dès qu'une recherche est saisie, même sans
  autre filtre actif.
- **RG-026-12** — État vide : si aucune MR ne correspond, l'état vide existant est réutilisé sans modification
  (« Aucune MR ne correspond aux filtres. » + bouton « Effacer les filtres »), le champ de recherche restant
  visible et rempli.
- **RG-026-13** — Robustesse : une valeur `q` restaurée depuis l'URL n'est jamais rejetée ni corrigée ; si elle ne
  correspond à rien, le tableau est simplement vide (même principe que RG-010-12 pour les valeurs de filtre
  inconnues).

## 4. Maquettes de référence

Aucune maquette de `docs/design/` ne couvre ce champ (nouveauté postérieure aux wireframes). Références
existantes : zone 4 (barre de filtres) des wireframes 1a/1b et du prototype — le champ s'y insère entre le
séparateur et les pastilles, dans le style des champs de recherche déjà présents dans les menus de filtre
(`.menu-search`, US-010, RG-010-05 : `mat-form-field` `appearance="outline"`, `subscriptSizing="dynamic"`), avec
la même typographie et aucun arrondi (design system).

## 5. Critères d'Acceptation

```gherkin
Scenario: Filtrer le tableau sur un mot du titre
  Given des MRs intitulées "Refonte de la facturation" et "Correctif export CSV"
  When je saisis "facturation" dans le champ de recherche
  Then seule la MR "Refonte de la facturation" reste affichée
  And le compteur global reflète ce nombre de MRs

Scenario: Recherche multi-termes dans le désordre
  Given une MR intitulée "Refonte de la facturation"
  When je saisis "fact refonte"
  Then la MR "Refonte de la facturation" reste affichée

Scenario: Recherche insensible à la casse et aux accents
  Given une MR intitulée "Réfacto du module Paiement"
  When je saisis "REFACTO paiement"
  Then la MR "Réfacto du module Paiement" reste affichée

Scenario: Recherche par numéro de MR
  Given une MR d'iid 42 intitulée "Correctif export CSV"
  When je saisis "!42"
  Then la MR d'iid 42 reste affichée

Scenario: La recherche se combine avec les autres filtres
  Given le filtre "Auteur : mdupont" est actif
  And mdupont a une MR "Refonte facturation" et kbenali une MR "Refonte export"
  When je saisis "refonte"
  Then seule la MR de mdupont reste affichée

Scenario: La recherche est prise en compte dans les compteurs des menus de filtre
  Given une recherche "facturation" est active
  When j'ouvre le menu du filtre "Projet"
  Then les compteurs affichés ne comptent que les MRs dont le titre contient "facturation"

Scenario: Aucun résultat
  Given des MRs affichées
  When je saisis "zzzzz"
  Then le tableau affiche "Aucune MR ne correspond aux filtres." et le bouton "Effacer les filtres"
  And le champ de recherche reste rempli avec "zzzzz"

Scenario: La recherche est propagée dans l'URL et restaurée
  Given je saisis "facturation"
  When je recharge la page avec l'URL courante
  Then le champ de recherche contient "facturation"
  And le tableau est filtré sur ce texte

Scenario: Le bouton Effacer vide aussi la recherche
  Given une recherche "facturation" et le filtre "Mes MRs" sont actifs
  When je clique sur "Effacer"
  Then le champ de recherche est vide, "Mes MRs" est désactivé et toutes les MRs réapparaissent

Scenario: Vider le champ seul ne touche pas aux autres filtres
  Given une recherche "facturation" et le filtre "Projet : api" sont actifs
  When je vide le champ de recherche
  Then le filtre "Projet : api" reste actif et ses MRs réapparaissent

Scenario: La recherche s'applique aussi aux drafts affichés
  Given les drafts sont affichés et une MR draft s'intitule "Brouillon facturation"
  When je saisis "facturation"
  Then la MR draft "Brouillon facturation" reste affichée, après le bloc des MRs Ready
```

## 6. Questions ouvertes

- **QO-026-01** : la recherche doit-elle aussi porter sur l'alias du projet, le nom de l'auteur ou le nom de
  branche ? *Hypothèse retenue* : non — titre + `iid` uniquement (RG-026-02/05) ; projet et auteur ont déjà leurs
  filtres dédiés, et le nom de branche n'est pas synchronisé.
- **QO-026-02** : faut-il surligner les termes trouvés dans le titre affiché ? *Hypothèse retenue* : non en v1
  (voir §7) — le titre est tronqué sur une ligne (RG-G11), un surlignage y serait peu lisible.
- **QO-026-03** : le délai anti-rebond de 300 ms convient-il, ou faut-il un déclenchement explicite (touche
  Entrée) ? *Hypothèse retenue* : 300 ms automatique, sans bouton ni validation (RG-026-09).
- **QO-026-04** : faut-il conserver un historique des recherches récentes (autocomplétion) ? *Hypothèse retenue* :
  non (voir §7).

## 7. Hors périmètre

- Recherche dans la description, les commentaires ou le nom de branche d'une MR — ces données ne sont pas
  synchronisées (RG-004-*).
- Opérateurs de recherche (guillemets pour une expression exacte, `-exclusion`, `OR`, jokers, expressions
  régulières) — RG-026-03.
- Surlignage des termes trouvés dans le tableau (QO-026-02).
- Historique/autocomplétion des recherches récentes (QO-026-04).
- Délégation de la recherche à l'API de la forge (recherche côté GitLab/GitHub) : la recherche porte uniquement
  sur les MRs déjà synchronisées localement.
- Recherche sur les écrans Paramètres (connexions, repos) — cette US ne concerne que le tableau.
