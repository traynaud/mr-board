import { ImportConfig } from '../../models/settings.model';

/** Résumé affiché dans le dialog de confirmation avant import (RG-015-04). */
export interface ImportSummary {
  settingsCount: number;
  totalRepos: number;
  newRepos: number;
}

/**
 * Parse et valide la forme minimale d'un fichier de config exporté
 * (RG-015-04) : `version` numérique, `settings` objet, `projects` tableau.
 * Ne valide pas le détail des champs (le backend le fait) — juste assez
 * pour éviter d'envoyer un JSON manifestement invalide et pour pouvoir
 * calculer le résumé de confirmation.
 * @returns la config, ou `null` si le fichier est invalide.
 */
export function parseImportFile(rawText: string): ImportConfig | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) {
    return null;
  }
  const candidate = parsed as Record<string, unknown>;
  if (typeof candidate['version'] !== 'number') {
    return null;
  }
  if (typeof candidate['settings'] !== 'object' || candidate['settings'] === null) {
    return null;
  }
  if (!Array.isArray(candidate['projects'])) {
    return null;
  }
  return parsed as ImportConfig;
}

/**
 * Résume un import pour le dialog de confirmation (RG-015-04) : nombre de
 * paramètres du fichier, nombre total de repos, et combien sont réellement
 * nouveaux par rapport aux repos déjà configurés (`currentPaths`, comparaison
 * insensible à la casse comme le reste des chemins de repo).
 */
export function summarizeImport(config: ImportConfig, currentPaths: string[]): ImportSummary {
  const currentPathsLower = new Set(currentPaths.map((path) => path.toLowerCase()));
  const newRepos = config.projects.filter(
    (project) => !currentPathsLower.has(project.pathWithNamespace.toLowerCase()),
  ).length;
  return {
    settingsCount: Object.keys(config.settings).length,
    totalRepos: config.projects.length,
    newRepos,
  };
}
