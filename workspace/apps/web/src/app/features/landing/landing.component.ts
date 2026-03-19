// @REVIEW: Landing Page Component
// Modern SaaS-style landing page with premium animations

import {
  Component,
  ChangeDetectionStrategy,
  signal,
  OnInit,
  OnDestroy,
  PLATFORM_ID,
  inject,
} from '@angular/core';
import { isPlatformBrowser, NgClass } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { RippleModule } from 'primeng/ripple';
import { DividerModule } from 'primeng/divider';

@Component({
  selector: 'app-landing',
  imports: [RouterLink, ButtonModule, CardModule, RippleModule, DividerModule, NgClass],
  templateUrl: './landing.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LandingComponent implements OnInit, OnDestroy {
  private readonly platformId = inject(PLATFORM_ID);

  readonly mobileMenuOpen = signal(false);
  readonly currentYear = new Date().getFullYear();

  readonly stats = [
    { value: '10K+', label: 'Teachers' },
    { value: '500K+', label: 'Students' },
    { value: '1M+', label: 'Exams' },
    { value: '99.9%', label: 'Uptime' },
  ];

  readonly features = [
    {
      icon: 'pi-users',
      title: 'Student Management',
      description:
        'Easily manage student profiles, track progress, and organize classes efficiently.',
      color: 'td-gradient-success',
    },
    {
      icon: 'pi-file-edit',
      title: 'Exam Creation',
      description:
        'Create MCQ exams with configurable timers, anti-cheat measures, and auto-grading.',
      color: 'td-gradient-info',
    },
    {
      icon: 'pi-clock',
      title: 'Smart Timer',
      description:
        'Per-question timers with skip-and-return functionality for flexible exam taking.',
      color: 'td-gradient-warning',
    },
    {
      icon: 'pi-shield',
      title: 'Anti-Cheat System',
      description:
        'Fullscreen lock, tab detection, and auto-submit on window blur.',
      color: 'td-gradient-danger',
    },
    {
      icon: 'pi-chart-bar',
      title: 'Analytics Dashboard',
      description:
        'Comprehensive statistics and insights for better teaching decisions.',
      color: 'td-gradient-accent',
    },
    {
      icon: 'pi-mobile',
      title: 'Mobile First',
      description:
        'Progressive Web App designed for seamless mobile experience.',
      color: 'td-gradient-accent',
    },
  ];

  readonly simplicityPoints = [
    'No complex setup required',
    'Intuitive interface for all users',
    'Real-time sync across devices',
    'Automatic backups and security',
  ];

  readonly contactMethods = [
    { icon: 'pi-envelope', title: 'Email', value: 'hello@tutordesk.com' },
    { icon: 'pi-phone', title: 'Phone', value: '+1 (555) 123-4567' },
    { icon: 'pi-map-marker', title: 'Location', value: 'San Francisco, CA' },
  ];

  private scrollHandler: (() => void) | null = null;

  getStaggerClass(index: number): string {
    return index > 0 ? `stagger-${Math.min(index, 5)}` : '';
  }

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.initScrollAnimations();
    }
  }

  ngOnDestroy(): void {
    if (this.scrollHandler && isPlatformBrowser(this.platformId)) {
      window.removeEventListener('scroll', this.scrollHandler);
    }
  }

  private initScrollAnimations(): void {
    const observerOptions = {
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px',
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('animate-visible');
        }
      });
    }, observerOptions);

    // Observe elements that should animate on scroll
    document
      .querySelectorAll('.landing__feature-card, .landing__contact-card')
      .forEach((el) => {
        observer.observe(el);
      });
  }
}
