# US-043 — Surbrillance des MRs nouvelles ou modifiées dans le tableau

> S'appuie sur le journal d'historique (US-033 → US-037) et sur l'état « vu / à traiter » des événements (US-039).

## 1. Reformulation

Dans le tableau principal, une MR **nouvelle** (apparue depuis que je l'ai vue) ou **modifiée** (un changement a été
détecté depuis) est mise en surbrillance, avec une teinte légèrement différente dans les deux cas. La surbrillance
disparaît quand je survole la MR avec la souris. Une option des Paramètres permet de la désactiver pour garder une
interface sobre.

Lecture retenue : « nouvelle / modifiée » = la MR a des **événements du journal non vus** (`created` → nouvelle, tout
autre type → modifiée). C'est la seule lecture qui s'appuie sur les événements comme demandé ; elle partage l'état
« vu » des notifications (US-039).

## 2. User Story

- **US-043** : En tant que membre de l'équipe, je veux repérer d'un coup d'œil dans le tableau les MRs nouvelles ou
  modifiées depuis ma dernière visite, afin de savoir où regarder en premier.
  - Priorité : Should — Complexité : M — Dépendances : US-004, US-033, US-039, US-015

## 3. Règles de Gestion

- **RG-043-01** — **Nouvelle** : la MR a au moins un événement `created` non vu. **Modifiée** : elle a au moins un
  événement non vu, aucun n'étant `created`. Sinon : aucune surbrillance. « Nouvelle » prime sur « modifiée »
  (une MR créée puis modifiée reste « nouvelle »).
- **RG-043-02** — Tous les types d'événements du catalogue (RG-033-03) comptent, commentaires compris. Les préférences
  de notification (types masqués, « seulement mes MRs », « exclure mes actions », US-041) ne s'appliquent **pas** : la
  surbrillance dépend uniquement de l'état « vu » des événements.
- **RG-043-03** — Une MR n'est jamais mise en surbrillance par un événement antérieur à l'activation du journal : la
  baseline (RG-033-05) et la migration d'US-039 (événements existants marqués vus) s'appliquent telles quelles.
- **RG-043-04** — **Survol** : maintenir le pointeur sur la ligne d'une MR en surbrillance pendant **500 ms** ✅ hypothèse
  (évite d'effacer en traversant le tableau) la marque **vue** : la surbrillance s'efface immédiatement (fondu), tous
  ses événements non vus passent à « vu » côté serveur, et le compteur de notifications est mis à jour. Quitter la
  ligne avant 500 ms n'a aucun effet. ✅ Hypothèse : le **focus clavier** dans la ligne pendant 500 ms produit le même effet
  (accessibilité : sans souris, la surbrillance reste effaçable).
- **RG-043-05** — Partage de l'état « vu » : voir une MR par survol ferme ses notifications ; fermer une notification (ou
  « Tout marquer comme vu ») retire la surbrillance de la MR concernée si elle n'a plus d'événement non vu. L'état est
  celui du serveur : il est commun à tous les navigateurs de l'instance (comme US-039).
- **RG-043-06** — La surbrillance est calculée à chaque chargement du tableau (ouverture, rafraîchissement, synchro) : une
  MR modifiée par une synchro devient surlignée sans action de l'utilisateur.
- **RG-043-07** — **Paramètre** « Surligner les MRs nouvelles ou modifiées » (`highlightChanges`) dans Paramètres,
  section « Interface » ; **activé par défaut** ✅ hypothèse. Désactivé : aucune surbrillance et le survol ne marque
  rien comme vu. Il fait partie de l'export / import de la configuration (RG-015-*) et de la réinitialisation (retour
  à « activé »).
- **RG-043-08** — Accessibilité : la surbrillance ne repose pas que sur la couleur : un libellé accessible
  (« Nouvelle » / « Modifiée ») est exposé aux lecteurs d'écran sur la ligne, et une infobulle de survol n'est pas
  requise. Les couleurs respectent le thème clair et sombre.
