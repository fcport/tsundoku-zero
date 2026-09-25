// Livello data (AD-2): l'adattatore concreto della porta `Clock` del dominio.
// `new Date()` è VIETATO sotto src/domain/ (AD-1: il dominio non legge
// l'orologio); qui è ammesso — questo è l'unico livello che tocca l'orologio di
// piattaforma. Il seam consegna il `now` alle funzioni di dominio (`isDue`,
// `schedule`, `streak`) senza che il dominio conosca la piattaforma.
import type { Clock } from '../domain/ports/clock';

/**
 * L'orologio di sistema: `now()` ritorna l'istante corrente come `new Date()`,
 * `timeZone()` il fuso IANA locale del browser via
 * `Intl.DateTimeFormat().resolvedOptions().timeZone` (vietato sotto src/domain,
 * AD-1: solo questo adattatore lo legge). È l'adattatore di produzione della
 * porta `Clock`; un test inietta invece un clock con `now()`/`timeZone()` fissi,
 * così le letture temporali sono deterministiche.
 */
export const systemClock: Clock = {
  now: () => new Date(),
  timeZone: () => Intl.DateTimeFormat().resolvedOptions().timeZone,
};
