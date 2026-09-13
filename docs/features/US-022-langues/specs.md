# US-022 — Support d'autres langues (anglais)

Version : 1.0 — 2026-09-13
Statut : proposition PO, à valider avant `/project:feature US-022`.

## 1. Reformulation

MR Board n'existe aujourd'hui qu'en français : le système i18n custom (`docs/tech/i18n.md`) charge un unique
dictionnaire `fr.json`. L'utilisateur veut pouvoir choisir la langue de l'interface dans les paramètres (section
« Divers »), via un groupe de boutons radio dans un premier temps, et disposer d'une traduction **anglaise complète**
de toute l'interface : tableau, filtres, paramètres, dialogs, toasts, infobulles, messages d'erreur, notifications
navigateur.

Le choix est une préférence persistée comme le thème (US-018) : enregistrée côté backend, exportable, remise à sa
valeur par défaut par « Réinitialiser », appliquée immédiatement en aperçu et sans « flash » de langue au chargement.
L'US pose le socle (paramètre `language`, chargement d'un dictionnaire par langue, formats de dates et de nombres
par langue) pour qu'ajouter une troisième langue se résume ensuite à un fichier JSON et une option de plus.

## 2. User Stories

- **US-022** : En tant qu'utilisateur, je veux choisir la langue de l'interface (français ou anglais) dans les
  paramètres, afin d'utiliser MR Board dans la langue de mon équipe.
    - Priorité : Should
    - Complexité estimée : M (mécanisme de changement de langue + traduction des 214 clés existantes + formats)
    - Dépendances : US-015 (export / import / réinitialisation), US-018 (même pattern de préférence : backend +
      cache `localStorage` + aperçu immédiat), TECH-002 (i18n custom)

## 3. Règles de gestion

### Préférence

