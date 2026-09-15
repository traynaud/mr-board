import { buildHelmetOptions } from './helmet-options.js';

describe('buildHelmetOptions', () => {
  it('should_keep_helmet_defaults_in_api_only_mode', () => {
    expect(buildHelmetOptions(undefined)).toEqual({});
  });

  it('should_relax_csp_when_serving_the_frontend', () => {
    const options = buildHelmetOptions('/app/public');
    const csp = options.contentSecurityPolicy as {
      directives: Record<string, unknown>;
    };

    expect(csp.directives['img-src']).toContain('https:');
    expect(csp.directives['font-src']).toContain('https://fonts.gstatic.com');
    expect(csp.directives['upgrade-insecure-requests']).toBeNull();
    expect(options.crossOriginEmbedderPolicy).toBe(false);
  });
});
