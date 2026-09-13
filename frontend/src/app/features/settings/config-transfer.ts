import { ImportConfig } from '../../models/settings.model';

/** Nom donné à la connexion d'un fichier `version: 1` (RG-019-06/19), avant qu'elle n'existe. */
const LEGACY_CONNECTION_NAME = 'GitLab';

/** Résumé affiché dans le dialog de confirmation avant import (RG-015-04, RG-019-19). */
export interface ImportSummary {
  settingsCount: number;
  connectionsCount: number;
  /** Connexions qui seront créées (toujours sans jeton, RG-019-19), par nom, insensible à la casse. */
  newConnections: number;
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
 * Résume un import pour le dialog de confirmation (RG-015-04, RG-019-19) :
 * nombre de paramètres du fichier, nombre de connexions (et combien seront
 * nouvellement créées, donc sans jeton), nombre total de repos et combien
 * sont réellement nouveaux par rapport à l'état actuel (`currentPaths`/
 * `currentConnectionNames`, comparaison insensible à la casse).
 */
export function summarizeImport(
  config: ImportConfig,
  currentPaths: string[],
  currentConnectionNames: string[],
): ImportSummary {
  const currentPathsLower = new Set(currentPaths.map((path) => path.toLowerCase()));
  const newRepos = config.projects.filter(
    (project) => !currentPathsLower.has(project.pathWithNamespace.toLowerCase()),
  ).length;
  const importedConnectionNames =
    config.version === 2
      ? (config.connections ?? []).map((connection) => connection.name)
      : [LEGACY_CONNECTION_NAME];
  const currentNamesLower = new Set(
    currentConnectionNames.map((name) => name.toLowerCase()),
  );
  const newConnections = importedConnectionNames.filter(
    (name) => !currentNamesLower.has(name.toLowerCase()),
  ).length;
  return {
    settingsCount: Object.keys(config.settings).length,
    connectionsCount: importedConnectionNames.length,
    newConnections,
    totalRepos: config.projects.length,
    newRepos,
  };
}