- **RG-022-01** : Nouveau paramètre `language` ∈ {`fr`, `en`}, défaut `fr`. Persisté côté backend avec les autres
  paramètres (`GET`/`PUT /settings`, colonne `language`, migration TypeORM), inclus dans l'export / import
  (RG-015-03/04 ; `version` d'export inchangée : champ optionnel, absent = `fr`) et remis à `fr` par
  « Réinitialiser » (RG-015-05). Toute valeur hors de la liste est refusée (`400`, `class-validator`). La liste des
  langues supportées est **une constante unique** partagée par le backend (validation) et le frontend (options du
  contrôle, fichiers disponibles).
- **RG-022-02** : Contrôle dans la section `06 · Divers`, **juste sous le contrôle « Thème »** (RG-018-02), sous forme
  d'un `mat-radio-group` horizontal étiqueté « Langue » avec les options **« Français »** et **« English »**. Les
  libellés des options sont écrits dans **leur propre langue** (endonymes) et ne sont **pas** traduits : quel que
  soit l'état courant, un utilisateur reconnaît sa langue. Comme les autres champs, la valeur est enregistrée par le
  bouton global « Enregistrer ».
- **RG-022-03** : **Aperçu immédiat** (même règle que RG-018-03) : changer l'option applique la langue à toute
  l'application sans attendre « Enregistrer » (le dictionnaire cible est chargé si nécessaire ; pendant ce
  chargement — quelques dizaines de ms — l'interface reste dans la langue précédente, jamais vide ni en clés brutes).
  « Annuler » ou l'abandon des modifications (RG-001-07) restaure la langue enregistrée. Le formulaire est marqué
  modifié (RG-001-06). Le dialog « modifications non enregistrées » s'affiche dans la langue **en cours d'aperçu**.
- **RG-022-04** : **Aucun flash de langue** (même mécanisme que RG-018-05) : la langue enregistrée est recopiée dans
  `localStorage` (`mrboard.language.v1`) à chaque chargement des paramètres. Au démarrage, l'initialiseur i18n lit
  cette clé et charge directement `i18n/<langue>.json` avant le premier rendu. Si la clé est vide, invalide ou
  `localStorage` indisponible, l'application démarre en `fr`, puis s'aligne sur la valeur backend dès sa réception
  (rechargement du dictionnaire si différent). La valeur backend fait toujours autorité en cas d'écart.
- **RG-022-05** : **Pas de détection automatique** de la langue du navigateur (`navigator.language`) : la langue par
  défaut est `fr` tant que l'utilisateur n'a rien choisi (voir QO-022-01).

### Dictionnaires

- **RG-022-06** : Un fichier par langue dans `frontend/public/i18n/` : `fr.json` (existant, inchangé dans sa
  structure) et **`en.json`** (nouveau). Les deux fichiers ont **exactement le même ensemble de clés** et, pour chaque
  clé, **le même ensemble de paramètres `{{nom}}`**. Un test unitaire (et le script `npm run i18n:check` prévu par
  `docs/tech/i18n.md` §4) échoue si une clé ou un paramètre manque ou est en trop dans l'un des fichiers, ou si une
  valeur est vide.
- **RG-022-07** : **Repli** : si, malgré RG-022-06, une clé est absente du dictionnaire courant à l'exécution, la
  valeur de `fr.json` est utilisée (le dictionnaire `fr` reste chargé en mémoire comme référence) ; si elle est
  absente des deux, la clé elle-même est renvoyée et un avertissement est logué en dev (règle existante,
  `docs/tech/i18n.md` §4).
- **RG-022-08** : **Périmètre de la traduction anglaise** : la totalité des clés existantes (214 au 2026-09-13 —
  groupes `app`, `common`, `board.*`, `settings.*`, `errors.*`), y compris les `aria-label`, les infobulles, les
  placeholders, les textes de dialogs et de toasts, les messages d'erreur résolus depuis les codes backend
  (`errors.gitlab.*`, `errors.settings.*`, `errors.projects.*`, `identity.missing`…), le titre et le corps des
  notifications navigateur (RG-016-01), le libellé du badge d'onglet (RG-016-04, inchangé : « (N) MR Board »).
  Aucun texte visible ne doit rester en français quand `en` est actif : la QA parcourt chaque écran / état listé en
  RG-018-09 (même grille) dans les deux langues.
- **RG-022-09** : **Vocabulaire anglais de référence** (à respecter dans `en.json`, cohérent avec le glossaire du
  README §3) :

  | Français (fr.json)                         | Anglais (en.json)                            |
  |--------------------------------------------|----------------------------------------------|
  | Rafraîchir / Paramètres                    | Refresh / Settings                           |
  | Synchronisé il y a {{minutes}} min         | Synced {{minutes}} min ago                   |
  | Synchronisé à l'instant                    | Synced just now                              |
  | Synchronisation en cours…                  | Syncing…                                     |
  | Aucun jeton GitLab configuré.              | No GitLab token configured.                  |
  | Configurer                                 | Configure                                    |
  | Drafts / Mes MRs                           | Drafts / My MRs                              |
  | Ajouter un filtre / Effacer                | Add a filter / Clear                         |
  | Projet / Auteur / Affecté à                | Project / Author / Assigned to               |
  | Affecté à (Reviewer OU Affecté)            | Assigned to (Reviewer OR Assignee)           |
  | Approved / Commenté / Oui / Non / tous     | Approved / Commented / Yes / No / all        |
  | Rechercher…                                | Search…                                      |
  | {{mrs}} MR(s) · {{projects}} projet(s)     | {{mrs}} MR(s) · {{projects}} project(s)      |
  | Titre / Difficulté / Commentaires          | Title / Difficulty / Comments                |
  | Reviewer / Affecté                         | Reviewer / Assignee                          |
  | Statut / Depuis Ready / Ouverte / Date d'ouverture | Status / Since Ready / Opened / Opened on |
  | Colonnes                                   | Columns                                      |
  | Easy / Medium / Hard                       | Easy / Medium / Hard (inchangé)              |
  | {{files}} f · {{lines}} l                  | {{files}} f · {{lines}} l (inchangé)         |
  | aujourd'hui / {{days}} j                   | today / {{days}} d                           |
  | ouverte il y a {{days}} j / ouverte aujourd'hui | opened {{days}} d ago / opened today    |
  | Aucune MR ne correspond aux filtres.       | No MR matches the filters.                   |
  | Effacer les filtres                        | Clear filters                                |
  | Impossible de charger les MRs.             | Could not load MRs.                          |
  | La synchronisation a échoué.               | Sync failed.                                 |
  | Nobody                                     | Nobody (inchangé)                            |
  | Enregistrer / Annuler / OK                 | Save / Cancel / OK                           |
  | Moi / Connexion GitLab / Repos à scanner   | Me / GitLab connection / Repositories to scan |
  | Actualisation / Seuils / Divers            | Refresh / Thresholds / Miscellaneous         |
  | Nom d'utilisateur GitLab / Email (optionnel) | GitLab username / Email (optional)         |
  | détecté via le jeton / ne correspond pas au jeton / saisi manuellement | detected from the token / does not match the token / entered manually |
  | Tester la connexion                        | Test connection                              |
  | Thème · Système / Clair / Sombre           | Theme · System / Light / Dark                |
  | Langue (nouveau)                           | Language                                     |
  | Exporter la config (JSON) / Importer / Réinitialiser | Export config (JSON) / Import / Reset |
  | Valeurs par défaut restaurées (non enregistrées) | Defaults restored (not saved)          |
  | Fichier de configuration invalide          | Invalid configuration file                   |
  | Notifications bloquées par le navigateur   | Notifications blocked by the browser         |
  | Configurez votre identité dans les paramètres | Set up your identity in the settings      |

  Les termes produit déjà anglais en français (« MR », « Draft », « Ready », « Easy/Medium/Hard », « Approved »,
  « Nobody », « GitLab », « MR Board ») restent identiques. Les autres clés sont traduites dans le même registre
  (concis, sans point final sur les libellés courts, point final sur les phrases de toast / bandeau, comme en
  français). Le Dev complète le tableau ci-dessus pour l'ensemble des 214 clés ; la revue (`/project:review`)
  relit `en.json` intégralement.

### Formats et attributs

- **RG-022-10** : **Formats localisés** : les helpers de `shared/format/` deviennent dépendants de la langue courante
  (même implémentation manuelle, sans `Intl`, pour rester déterministes) :

  | Donnée                    | `fr` (existant)          | `en`                          | Où                                        |
  |---------------------------|--------------------------|-------------------------------|-------------------------------------------|
  | Date courte               | `13/09/2026`             | `2026-09-13`                  | colonne « Date d'ouverture » (RG-011-09)  |
  | Date-heure                | `13/09/2026 14:05`       | `2026-09-13 14:05`            | infobulle délai Ready (RG-007-04), statut de synchro |
  | Heure                     | `14:05`                  | `14:05` (inchangé, 24 h)      | infobulle « Prochaine synchro » (US-013)  |
  | Séparateur de milliers    | `1 240` (espace)         | `1,240` (virgule)             | méta difficulté `{{lines}}` (RG-006)      |

  Le format anglais des dates est **ISO `YYYY-MM-DD`** (non ambigu entre lecteurs britanniques et américains, voir
  QO-022-02).
- **RG-022-11** : L'attribut `lang` de `<html>` (aujourd'hui `fr` en dur dans `index.html`) reflète la langue
  effective (`fr` / `en`) dès le script de démarrage (RG-022-04) puis à chaque changement : lecteurs d'écran,
  césure, correcteur orthographique des champs de saisie. Le `<title>` reste « MR Board » (nom du produit).
