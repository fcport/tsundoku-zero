// Livello data: implementa le porte del dominio (AD-2). Può dipendere da
// domain (arco ammesso data→domain) e, dalla storia 1.5, sarà l'unica
// cartella a importare @supabase/supabase-js.
//
// Questo modulo è anche il bersaglio della sonda di confine features→data:
// una violazione reale importa '../data/index', perciò il resolver deve
// poterlo classificare come livello `data`.
import { projectName } from '../domain/scaffold';

export function dataLayerLabel(): string {
  return `${projectName()} · data`;
}
