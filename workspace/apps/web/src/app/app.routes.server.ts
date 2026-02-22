// @REVIEW: Server-side rendering routes configuration
import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  // Static pages - prerender for best performance
  {
    path: '',
    renderMode: RenderMode.Server,
  },
  {
    path: 'auth/**',
    renderMode: RenderMode.Client,
  },
  // Protected routes - server render (require auth check)
  {
    path: 'admin/**',
    renderMode: RenderMode.Client,
  },
  {
    path: 'teacher/**',
    renderMode: RenderMode.Client,
  },
  {
    path: 'student/**',
    renderMode: RenderMode.Client,
  },
  // Fallback
  {
    path: '**',
    renderMode: RenderMode.Server,
  },
];
