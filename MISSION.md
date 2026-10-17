# MISSION : APPLICATION « CARNET » — DETTES, VERSEMENTS ET EMPLOYÉS DU PETIT COMMERÇANT

*Instruction du responsable du projet. Nom de travail provisoire : « Carnet ». Le vrai nom sera choisi plus tard.*

---

## 0. À lire avant tout

- **Projet séparé de l'ERP.** Ne touche à rien dans `Mon_ERP` ni dans `Mon_ERP_App`.
  - Crée un nouveau dossier **hors de OneDrive** : `C:\Users\pouro\Projets\Carnet\`.
  - Initialise-y un dépôt Git. Fais une sauvegarde par bundle dans `C:\Users\pouro\OneDrive\Documentos\Sauvegardes_git\Carnet.bundle` à la fin de chaque étape.
- **Réutilisation future.** Cette application deviendra plus tard une brique de l'ERP. Construis-la en modules étanches :
  - `personnes` ;
  - `mouvements` (le compte entre moi et une personne) ;
  - `employes` (salaires, avances, départs) ;
  - `pieces_jointes` ;
  - `synchronisation`.

  Chaque module a ses données et ses fonctions. Les autres modules ne passent que par ses fonctions publiques.
- **Règles de travail (version légère) :**
  - un enregistrement Git avant et après chaque étape ;
  - un fichier `ETAT.md` à jour : où on en est, prochaine action, décisions prises ;
  - aucune suppression de données ou d'historique ;
  - aucun déploiement ni aucune publication sans mon accord ;
  - aucune autre dépendance que celles autorisées en section 9 sans me le demander.
- **Communication avec moi.**
  - À la fin de chaque étape, une page en langage simple : ce qui est fait, ce que je peux tester, et au plus 3 questions, chacune avec ta recommandation.
  - Pas de jargon. Pas d'identifiants techniques sans explication.

---

## 1. Le problème à résoudre

L'utilisateur est un **très petit commerçant**, au Congo-Brazzaville. Il ne veut pas de technologie : il cherche la moindre raison de dire « voilà pourquoi je n'utilise pas ces trucs ». Aujourd'hui, il tient tout de tête ou dans un cahier.

**Avec ses employés,** il n'arrive pas à suivre :
- les dates de salaire ;
- les versements faits à l'employé, parfois en plusieurs fois ;
- les avances, parfois remboursées par retenues étalées sur plusieurs paies, parfois remboursées par l'employé de sa poche.

Conséquences :
- salaires payés deux fois ;
- employé qui nie avoir reçu un versement ;
- patron qui oublie ce qu'il a versé ;
- personne ne sait qui doit combien à qui.

**Avec ses partenaires,** la même personne est souvent à la fois fournisseur et client. Il prend à crédit chez elle, elle prend à crédit chez lui, et il y a des versements dans les deux sens. Il oublie les montants et n'a aucune preuve.

**La promesse de l'application,** en une phrase :
> « Je sais à tout moment qui me doit, à qui je dois, combien, et j'ai la preuve. »

---

## 2. Principe absolu : zéro excuse pour ne pas l'utiliser

Chaque écran est jugé ainsi : *« Un commerçant pressé, méfiant, sur un téléphone Android bon marché, avec un réseau qui coupe, en plein soleil, y arriverait-il du premier coup, sans aide ? »* Si la réponse est non, l'écran est refait.

Règles obligatoires :
1. **Enregistrer un versement en 3 gestes au plus**, plus la saisie du montant : ouvrir la personne, toucher « Il m'a versé » ou « Je lui ai versé », taper le montant, valider.
2. **Démarrage en moins d'une minute :** nom du commerce, téléphone, code PIN. Pas de tutoriel. Chaque écran vide montre un seul gros bouton et une phrase d'explication.
3. **Les mots du commerçant, jamais ceux du comptable.**
   - Écrire : « Il me doit », « Je lui dois », « Il a pris à crédit », « Il m'a versé », « Je lui ai versé », « Avance », « Retenue sur salaire ».
   - Ne jamais écrire : « créance », « débit », « crédit », « solde débiteur ».
4. **Gros et lisible.**
   - Zones tactiles d'au moins 48 px ; texte d'au moins 16 px ; montants en très grand.
   - Contraste élevé, lisible en plein soleil (WCAG 2.2 AA au minimum).
5. **Montants :** francs CFA (FCFA), sans décimales, avec espaces des milliers (« 25 000 FCFA »). Pavé numérique dédié, avec des boutons rapides (+1 000, +5 000, +10 000).
6. **Rien ne bloque.** Pas de champ obligatoire inutile. Seuls la personne, le sens et le montant sont obligatoires. Note, pièce jointe, moyen de paiement et date sont facultatifs. La date par défaut est aujourd'hui.
7. **Fonctionne sans réseau,** toujours (section 6). L'application ne doit jamais afficher une erreur parce que le réseau est coupé.
8. **Rapide sur un petit téléphone :** ouverture en moins de 2 secondes une fois installée, application légère.
9. **Rien ne se perd :** ni à la perte du téléphone (sauvegarde en ligne), ni par une fausse manipulation (on annule, on ne supprime jamais).
10. **Langue : français simple.** Formats : JJ/MM/AAAA, FCFA. Prévoir la traduction plus tard (fichiers de textes séparés).

---

## 3. Fonctionnalités

### 3.1 Personnes
- Une personne a un nom, un téléphone (facultatif), une photo (facultative), une note (facultative) et un type : **partenaire** ou **employé**.
- Recherche instantanée par nom ou téléphone.
- Liste triée par défaut selon le plus gros montant en jeu, avec filtres « Me doivent », « Je leur dois », « Employés ».

### 3.2 Compte avec un partenaire (les deux sens)
Chaque partenaire a **deux compteurs séparés** :
- **« Il me doit »**, augmenté par « Il a pris à crédit chez moi » et diminué par « Il m'a versé » ;
- **« Je lui dois »**, augmenté par « J'ai pris à crédit chez lui » et diminué par « Je lui ai versé ».

Règles :
- **Solde net :** l'écran affiche les deux compteurs, et en dessous le solde net en une phrase : « Au total, il vous doit 20 000 FCFA » ou « Au total, vous lui devez… ».
- **Compensation :** elle n'est **jamais automatique**. Un bouton « Compenser » propose d'annuler les dettes croisées à hauteur du plus petit montant. Il crée deux mouvements liés et visibles dans l'historique.
- **Versement trop élevé :** un versement ne peut pas dépasser le compteur concerné sans confirmation. Si c'est le cas, l'application demande : « Le surplus de X FCFA est-il une avance ? Il passera dans "Je lui dois" (ou "Il me doit") ».
- **Derniers versements :** sur la fiche, deux listes courtes, « Derniers versements reçus de lui » et « Derniers versements que je lui ai faits », avec date, montant et moyen de paiement. Un lien mène à l'historique complet.

### 3.3 Employés
- **Fiche :** salaire (montant), fréquence (mensuelle, par quinzaine, hebdomadaire ou journalière), date de début, jour d'échéance, et statut actif ou inactif.
- **Salaire automatique.**
  - Tant que l'employé est actif, un mouvement « Salaire dû — période du … au … » est créé à chaque échéance, dans le compteur « Je lui dois ».
  - La création est **idempotente** : une période donnée d'un employé donné ne peut produire qu'**un seul** salaire dû, même avec plusieurs appareils, hors ligne, ou si l'application est ouverte plusieurs fois.
  - L'identifiant de chaque salaire dû est déterministe : employé + début de période.
- **Paiement du salaire :** en une ou plusieurs fois (« Je lui ai versé »).
- **Avances.**
  - « Donner une avance » augmente le compteur « Il me doit (avance) », avec un plan de remboursement facultatif : retenue d'un montant fixe à chaque paie, ou répartition sur N paies.
  - À chaque salaire dû, la retenue prévue est appliquée automatiquement : un mouvement lié diminue à la fois le salaire dû et l'avance restante. Elle est toujours visible et peut être modifiée ou suspendue pour une paie.
  - « Il rembourse de sa poche » diminue directement l'avance.
- **Départ ou désactivation en cours de période.** L'application demande comment solder la période en cours :
  1. **mois complet** ;
  2. **au prorata des jours écoulés** (jours travaillés ÷ jours de la période × salaire, arrondi à l'unité) ;
  3. **montant fixe** saisi par le patron.

  Puis, s'il reste une avance non remboursée :
  - **la retenir** sur le montant final (recommandé par défaut) ;
  - **la garder comme dette** de l'employé ;
  - **l'abandonner**, avec une note obligatoire.

  Ensuite, plus aucun salaire n'est créé. On peut réactiver un employé plus tard, sans perdre son historique.

### 3.4 Mouvements (tout enregistrement)
- **Champs :**
  - personne, sens, montant, date ;
  - **moyen de paiement** : espèces ou mobile money, avec le numéro et la référence de transaction facultatifs ;
  - **note** facultative ;
  - **pièces jointes** facultatives : photo prise avec l'appareil ou fichier, compressée automatiquement.
- **Jamais de suppression.** Une erreur s'**annule** : le mouvement reste visible, barré, avec le motif et la date de l'annulation, et les compteurs sont recalculés. Ça protège le patron en cas de dispute.
- **Reçu à partager.**
  - Après chaque versement, un bouton « Envoyer un reçu » prépare un message clair et peut l'envoyer par WhatsApp ou par SMS depuis le téléphone (partage natif ou lien `wa.me`). Exemple : « Commerce X — Versement de 25 000 FCFA reçu de Y le 17/10/2026 — reste dû : 15 000 FCFA ».
  - L'application n'envoie rien automatiquement en V1.

### 3.5 Tableau de bord (Accueil)
- **Deux grandes cartes :** « Je dois » et « On me doit », avec les totaux en très grand.
- **Sous chacune, la répartition :** partenaires et employés.
- **« À payer bientôt » :** les salaires dus dans les 7 prochains jours et ceux en retard.
- **« Ils tardent à payer » :** les personnes qui me doivent et n'ont rien versé depuis 30 jours (seuil réglable).
- **Chaque carte est cliquable** et mène à la liste filtrée correspondante.

### 3.6 Hors périmètre de la V1
Pas de :
- paie légale (CNSS, impôt sur salaire, bulletins officiels) ;
- stock, caisse, factures ;
- multi-devises ;
- plusieurs utilisateurs par commerce ;
- envoi automatique de messages ;
- encaissement d'argent par l'application.

L'application **suit** l'argent, elle ne le **déplace** jamais.

---

## 4. Écrans

**Sur téléphone, la priorité** (c'est l'usage principal) :
- **Barre en bas à 4 onglets :** Accueil · Personnes · Employés · Réglages.
- **Un bouton flottant « + »** pour ajouter rapidement un mouvement ou une personne.

**Sur ordinateur et tablette :** une barre latérale inspirée du bloc shadcn `sidebar-03` (barre latérale avec sous-menus). Elle se replie, et sur mobile elle est remplacée par la barre du bas.

**Liste des écrans :**
1. Démarrage : nom du commerce, téléphone, code PIN.
2. Connexion (section 5).
3. Accueil (section 3.5).
4. Liste des personnes, avec recherche et filtres.
5. Fiche d'un partenaire :
   - en tête : les deux compteurs, le solde net et 4 gros boutons d'action (« Il a pris à crédit », « J'ai pris à crédit », « Il m'a versé », « Je lui ai versé ») ;
   - les derniers versements dans les deux sens ;
   - l'historique.
6. Fiche d'un employé :
   - salaire et prochaine échéance, ce que je lui dois, son avance restante ;
   - boutons « Verser le salaire », « Donner une avance », « Il rembourse », « Désactiver » ;
   - l'historique.
7. Saisie d'un mouvement : un seul écran, avec un pavé numérique géant.
8. Assistant de départ d'un employé (section 3.3).
9. Détail d'un mouvement : pièces jointes, note, annulation, reçu.
10. Réglages : nom du commerce, code PIN, thème, sauvegarde et état de synchronisation, export des données (fichier CSV ou Excel), déconnexion.

---

## 5. Design (références fournies par le responsable)

**Style :**
- sombre, monochrome (gris, blanc), sobre ;
- cartes aux coins arrondis, bordures fines ;
- typographie nette, gros chiffres.

**Les trois références :**
1. **Bloc shadcn `sidebar-03`** : barre latérale à sous-menus, pour la version ordinateur.
2. **Écran de connexion shadcn** : carte centrée, connexion avec Google, puis e-mail et mot de passe. Identifie le bloc officiel correspondant dans la bibliothèque des blocs shadcn et vérifie-le avec `--dry-run` avant de l'installer.
3. **Carte d'indicateur avec anneau** : un grand montant au centre et des lignes de détail en dessous. Utilise-la pour l'Accueil, par exemple l'anneau « On me doit » montrant la part partenaires et la part employés.

**Adaptations obligatoires :**
- **Thème :** clair et sombre, au choix dans Réglages. Le sombre est le thème de référence du responsable. Le thème clair doit exister, car il reste lisible en plein soleil dans une boutique.
- **Couleur :** une seule couleur d'accent, en plus du monochrome, pour les actions principales. Un code couleur constant : ce qu'on me doit et ce que je dois ont chacun une couleur distincte, toujours accompagnée d'un mot, jamais la couleur seule.
- **Connexion adaptée au Congo** (hypothèse à me confirmer) :
  - connexion avec Google (la plupart des commerçants ont un téléphone Android) ;
  - à défaut, numéro de téléphone et mot de passe ;
  - ensuite, déverrouillage rapide par **code PIN à 4 chiffres**, qui fonctionne hors ligne.
  - Pas de SMS de vérification en V1, à cause du coût. Pas de connexion Apple, sauf si c'est gratuit à ajouter.
- **Animations discrètes et rapides** seulement. Rien qui ralentisse un petit téléphone.

---

## 6. Hors ligne et sauvegarde

- **Toutes les données vivent d'abord sur le téléphone** (base locale) : l'application fonctionne entièrement sans réseau.
- **Dès que le réseau revient,** les données se synchronisent avec une sauvegarde en ligne. C'est ce qui protège contre la perte ou la casse du téléphone.
- **Les conflits sont impossibles par construction :** les mouvements sont en ajout seul, avec des identifiants uniques générés sur l'appareil, et le salaire dû est idempotent (section 3.3).
- **Les pièces jointes** sont envoyées dès que le réseau le permet. En attendant, elles sont mises en file d'attente.
- **Un indicateur discret** (« Tout est sauvegardé » ou « 3 éléments en attente ») est visible dans Réglages et dans un petit badge. Jamais de message d'erreur bloquant.
- **Changement de téléphone :** on se connecte et on retrouve tout.

---

## 7. Données et calculs (règles de vérité)

- **Les compteurs ne sont jamais stockés seuls.** Ils sont **calculés** à partir des mouvements non annulés. Un contrôle vérifie en permanence que les totaux du tableau de bord sont égaux à la somme des fiches.
- **Montants :** entiers en FCFA. Aucun calcul en nombres à virgule flottante.
- **Prorata :** arrondi à l'unité la plus proche. La règle est écrite et testée.
- **Traçabilité :** chaque mouvement porte sa date de création, sa date effective et l'appareil d'origine. Une annulation porte son motif et sa date.

---

## 8. Tests et contrôles (obligatoires)

1. **Tests unitaires de tous les calculs :**
   - compteurs, solde net, compensation ;
   - avances et retenues sur plusieurs paies ;
   - prorata ;
   - départ, avec ses trois options de solde et ses trois options d'avance ;
   - surplus de versement ;
   - annulation.
2. **Test d'idempotence :** ouvrir l'application 10 fois, sur 2 appareils, hors ligne puis en ligne. Il doit y avoir exactement un salaire dû par période.
3. **Simulateur :**
   - générer un commerce fictif avec 5 employés et 30 partenaires ;
   - jouer 6 mois de mouvements aléatoires : avances, retenues, départs, annulations, coupures de réseau ;
   - comparer chaque compteur à un calcul indépendant écrit séparément ;
   - produire un rapport des écarts, qui doit compter 0 écart.
4. **Tests de bout en bout des parcours clés :** démarrage, ajout d'un employé, versement du salaire, avance avec retenue, départ, versement d'un partenaire, reçu WhatsApp.
5. **Test sur petit écran** (360 px de large) et en réseau lent ou coupé.
6. **Mesure de performance :** temps d'ouverture et taille de l'application.

Aucune étape n'est terminée si un test échoue.

---

## 9. Pile technique

Je t'autorise à installer ces outils dans le dossier `Carnet` uniquement :
- **React** avec **TypeScript**, dans une **application web installable** (PWA), construite avec Vite ou Next.js. Choisis la plus légère pour le hors ligne et justifie ce choix en une page.
- **shadcn/ui**, avec **Tailwind CSS** et **Radix**.
- **Base locale :** IndexedDB, via Dexie ou un équivalent léger.
- **Sauvegarde en ligne et connexion :** Supabase (PostgreSQL), avec sécurité par ligne : chaque commerçant ne voit que ses données.
- **Tests :** Vitest et Playwright.

Pour tout autre outil, demande-moi avant.

Les comptes Supabase et d'hébergement seront créés par moi. Dis-moi précisément quoi créer et quelles clés te fournir. Les clés ne sont jamais enregistrées dans Git.

---

## 10. Étapes

| Étape | Contenu | Fin d'étape |
|---|---|---|
| 1 | Dossier, Git, `ETAT.md`, choix justifié de la pile (une page), structure en modules | Je valide la page de choix |
| 2 | **Maquette cliquable** avec des données fictives : tous les écrans, thème sombre et clair, sur téléphone et ordinateur | **Arrêt.** Je la fais tester à 3 à 5 commerçants et je te rapporte leurs réactions |
| 3 | Fonctionnement réel en local (hors ligne) : personnes, mouvements, employés, calculs, tests unitaires et simulateur | Tous les tests passent |
| 4 | Connexion, code PIN, synchronisation en ligne, pièces jointes, reçus | Tests de bout en bout et tests hors ligne réussis |
| 5 | Finitions : performance, accessibilité, export, textes | Rapport final en une page + liste de ce qui reste |

Après chaque étape : enregistrement Git, bundle, `ETAT.md` à jour et une page de résumé pour moi. **Pas de mise en ligne publique sans mon accord.**

---

## 11. Choix faits par défaut, à me signaler

Je n'ai pas tranché ces points. Applique ces choix, et signale-les clairement dans ta première page de résumé :
1. Les dettes croisées ne sont **pas compensées automatiquement** : un bouton « Compenser » le fait à la demande.
2. **Au départ d'un employé,** l'avance restante est **retenue par défaut** sur le montant final. On peut aussi la garder comme dette ou l'abandonner, avec une note.
3. **La preuve** repose sur l'historique non supprimable, les pièces jointes et le reçu envoyé par WhatsApp ou SMS. L'employé n'a pas de compte dans l'application.
4. **La connexion** se fait avec Google ou par téléphone et mot de passe, plus un code PIN. Pas de SMS de vérification.
5. Il y a **un seul utilisateur** par commerce en V1.
