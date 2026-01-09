# Release 1: Skeleton & Foundation

## Objective
Establish the foundational architecture, configure PrimeNG with Aura Green theme, and create the application skeleton with a SaaS-style landing page.

---

## Phase 1: PrimeNG Configuration

### Tasks
- [ ] Configure Aura Green theme preset in `app.config.ts`
- [ ] Import PrimeNG styles in `styles.css`
- [ ] Setup PrimeNG animation module
- [ ] Test theme configuration with sample button

### Files to Modify
- `tutor-desk/src/app/app.config.ts`
- `tutor-desk/src/styles.css`

### Theme Configuration Code
```typescript
import { providePrimeNG } from 'primeng/config';
import Aura from '@primeng/themes/aura';
import { definePreset } from '@primeng/themes';

const TutorDeskPreset = definePreset(Aura, {
  semantic: {
    primary: {
      50: '{green.50}',
      100: '{green.100}',
      200: '{green.200}',
      300: '{green.300}',
      400: '{green.400}',
      500: '{green.500}',
      600: '{green.600}',
      700: '{green.700}',
      800: '{green.800}',
      900: '{green.900}',
      950: '{green.950}'
    }
  }
});

// In providers:
providePrimeNG({
  theme: {
    preset: TutorDeskPreset,
    options: {
      darkModeSelector: '.dark-mode'
    }
  }
})
```

---

## Phase 2: Folder Structure

### Tasks
- [ ] Create `core/` directory structure
- [ ] Create `shared/` directory structure
- [ ] Create `layout/` directory structure
- [ ] Create `features/` directory structure
- [ ] Create placeholder files for each module

### Directory Structure
```
src/app/
├── core/
│   ├── guards/
│   │   ├── auth.guard.ts
│   │   ├── role.guard.ts
│   │   └── index.ts
│   ├── interceptors/
│   │   └── index.ts
│   ├── services/
│   │   ├── supabase.service.ts
│   │   ├── auth.service.ts
│   │   ├── database.service.ts
│   │   ├── storage.service.ts
│   │   └── index.ts
│   └── models/
│       ├── user.model.ts
│       ├── exam.model.ts
│       ├── subject.model.ts
│       └── index.ts
├── shared/
│   ├── components/
│   │   └── index.ts
│   ├── pipes/
│   │   └── index.ts
│   └── directives/
│       └── index.ts
├── layout/
│   ├── components/
│   │   ├── header/
│   │   ├── sidebar/
│   │   ├── footer/
│   │   └── shell/
│   └── layout.routes.ts
└── features/
    ├── landing/
    ├── auth/
    ├── super-admin/
    ├── teacher/
    └── student/
```

---

## Phase 3: Core Models

### Tasks
- [ ] Create User model with roles enum
- [ ] Create Subject model
- [ ] Create Exam model
- [ ] Create Question model

### User Model
```typescript
export enum UserRole {
  SUPER_ADMIN = 'super_admin',
  TEACHER = 'teacher',
  STUDENT = 'student'
}

export enum UserStatus {
  PENDING = 'pending',
  ACTIVE = 'active',
  DISABLED = 'disabled'
}

export interface User {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  status: UserStatus;
  createdAt: number;
  updatedAt: number;
  // Teacher specific
  teacherId?: string;
  // Student specific
  assignedSubjects?: string[];
}
```

---

## Phase 4: Layout Components

### Tasks
- [ ] Create shell component (main layout wrapper)
- [ ] Create header component with logo and navigation
- [ ] Create sidebar component with PrimeNG menu
- [ ] Create footer component
- [ ] Setup responsive behavior

### Shell Component Structure
```
+----------------------------------+
|           HEADER                 |
+--------+-------------------------+
|        |                         |
| SIDE   |      CONTENT            |
| BAR    |      (router-outlet)    |
|        |                         |
+--------+-------------------------+
|           FOOTER                 |
+----------------------------------+
```

