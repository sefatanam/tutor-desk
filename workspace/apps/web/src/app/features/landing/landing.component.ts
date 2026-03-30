import {
  Component,
  ChangeDetectionStrategy,
  ViewEncapsulation,
  signal,
  OnDestroy,
  inject,
  afterNextRender,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { RippleModule } from 'primeng/ripple';
import { DividerModule } from 'primeng/divider';

@Component({
  selector: 'app-landing',
  imports: [RouterLink, ButtonModule, RippleModule, DividerModule],
  templateUrl: './landing.component.html',
  styleUrl: './landing.component.css',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LandingComponent implements OnDestroy {
  readonly mobileMenuOpen = signal(false);
  readonly currentYear = new Date().getFullYear();
  readonly activeTestimonialIndex = signal(0);

  readonly stats = [
    { display: '১০,০০০+', label: 'শিক্ষক', labelEn: 'Teachers' },
    { display: '৫ লক্ষ+', label: 'শিক্ষার্থী', labelEn: 'Students' },
    { display: '১০ লক্ষ+', label: 'পরীক্ষা', labelEn: 'Exams Held' },
    { display: '৯৯.৯%', label: 'আপটাইম', labelEn: 'Uptime' },
  ];

  readonly features = [
    {
      icon: 'pi-users',
      title: 'ছাত্র ব্যবস্থাপনা',
      titleEn: 'Student Management',
      description: 'SSC ও HSC শিক্ষার্থীদের অগ্রগতি ট্র্যাক করুন সহজেই।',
      color: 'green',
      size: 'wide',
    },
    {
      icon: 'pi-file-edit',
      title: 'MCQ পরীক্ষা তৈরি',
      titleEn: 'Exam Creation',
      description: 'টাইমার, অটো-গ্রেডিং ও অ্যান্টি-চিট সহ পরীক্ষা তৈরি করুন।',
      color: 'blue',
      size: 'normal',
    },
    {
      icon: 'pi-shield',
      title: 'অ্যান্টি-চিট সিস্টেম',
      titleEn: 'Anti-Cheat',
      description: 'ফুলস্ক্রিন লক ও ট্যাব ডিটেকশন।',
      color: 'red',
      size: 'normal',
    },
    {
      icon: 'pi-chart-bar',
      title: 'Analytics Dashboard',
      titleEn: 'Analytics',
      description: 'শিক্ষকদের জন্য ব্যাপক পরিসংখ্যান ও অন্তর্দৃষ্টি।',
      color: 'purple',
      size: 'tall',
    },
    {
      icon: 'pi-clock',
      title: 'স্মার্ট টাইমার',
      titleEn: 'Smart Timer',
      description: 'প্রতি প্রশ্নে আলাদা টাইমার।',
      color: 'orange',
      size: 'normal',
    },
    {
      icon: 'pi-mobile',
      title: 'মোবাইল ফার্স্ট',
      titleEn: 'Mobile First',
      description: 'বাংলাদেশের শিক্ষার্থীদের জন্য মোবাইল অপটিমাইজড PWA।',
      color: 'cyan',
      size: 'wide',
    },
  ];

  readonly howItWorksSteps = [
    { step: '০১', icon: 'pi-user-plus', title: 'সাইন আপ করুন', titleEn: 'Sign Up Free', description: 'একটি বিনামূল্যে অ্যাকাউন্ট তৈরি করুন মাত্র ৩০ সেকেন্ডে।' },
    { step: '০২', icon: 'pi-users', title: 'শিক্ষার্থী যোগ করুন', titleEn: 'Add Students', description: 'আপনার ব্যাচ তৈরি করুন এবং শিক্ষার্থীদের আমন্ত্রণ জানান।' },
    { step: '০৩', icon: 'pi-file-edit', title: 'পরীক্ষা তৈরি করুন', titleEn: 'Create Exams', description: 'MCQ প্রশ্নপত্র তৈরি করুন এবং টাইমার সেট করুন।' },
    { step: '০৪', icon: 'pi-chart-bar', title: 'ফলাফল বিশ্লেষণ করুন', titleEn: 'Analyze Results', description: 'রিয়েল-টাইম ফলাফল ও বিস্তারিত analytics দেখুন।' },
  ];

  readonly testimonials = [
    {
      name: 'রাহেলা বেগম',
      role: 'গণিত শিক্ষক, ঢাকা',
      avatar: 'রা',
      avatarColor: '#10b981',
      quote: 'Tutor Desk আমার SSC ব্যাচের পরীক্ষা নেওয়া অনেক সহজ করে দিয়েছে। অটো-গ্রেডিং বিশেষভাবে সময় বাঁচায়।',
    },
    {
      name: 'মোহাম্মদ রাফি',
      role: 'HSC শিক্ষার্থী, চট্টগ্রাম',
      avatar: 'রা',
      avatarColor: '#3b82f6',
      quote: 'পরীক্ষার সময় টাইমার দেখতে পাওয়া খুবই সহায়ক। আমার স্কোর উন্নত হয়েছে এবং পরীক্ষার ভয় কমেছে।',
    },
    {
      name: 'সুমাইয়া আক্তার',
      role: 'পদার্থবিজ্ঞান শিক্ষক, সিলেট',
      avatar: 'সু',
      avatarColor: '#8b5cf6',
      quote: 'Analytics dashboard থেকে কোন শিক্ষার্থী কোন বিষয়ে দুর্বল তা এখন সহজেই বুঝতে পারি।',
    },
  ];

  private observers: IntersectionObserver[] = [];
  private scrollHandler: (() => void) | null = null;

  constructor() {
    afterNextRender(() => {
      this.initScrollAnimations();
      this.initNavScroll();
    });
  }

  nextTestimonial(): void {
    this.activeTestimonialIndex.update(i => (i + 1) % this.testimonials.length);
  }

  prevTestimonial(): void {
    this.activeTestimonialIndex.update(i => i === 0 ? this.testimonials.length - 1 : i - 1);
  }

  ngOnDestroy(): void {
    this.observers.forEach(o => o.disconnect());
    if (this.scrollHandler) {
      window.removeEventListener('scroll', this.scrollHandler);
    }
  }

  private initNavScroll(): void {
    this.scrollHandler = () => {
      const nav = document.querySelector('.td-lp-nav');
      if (nav) {
        nav.classList.toggle('td-lp-nav--scrolled', window.scrollY > 20);
      }
    };
    window.addEventListener('scroll', this.scrollHandler, { passive: true });
  }

  private initScrollAnimations(): void {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('is-visible'); });
    }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

    document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
    this.observers.push(observer);
  }
}
