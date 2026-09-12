export interface MergeRequestIdentitySubject {
  authorUsername: string;
  reviewerUsernames: string[];
  assigneeUsernames: string[];
}

export interface Identity {
  username: string | null;
  email: string | null;
}

/**
 * RG-G09: a merge request is "mine" when my username — or, failing that,
 * my email — case-insensitively matches the author, one of the reviewers,
 * or one of the assignees.
 * ⚠️ Known limitation (see archi.md): author/reviewer/assignee records
 * only ever carry a `username` (GitLab never exposes another user's email
 * to a third-party token, and `User` doesn't store one) — the email
 * fallback can therefore never find a match in practice. Implemented
 * faithfully to the rule regardless.
 * @see RG-G09
 */
export function isMine(
  subject: MergeRequestIdentitySubject,
  identity: Identity,
): boolean {
  const value = identity.username || identity.email;
  if (!value) {
    return false;
  }
  const needle = value.toLowerCase();
  const usernames = [
    subject.authorUsername,
    ...subject.reviewerUsernames,
    ...subject.assigneeUsernames,
  ];
  return usernames.some((username) => username.toLowerCase() === needle);
}
