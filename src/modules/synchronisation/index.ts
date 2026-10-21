/**
 * Module Synchronisation : enregistrement en ligne (Firebase) et sur le téléphone.
 * Le code est dans src/lib/firebase.ts ; les autres modules passent par ce qui est exporté ici.
 */
export { loadShop, createShop, makePersister, type CloudData, type ShopDoc } from '@/lib/firebase'
export * from './types'