### PrimeNG Components to Use
- `p-menubar` - Header navigation
- `p-panelmenu` or `p-menu` - Sidebar menu
- `p-button` - Buttons
- `p-avatar` - User avatar
- `p-divider` - Section dividers

---

## Phase 5: Routing Setup

### Tasks
- [ ] Configure lazy loading for all feature modules
- [ ] Setup route guards placeholders
- [ ] Configure 404 and error routes
- [ ] Setup landing route as default

### Route Structure
```typescript
export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./features/landing/landing.component')
  },
  {
    path: 'auth',
    loadChildren: () => import('./features/auth/auth.routes')
  },
  {
    path: 'admin',
    loadChildren: () => import('./features/super-admin/super-admin.routes'),
    canActivate: [authGuard, roleGuard('super_admin')]
  },
  {
    path: 'teacher',
    loadChildren: () => import('./features/teacher/teacher.routes'),
    canActivate: [authGuard, roleGuard('teacher')]
  },
  {
    path: 'student',
    loadChildren: () => import('./features/student/student.routes'),
    canActivate: [authGuard, roleGuard('student')]
  },
  {
    path: '**',
    loadComponent: () => import('./shared/components/not-found/not-found.component')
  }
];
```

---

## Phase 6: Landing Page (SaaS Style)

### Tasks
- [ ] Create landing component
- [ ] Build hero section with CTA
- [ ] Build features section with icons
- [ ] Build about/benefits section
- [ ] Build testimonials/trust section (placeholder)
- [ ] Build CTA section
- [ ] Build footer with links
- [ ] Add subtle animations

### Landing Page Sections
1. **Hero** - Headline, subtitle, CTA buttons (Login/Get Started)
2. **Features** - 3-4 feature cards with icons
3. **How It Works** - Step-by-step visual guide
4. **Benefits** - Why choose Tutor Desk
5. **CTA** - Final call to action
6. **Footer** - Links, contact, developer info

### PrimeNG Components for Landing
- `p-button` - CTA buttons
- `p-card` - Feature cards
- `p-divider` - Section separators
- `p-image` - Hero images

---

## Phase 7: Supabase Service Wrappers

### Tasks
- [ ] Create AuthService with signal-based state
- [ ] Create DatabaseService wrapper for Supabase
- [ ] Create StorageService wrapper for Supabase Storage
- [ ] Setup environment configuration with Supabase keys

### AuthService Skeleton
```typescript
@Injectable({ providedIn: 'root' })
export class AuthService {
  private supabase = inject(SupabaseService);

  // Signal-based state
  currentUser = signal<User | null>(null);
  isLoading = signal<boolean>(true);
  isAuthenticated = computed(() => !!this.currentUser());

  // Methods (to be implemented in Release 2)
  async loginWithGoogle(): Promise<void> { }
  async loginWithCredentials(email: string, password: string): Promise<void> { }
  async logout(): Promise<void> { }
}
```

---

## Deliverables Checklist

### Configuration
- [ ] PrimeNG Aura Green theme configured
- [ ] Tailwind CSS working with PrimeNG
- [ ] Environment files setup

### Structure
- [ ] Folder structure created
- [ ] All barrel exports (index.ts) in place
- [ ] Models defined

### Components
- [ ] Shell layout component
- [ ] Header component
- [ ] Sidebar component (placeholder)
- [ ] Footer component
- [ ] Landing page with all sections

### Routing
- [ ] Lazy loading configured
- [ ] Guard placeholders created
- [ ] 404 page created

### Services
- [ ] SupabaseService (client wrapper)
- [ ] AuthService skeleton
- [ ] DatabaseService skeleton
- [ ] StorageService skeleton

---

## Success Criteria

1. App loads with PrimeNG Aura Green theme
2. Landing page displays with all sections
3. Navigation structure is clear
4. Clicking "Login" navigates to auth routes
5. All routes are lazy-loaded
6. No console errors
7. Mobile-responsive layout
