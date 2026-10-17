# Choix de la Pile Technique — Application « Carnet »

*Document d'arbitrage technique conformément à l'Étape 1 du cahier des charges.*

---

## 1. Contexte et contraintes d'usage réelles

L'application **Carnet** s'adresse à un très petit commerçant au Congo-Brazzaville :
- **Appareil cible :** Smartphone Android d'entrée de gamme (1 à 2 Go de RAM, processeur modeste, stockage limité).
- **Environnement réseau :** Connexions mobiles instables, coupures d'électricité fréquentes, réseau souvent absent en cours de journée.
- **Environnement physique :** Forte luminosité en boutique ouverte / marché (besoin de réactivité instantanée et d'ergonomie lisible).
- **Impératif absolu :** « Zéro excuse pour ne pas l'utiliser ». L'application doit s'ouvrir en **moins de 2 secondes** et fonctionner à 100% hors ligne sans la moindre latence.

---

## 2. Analyse comparative : Vite + React SPA (PWA) vs Next.js (App Router)

| Critère | Vite + React SPA (PWA) | Next.js (App Router / SSR) | Impact pour le commerçant |
|---|---|---|---|
| **Fonctionnement hors ligne** | **Natif et inaltérable** : 100% des fichiers (HTML, JS, CSS) sont mis en cache localement par le Service Worker. Aucun appel serveur requis. | Complexe : conçu pour le rendu serveur (SSR/RSC). L'export statique (`output: export`) perd les atouts de Next.js et la gestion PWA / Service Worker est fragile. | **Primordial.** Carnet doit être utilisable en plein mode avion à n'importe quel moment. |
| **Poids du bundle initial** | **Ultra-léger (~150 à 250 Ko gzippé)** avec le runtime React et Tailwind. | Lourd (~500 à 900+ Ko) avec le runtime d'hydratation Next.js, le routeur serveur et les polyfills. | Chargement initial 3× plus rapide sur réseau 3G/Edge congolais. |
| **Empreinte mémoire (RAM)** | Faible : simple arbre DOM React monté dans le WebView / navigateur. | Élevée : l'hydratation React Server Components consomme beaucoup de RAM sur petits téléphones. | Évite les plantages et les fermetures intempestives par le système Android. |
| **Architecture locale (Dexie/IndexedDB)** | Idéale : lecture et écriture directes dans IndexedDB côté client avec calcul immédiat des compteurs. | Redondante : le cycle serveur de Next.js est inutile car toutes les données vivent d'abord sur l'appareil. | Synchronisation fluide avec Supabase en arrière-plan sans passer par un serveur intermédiaire. |
| **Déploiement et coût d'hébergement** | Hébergement statique gratuit (Cloudflare Pages, Vercel ou Supabase Storage), résilient et sans serveur Node.js à maintenir. | Nécessite un runtime Node/Edge pour le SSR, augmentant le coût et les points de défaillance. | Zéro coût d'infrastructure serveur pour le responsable. |

---

## 3. Choix retenu : Vite + React + TypeScript + PWA

Pour respecter scrupuleusement la règle **« ouverture en moins de 2 secondes »** et **« fonctionnement hors ligne permanent sans erreur »**, la pile retenue est :

1. **Vite + React (TypeScript) :**
   - Application web installable (PWA) avec Service Worker local.
   - Démarrage instantané, rechargement à chaud ultra-rapide pour le développement.
2. **shadcn/ui + Tailwind CSS + Radix UI :**
   - Composants accessibles, contrastes élevés (mode sombre et mode clair lisible en plein soleil).
   - Zones tactiles ≥ 48 px et typographie large pour les montants.
3. **Dexie.js (IndexedDB) :**
   - Base de données locale ultra-légère et rapide, tolérante aux pannes de batterie ou de réseau.
4. **Supabase (PostgreSQL + RLS) :**
   - Synchronisation en ligne dès que le réseau réapparaît, sans jamais bloquer l'interface.
5. **Vitest :**
   - Suite de tests unitaires ultra-rapide pour valider tous les calculs (prorata, salaires, avances, compteurs).

---

## 4. Conclusion

Vite est la solution la plus sobre, la plus robuste et la plus légère pour l'Afrique subsaharienne : elle transforme le téléphone en terminal autonome et infaillible.
