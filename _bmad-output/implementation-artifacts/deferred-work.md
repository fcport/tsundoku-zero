### DW-1: Irrigidire la purezza del dominio oltre i quattro casi dell'AC (AD-3/AD-4): vietare in src/domain i global di orologio/casualità (Date.now, new Date senza argomenti, Math.random) e gli import di built
origin: spec-deferred 7ea7adc885fb
location: eslint.config.js (override src/domain/**)
source_spec: `spec-1-1-scaffold-con-i-confini-imposti-in-ci.md`
severity: low
reason: L'AC2 della storia elenca solo React, @supabase/supabase-js, fetch e storage, e la config li impone come ERROR. Ma AD-3 (tempo come parametro) e AD-4 (nessun Math.random nel dominio) diventano vincoli meccanici necessari quando arriva la logica di scheduling/streak del dominio (Epic 3). Oggi il dominio non ha codice tempo/casualità, quindi la conseguenza è nulla: va imposto prima che quel codice esista.
status: open
