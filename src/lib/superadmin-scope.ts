// =============================================================================
// Che cosa vede un superadmin dei clienti degli altri professionisti
// =============================================================================
//
// Il cliente dà il consenso al PROPRIO professionista, non al Super Admin. Un
// consenso esplicito verso il Super Admin (assistenza su richiesta, con
// registro degli accessi) non è ancora implementato: finché non lo è, il
// superadmin nell'area professionisti è un professionista come gli altri e vede
// solo il proprio perimetro (perimetro.ts). Dei dati altrui restano i conteggi
// aggregati dell'area admin, senza righe.
//
// Questa costante è l'unico interruttore: la leggono la vista "come un altro
// professionista" (`resolveViewingProfessional`), le stampe e i PDF
// (`assertOwnerOrSuperadmin`). Va portata a `true` solo insieme al consenso.
//
// ⚠️ È un limite del SITO. Le policy `superadmin_read_*` nel database restano:
// con le API di Supabase un superadmin legge ancora quelle tabelle. Chiuderle è
// una migrazione a parte.
export const SUPERADMIN_VEDE_DATI_CLIENTI = false
