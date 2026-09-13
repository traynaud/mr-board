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
 * RG-G09 (per-user): a single username is "me" when it case-insensitively
 * matches my username or, failing that, my email.
 * ⚠️ Known limitation (see archi.md): author/reviewer/assignee records only
 * ever carry a `username` (GitLab never exposes another user's email to a
 * third-party token, and `User` doesn't store one) — the email fallback can
 * therefore never find a match in practice. Implemented faithfully to the
 * rule regardless.
 * @see RG-G09
 * @see RG-023-04/05
 */
export function isMe(username: string, identity: Identity): boolean {
  const value = identity.username || identity.email;
  if (!value) {
    return false;
  }
  return username.toLowerCase() === value.toLowerCase();
}

/**
 * RG-G09: a merge request is "mine" when my username — or, failing that,
 * my email — case-insensitively matches the author, one of the reviewers,
 * or one of the assignees.
 * @see RG-G09
 */
export function isMine(
  subject: MergeRequestIdentitySubject,
  identity: Identity,
): boolean {
  return (
    isMe(subject.authorUsername, identity) ||
    subject.reviewerUsernames.some((username) => isMe(username, identity)) ||
    subject.assigneeUsernames.some((username) => isMe(username, identity))
  );
}
