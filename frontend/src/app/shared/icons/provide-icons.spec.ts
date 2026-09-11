import { TestBed } from '@angular/core/testing';
import { MatIconRegistry } from '@angular/material/icon';
import { firstValueFrom } from 'rxjs';
import { ICONS, provideIcons } from './provide-icons';

describe('provideIcons', () => {
  it('should_register_every_lucide_icon', async () => {
    TestBed.configureTestingModule({ providers: [provideIcons()] });
    const registry = TestBed.inject(MatIconRegistry);

    for (const name of Object.keys(ICONS)) {
      const svg = await firstValueFrom(registry.getNamedSvgIcon(name));
      expect(svg.getAttribute('viewBox')).toBe('0 0 24 24');
      expect(svg.getAttribute('stroke')).toBe('currentColor');
    }
  });
});
