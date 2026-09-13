import { ForgeTypeUnsupportedException } from '../../common/exceptions';
import { GitlabClientService } from '../gitlab/gitlab-client.service';
import { ForgeClientFactory } from './forge-client.factory';

describe('ForgeClientFactory', () => {
  const gitlab = {} as GitlabClientService;
  const factory = new ForgeClientFactory(gitlab);

  it('should_return_the_gitlab_client_for_the_gitlab_type', () => {
    expect(factory.forType('gitlab')).toBe(gitlab);
  });

  it('should_throw_for_the_github_type', () => {
    expect(() => factory.forType('github')).toThrow(
      ForgeTypeUnsupportedException,
    );
  });
});
