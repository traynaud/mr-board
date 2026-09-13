import { TestConnectionState } from '../../models/connection.model';

/** Un des 4 états de résolution de l'identité « Moi » (RG-002-03). */
export type MeIdentityStatus = 'unset' | 'matched' | 'mismatch' | 'manual';

export interface MeIdentity {
  status: MeIdentityStatus;
  /** Username tel que saisi, trimé ; `null` seulement à l'état `unset`. */
  username: string | null;
  /** Nom complet connu (uniquement à l'état `matched`), `null` sinon. */
  name: string | null;
  avatarUrl: string | null;
}

const UNSET: MeIdentity = { status: 'unset', username: null, name: null, avatarUrl: null };
const NO_MATCH_INFO: Pick<MeIdentity, 'name' | 'avatarUrl'> = {
  name: null,
  avatarUrl: null,
};

/**
 * Résout l'identité affichée dans l'aperçu à partir du champ username
 * (tel que saisi à l'écran) et du dernier test de connexion de la session
 * (US-001, transitoire — jamais persisté). Voir RG-002-03.
 *
 * Le résultat porte le username trimé (`MeIdentity.username`) pour que les
 * composants d'affichage n'aient jamais besoin de relire le formulaire.
 * @param username valeur courante du champ « Nom d'utilisateur GitLab ».
 * @param test état du test de connexion (`SettingsStore.test`).
 */
export function resolveMeIdentity(username: string, test: TestConnectionState): MeIdentity {
  const trimmed = username.trim();
  if (!trimmed) {
    return UNSET;
  }
  if (test.status === 'success' && test.result) {
    if (test.result.username.toLowerCase() === trimmed.toLowerCase()) {
      return {
        status: 'matched',
        username: trimmed,
        name: test.result.name,
        avatarUrl: test.result.avatarUrl,
      };
    }
    return { status: 'mismatch', username: trimmed, ...NO_MATCH_INFO };
  }
  return { status: 'manual', username: trimmed, ...NO_MATCH_INFO };
}