- **RG-043-09** — Les filtres, le tri et les compteurs du tableau ne changent pas : la surbrillance est purement visuelle.
- **RG-043-10** — Une MR survolée qui ne se trouve plus dans la liste ou dont le marquage échoue (erreur réseau) : la
  surbrillance est restaurée à l'écran, sans message bloquant (échec silencieux, nouvelle tentative au prochain survol).

## 4. Maquettes de référence
Tableau principal (`docs/design/`, wireframe 1) : ajout d'une teinte de fond de ligne et d'un filet gauche de 2 px ;
aucun nouveau composant. Case à cocher dans la section « Interface » des Paramètres (pattern existant, comme
« Surligner mes MRs »).

## 5. Critères d'Acceptation

```gherkin
Scenario: MR nouvelle
  Given la MR !12 a un événement created non vu
  When j'ouvre le tableau
  Then la ligne de !12 est en surbrillance « nouvelle »

Scenario: MR modifiée
  Given la MR !13 a un événement title_changed non vu et aucun created non vu
  Then la ligne de !13 est en surbrillance « modifiée », d'une teinte différente de « nouvelle »

Scenario: Nouvelle puis modifiée
  Given la MR !12 a un created et un approved non vus
  Then sa surbrillance est « nouvelle »

Scenario: Aucun événement non vu
  Given la MR !14 n'a que des événements vus
  Then sa ligne n'est pas en surbrillance

Scenario: Survol prolongé
  Given !12 est en surbrillance
  When je survole sa ligne pendant 500 ms
  Then la surbrillance disparaît
  And ses événements sont vus côté serveur
  And le compteur de la cloche diminue d'autant

Scenario: Survol bref
  When je traverse la ligne en moins de 500 ms
  Then la surbrillance reste

Scenario: Surbrillance conservée après rechargement tant que non survolée
  Given !12 est en surbrillance et que je ne l'ai pas survolée
  When je recharge la page
  Then !12 est toujours en surbrillance

Scenario: Fermeture d'une notification
  Given !12 est en surbrillance à cause d'un seul événement non vu
  When je ferme cette notification dans le panneau
  Then !12 n'est plus en surbrillance au prochain chargement du tableau

Scenario: Préférences de notification sans effet
  Given le type « Commentée » est décoché dans les notifications
  And !15 a un événement commented non vu
  Then !15 est en surbrillance « modifiée »

Scenario: Désactivation
  Given l'option « Surligner les MRs nouvelles ou modifiées » est décochée
  Then aucune ligne n'est en surbrillance
  And survoler une ligne ne marque aucun événement comme vu

Scenario: Par défaut
  Given une installation neuve ou existante
  Then l'option est cochée

Scenario: Export / import
  When j'exporte puis importe la configuration
  Then la valeur de l'option est conservée

Scenario: Échec du marquage
  Given l'API de marquage répond une erreur
  When je survole !12 pendant 500 ms
  Then la surbrillance de !12 réapparaît
```

## 6. Décisions et points ouverts

#### 🛑 Bloquant — arbitrage humain requis
Aucun.

#### ✅ Hypothèses retenues (non bloquant, modifiable après coup)
- « Vu » = état des événements d'US-039, partagé avec les notifications → pas de second état à maintenir. Conséquence
  visible : survoler une MR ferme ses notifications.
- Survol de 500 ms avant effacement → évite les effacements accidentels ; réglable.
- Préférences de notification ignorées (RG-043-02) → la surbrillance est un repère visuel, pas une alerte.
- Activée par défaut → la fonction est utile dès l'installation ; décochable.
- Teintes : « nouvelle » en vert (`--color-success`), « modifiée » en ambre (`--color-warning`), filet gauche 2 px.

## 7. Hors périmètre
- Surbrillance dans l'Historique ou le panneau de notifications.
- Réglage de la durée de survol ou des couleurs.
- Surbrillance des MRs fermées / fusionnées (elles quittent le tableau).
- Animation d'attention (clignotement, pulsation).

## Décisions
### Prises en autonomie
- Voir §6 — réversible : oui
### Arbitrées par l'humain
- Aucune (autonomie totale demandée)
