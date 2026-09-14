# US-028 — Labels dans le tableau : colonne et filtre

## 1. Reformulation

Les labels des MRs sont **déjà synchronisés et stockés** par MR Board (GitLab `labels.title`, GitHub
`labels.name`), mais ils ne servent aujourd'hui qu'à **masquer** des MRs via les « labels ignorés » des
Paramètres (RG-015-02) : ils ne sont ni affichés, ni filtrables. On veut les exposer dans le tableau — une colonne
optionnelle « Labels » — et pouvoir filtrer dessus comme sur un projet ou un auteur, pour trier son travail selon
les conventions de l'équipe (`bug`, `urgent`, `techdebt`, `needs-design`…).

## 2. User Story

- **US-028** : En tant que membre d'une équipe qui étiquette ses MRs, je veux voir les labels d'une MR dans le
  tableau et pouvoir filtrer sur un ou plusieurs labels, afin de repérer et traiter les MRs par catégorie sans
  retourner dans l'interface de la forge.
    - Priorité : Should
    - Complexité estimée : M
    - Dépendances : US-005 (tableau), US-010 (filtres composables et facettes), US-011 (colonnes optionnelles et
      URL), US-012 (colonnes redimensionnables), US-015 (labels ignorés)

## 3. Règles de Gestion

### Données

- **RG-028-01** — Exposition : l'attribut `labels` (liste de chaînes, déjà persistée en base) est ajouté au DTO de
  MR renvoyé par l'API, dans l'ordre fourni par la forge. Aucune resynchronisation n'est nécessaire : les labels
  sont déjà stockés pour toutes les MRs synchronisées depuis US-004 (GitLab) et US-020 (GitHub).
- **RG-028-02** — Valeur : un label est le **libellé brut** de la forge (`title` GitLab, `name` GitHub), y compris
  les labels scopés GitLab (`priorité::haute`) qui restent des chaînes opaques, sans traitement particulier.
- **RG-028-03** — Plafond de synchronisation : côté GitHub, la requête est plafonnée à 50 labels par PR (limite
  existante de la requête GraphQL, hors périmètre de cette US) ; au-delà, les labels excédentaires sont absents,
  et cette US ne cherche pas à les récupérer.
- **RG-028-04** — Labels ignorés : les MRs portant un label ignoré (RG-015-02) restent **entièrement masquées** ;
  par conséquent ces labels n'apparaissent ni dans la colonne, ni dans les options du filtre. La liste des labels
  ignorés reste gérée dans les Paramètres (section « Divers »), sans changement.

### Colonne « Labels »

- **RG-028-05** — Colonne optionnelle : une colonne « Labels » est ajoutée au tableau, **masquée par défaut**,
  activable via le menu « Colonnes » du tableau, exactement comme « Date d'ouverture » (RG-011-09/10/11). Sa
  visibilité est reflétée dans le paramètre d'URL `cols` sous le jeton `labels` (RG-011-11), et restaurée au
  chargement.
- **RG-028-06** — Position : entre « Titre » et « Difficulté ».
- **RG-028-07** — Rendu : chaque label est un jeton neutre (style `.tag.tag-neutral` du design system, aucun
  arrondi). Au-delà de **2 labels**, seuls les 2 premiers sont affichés, suivis d'un jeton « +N » ; la liste
  complète est disponible en infobulle au survol de la cellule — même principe que les reviewers/assignés
  multiples (RG-G06).
- **RG-028-08** — Cellule vide : une MR sans label affiche un tiret `—` en `neutral-400`, comme les colonnes
  Reviewer/Affecté vides (RG-005-*).
- **RG-028-09** — Largeur : colonne redimensionnable (RG-012-01/02/03), largeur par défaut 160 px, mémorisée comme
  les autres (`localStorage`, RG-012-03) et réinitialisable (RG-012-04/05).
- **RG-028-10** — Couleurs : les couleurs de label définies sur la forge ne sont **pas** reprises en v1 (elles ne
  sont pas synchronisées) ; tous les jetons sont neutres. Voir QO-028-01.

### Filtre « Label »

- **RG-028-11** — Nouveau filtre composable : « Label » devient le **7ᵉ** filtre composable (après « Commenté »
  dans le menu « + Ajouter un filtre », RG-010-03), en multi-sélection, avec le même comportement que « Projet » /
  « Auteur » : OU entre les valeurs sélectionnées, ET avec les autres filtres (RG-G14).
