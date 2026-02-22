// @REVIEW: Auth HTTP Interceptor
// Automatically adds Supabase anon key to all requests to the Supabase domain
// This ensures Edge Functions receive proper authentication

import { HttpInterceptorFn } from '@angular/common/http';
import { environment } from '../../../environments/environment';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  // Only add headers for Supabase requests
  if (req.url.includes(environment.supabase.url)) {
    // Check if Authorization header is already set (for authenticated requests)
    const hasAuthHeader = req.headers.has('Authorization');

    // Clone request with additional headers
    const modifiedReq = req.clone({
      setHeaders: {
        // Always include apikey
        apikey: environment.supabase.anonKey,
        // Only set Authorization if not already set
        ...(!hasAuthHeader && {
          Authorization: `Bearer ${environment.supabase.anonKey}`,
        }),
      },
    });

    return next(modifiedReq);
  }

  return next(req);
};
