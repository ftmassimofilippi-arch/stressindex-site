// Nome del sensore da mostrare in un dettaglio misurazione o nel suo PDF.
// L'app salva in `sensor_name` quello che il telefono vede via Bluetooth: su
// iOS è spesso l'identificativo della periferica (UUID), su Android l'indirizzo
// MAC. Nessuno dei due dice qualcosa al professionista. Modulo puro, senza
// import: lo usano pagine server e test (`node --test`).

const UUID_LIKE = /^[0-9A-F]{8}-[0-9A-F]{4}-/i
const BLE_ADDRESS = /^([0-9A-F]{2}:){5}/i

/** true se la stringa è vuota o è un identificativo tecnico (UUID, MAC). */
export function isOpaqueSensorId(value: string | null | undefined): boolean {
  const v = (value ?? '').trim()
  if (!v) return true
  return UUID_LIKE.test(v) || BLE_ADDRESS.test(v)
}

/**
 * Etichetta leggibile: `name` se è un nome vero, altrimenti `type` se lo è,
 * altrimenti `fallback` (tradotto dal chiamante, es. "Sensore BLE").
 */
export function sensorLabel(
  name: string | null | undefined,
  type: string | null | undefined,
  fallback: string,
): string {
  if (!isOpaqueSensorId(name)) return (name as string).trim()
  if (!isOpaqueSensorId(type)) return (type as string).trim()
  return fallback
}
