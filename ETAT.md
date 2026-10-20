# État d'avancement — Application « Carnet »

*Dernière mise à jour : 17 octobre 2026*

> [!IMPORTANT]
> **Document de référence du projet :** Le cahier des charges et instructions intégrales du responsable sont enregistrés dans [MISSION.md](file:///C:/Users/pouro/Projets/Carnet/MISSION.md). Ce document fait foi pour toutes les étapes, règles de calcul, contraintes et choix techniques.


---

## 1. Où on en est

### Étape 1 : Initialisation & Choix de la Pile (Validée par le responsable)
- [x] Dossier créé hors de OneDrive : `C:\Users\pouro\Projets\Carnet\`
- [x] Dépôt Git initialisé
- [x] Choix technique validé : Vite + React SPA (PWA) justifié dans `CHOIX_PILE.md`
- [x] Structure en 5 modules étanches initialisée (squelettes de dossiers, points d'entrée et types publics créés ; la logique métier complète sera implémentée à l'Étape 3) :
  - `src/modules/personnes/`
  - `src/modules/mouvements/`
  - `src/modules/employes/`
  - `src/modules/pieces_jointes/`
  - `src/modules/synchronisation/`
- [x] Sauvegarde initiale par bundle Git réalisée et vérifiée : `Carnet.bundle`

### Étape 2 : Maquette cliquable complète (Terminée — Arrêt pour tests commerçants)
- [x] Migration vers Tailwind CSS 4 native (@tailwindcss/vite, suppression de PostCSS, Autoprefixer et tailwind.config.js) et composants officiels shadcn/ui style radix-nova (bloc `sidebar-03`, cartes, boutons, modales, badges, formulaires).
- [x] Jeu de données réalistes configuré pour une **Alimentation Générale** à Brazzaville (« Alimentation Générale La Grâce », Bacongo / Marché Total) avec 5 employés et des partenaires représentatifs.
- [x] **Tous les écrans interactifs créés et fonctionnels en local :**
  - **Démarrage & Connexion / PIN :** déverrouillage tactile par code PIN à 4 chiffres (PIN test : `1234`), option Google Auth et téléphone local.
  - **Accueil (Tableau de bord) :** 
    - 2 grandes cartes d'indicateurs géantes : « ON ME DOIT » en vert et « JE DOIS » en orange, avec la répartition partenaires / employés.
    - Carte avec anneau Recharts visualisant la part des créances et des dettes.
    - Section « À payer bientôt » (salaires échus des employés et échéances proches).
    - Section « Ils tardent à payer » (partenaires sans versement depuis plus de 30 jours).
  - **Liste des Personnes :** recherche instantanée, filtres (« Tout », « Me doivent », « Je leur dois », « Employés »), tri automatique par le plus gros montant en jeu.
  - **Fiche Partenaire (les deux sens) :**
    - Double compteur séparé (« Il me doit » et « Je lui dois »).
    - Phrase claire de solde net (« Au total, il vous doit X FCFA »).
    - 4 gros boutons tactiles (≥ 48 px) : « Il m'a versé », « Il a pris à crédit », « Je lui ai versé », « J'ai pris à crédit ».
    - Bouton « Compenser » pour la compensation manuelle bilatérale.
    - Listes des derniers versements reçus et faits, et historique complet non supprimable.
  - **Fiche Employé :**
    - Salaire convenu, échéance, compteurs « Ce que je lui dois » (salaire échu) et « Avance restante ».
    - 4 gros boutons tactiles : « Verser le salaire », « Donner une avance », « Il rembourse (direct) », « Assistant de départ ».
    - Historique des paies et versements.
  - **Modal de saisie rapide d'un mouvement :**
    - Pavé numérique géant tactile et boutons rapides (+1 000, +5 000, +10 000, +50 000 FCFA).
    - Sélection des sens avec les mots du commerçant.
    - Alerte explicite en cas de surplus par rapport à la dette existante avec bascule en avance.
    - Moyen de paiement : Espèces, MTN Mobile Money, Airtel Money (référence facultative).
    - Note et photo de reçu facultatives.
    - Recalcul immédiat des compteurs dans toute l'application.
  - **Assistant de départ d'un employé (en 2 étapes) :**
    - Étape 1 : Salaire de la période en cours (au prorata des jours travaillés, mois complet ou montant fixe).
    - Étape 2 : Avance restante (retenue par défaut sur le solde final, conservation en dette ou abandon avec note obligatoire).
    - Récapitulatif du net à payer et passage de l'employé en inactif (aucun salaire futur ne sera généré).
  - **Modal de compensation manuelle :** simulation bilatérale avant application, création des 2 mouvements liés.
  - **Détail d'un mouvement & Reçu partagé :**
    - Préparation du message formaté pour WhatsApp / SMS avec bouton de partage direct (`wa.me`) et copie dans le presse-papier.
    - Annulation d'un mouvement avec motif obligatoire (le mouvement reste visible, affiché barré, et les compteurs sont recalculés).
  - **Réglages :**
    - Nom du commerce et modification du code PIN.
    - Bascule thème sombre (sobre de référence) / thème clair (lisible en plein soleil).
    - Badge de synchronisation locale.
    - Exportation intégrale des données au format CSV.
    - Bouton de verrouillage immédiat de l'écran.
  - **Ergonomie & Navigation :**
    - Sur smartphone : barre inférieure à 4 onglets + gros bouton central « + ».
    - Sur tablette et ordinateur : barre latérale shadcn `sidebar-03` avec sous-menus et repli.
- [x] **Mesure réelle de la compilation de production (`npm run build`) :**
  - Fichier HTML : 0.45 kB (0.29 kB gzippé)
  - Fichier CSS : 84.16 kB (13.67 kB gzippé)
  - Fichier JavaScript : 714.95 kB (211.43 kB gzippé)
  - **Poids total transféré gzippé : ~225 kB**, compilation éclair en **1,17 s**, garantissant un démarrage instantané en moins de 2 secondes sur mobile 3G/Edge.

---

## 2. Prochaine action (Étape 3 : Fonctionnement réel en local)

*Arrêt prévu du travail : en attente des retours du responsable suite au test de la maquette auprès de 3 à 5 commerçants.*

Dès réception des retours et validation :
- Implémentation réelle de la base locale IndexedDB (via Dexie) au sein des 5 modules étanches.
- Calcul permanent des compteurs à partir des mouvements non annulés.
- Génération idempotente des salaires dus à date d'échéance.
- Tests unitaires complets de tous les calculs (prorata, retenues, compensations, annulations).
- Simulateur sur 6 mois (5 employés, 30 partenaires, 0 écart).

---

## 3. Décisions prises et choix appliqués

1. **Pile retenue :** Vite + React SPA (PWA) + Tailwind CSS + shadcn/ui (`sidebar-03`) + Recharts.
2. **Secteur des données fictives :** Alimentation générale (« Alimentation Générale La Grâce », Bacongo, Brazzaville).
3. **Code couleur constant :** Vert émeraude avec mention écrite pour « On me doit » / « Il me doit », Orange chaud avec mention écrite pour « Je dois » / « Je lui dois ».
4. **Compensation :** Uniquement manuelle via bouton dédié, jamais automatique.
5. **Départ employé :** Retenue de l'avance restante proposée et cochée par défaut sur le solde final.
6. **Preuve :** Historique inaltérable non supprimable (annulation tracée), pièces jointes archivées, reçus WhatsApp/SMS.
7. **Accès :** Code PIN à 4 chiffres hors ligne pour le quotidien, avec alternative Google/téléphone.

---

## Reprise de l'interface sur les modèles shadcn/ui (17/10/2026, faite par Claude dans claude.ai)

Motif : doublons d'affichage et fenêtres bricolées signalés par le propriétaire.

- Barre latérale : composant shadcn `Sidebar` (repliable en icônes), une seule entrée « Nouveau mouvement ».
- Téléphone : barre du bas à 4 onglets + un seul bouton « + ».
- Accueil : cartes d'indicateurs (section-cards) + anneau « Solde net » (chart-pie-donut-text) ; suppression du bloc « Répartition globale » qui répétait les chiffres.
- Fenêtres de saisie : panneau qui monte du bas sur téléphone (`Drawer`), fenêtre centrée sur ordinateur (modèle « responsive dialog »). Quand la personne et l'opération sont déjà connues, les étapes 1 et 2 sont remplacées par un résumé avec « Modifier ».
- Fiches partenaire et employé : chaque compteur porte ses propres boutons ; un seul historique filtrable (onglets Tout / Reçus / Versés / Crédits) remplace les blocs qui répétaient les mêmes lignes.
- Réglages : trois cartes simples ; suppression du message « Tout est sauvegardé » (faux sur des données d'exemple).
- Dépendance ajoutée : `vaul` (requis par le Drawer shadcn). Lancer `npm install` sur la machine.
- `drawer.tsx` et `chart.tsx` écrits à la main d'après la source officielle shadcn, car le registre shadcn n'était pas joignable. À resynchroniser plus tard avec `npx shadcn add drawer chart --overwrite`.

Vérifié : `npm run build` passe, aucune erreur dans la console du navigateur, captures téléphone (360 px) et ordinateur (1366 px) sur Accueil, Personnes, fiche partenaire, Employés, fiche employé, Réglages et fenêtre de saisie.

Reste à faire : écran de code PIN au format du bloc shadcn « login » ; pavé numérique et boutons de paiement de la fenêtre de saisie encore stylés à la main.

## Tableau de bord allégé (17/10/2026, Claude)

- En-tête : uniquement le nom de la page, plus les boutons thème et verrouillage (téléphone). Les titres répétés dans les pages sont retirés.
- Accueil : deux cartes côte à côte (On me doit / Je dois), deux anneaux de répartition (Qui me doit / À qui je dois) avec le nombre de personnes au centre, puis les listes « Salaires à payer » et « Ils tardent à payer ».
- Police : Urbanist (gratuite, Google Fonts) à la place de Geist. Lancer `npm install`.
- Le « solde net » n'est plus affiché sur l'accueil.

## Employés : vue d'ensemble (17/10/2026, Claude)

- Page Employés : deux onglets, « Liste » et « Vue d'ensemble ».
- Graphique « Salaires » en barres empilées : gris = versé, orange = reste dû. Filtre par année (mois par mois) ou « Tout » (année par année).
- Graphique « Avances » : barres horizontales, jours depuis le dernier remboursement par employé, le plus ancien en haut.
- DÉMONSTRATION : les mois passés sont fabriqués de façon fixe (src/data/payHistory.ts) ; le mois en cours suit l'état réel. À remplacer par le calcul à partir des opérations enregistrées.
- Nouveau champ `lastAdvanceRepaymentDate`, mis à jour à chaque remboursement ou retenue d'avance.
- Vue d'ensemble (suite) : choix d'un employé avec recherche (shadcn Combobox = Popover + Command, `cmdk` ajouté ; popover.tsx et command.tsx écrits d'après la source officielle, registre injoignable). « Total » à la place de « Versé ». Cartes Avances et Salaires dus : montant + jours, 5 premiers et « Voir plus » au-delà de 7. Nouveau champ `lastSalaryPaymentDate`. Lancer `npm install`.

## Personnes : vue d'ensemble (17/10/2026, Claude)

- Page Personnes : onglets « Liste » et « Vue d'ensemble », comme Employés (sans graphique).
- Cartes « Dernier versement reçu » (ceux qui me doivent) et « Dernier versement fait » (ceux à qui je dois) : total, nombre de personnes, montant et jours par personne, tri, « Voir plus ».
- Pièces communes extraites dans src/components/overview-parts.tsx (choix de personne avec recherche, carte des jours).
- Nouveau champ `lastPaidByMeDate` (mon dernier versement à une personne), mis à jour à chaque « Je lui ai versé ».
- Vues d'ensemble (suite) : listes limitées à 5 avec « Tout voir » puis « Retour » ; chaque carte bascule Liste / Graphique (anneau : répartition du montant par rôle). Liste Personnes sans montants (nom, rôle, numéro), nombre de personnes, ordre alphabétique. Rôles des personnes de démonstration raccourcis en catégories (Client, Fournisseur, Client et fournisseur, Revendeuse).
- Saisie (règle) : un versement ou un remboursement ne peut pas dépasser ce qui est dû (message « Pas plus de … », Enregistrer désactivé) ; bouton de versement grisé quand rien n'est dû. L'écran « Combien ? » affiche le compte concerné (Il me doit, Je lui dois, Salaire dû, Avance à rendre). L'ancienne règle « surplus gardé comme avance » est retirée.
- Règle (17/10/2026) : salaire toujours mensuel, dû à la fin du mois. Plus de jour de paie à saisir (champ retiré du formulaire Ajouter / Modifier un employé).
- Fenêtres (17/10/2026) : confirmation avant de fermer une fenêtre contenant une saisie non enregistrée (toucher à côté, glisser, Échap, croix). « Abandonner l'ajout ? » ou « Abandonner les modifications ? », boutons « Continuer la saisie » (mis en avant) / « Abandonner ». Réglé une seule fois dans src/components/ui/responsive-dialog.tsx (props `dirty`, `dirtyKind`) ; chaque fenêtre indique si elle est modifiée.

## Comptes depuis le tableau de bord (18/10/2026)
- Toucher « On me doit » ouvre « Leurs comptes », toucher « Je dois » ouvre « Mes comptes » (fil d'Ariane pour revenir).
- En haut, un choix Personnes / Employés. Leurs comptes : personnes qui me doivent, avances à rendre. Mes comptes : personnes à qui je dois, graphique des salaires et salaires dus.
- Toucher une ligne de légende sous un anneau ouvre directement le bon côté.
- Les onglets « Vue d'ensemble » des pages Personnes et Employés sont retirés : ces pages sont un simple carnet d'adresses.

## Retours, trop versé, annulations barrées (18/10/2026)
- Détail d'un crédit ou d'une dette : bouton « Retour » à côté de « Annuler ». Le retour de marchandise diminue le compte sans argent ni moyen de paiement ; le crédit affiche « dont X retournés » et le reste.
- Si une annulation ou un retour fait passer un compte sous zéro : « Il a trop versé de X » avec trois choix : « Je lui rends plus tard » (la différence passe dans l'autre compte), « Je lui ai déjà rendu » (dette inscrite et réglée aussitôt, pour l'historique), « Ne pas annuler / Ne pas faire le retour ». Même logique dans l'autre sens.
- Un crédit annulé emporte ses retours. Les opérations annulées restent visibles : montant barré en rouge, pastille « Annulé ».
- Onglet « Retours » dans l'historique d'une personne, seulement s'il y en a.
- Reste à faire : le reçu WhatsApp d'un crédit ou d'un retour parle encore de « versement ».

## Compensation, retour à la même position, recherche gardée, œil (18/10/2026)
- Compenser crée deux versements liés, motif « Compensation » : un dans Son compte, un dans Mon compte. Annuler l'un annule l'autre.
- Ouvrir une fiche puis revenir (fil d'Ariane) ramène exactement à la même position, avec la recherche, le tri et « Tout voir » conservés (la page reste montée sous la fiche).
- Bouton du menu (barre du bas ou latérale), même celui de la page actuelle : retour en haut.
- Recherche des listes : petite croix pour effacer. Vues « Leurs comptes / Mes comptes » : croix pour revenir à « Toutes les personnes », œil sur chaque ligne pour ouvrir la fiche.

## Détail en tableau d'un crédit ou d'une dette (19/10/2026)
- Option à côté de la note et de la photo : « Ajouter un détail ». Une carte par ligne, total en bas, puis « Confirmer ».
- Interrupteur « Calculer avec prix et quantité » : libellé, prix, quantité (total calculé) ; sinon libellé et total de la ligne.
- Avec un détail, le montant vient des lignes : le pavé laisse la place à la liste, avec « Modifier » ; « Supprimer le détail » rend le pavé.
- Le détail apparaît dans la fiche de l'opération et dans le reçu WhatsApp.
- Lignes du détail compactes (une rangée : libellé, prix × quantité ou total, poubelle ; total de ligne en petit dessous). Entrée passe au champ suivant ; sur le dernier champ, une nouvelle ligne s'ouvre. Les champs chiffrés se sélectionnent à l'entrée (taper 2 remplace le 1).

## Fiche d'une personne : trois onglets (19/10/2026)
- « Vue d'ensemble · Son compte · Mon compte » au même niveau ; l'onglet « Historique » et ses sous-onglets disparaissent (mot d'ordinateur, deux choix au lieu d'un).
- Toucher la carte « Son compte » ou « Mon compte » de la vue d'ensemble ouvre l'onglet correspondant (petite flèche sur la carte).
- Fenêtre « Quelle opération ? » (personne) : onglets « Son compte / Mon compte », un seul compte affiché à la fois avec ses deux boutons ; ouvert depuis un onglet de la fiche, le bon compte est déjà choisi.
- Icônes devant « Son compte » (↙ vert) et « Mon compte » (↗ orange) dans les onglets de la fiche et de la fenêtre ; sous 360 px, les icônes de la fiche s'effacent pour que les trois onglets tiennent.

## Fiche employé : Salaire et Avance (19/10/2026)
- Trois onglets : Vue d'ensemble · Salaire · Avance. Toucher une carte de la vue d'ensemble ouvre son onglet.
- Salaire : en haut, reste à payer et dernier versement ; pastilles « Mois » (tableau, une ligne par mois : Mois, Salaire de base, Ajouts, Retenues, À payer, Versé, Reste, État ; bouton « Colonnes ») et « Versements » (liste de tous les versements).
- Avance : en haut, reste à rendre, dernier remboursement, façon de rendre ; pastilles « Avances » (tableau : Date, Montant, Rendu, Reste, État, Note) et « Remboursements ».
- Versements et remboursements répartis du plus ancien au plus récent (data/payroll.ts : tout est calculé à partir des opérations).
- Fiche d'un mois : détail des lignes ; mois en cours seulement : ajouter au salaire, ajouter une retenue (motif, note, photo, détail en tableau), annuler une ligne (dont la retenue d'avance automatique), arrêter le mois (mois complet, prorata des jours, montant fixe), annuler le mois (motif). Si l'employé a déjà reçu trop : « Ça devient une avance à rendre » ou « Il l'a déjà rendu ». Mois passés, arrêtés ou annulés : scellés, on peut seulement les payer.
- Démonstration : la paie de chaque employé est reconstituée en opérations au démarrage (salaire de base mensuel, versements, avances et retenues).
- Reste à faire : « L'employé quitte la boutique » utilise encore l'ancienne fenêtre de départ (à rebrancher sur « Arrêter le mois ») ; la façon de rendre une avance (retenue par mois) n'est pas encore modifiable.
- Fiche d'un mois retravaillée : « Reste à payer » en grand avec barre versé / à payer, détail façon reçu (total « À payer » en bas), deux boutons « Ajout » / « Retenue », puis « Arrêter le mois · Annuler le mois » en discret. Toucher une ligne du mois en cours pour l'annuler.
- Retenue d'avance du mois : son montant se change pour ce mois seulement (plus ou moins, sans dépasser l'avance restante) ; la ligne affiche « au lieu de … ».
- Façon de rendre : ligne courte « Façon de rendre · 15 000 FCFA / mois » (ou « Direct »), modifiable avec le crayon (0 = direct) ; la retenue du mois en cours suit.
- Fiche d'un mois : sous le « Reste à payer » (sans texte « Versé … sur … »), deux lignes repliables comme une fiche de paie : « À payer » (salaire de base + ajouts) et « Retenues et versements » (retenue d'avance, retenues, versements). Un versement partagé entre deux mois n'affiche que la part du mois (« en partie »).
- Fiche d'un mois : crayon visible sur chaque ajout ou retenue du mois en cours pour la modifier ou l'annuler (plus de « touchez la ligne »).
- Fiche d'un mois : « Ajout » et « Retenue » s'ouvrent par-dessus et ramènent à la fiche du mois ; le crayon ouvre une petite fenêtre à part (retenue d'avance : montant plafonné à ce qu'il doit encore, avec message ; ou « Pas de retenue ce mois-ci » ; autres lignes : annulation avec motif). Les lignes ne s'ouvrent plus d'elles-mêmes.
- « Arrêter le mois » et « Annuler le mois » s'ouvrent chacun dans leur propre fenêtre ; la question du trop reçu s'affiche dans cette même fenêtre. La fiche du mois ne contient plus que le résumé, les deux lignes et les boutons.
- « Arrêter le mois » : trois choix empilés avec une phrase chacun (Montant complet, Selon les jours travaillés, Montant convenu), le champ utile s'ouvre sous le choix, puis « Il touchera pour ce mois ». Un versement annulé reste visible, barré, dans le mois qu'il payait.
- Mois arrêté ou annulé après des versements : chaque versement concerné reste visible dans le mois, barré, avec sa date, son moyen de paiement et ce qu'il est devenu (« Passé en avance à rendre » ou « Rendu »). Le trop reçu et l'avance qui en naît disent de quel mois il s'agit. Pas de moyen de paiement affiché pour ce qui n'est pas un paiement.

## 2026-10-19 — Retenue prévue et versements barrés
- La retenue d'avance du mois en cours reste « prévue » jusqu'à la clôture du mois : elle se modifie sur place, sans lignes annulées puis recréées.
- Onglet Avance : reste à rendre total, plus « dont X retenus ce mois-ci ».
- Salaire › Versements : un versement passé en avance ou rendu (mois arrêté ou annulé) est barré avec une pastille ; la ligne « Trop reçu » n'apparaît plus.

## 2026-10-19 — Retenue prévue : limitée à l'avance, visible dans le salaire
- La retenue prévue ne dépasse jamais l'avance à rendre (avance annulée ou soldée : plus de retenue, « dont » caché).
- Salaire : « Reste à payer » compte la retenue prévue, avec « dont X retenus pour l'avance ».
- Verser plus que salaire moins retenue est permis jusqu'au salaire entier : un avertissement dit de combien la retenue du mois baisse.
- À la clôture (mois arrêté), la retenue est inscrite pour ce qu'elle vaut vraiment.
- Reste à faire : au passage naturel au mois suivant, la retenue est comptée à son montant inscrit.

## 2026-10-19 — Fiche employé : bandeau « Avance déduite » retiré de la vue d'ensemble

## 2026-10-19 — Versement qui touche la retenue : alerte courte + fenêtre de confirmation (Continuer / Revenir)

## 2026-10-19 — Écran « kayé » au démarrage (moins d'une seconde, seulement à l'ouverture de l'app)

## 2026-10-19 — Logo Kayé enregistré dans logo/ (icône é doré, icône nom complet, nom seul, nom + slogan ; SVG et PNG)

## 2026-10-19 — Départ de l'employé refait
- Fenêtre « Il quitte la boutique » : son dernier mois (complet / jours travaillés / montant convenu), son avance (la retirer de son salaire / il la rendra plus tard / je la lui laisse + motif), puis « À lui verser » et « Il vous devra encore ».
- Le départ arrête le mois en cours, enlève la retenue prévue, règle l'avance, passe l'employé « Parti ». Rien n'est versé automatiquement : « Verser » reste possible tant qu'il reste quelque chose à lui payer.

## 2026-10-19 — Liste des employés : pastille Actif / Parti

## 2026-10-19 — Employés : onglet « Ce mois »
- Pastille rouge : employés pas encore payés en entier ce mois-ci.
- Cartes « Salaires du mois » (avec le nombre d'employés) et « Reste à verser » (dont la retenue d'avance prévue).
- Tableau du mois pour tous les employés (colonne Employé en plus, bouton Colonnes) ; toucher une ligne ouvre son mois.

## 2026-10-19 — « Salaires » devient un onglet du menu
- Barre du bas : Accueil, Personnes, +, Employés, Salaires (pastille rouge). Réglages passe en icône en haut à droite (téléphone) ; la barre latérale garde Réglages.
- La page Employés redevient la liste seule.

## 2026-10-19 — Réglages : modules Personnes et Employés
- Deux interrupteurs ; par défaut Personnes seul. Au moins un reste allumé. Le choix est gardé sur l'appareil.
- Un module coupé est caché partout (menu, tableau de bord, totaux, comptes, saisie) ; ses données restent.

## 2026-10-19 — Bouton « + » toujours au centre ; Réglages › ligne « Modules » qui ouvre la liste des modules

## 2026-10-19 — Tableau de bord : anneaux en couleur pleine quand seul le module Employés est allumé

## 2026-10-19 — Nouvel employé en 6 écrans courts
- Qui ? → Son salaire → Ce mois-ci (interrupteur « au début du mois », sinon selon son jour d'arrivée — le jour compte — ou montant convenu) → Ancien compte (ajouté au mois en cours) → Son avance (retenue par mois dès ce mois-ci, ou il la rend lui-même) → Résumé.
- Chaque nouveau mois commence avec le salaire entier (et la retenue d'avance prévue) : ajouté automatiquement.

## 2026-10-19 — Nouvel employé : phrases plus simples, « Anciennes avances », résumé rangé en 3 blocs (salaire, paie du mois, anciennes avances)

## 2026-10-19 — Fiche de paie du mois (bouton dans la fiche du mois) : feuille blanche, envoi WhatsApp, impression / PDF

## 2026-10-19 — Fiche de paie : sans versement, seulement « À payer » (plus de doublon avec « Reste à payer »)

## 2026-10-19 — Corrections après la séance de tests (3 testeurs)
- Salaires : une seule règle partout (retenue prévue comprise, avec « dont ») ; employés partis comptés au tableau de bord ; pastille rouge = reste à verser ; page Salaires avec mois d'avant.
- Arrêter / annuler le mois : le trop reçu annoncé est le vrai (même calcul que l'enregistrement).
- Reçus WhatsApp selon l'opération, solde du bon compte, numéro de la personne.
- Liste « Qui ? » : les deux comptes séparés. Détail : quantité 1,5 acceptée, prix sans centimes.
- Bouton retour du téléphone géré dans l'app. PIN non affiché, clavier d'ordinateur. Recherche sans accents ni espaces, numéros au format +242.
- Petits points : réglages vérifiés, thème retenu, « % rendu », pas d'avance après départ, textes, tablette, accessibilité.

## 2026-10-19 — Glissement tableau de bord ⇄ Leurs/Mes comptes (aller et retour, pas entre onglets) ; Réglages › Modules devient une vraie page (fil d'Ariane, sans menu du bas)

## 2026-10-19 — Glissement aussi à l'ouverture et à la fermeture des fiches, et pour la page Modules (pas pour le menu ni les onglets)

## 2026-10-19 — Adresses des écrans (/personnes/id, /employes, /salaires, /comptes/leurs, /reglages/modules…) : actualiser garde l'écran, le retour suit les adresses, une fenêtre ouverte se ferme d'abord. À prévoir à la mise en ligne : renvoyer toutes les adresses vers index.html.

## 2026-10-19 — Écran « kayé » seulement à l'ouverture de l'app (session), plus à chaque actualisation

## 2026-10-19 — Aperçu des écrans Connexion (/connexion) et Inscription (/inscription) : Google, Apple, e-mail + mot de passe. Pas encore branchés à Firebase. Dépôt GitHub : Pouroubaba-ai/mon-kaye

## 2026-10-19 — Icônes Google et Apple dans les boutons de connexion (paquet react-icons ; sur cet ordinateur, lancer npm install avant de démarrer)

## 2026-10-19 — Réglages : bouton « Se déconnecter » (avec confirmation) ; carte « Données » retirée. npm install lancé sur cet ordinateur (react-icons).

## 2026-10-20 — Firebase branché
- Connexion : Google, Apple (à activer chez Apple), e-mail + mot de passe, mot de passe oublié. Premier réglage : nom du commerce + code PIN. PIN à chaque ouverture ; « Changer de compte » et « Se déconnecter » ferment le compte.
- Données : shops/{uid} (boutique), persons, movements, meta/months ; gardées sur le téléphone (hors ligne) et envoyées en ligne. Règles : firestore.rules (publiées). Base Firestore en africa-south1.
- Démonstration sans compte : ?demo (exemples) ou ?demo=vide (compte neuf).
- firebase.json : hébergement (dist, toutes les adresses vers index.html).

## 2026-10-20 — En ligne sur Vercel (mon-kaye.vercel.app) : vercel.json renvoie toutes les adresses vers index.html (actualiser /connexion ne fait plus 404). Message clair si le domaine n'est pas autorisé dans Firebase.

## 2026-10-20 — « Nom de l'activité » au lieu de « Nom de votre commerce » (inscription, bienvenue, réglages)

## 2026-10-20 — Installation sur l'écran d'accueil : nom « Kayé », icône « é » doré (manifest.webmanifest, icônes Android/iPhone, favicon, titre de la page)

## 2026-10-20 — Icône de l'app : le nom complet « kayé » (au lieu du « é » seul)

## 2026-10-20 — iPhone : plus de zoom en touchant un champ (champs à 16 px sur iPhone), en-tête sous la barre de l'heure ; « Utiliser un autre compte » au lieu de « Ce n'est pas mon compte »
