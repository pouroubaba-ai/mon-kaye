# État d'avancement — Application « Carnet »

*Dernière mise à jour : 17 octobre 2026*

---

## 1. Où on en est (Étape 1 terminée)

- [x] Dossier créé hors de OneDrive : `C:\Users\pouro\Projets\Carnet\`
- [x] Dépôt Git initialisé
- [x] Environnement technique configuré (React 19, TypeScript, Vite, Tailwind CSS, shadcn/ui base, Dexie, Vitest)
- [x] Architecture modulaire étanche en place :
  - `src/modules/personnes/`
  - `src/modules/mouvements/`
  - `src/modules/employes/`
  - `src/modules/pieces_jointes/`
  - `src/modules/synchronisation/`
- [x] Document d'arbitrage technique rédigé : `CHOIX_PILE.md` (validation de Vite PWA)
- [x] Journal de bord initialisé : `ETAT.md`

---

## 2. Prochaine action (Étape 2)

Dès validation de la page de choix par le responsable :
- Construction de la **maquette cliquable complète** avec jeu de données fictives (5 employés, 30 partenaires, historique) :
  - Écran Démarrage & Connexion / PIN
  - Accueil avec les 2 grandes cartes d'indicateurs (« Je dois », « On me doit ») et l'anneau shadcn
  - Liste des personnes avec recherche et filtres
  - Fiche partenaire (double compteur, solde net, 4 boutons d'action rapide, compensation manuelle)
  - Fiche employé (suivi salaire, avances, remboursement, assistant de départ)
  - Pavé numérique géant pour saisie d'un versement en 3 gestes
  - Détail d'un mouvement avec reçu partageable (WhatsApp/SMS)
  - Réglages (thème sombre/clair, PIN, export, état de synchronisation)
- Arrêt pour test auprès de 3 à 5 commerçants.

---

## 3. Décisions prises et choix par défaut appliqués

1. **Pile technique :** Vite + React SPA (PWA) + Tailwind/shadcn + Dexie.js + Supabase.
2. **Compensation des dettes croisées :** Manuelle uniquement via un bouton dédié « Compenser », jamais automatique.
3. **Départ d'un employé :** L'avance restante est retenue par défaut sur le montant final de la période (options secondaires : garder en dette ou abandonner avec note).
4. **Preuve et traçabilité :** Aucun compte employé requis ; la preuve repose sur l'historique inaltérable, les pièces jointes et le reçu envoyé par WhatsApp/SMS.
5. **Authentification adaptée :** Google Auth ou Téléphone + mot de passe, déverrouillage quotidien par code PIN à 4 chiffres (sans SMS payant en V1).
6. **Utilisateur :** Monocompte par commerce pour la V1.
