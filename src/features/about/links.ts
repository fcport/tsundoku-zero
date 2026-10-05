// Livello features/about: i collegamenti dell'autore, condivisi fra la pagina «Come
// funziona?» e i link di servizio (accesso, dashboard) che portano al codice.

/** Il codice del progetto su GitHub. */
export const REPO_URL = 'https://github.com/fcport/tsundoku-zero';

// Chi scrive il sito: il sito personale, il profilo GitHub e il codice del progetto.
export const AUTHOR_LINKS = [
  ['siteLabel', 'https://federicocasadei.dev'],
  ['githubLabel', 'https://github.com/fcport'],
  ['repoLabel', REPO_URL],
] as const;
