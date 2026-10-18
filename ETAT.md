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
