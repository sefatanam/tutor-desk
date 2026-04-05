// @REVIEW: Teacher Asset Management Component - CRUD for subject assets
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
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import {
  FormsModule,
  ReactiveFormsModule,
  FormBuilder,
  Validators,
} from '@angular/forms';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { SelectModule } from 'primeng/select';
import { DialogModule } from 'primeng/dialog';
import { FileUploadModule } from 'primeng/fileupload';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ToastModule } from 'primeng/toast';
import { SkeletonModule } from 'primeng/skeleton';
import { ConfirmationService, MessageService } from 'primeng/api';
import { SupabaseDatabaseAdapter } from '../../../core/adapters/supabase-database.adapter';
import { AuthStore } from '../../../core/store/auth.store';
import { getThemeToneClass } from '../../../core/utils/theme-tone.util';

import {
  Subject,
  Asset,
  AssetType,
  CreateAssetDto,
} from '../../../core/models';

interface AssetTypeOption {
  label: string;
  value: AssetType;
  icon: string;
}

@Component({
  selector: 'app-assets',
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterLink,
    CardModule,
    ButtonModule,
    TableModule,
    TagModule,
    TooltipModule,
    InputTextModule,
    TextareaModule,
    SelectModule,
    DialogModule,
    FileUploadModule,
    ConfirmDialogModule,
    ToastModule,
    SkeletonModule,
  ],
  providers: [ConfirmationService, MessageService],
  templateUrl: './assets.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AssetsComponent implements OnInit {
  readonly getThemeToneClass = getThemeToneClass;
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly db = inject(SupabaseDatabaseAdapter);
  private readonly authStore = inject(AuthStore);
  private readonly fb = inject(FormBuilder);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly messageService = inject(MessageService);
  // @REVIEW: DestroyRef for subscription cleanup
  private readonly destroyRef = inject(DestroyRef);

  // State
  readonly loading = signal(true);
  readonly loadingAssets = signal(true);
  readonly saving = signal(false);
  readonly subject = signal<Subject | null>(null);
  readonly assets = signal<Asset[]>([]);
  readonly editingAsset = signal<Asset | null>(null);
  readonly selectedFile = signal<File | null>(null);

  showDialog = false;

  readonly subjectId = computed(
    () => this.route.snapshot.paramMap.get('subjectId') ?? ''
  );
  readonly teacherId = computed(() => this.authStore.teacherId());

  readonly assetTypeOptions: AssetTypeOption[] = [
    { label: 'Document', value: 'document', icon: 'pi pi-file' },
    { label: 'Image', value: 'image', icon: 'pi pi-image' },
    { label: 'Video', value: 'video', icon: 'pi pi-video' },
    { label: 'Link', value: 'link', icon: 'pi pi-link' },
    { label: 'Other', value: 'other', icon: 'pi pi-paperclip' },
  ];

  assetForm = this.fb.group({
    title: ['', [Validators.required, Validators.minLength(2)]],
    description: [''],
    assetType: ['document' as AssetType, Validators.required],
    externalUrl: [''],
  });

  ngOnInit(): void {
    const subjectId = this.subjectId();
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
    this.loadingAssets.set(true);
    this.db.assets
      .getBySubject(subjectId, { page: 1, pageSize: 100 })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.assets.set(response.items);
          this.loadingAssets.set(false);
        },
        error: (err) => {
          console.error('Failed to load assets:', err);
          this.loadingAssets.set(false);
        },
      });
  }

  openCreateDialog(): void {
    this.editingAsset.set(null);
    this.selectedFile.set(null);
    this.assetForm.reset({ assetType: 'document' });
    this.showDialog = true;
  }

  openEditDialog(asset: Asset): void {
    this.editingAsset.set(asset);
    this.selectedFile.set(null);
    this.assetForm.patchValue({
      title: asset.title,
      description: asset.description ?? '',
      assetType: asset.assetType,
      externalUrl: asset.externalUrl ?? '',
    });
    this.showDialog = true;
  }

  closeDialog(): void {
    this.showDialog = false;
    this.editingAsset.set(null);
    this.selectedFile.set(null);
  }

  onFileSelect(event: { files: File[] }): void {
    if (event.files.length > 0) {
      this.selectedFile.set(event.files[0]);
    }
  }

  saveAsset(): void {
    if (this.assetForm.invalid) return;

    const formValue = this.assetForm.value;
    const teacherId = this.teacherId();
    const subjectId = this.subjectId();

    if (!teacherId || !subjectId) return;

    this.saving.set(true);

    if (this.editingAsset()) {
      // Update existing asset
      this.db.assets
        .update(this.editingAsset()!.id, {
          title: formValue.title ?? undefined,
          description: formValue.description ?? undefined,
          assetType: formValue.assetType as AssetType,
          externalUrl: formValue.externalUrl ?? undefined,
        })
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (updated) => {
            this.assets.update((list) =>
              list.map((a) => (a.id === updated.id ? updated : a))
            );
            this.saving.set(false);
            this.closeDialog();
            this.messageService.add({
              severity: 'success',
              summary: 'Updated',
              detail: 'Asset has been updated',
            });
          },
          error: (err) => {
            console.error('Failed to update asset:', err);
            this.saving.set(false);
            this.messageService.add({
              severity: 'error',
              summary: 'Error',
              detail: 'Failed to update asset',
            });
          },
        });
    } else {
      // Create new asset
      const file = this.selectedFile();

      if (formValue.assetType === 'link') {
        // Link type - no file upload
        this.createAsset({
          subjectId,
          teacherId,
          title: formValue.title!,
          description: formValue.description ?? undefined,
          assetType: 'link',
          externalUrl: formValue.externalUrl ?? undefined,
        });
      } else if (file) {
        // Upload file first
        const path = `${teacherId}/${subjectId}`;
        this.db.assets
          .uploadFile(file, path)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: (uploadResult) => {
              this.createAsset({
                subjectId,
                teacherId,
                title: formValue.title!,
                description: formValue.description ?? undefined,
                assetType: formValue.assetType as AssetType,
                fileUrl: uploadResult.url,
                fileName: uploadResult.fileName,
                fileSizeBytes: uploadResult.size,
                mimeType: file.type,
              });
            },
            error: (err) => {
              console.error('Failed to upload file:', err);
              this.saving.set(false);
              this.messageService.add({
                severity: 'error',
                summary: 'Error',
                detail: 'Failed to upload file',
              });
            },
          });
      } else {
        // No file - just create asset record
        this.createAsset({
          subjectId,
          teacherId,
          title: formValue.title!,
          description: formValue.description ?? undefined,
          assetType: formValue.assetType as AssetType,
        });
      }
    }
  }

  private createAsset(dto: CreateAssetDto): void {
    this.db.assets
      .create(dto)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (created) => {
          this.assets.update((list) => [...list, created]);
          this.saving.set(false);
          this.closeDialog();
          this.messageService.add({
            severity: 'success',
            summary: 'Created',
            detail: 'Asset has been added',
          });
        },
        error: (err) => {
          console.error('Failed to create asset:', err);
          this.saving.set(false);
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'Failed to create asset',
          });
        },
      });
  }

  confirmDelete(asset: Asset): void {
    this.confirmationService.confirm({
      message: `Are you sure you want to delete "${asset.title}"?`,
      header: 'Confirm Delete',
      icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => this.deleteAsset(asset),
    });
  }

  private deleteAsset(asset: Asset): void {
    this.db.assets
      .delete(asset.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.assets.update((list) => list.filter((a) => a.id !== asset.id));
          this.messageService.add({
            severity: 'success',
            summary: 'Deleted',
            detail: 'Asset has been deleted',
          });
        },
        error: (err) => {
          console.error('Failed to delete asset:', err);
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'Failed to delete asset',
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

  getAssetIcon(type: AssetType): string {
    const icons: Record<AssetType, string> = {
      document: 'pi pi-file',
      image: 'pi pi-image',
      video: 'pi pi-video',
      link: 'pi pi-link',
      other: 'pi pi-paperclip',
    };
    return icons[type] ?? 'pi pi-file';
  }

  getAssetTypeLabel(type: AssetType): string {
    return this.assetTypeOptions.find((o) => o.value === type)?.label ?? type;
  }

  getAssetTypeSeverity(
    type: AssetType
  ): 'success' | 'info' | 'warn' | 'danger' | 'secondary' {
    const map: Record<
      AssetType,
      'success' | 'info' | 'warn' | 'danger' | 'secondary'
    > = {
      document: 'info',
      image: 'success',
      video: 'warn',
      link: 'secondary',
      other: 'secondary',
    };
    return map[type] ?? 'secondary';
  }

  formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  }
}
