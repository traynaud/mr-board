import { buildStaticOptions } from './static.module.js';

describe('buildStaticOptions', () => {
  it('should_serve_root_path_and_exclude_api_routes', () => {
    const options = buildStaticOptions('/app/public');

    expect(options.rootPath).toBe('/app/public');
    expect(options.exclude).toEqual(['/api/v1/{*path}']);
    expect(options.serveStaticOptions.index).toBe('index.html');
  });
});
