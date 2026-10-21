# Kayé — Mon kayé de compte

Carnet de crédits, dettes et paie pour les commerçants. React 19 + TypeScript + Vite, Firebase (Auth + Firestore), déployé sur Vercel (mon-kaye.vercel.app).

## Commandes

```bash
npm run dev      # l'app en local
npm test         # les tests automatiques (soldes, compensations, paie, dates)
npm run build    # vérification des types + version de production
```

`?demo` dans l'adresse ouvre l'app avec des données de démonstration, `?demo=vide` un compte neuf.

## Organisation du code

Les règles du métier sont dans `src/modules`, en fonctions sans effet (elles reçoivent l'état et rendent le nouvel état) :

| Module | Contenu |
| --- | --- |
| `modules/personnes` | comptes des partenaires : crédits, versements, retours, trop versé, compensation |
| `modules/employes` | paie : périodes (d'une échéance à l'autre), salaires, avances, retenues, arrêt, départ |
| `modules/mouvements` | dates, identifiants, annulation (jamais de suppression), export CSV |
| `modules/navigation` | adresses des écrans, bouton retour du téléphone |
| `modules/reglages` | modules allumés (enregistrés dans le compte), thème |
| `modules/synchronisation` | enregistrement Firebase (code dans `lib/firebase.ts`) |
| `modules/pieces_jointes` | photo d'une opération |

`src/data/store.tsx` relie tout : il garde l'état de l'app et applique les résultats des modules. Les écrans sont dans `src/components`.

Avant chaque mise en ligne : `npm test` doit passer. Une nouvelle règle de calcul arrive avec son test (`src/test`).