- **RG-022-12** : La langue courante est exposée par le `TranslateService` sous forme de **signal** (`language`), et
  le pipe `translate` **réagit au changement de langue** sans rechargement de page (aujourd'hui pipe pur : à faire
  évoluer par l'Architecte — pipe impur, ou pur avec dépendance au signal). Aucun composant ne lit `localStorage`
  ni ne charge un JSON directement.

### Invariants

- **RG-022-13** : **Ne changent pas avec la langue** : les query params de l'URL (RG-G15, `drafts`, `mine`, `sort`,
  `cols`…), les valeurs d'enum de l'API (`easy`, `green`, `mergeable`…), le nom du fichier d'export
  `mrboard-config.json`, les codes i18n renvoyés par le backend (le backend reste **agnostique** de la langue : il
  n'envoie que des codes, jamais de texte traduit — aucun `Accept-Language` n'est traité), le fichier
  `changelog.json` (non affiché dans l'interface, hors périmètre).
- **RG-022-14** : Les libellés provenant des données (titres de MR, noms d'utilisateurs, alias de projets, labels)
  sont affichés tels quels dans les deux langues.

## 4. Contrat API (extension de US-001 / US-015)

- `GET /api/v1/settings` et `PUT /api/v1/settings` renvoient `language: 'fr' | 'en'`.
- `PUT /api/v1/settings` accepte `language?: 'fr' | 'en'` (absent = inchangé ; autre valeur → `400`).
- `GET /settings/export` inclut `settings.language` ; `POST /settings/import` l'accepte (optionnel, défaut `fr`,
  valeur invalide → fichier rejeté comme pour tout champ invalide, RG-015-04).

## 5. Maquettes de référence

- Wireframe **1c** et prototype — section `06 · Divers`, contrôle « Thème » (`mat-radio-group` horizontal, RG-018-02) :
  le contrôle « Langue » reprend **exactement ce pattern visuel** (libellé à gauche en `neutral-700` 12 px, options
  radio en ligne) et se place immédiatement sous « Thème ».
- Wireframe sombre **1c** — même emplacement.

> ⚠️ **Écart avec les maquettes** : aucun wireframe ni prototype ne montre le contrôle « Langue » ni l'interface en
> anglais. Le contrôle est spécifié par analogie stricte avec « Thème » (même composant, même section, même
> comportement d'aperçu) ; aucune autre zone de l'interface ne change de disposition. Les libellés anglais plus
> longs que leurs équivalents français (ex. « Assigned to (Reviewer OR Assignee) ») doivent tenir dans les largeurs
> existantes des colonnes (US-012) et des menus : à vérifier en QA, sans nouvelle maquette.

## 6. Critères d'acceptation

```gherkin
Scenario: Valeur par défaut
  Given aucun paramètre language n'a jamais été enregistré
  When j'ouvre /settings
  Then l'option « Français » est sélectionnée sous « Langue », juste sous « Thème »
  And GET /api/v1/settings renvoie language = "fr"
  And l'interface est en français

Scenario: Passer en anglais avec aperçu immédiat
  Given je suis sur /settings en français
  When je sélectionne « English »
  Then toute la page Paramètres passe en anglais sans rechargement (titre « Settings », boutons « Save » / « Cancel », titres de sections « Me », « GitLab connection »…)
  And les options du contrôle restent « Français » et « English »
  And le bouton « Save » est activé
  When je clique sur « Save »
  Then PUT /api/v1/settings contient language = "en"
  And localStorage["mrboard.language.v1"] vaut "en"
  And html porte lang="en"

Scenario: Annuler l'aperçu
  Given la langue enregistrée est « Français » et j'ai sélectionné « English » sans enregistrer
  When je clique sur « Cancel » et je confirme l'abandon dans le dialog (affiché en anglais)
  Then l'application revient en français

Scenario: Tableau en anglais
  Given language = "en"
  When j'ouvre le tableau
  Then la toolbar affiche « Refresh », « Settings », « Synced 2 min ago »
  And les chips affichent « Drafts » et « My MRs »
  And les colonnes affichent « Project », « Author », « Title », « Difficulty », « Comments », « Reviewer », « Assignee », « Approved », « Status », « Since Ready »
  And le compteur affiche « 7 MR(s) · 2 project(s) »
  And les délais affichent « today » / « 3 d »
  And le pied de page est en anglais

Scenario: Menus de filtres et état vide en anglais
  Given language = "en"
  When j'ouvre « Add a filter » puis le menu « Assigned to »
  Then les options « Nobody », « all », le champ « Search… » et les compteurs sont affichés
  When aucun résultat ne correspond
  Then « No MR matches the filters. » et « Clear filters » sont affichés

Scenario: Erreurs backend traduites
  Given language = "en" et le jeton GitLab est invalide
  When une synchronisation échoue avec le code errors.gitlab.auth
  Then le toast affiche le message anglais correspondant (jamais le code brut, jamais le texte français)

Scenario: Notification navigateur en anglais
  Given language = "en" et notifyAssigned = true
  When une MR m'est nouvellement affectée
  Then la notification est émise avec un titre et un corps anglais

Scenario: Formats localisés
  Given language = "en", une MR ouverte le 13/09/2026 et 1240 lignes modifiées, colonne « Opened on » visible
  Then la date est affichée « 2026-09-13 » et la méta difficulté « 1,240 l »
  Given language = "fr"
  Then la date est affichée « 13/09/2026 » et la méta « 1 240 l »

Scenario: Aucun flash de langue au chargement
  Given language = "en" est enregistré et présent dans localStorage
  When je recharge la page
  Then le premier rendu est déjà en anglais (aucune image français → anglais)
  And html porte lang="en" avant le premier rendu

Scenario: localStorage vide
  Given language = "en" est enregistré côté backend mais localStorage est vide
  When je recharge la page
  Then l'application démarre en français puis passe en anglais dès la réception des paramètres
  And localStorage est mis à jour

Scenario: Export / import
  When j'exporte la configuration
  Then le fichier contient settings.language
  When j'importe un fichier sans champ language
  Then language vaut "fr"
  When j'importe un fichier avec language = "de"
  Then le fichier est rejeté (« Fichier de configuration invalide ») et rien n'est modifié

Scenario: Réinitialiser
  Given language = "en"
  When je clique sur « Reset »
  Then l'option « Français » est sélectionnée dans le formulaire (non enregistré) et l'aperçu repasse en français
  And le toast « Valeurs par défaut restaurées (non enregistrées) » s'affiche (en français, langue de l'aperçu courant)

Scenario: Valeur invalide
  When j'envoie PUT /api/v1/settings avec language = "de"
  Then l'API répond 400

Scenario: Parité des dictionnaires
  When j'exécute les tests unitaires du frontend
  Then un test vérifie que fr.json et en.json ont le même ensemble de clés, les mêmes paramètres {{…}} par clé et aucune valeur vide
  And il échoue si une clé est ajoutée dans un seul des deux fichiers

Scenario: Repli sur le français
  Given en.json ne contient pas la clé board.filters.count (cas de test forcé)
  When l'interface est en anglais
  Then le compteur est affiché avec la valeur française de la clé et un avertissement est logué en dev

Scenario: Invariants
  Given language = "en"
  Then l'URL du tableau contient toujours drafts=1, mine=1, sort=… (inchangés)
  And l'export télécharge toujours mrboard-config.json
  And le titre de l'onglet reste « MR Board » / « (N) MR Board »
```

## 7. Questions ouvertes

- **QO-022-01** : Faut-il, au tout premier lancement (aucune préférence enregistrée), pré-sélectionner la langue à
  partir de `navigator.language` ? Hypothèse : **non** (RG-022-05), défaut `fr` explicite — l'instance est
  mono-utilisateur (RG-G18) et le choix se fait une fois pour toutes ; à reconsidérer si QO-G01 bascule en instance
  partagée (la langue deviendrait alors une préférence par navigateur, comme le thème, cf. QO-G09).
- **QO-022-02** : Format de date anglais : ISO `YYYY-MM-DD` (hypothèse RG-022-10) ou `MM/DD/YYYY` (US) ou
  `DD/MM/YYYY` (UK, identique au français) ? Hypothèse : ISO, non ambigu.
- **QO-022-03** : Le contrôle est un groupe de radios « dans un premier temps ». À partir de combien de langues
  passe-t-on à un `mat-select` ? Hypothèse : au-delà de 3 langues ; hors périmètre ici.
- **QO-022-04** : Le `changelog.json` (entrées en français, non affiché aujourd'hui dans l'interface) doit-il être
  traduit ? Hypothèse : non, hors périmètre (RG-022-13) tant qu'il n'est pas affiché.
- **QO-022-05** : Faut-il un toast de confirmation après enregistrement de la langue ? Hypothèse : non, même
  raisonnement que QO-018-05 (l'application immédiate est son propre feedback) ; le toast générique d'enregistrement
  des paramètres, s'il existe, s'affiche dans la nouvelle langue.

## 8. Hors périmètre

- Toute langue autre que le français et l'anglais (l'ajout ultérieur = un fichier `xx.json` + une entrée dans la
  constante des langues supportées + une option radio, sans autre changement de code)
- Détection automatique de la langue du navigateur (QO-022-01)
- Traduction des données provenant de GitLab (titres, labels, noms) et du `changelog.json`
- Localisation côté backend (`Accept-Language`, messages traduits par l'API)
- Pluralisation avancée (ICU) : les libellés conservent la forme « MR(s) » / « project(s) » dans les deux langues
- Bascule rapide de langue dans la toolbar (contrairement au thème, RG-018-12) : le changement de langue est rare
