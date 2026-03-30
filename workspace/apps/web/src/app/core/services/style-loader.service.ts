import { inject, Injectable, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

/**
 * Lazily injects a CSS bundle (compiled by Angular with inject:false) into
 * the document <head> the first time a feature is requested. Subsequent calls
 * for the same bundle are no-ops — the browser's cache handles the rest.
 *
 * Usage in a route guard:
 *   inject(StyleLoaderService).load('feature-teacher');
 */
@Injectable({ providedIn: 'root' })
export class StyleLoaderService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly loaded = new Set<string>();

  load(bundleName: string): void {
    if (!isPlatformBrowser(this.platformId)) return;
    if (this.loaded.has(bundleName)) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `${bundleName}.css`;
    document.head.appendChild(link);
    this.loaded.add(bundleName);
  }
}
