-- La pila si riempie tutta alle 2 di notte.
--
-- Da ora il client fissa ogni scadenza positiva all'INIZIO di una giornata di
-- studio, le 2 locali (`schedule` in src/domain/schedule.ts), invece che a «adesso
-- + intervallo» al millisecondo. Le scadenze già salvate però restano sparse
-- durante il giorno: questa migrazione DI DATI le riallinea una volta sola,
-- portando ogni scadenza futura alle 2 della sua giornata di studio (la giornata
-- comincia alle 2, quindi una scadenza all'una e mezza va alle 2 del giorno prima).
-- Una scadenza si ANTICIPA al più di 24 ore, mai si posticipa: quelle che cadono
-- più tardi oggi diventano dovute subito.
--
-- Il fuso è quello di Roma: il server non conosce il fuso di ciascuno studente
-- (lo legge il client dal browser), e gli studenti oggi sono in Italia.
-- Nessuna modifica di schema. Si applica al merge su main via migrate.yml.
update review_state
set due_at = (
  (((due_at at time zone 'Europe/Rome') - interval '2 hours')::date + time '02:00')
  at time zone 'Europe/Rome'
)
where due_at > now();