- **RG-028-12** — Options et compteurs : les options sont les labels distincts portés par les MRs visibles, avec
  leur compteur contextuel calculé comme pour les autres filtres (RG-G19 : tous les autres filtres actifs
  appliqués, le filtre Label exclu). Options triées par ordre alphabétique croissant, insensible à la casse et aux
  accents. Le champ « Rechercher… » du menu apparaît au-delà de 6 options, comme pour les autres filtres
  (RG-010-05).
- **RG-028-13** — Option « Sans label » : une option `Sans label` est toujours proposée **en première position**
  du menu (comme « Nobody » pour « Affecté à », RG-010-05) ; sélectionnée, elle retient les MRs dont la liste de
  labels est vide. Elle se combine en OU avec les labels sélectionnés (« `bug` OU sans label »).
- **RG-028-14** — Correspondance : la comparaison d'un label sélectionné avec les labels d'une MR est **exacte**
  (sensible à la casse), comme pour les alias de projet et les noms d'utilisateur — deux labels ne différant que
  par la casse sont deux labels distincts sur la forge, donc deux options distinctes ici.
- **RG-028-15** — URL : le filtre est reflété dans l'URL sous `label=<csv>` (RG-G15, RG-011-01), avec la même
  sémantique que `project`/`author` : présence de la clé = pastille active, valeurs séparées par des virgules. Un
  label contenant une virgule ne peut pas être représenté — un tel label est donc **exclu des options** du filtre
  (il reste visible dans la colonne) ; ce cas est rare et documenté plutôt que contourné (même contrainte que les
  alias de projet, RG-003-04).
- **RG-028-16** — Réconciliation : une valeur de `label` restaurée depuis l'URL qui n'existe plus parmi les
  options est retirée silencieusement de la sélection au premier chargement des facettes (RG-010-09), comme pour
  les autres filtres multi-sélection.
- **RG-028-17** — Effacement : la pastille « Label » est retirée par sa croix (RG-010-04) et par le bouton
  « Effacer » (RG-010-11), comme les autres filtres composables.

## 4. Maquettes de référence

