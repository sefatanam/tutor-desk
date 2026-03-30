import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZoneChangeDetection,
  isDevMode,
} from '@angular/core';
import { provideRouter, withViewTransitions } from '@angular/router';
import {
  provideHttpClient,
  withFetch,
  withInterceptors,
} from '@angular/common/http';
import {
  provideClientHydration,
  withEventReplay,
} from '@angular/platform-browser';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideServiceWorker } from '@angular/service-worker';

// PrimeNG
import { providePrimeNG } from 'primeng/config';
import { definePreset } from '@primeng/themes';
import Aura from '@primeng/themes/aura';

// Custom squarish preset — small border-radius, compact sizing
const TutorDeskPreset = definePreset(Aura, {
  primitive: {
    borderRadius: {
      none: '0',
      xs: '2px',
      sm: '2px',
      md: '4px',
      lg: '6px',
      xl: '8px',
    },
  },
  semantic: {
    primary: {
      50: '{emerald.50}',
      100: '{emerald.100}',
      200: '{emerald.200}',
      300: '{emerald.300}',
      400: '{emerald.400}',
      500: '{emerald.500}',
      600: '{emerald.600}',
      700: '{emerald.700}',
      800: '{emerald.800}',
      900: '{emerald.900}',
      950: '{emerald.950}',
    },
    colorScheme: {
      light: {
        surface: {
          0: '#ffffff',
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
          950: '#020617',
        },
      },
      dark: {
        surface: {
          0: '#161b22',
          50: '#21262d',
          100: '#30363d',
          200: '#484f58',
          300: '#6e7681',
          400: '#8b949e',
          500: '#b1bac4',
          600: '#c9d1d9',
          700: '#e6edf3',
          800: '#f0f6fc',
          900: '#f6f8fa',
          950: '#ffffff',
        },
      },
    },
  },
});

// Auth interceptor (attaches JWT to Go API requests)
import { authInterceptor } from './core/interceptors/auth.interceptor';

// Go API Database Adapter
import { provideGoApiDatabaseAdapter } from './core/adapters/go-api-database.adapter';

import { appRoutes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideClientHydration(withEventReplay()),
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(appRoutes, withViewTransitions()),
    provideHttpClient(withFetch(), withInterceptors([authInterceptor])),
    provideAnimationsAsync(),

    // PrimeNG with compact squarish TutorDesk preset
    providePrimeNG({
      theme: {
        preset: TutorDeskPreset,
        options: {
          prefix: 'p',
          darkModeSelector: '.dark-mode',
          cssLayer: {
            name: 'primeng',
            order: 'tailwind-base, primeng, tailwind-utilities',
          },
        },
      },
      ripple: true,
    }),

    // PWA Service Worker
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),

    // Go REST API Database Adapter (replaces Supabase)
    ...provideGoApiDatabaseAdapter(),
  ],
};
