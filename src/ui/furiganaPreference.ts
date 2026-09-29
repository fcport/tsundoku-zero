// Livello ui: le preferenze RAPIDE di lettura (29-09-2026), due interruttori sul
// dorso di ogni schermata (`MagazineFrame`), ricordati su QUESTO dispositivo
// (localStorage): sono comodità di lettura, non dati di studio, quindi non passano
// dal database né da una porta.
//
// - «Furigana» (predefinito: acceso). Può solo TOGLIERE la furigana: acceso, decide
//   il contenuto (`furiganaVisible`, un esercizio scritto senza furigana resta
//   senza); spento, la nasconde ovunque.
// - «Traduzioni» (predefinito: spento). Acceso, sotto il giapponese compare la sua
//   traduzione nella lingua dell'interfaccia; il giapponese resta sempre.
//
// Ogni preferenza è uno store zustand, così il dorso e le schermate leggono lo
// stesso valore.
import { useSyncExternalStore } from 'react';
import { create, type StoreApi, type UseBoundStore } from 'zustand';

export const FURIGANA_STORAGE_KEY = 'tsundoku.showFurigana';
export const TRANSLATIONS_STORAGE_KEY = 'tsundoku.showTranslations';

/**
 * Legge una preferenza salvata: `"true"`/`"false"`; qualunque altro valore, o
 * nessuno storage (SSR, privacy), ⇒ il predefinito.
 */
export function readTogglePreference(
  storage: Pick<Storage, 'getItem'> | undefined,
  key: string,
  fallback: boolean,
): boolean {
  try {
    const value = storage?.getItem(key);
    return value === 'true' ? true : value === 'false' ? false : fallback;
  } catch {
    return fallback;
  }
}

/** La furigana: visibile salvo scelta contraria. */
export function readFuriganaPreference(storage: Pick<Storage, 'getItem'> | undefined): boolean {
  return readTogglePreference(storage, FURIGANA_STORAGE_KEY, true);
}

function browserStorage(): Storage | undefined {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}

export interface TogglePreferenceState {
  readonly show: boolean;
  readonly setShow: (show: boolean) => void;
}

/** Uno store di preferenza on/off (hook zustand). */
export type TogglePreference = UseBoundStore<StoreApi<TogglePreferenceState>>;

function createTogglePreference(key: string, fallback: boolean): TogglePreference {
  return create<TogglePreferenceState>((set) => ({
    show: readTogglePreference(browserStorage(), key, fallback),
    setShow: (show) => {
      set({ show });
      try {
        browserStorage()?.setItem(key, String(show));
      } catch {
        // Storage pieno o negato: la scelta vale comunque per questa visita.
      }
    },
  }));
}

export const useFuriganaPreference = createTogglePreference(FURIGANA_STORAGE_KEY, true);
export const useTranslationPreference = createTogglePreference(TRANSLATIONS_STORAGE_KEY, false);

/**
 * Se la preferenza è accesa. Come l'hook zustand, ma il render statico (SSR, test)
 * legge lo stato CORRENTE dello store invece di quello iniziale: una preferenza
 * impostata prima del render si vede anche lì.
 */
export function usePreferenceShown(store: TogglePreference): boolean {
  return useSyncExternalStore(
    store.subscribe,
    () => store.getState().show,
    () => store.getState().show,
  );
}
