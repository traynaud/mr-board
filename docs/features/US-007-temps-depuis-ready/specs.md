# US-007 — Temps depuis Ready

## 1. Reformulation

Chaque MR Ready affiche depuis combien de jours elle attend une relecture, avec un code couleur vert / orange / rouge
qui s'aggrave avec le temps. Les drafts, qui n'ont pas de date Ready, affichent à la place leur ancienneté d'ouverture.

## 2. User Stories

- **US-007** : En tant qu'utilisateur, je veux voir depuis combien de temps une MR est prête à être relue, avec un code
  couleur, afin de prioriser les MRs qui stagnent.
    - Priorité : Must
    - Complexité estimée : M
    - Dépendances : US-005

## 3. Règles de gestion

- **RG-007-01** : Calcul selon RG-G04 côté backend (fonction pure `domain/ready-delay.calculator.ts`) à la lecture, avec l'heure courante injectée. Champs renvoyés : `readyAt`, `readyDays` (entier ≥ 0, `null` pour un draft), `readyLevel` (`green` / `orange` / `red`, `null` pour un draft).
- **RG-007-02** : Libellé : `readyDays = 0` → « aujourd'hui » ; sinon « N j ». Cellule : carré 8 px de la couleur du niveau + libellé en gras de la même couleur.
- **RG-007-03** : Seuils par défaut : vert si `readyDays ≤ 1`, orange si `2 ≤ readyDays ≤ 3`, rouge si `readyDays ≥ 4` (configurables en US-014).
- **RG-007-04** : Tooltip : « Prête depuis le JJ/MM/AAAA HH:mm » (date Ready locale).
- **RG-007-05** : Pour un draft, la cellule affiche « ouverte il y a N j » (ou « ouverte aujourd'hui ») en 12 px gris, sans couleur.
- **RG-007-06** : Mode jours ouvrés (option de US-014, désactivé par défaut) : `readyDays` compte uniquement les jours lundi→vendredi entre la date Ready et maintenant (une MR prête vendredi 17 h affiche « aujourd'hui » jusqu'à lundi inclus puis « 1 j » mardi).
- **RG-007-07** : Le libellé et la couleur sont recalculés au rechargement des données ; le frontend recharge la liste au minimum à chaque synchronisation et à chaque changement de jour (minuit local) pour éviter des délais figés.

## 4. Maquettes de référence

- Wireframes **1a** / **1b** — colonne « Depuis Ready » (`readyColor`, `readyLabel`, drafts « ouverte il y a 12 j »)
- Prototype — `readyColor`, `fmtDays`

## 5. Critères d'acceptation

```gherkin
Scenario Outline: Niveau selon le délai (jours calendaires)
  Given maintenant = 2026-09-11T10:00:00Z et une MR prête depuis <readyAt>
  When le délai est calculé
  Then readyDays = <jours> et readyLevel = <niveau>

  Examples:
    | readyAt              | jours | niveau |
    | 2026-09-11T08:00:00Z | 0     | green  |
    | 2026-09-10T09:00:00Z | 1     | green  |
    | 2026-09-09T09:00:00Z | 2     | orange |
    | 2026-09-08T09:00:00Z | 3     | orange |
    | 2026-09-07T09:00:00Z | 4     | red    |
    | 2026-09-01T09:00:00Z | 10    | red    |

Scenario: Libellés
  Given readyDays = 0
  Then la cellule affiche « aujourd'hui »
  Given readyDays = 6
  Then la cellule affiche « 6 j » en rouge

Scenario: Draft
  Given une MR draft ouverte il y a 12 jours
  Then la cellule affiche « ouverte il y a 12 j » en gris, sans pastille
  And readyDays et readyLevel sont null dans l'API

Scenario: Jours ouvrés
  Given l'option « jours ouvrés » est activée
  And maintenant = lundi 2026-09-14T10:00:00Z et une MR prête depuis vendredi 2026-09-11T17:00:00Z
  Then readyDays = 0 et le libellé « aujourd'hui »
  Given maintenant = mardi 2026-09-15T10:00:00Z
  Then readyDays = 1

Scenario: Tooltip
  Given une MR prête depuis le 2026-09-05T14:30:00Z
  When je survole la cellule
  Then le tooltip affiche « Prête depuis le 05/09/2026 16:30 » (heure locale Europe/Paris)

Scenario: Rechargement au changement de jour
  Given le tableau est ouvert avec une MR à « aujourd'hui »
  When minuit local passe
  Then la liste est rechargée et la MR affiche « 1 j »
```

## 6. Questions ouvertes

- QO-007-01 : Le calcul en jours entiers (`floor`) peut afficher « aujourd'hui » pour une MR prête depuis 23 h. Alternative : arrondir à l'heure la plus proche ou afficher « Nh » sous 24 h. Hypothèse : jours entiers, conforme à la spec.
- Voir QO-G03 (précision de la date Ready) et QO-G05 (jours fériés).

## 7. Hors périmètre

- Configuration des seuils et de l'option jours ouvrés (US-014)
- Affichage en heures
