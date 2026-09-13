import { ForgeMergeRequest } from './types/forge-merge-request';
import { ForgeProject } from './types/forge-project';
import { ForgeTestResult } from './types/forge-test-result';

/** Options bounding the time budget of a merge/pull requests fetch (RG-004-14). */
export interface FetchOpenMergeRequestsOptions {
  deadlineAt: number;
}

/**
 * Contract implemented once per forge type (RG-019-21). `SyncService`,
 * `ProjectsService` and `ConnectionsService` depend only on this contract,
 * never on a concrete forge module — `ForgeClientFactory` is the only place
 * that knows which implementation backs a given `Connection.type`.
 */
export interface ForgeClient {
  /**
   * Normalises a raw instance URL for this forge (RG-001-01), or `null` when
   * it cannot be interpreted as one.
   */
  normalizeUrl(input: string): string | null;

  /**
   * Verifies a token against the forge (RG-001-04) and returns the identity
   * it resolves to.
   * @throws ForgeAuthException when the token is rejected.
   * @throws ForgeScopeException when the token lacks the required scope.
   * @throws ForgeUnavailableException when the forge is unreachable.
   */
  testConnection(url: string, token: string): Promise<ForgeTestResult>;

  /**
   * Resolves a repository from a user-supplied path or URL (RG-003-01/03).
   * @returns `null` when the forge reports the repository as not found.
   */
  resolveProject(
    url: string,
    token: string,
    path: string,
  ): Promise<ForgeProject | null>;

  /**
   * Fetches every open merge/pull request of a repository, already
   * normalised (RG-004-01, RG-017-01, RG-019-21).
   * @throws ForgeTimeoutException when `options.deadlineAt` is exceeded.
   */
  fetchOpenMergeRequests(
    url: string,
    token: string,
    project: ForgeProject,
    options: FetchOpenMergeRequestsOptions,
  ): Promise<ForgeMergeRequest[]>;
}
