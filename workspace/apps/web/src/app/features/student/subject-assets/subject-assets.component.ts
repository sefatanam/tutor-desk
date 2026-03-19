// @REVIEW: Student Subject Assets - View assets and comment on them
import {
  Component,
  ChangeDetectionStrategy,
  OnInit,
  inject,
  signal,
  computed,
  DestroyRef,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { SkeletonModule } from 'primeng/skeleton';
import { TooltipModule } from 'primeng/tooltip';
import { TextareaModule } from 'primeng/textarea';
import { DividerModule } from 'primeng/divider';
import { AvatarModule } from 'primeng/avatar';
import { ToastModule } from 'primeng/toast';
import { MessageService, ConfirmationService } from 'primeng/api';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { SupabaseDatabaseAdapter } from '../../../core/adapters/supabase-database.adapter';
import { AuthStore } from '../../../core/store/auth.store';
import {
  Subject,
  Asset,
  AssetCommentWithUser,
  CreateAssetCommentDto,
} from '../../../core/models';

@Component({
  selector: 'app-subject-assets',
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    CardModule,
    ButtonModule,
    TagModule,
    SkeletonModule,
    TooltipModule,
    TextareaModule,
    DividerModule,
    AvatarModule,
    ToastModule,
    ConfirmDialogModule,
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './subject-assets.component.html',
  styles: `
    .page { padding: 1.5rem; max-width: 900px; margin: 0 auto; }

    .page-nav { margin-bottom: 1rem; }

    .loading { padding: 2rem; }

    .empty-state {
      display: flex; flex-direction: column; align-items: center;
      padding: 4rem 2rem; text-align: center;
    }
    .empty-state i { font-size: 4rem; color: var(--primary-color); opacity: 0.5; margin-bottom: 1rem; }
    .empty-state h2 { margin: 0 0 0.5rem; font-size: 1.25rem; }
    .empty-state p { margin: 0 0 1.5rem; color: var(--text-color-secondary); }

    .subject-header {
      display: flex; gap: 1rem; align-items: flex-start; margin-bottom: 2rem;
    }
    .subject-badge {
      width: 56px; height: 56px; border-radius: 14px; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
      color: white; font-size: 1.5rem;
    }
    .subject-header h1 { margin: 0; font-size: 1.5rem; font-weight: 600; }
    .subject-desc { margin: 0.25rem 0 0; color: var(--text-color-secondary); }

    .assets-list { display: flex; flex-direction: column; gap: 1.5rem; }

    :host ::ng-deep .asset-card .p-card-content { padding: 1.25rem; }

    .asset-header {
      display: flex; justify-content: space-between; align-items: center;
      margin-bottom: 1rem;
    }
    .asset-header__info { display: flex; gap: 0.75rem; align-items: center; }
    .asset-icon { font-size: 1.5rem; color: var(--primary-color); }
    .asset-title { margin: 0 0 0.25rem; font-size: 1.125rem; font-weight: 600; }

    .asset-description {
      color: var(--text-color-secondary); margin: 0 0 1rem;
      line-height: 1.5;
    }

    .comments-section { margin-top: 0.5rem; }
    .comments-title {
      margin: 0 0 1rem; font-size: 1rem; font-weight: 600;
      display: flex; align-items: center; gap: 0.5rem;
    }
    .comments-title i { color: var(--primary-color); }

    .comment-input {
      display: flex; gap: 0.75rem; margin-bottom: 1.5rem;
      align-items: flex-start;
    }
    .comment-input__field {
      flex: 1; display: flex; flex-direction: column; gap: 0.5rem;
      align-items: flex-end;
    }
    .comment-input__field textarea { width: 100%; }

    .no-comments {
      color: var(--text-color-secondary); font-style: italic;
      text-align: center; padding: 1rem;
    }

    .comments-list { display: flex; flex-direction: column; gap: 1rem; }

    .comment { display: flex; gap: 0.75rem; }
    .comment__content { flex: 1; }
    .comment__header {
      display: flex; align-items: center; gap: 0.5rem;
      margin-bottom: 0.25rem; flex-wrap: wrap;
    }
    .comment__author { font-weight: 600; font-size: 0.875rem; }
    .comment__role {
      font-size: 0.75rem; color: var(--text-color-secondary);
      background: var(--surface-ground); padding: 0.125rem 0.375rem; border-radius: 4px;
      text-transform: capitalize;
    }
    .comment__time { font-size: 0.75rem; color: var(--text-color-secondary); }
    .comment__text { margin: 0; font-size: 0.875rem; line-height: 1.5; }

    .replies {
      margin-top: 0.75rem; padding-left: 1rem;
      border-left: 2px solid var(--surface-border);
    }
    .reply { margin-top: 0.5rem; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SubjectAssetsComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly db = inject(SupabaseDatabaseAdapter);
  private readonly authStore = inject(AuthStore);
  private readonly messageService = inject(MessageService);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly destroyRef = inject(DestroyRef);

  readonly loading = signal(true);
  readonly subject = signal<Subject | null>(null);
  readonly assets = signal<Asset[]>([]);
  readonly commentsMap = signal<Record<string, AssetCommentWithUser[]>>({});
  readonly commentInputs = signal<Record<string, string>>({});
  readonly postingComment = signal<string | null>(null);

  readonly currentUserId = computed(() => this.authStore.user()?.id ?? '');
  readonly currentUserName = computed(
    () => this.authStore.user()?.fullName ?? 'User'
  );
  readonly canComment = computed(() => !!this.authStore.user());

  ngOnInit(): void {
    const subjectId = this.route.snapshot.paramMap.get('subjectId');
    if (!subjectId) {
      this.loading.set(false);
      return;
    }
    this.loadSubject(subjectId);
    this.loadAssets(subjectId);
  }

  private loadSubject(id: string): void {
    this.db.subjects
      .getById(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (subject) => {
          this.subject.set(subject);
          this.loading.set(false);
        },
        error: (err) => {
          console.error('Failed to load subject:', err);
          this.loading.set(false);
        },
      });
  }

  private loadAssets(subjectId: string): void {
    this.db.assets
      .getBySubject(subjectId, { page: 1, pageSize: 100 })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          const publishedAssets = response.items.filter((a) => a.isPublished);
          this.assets.set(publishedAssets);
          // Load comments for each asset
          publishedAssets.forEach((asset) => this.loadComments(asset.id));
        },
        error: (err) => {
          console.error('Failed to load assets:', err);
        },
      });
  }

  private loadComments(assetId: string): void {
    this.db.comments
      .getByAsset(assetId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (comments) => {
          this.commentsMap.update((map) => ({
            ...map,
            [assetId]: comments.filter((c) => c.isVisible),
          }));
        },
        error: (err) => {
          console.error('Failed to load comments:', err);
        },
      });
  }

  getAssetComments(assetId: string): AssetCommentWithUser[] {
    return this.commentsMap()[assetId] ?? [];
  }

  postComment(assetId: string): void {
    const content = this.commentInputs()[assetId]?.trim();
    const userId = this.currentUserId();

    if (!content || !userId) return;

    this.postingComment.set(assetId);

    const dto: CreateAssetCommentDto = {
      assetId,
      userId,
      content,
    };

    this.db.comments
      .create(dto)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          // Clear input and reload comments
          this.commentInputs.update((inputs) => ({ ...inputs, [assetId]: '' }));
          this.loadComments(assetId);
          this.postingComment.set(null);
          this.messageService.add({
            severity: 'success',
            summary: 'Posted',
            detail: 'Your comment has been posted',
          });
        },
        error: (err) => {
          console.error('Failed to post comment:', err);
          this.postingComment.set(null);
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'Failed to post comment',
          });
        },
      });
  }

  confirmDeleteComment(comment: AssetCommentWithUser, assetId: string): void {
    this.confirmationService.confirm({
      message: 'Are you sure you want to delete this comment?',
      header: 'Delete Comment',
      icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => this.deleteComment(comment.id, assetId),
    });
  }

  private deleteComment(commentId: string, assetId: string): void {
    this.db.comments
      .delete(commentId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.loadComments(assetId);
          this.messageService.add({
            severity: 'success',
            summary: 'Deleted',
            detail: 'Comment has been deleted',
          });
        },
        error: (err) => {
          console.error('Failed to delete comment:', err);
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'Failed to delete comment',
          });
        },
      });
  }

  openAsset(asset: Asset): void {
    const url = asset.externalUrl || asset.fileUrl;
    if (url) {
      window.open(url, '_blank');
    }
  }

  getAssetIcon(type: string): string {
    const icons: Record<string, string> = {
      document: 'pi pi-file',
      image: 'pi pi-image',
      video: 'pi pi-video',
      link: 'pi pi-link',
      other: 'pi pi-paperclip',
    };
    return icons[type] ?? 'pi pi-file';
  }

  getInitials(name: string): string {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }

  getAvatarColor(name: string): string {
    const colors = [
      '#f87171',
      '#fb923c',
      '#fbbf24',
      '#a3e635',
      '#4ade80',
      '#2dd4bf',
      '#38bdf8',
      '#818cf8',
      '#c084fc',
      '#f472b6',
    ];
    const index = name
      .split('')
      .reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[index % colors.length];
  }
}