Aucune maquette de `docs/design/` ne couvre les labels (nouveauté postérieure aux wireframes). Références
existantes :
- zone 5 (tableau) des wireframes 1a/1b : la colonne « Labels » reprend la mécanique des colonnes optionnelles
  (« Statut », « Date d'ouverture ») et le style de jeton `.tag.tag-neutral` déjà utilisé par le tag Projet ;
- zone 4 (barre de filtres) : la pastille « Label » est strictement identique aux pastilles multi-sélection
  existantes (`FilterPillComponent`, cases à cocher + compteurs) ;
- le « +N » et son infobulle reprennent le traitement des reviewers/assignés multiples (RG-G06).

## 5. Critères d'Acceptation

```gherkin
Scenario: La colonne Labels est masquée par défaut
  Given des MRs portant des labels
  When j'ouvre le tableau sans paramètre d'URL
  Then la colonne "Labels" n'est pas affichée
  And le menu "Colonnes" propose une case "Labels" décochée

Scenario: Afficher la colonne Labels
  Given la colonne "Labels" est masquée
  When je coche "Labels" dans le menu "Colonnes"
  Then la colonne apparaît entre "Titre" et "Difficulté"
  And l'URL contient le jeton "labels" dans le paramètre cols

Scenario: Afficher les labels d'une MR
  Given une MR portant les labels "bug" et "urgent"
  And la colonne "Labels" est affichée
  Then la cellule affiche les jetons "bug" et "urgent"

Scenario: Tronquer au-delà de deux labels
  Given une MR portant les labels "bug", "urgent", "backend", "v2"
  And la colonne "Labels" est affichée
  Then la cellule affiche "bug", "urgent" et un jeton "+2"
  And l'infobulle de la cellule liste les 4 labels

Scenario: MR sans label
  Given une MR sans aucun label
  And la colonne "Labels" est affichée
  Then la cellule affiche un tiret

Scenario: Filtrer sur un label
  Given des MRs dont 3 portent le label "bug"
  When j'ajoute le filtre "Label" et je sélectionne "bug"
  Then seules les 3 MRs portant "bug" restent affichées
  And le compteur global indique 3 MRs

Scenario: Filtrer sur plusieurs labels combine en OU
  Given 3 MRs portent "bug" et 2 autres portent "urgent"
  When je sélectionne "bug" et "urgent" dans le filtre "Label"
  Then les 5 MRs sont affichées

Scenario: Le filtre Label se combine en ET avec les autres filtres
  Given le filtre "Projet : api" est actif
  When je sélectionne le label "bug"
  Then seules les MRs du projet "api" portant le label "bug" sont affichées

Scenario: Option "Sans label"
  Given 2 MRs sans aucun label et 5 MRs étiquetées
  When je sélectionne "Sans label" dans le filtre "Label"
  Then seules les 2 MRs sans label sont affichées

Scenario: Les compteurs du menu Label sont contextuels
  Given le filtre "Auteur : mdupont" est actif
  When j'ouvre le menu du filtre "Label"
  Then chaque compteur ne compte que les MRs de mdupont portant ce label

Scenario: Les labels ignorés n'apparaissent jamais
  Given le label "wip" est configuré comme label ignoré dans les Paramètres
  And une MR porte les labels "wip" et "backend"
  When je consulte le tableau et le menu du filtre "Label"
  Then cette MR n'est pas affichée
  And "wip" n'apparaît pas dans les options du filtre

Scenario: Le filtre Label est propagé dans l'URL et restauré
  Given le filtre "Label : bug" est actif
  When je recharge la page avec l'URL courante
  Then la pastille "Label : bug" est de nouveau active et le tableau est filtré

Scenario: Un label disparu est retiré silencieusement de la sélection
  Given une URL contenant "label=obsolete" alors qu'aucune MR ne porte ce label
  When le tableau se charge
  Then la pastille "Label" est affichée sans valeur sélectionnée
  And aucune MR n'est exclue par ce filtre

Scenario: La colonne Labels est redimensionnable
  Given la colonne "Labels" est affichée
  When je fais glisser sa poignée de redimensionnement
  Then sa largeur change et est mémorisée après rechargement
```

## 6. Questions ouvertes

- **QO-028-01** : faut-il synchroniser et afficher la **couleur** des labels définie sur la forge (GitLab `color`,
  GitHub `color`) ? *Hypothèse retenue* : non en v1 (RG-028-10) — cela demande de modifier les requêtes GraphQL,
  le schéma de stockage et la gestion du contraste sur les deux thèmes ; à traiter dans une US dédiée si le
  besoin se confirme.
- **QO-028-02** : un clic sur un jeton de label dans le tableau doit-il activer directement le filtre sur ce
  label ? *Hypothèse retenue* : non en v1 (voir §7) — la cellule reste purement informative, comme le tag Projet.
- **QO-028-03** : le seuil de 2 labels affichés avant le « +N » est-il le bon ? *Hypothèse retenue* : 2
  (RG-028-07), aligné sur la largeur par défaut de 160 px ; ajustable sans impact structurel.
- **QO-028-04** : la colonne doit-elle être visible par défaut ? *Hypothèse retenue* : non (RG-028-05) — toutes
  les équipes n'utilisent pas les labels, et le tableau est déjà dense ; « Statut » est la seule colonne
  optionnelle visible par défaut.
- **QO-028-05** : faut-il un filtre d'**exclusion** (« tout sauf `wip` ») en plus de l'inclusion ? *Hypothèse
  retenue* : non — le besoin d'exclusion permanente est déjà couvert par les labels ignorés (RG-015-02).

## 7. Hors périmètre

- Couleurs des labels reprises de la forge (QO-028-01).
- Clic sur un label pour filtrer (QO-028-02).
- Filtre d'exclusion par label (QO-028-05) — couvert par les labels ignorés pour le cas d'usage permanent.
- Écriture sur la forge : ajouter ou retirer un label sur une MR depuis MR Board (non-objectif « lecture seule »).
- Labels scopés GitLab (`clé::valeur`) traités comme des groupes exclusifs — ils restent des chaînes opaques
  (RG-028-02).
- Récupération des labels au-delà du plafond GraphQL GitHub de 50 par PR (RG-028-03).
- Gestion des labels dans les Paramètres (renommage, regroupement, alias) — seule la liste des labels ignorés
  existe, inchangée.
