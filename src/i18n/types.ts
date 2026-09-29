// Tipi "puri" (senza next/headers) condivisi da client, server e route API.

/** Funzione di traduzione minima: compatibile con `useTranslations`, `getTranslations` e `getTranslator`. */
export type Tr = (key: string, values?: Record<string, string | number | Date>) => string
