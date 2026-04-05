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
import { getThemeToneClass } from '../../../core/utils/theme-tone.util';

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
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SubjectAssetsComponent implements OnInit {
  readonly getThemeToneClass = getThemeToneClass;
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
      'td-tone-danger',
      'td-tone-warning',
      'td-tone-warning',
      'td-tone-success',
      'td-tone-success',
      'td-tone-info',
      'td-tone-info',
      'td-tone-primary',
      'td-tone-accent',
      'td-tone-accent',
    ];
    const index = name
      .split('')
      .reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[index % colors.length];
  }
}
