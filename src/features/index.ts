// Livello features: schermate e casi d'uso. Archi ammessi:
// features→domain|ui|i18n. MAI features→data (AD-1): gli adattatori dati
// nascono in app e arrivano come porte iniettate.
import { projectName } from '../domain/scaffold';

export function featuresLayerLabel(): string {
  return `${projectName()} · features`;
}
