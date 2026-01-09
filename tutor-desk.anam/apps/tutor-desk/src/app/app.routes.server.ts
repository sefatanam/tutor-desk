// @REVIEW: Server-side rendering routes configuration
import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  // Static pages - prerender for best performance
  {
    path: '',
    renderMode: RenderMode.Prerender,
  },
  {
    path: 'auth/**',
    renderMode: RenderMode.Server,
  },
  // Protected routes - server render (require auth check)
  {
    path: 'admin/**',
    renderMode: RenderMode.Server,
  },
  {
    path: 'teacher/**',
    renderMode: RenderMode.Server,
  },
  {
    path: 'student/**',
    renderMode: RenderMode.Server,
  },
  // Fallback
  {
    path: '**',
    renderMode: RenderMode.Server,
  },
];
