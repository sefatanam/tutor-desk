// @REVIEW: Teacher Asset Management Component - CRUD for subject assets
import { Component, ChangeDetectionStrategy, OnInit, inject, signal, computed, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
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
import { Subject, Asset, AssetType, CreateAssetDto } from '../../../core/models';

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
  template: `
    <div class="assets-page">
      <!-- Breadcrumb & Back -->
      <div class="page-nav">
        <p-button 
          icon="pi pi-arrow-left" 
          label="Back to Subject" 
          [text]="true" 
          [routerLink]="['/teacher/subjects', subjectId()]"
        />
      </div>

      @if (loading()) {
        <div class="loading-container">
          <p-skeleton width="300px" height="32px" styleClass="mb-3" />
          <p-skeleton width="100%" height="400px" />
        </div>
      } @else if (!subject()) {
        <div class="not-found">
          <i class="pi pi-exclamation-circle"></i>
          <h2>Subject Not Found</h2>
          <p>The subject you're looking for doesn't exist or has been deleted.</p>
          <p-button label="Go to Subjects" routerLink="/teacher/subjects" />
        </div>
      } @else {
        <!-- Page Header -->
        <header class="page-header">
          <div class="page-header__info">
            <div class="subject-badge" [style.background]="subject()!.color">
              <i [class]="'pi ' + subject()!.icon"></i>
            </div>
            <div>
              <h1 class="page-title">{{ subject()!.name }} - Assets</h1>
              <p class="page-subtitle">Manage learning materials for this subject</p>
            </div>
          </div>
          <p-button 
            icon="pi pi-plus" 
            label="Add Asset" 
            (click)="openCreateDialog()"
          />
        </header>

        <!-- Assets Table -->
        <p-card>
          @if (loadingAssets()) {
            <div class="skeleton-container">
              @for (i of [1, 2, 3, 4]; track i) {
                <p-skeleton width="100%" height="60px" styleClass="mb-2" />
              }
            </div>
          } @else if (assets().length === 0) {
            <div class="empty-state">
              <i class="pi pi-folder-open"></i>
              <h2>No Assets Yet</h2>
              <p>Start adding learning materials like documents, images, videos, or links.</p>
              <p-button 
                label="Add First Asset" 
                icon="pi pi-plus"
                (click)="openCreateDialog()"
              />
            </div>
          } @else {
            <p-table 
              [value]="assets()" 
              [paginator]="assets().length > 10"
              [rows]="10"
              [rowHover]="true"
              styleClass="p-datatable-sm"
            >
              <ng-template #header>
                <tr>
                  <th style="width: 50px">#</th>
                  <th>Title</th>
                  <th style="width: 120px">Type</th>
                  <th style="width: 100px">Status</th>
                  <th style="width: 150px">Created</th>
                  <th style="width: 150px">Actions</th>
                </tr>
              </ng-template>
              <ng-template #body let-asset let-rowIndex="rowIndex">
                <tr>
                  <td>{{ rowIndex + 1 }}</td>
                  <td>
                    <div class="asset-info">
                      <i [class]="getAssetIcon(asset.assetType)" class="asset-icon"></i>
                      <div>
                        <span class="asset-title">{{ asset.title }}</span>
                        @if (asset.description) {
                          <span class="asset-desc">{{ asset.description | slice:0:50 }}{{ asset.description.length > 50 ? '...' : '' }}</span>
                        }
                      </div>
                    </div>
                  </td>
                  <td>
                    <p-tag [value]="getAssetTypeLabel(asset.assetType)" [severity]="getAssetTypeSeverity(asset.assetType)" />
                  </td>
                  <td>
                    <p-tag 
                      [value]="asset.isPublished ? 'Published' : 'Draft'" 
                      [severity]="asset.isPublished ? 'success' : 'secondary'"
                    />
                  </td>
                  <td>{{ asset.createdAt | date:'MMM d, yyyy' }}</td>
                  <td>
                    <div class="action-buttons">
                      @if (asset.fileUrl || asset.externalUrl) {
                        <p-button 
                          icon="pi pi-external-link" 
                          [text]="true" 
                          [rounded]="true"
                          size="small"
                          pTooltip="Open"
                          (click)="openAsset(asset)"
                        />
                      }
                      <p-button 
                        icon="pi pi-pencil" 
                        severity="secondary"
                        [text]="true" 
                        [rounded]="true"
                        size="small"
                        pTooltip="Edit"
                        (click)="openEditDialog(asset)"
                      />
                      <p-button 
                        icon="pi pi-trash" 
                        severity="danger"
                        [text]="true" 
                        [rounded]="true"
                        size="small"
                        pTooltip="Delete"
                        (click)="confirmDelete(asset)"
                      />
                    </div>
                  </td>
                </tr>
              </ng-template>
            </p-table>
          }
        </p-card>
      }
    </div>

    <!-- Create/Edit Dialog -->
    <p-dialog 
      [(visible)]="showDialog" 
      [header]="editingAsset() ? 'Edit Asset' : 'Add New Asset'"
      [modal]="true"
      [style]="{ width: '500px' }"
      [draggable]="false"
      [resizable]="false"
    >
      <form [formGroup]="assetForm" (ngSubmit)="saveAsset()">
        <div class="form-field">
          <label for="title">Title *</label>
          <input 
            id="title" 
            type="text" 
            pInputText 
            formControlName="title"
            placeholder="Enter asset title"
          />
          @if (assetForm.get('title')?.invalid && assetForm.get('title')?.touched) {
            <small class="error-text">Title is required</small>
          }
        </div>

        <div class="form-field">
          <label for="description">Description</label>
          <textarea 
            id="description" 
            pInputTextarea 
            formControlName="description"
            rows="3"
            placeholder="Optional description"
          ></textarea>
        </div>

        <div class="form-field">
          <label for="assetType">Type *</label>
          <p-select 
            id="assetType"
            formControlName="assetType"
            [options]="assetTypeOptions"
            optionLabel="label"
            optionValue="value"
            placeholder="Select asset type"
            styleClass="w-full"
          />
        </div>

        @if (assetForm.get('assetType')?.value === 'link') {
          <div class="form-field">
            <label for="externalUrl">External URL *</label>
            <input 
              id="externalUrl" 
              type="url" 
              pInputText 
              formControlName="externalUrl"
              placeholder="https://..."
            />
          </div>
        } @else if (!editingAsset()) {
          <div class="form-field">
            <label>Upload File</label>
            <p-fileupload 
              mode="basic" 
              [auto]="false"
              chooseLabel="Choose File"
              [maxFileSize]="50000000"
              (onSelect)="onFileSelect($event)"
              styleClass="w-full"
            />
            @if (selectedFile()) {
              <small class="file-info">
                Selected: {{ selectedFile()!.name }} ({{ formatFileSize(selectedFile()!.size) }})
              </small>
            }
          </div>
        }

        <div class="dialog-footer">
          <p-button 
            label="Cancel" 
            severity="secondary" 
            [text]="true"
            (click)="closeDialog()"
          />
          <p-button 
            [label]="editingAsset() ? 'Update' : 'Create'" 
            type="submit"
            [loading]="saving()"
            [disabled]="assetForm.invalid || saving()"
          />
        </div>
      </form>
    </p-dialog>

    <p-confirmDialog />
    <p-toast />
  `,
  styles: `
    .assets-page { padding: 1.5rem; max-width: 1200px; margin: 0 auto; }
    
    .page-nav { margin-bottom: 1rem; }
    
    .loading-container { padding: 2rem; }
    .skeleton-container { padding: 1rem; }
    
    .not-found { 
      display: flex; flex-direction: column; align-items: center; justify-content: center; 
      padding: 4rem 2rem; text-align: center;
    }
    .not-found i { font-size: 4rem; color: var(--text-color-secondary); margin-bottom: 1rem; }
    .not-found h2 { margin: 0 0 0.5rem; }
    .not-found p { color: var(--text-color-secondary); margin-bottom: 1.5rem; }
    
    .page-header { 
      display: flex; justify-content: space-between; align-items: center; 
      margin-bottom: 1.5rem; gap: 1rem; flex-wrap: wrap;
    }
    .page-header__info { display: flex; align-items: center; gap: 1rem; }
    .subject-badge { 
      width: 48px; height: 48px; border-radius: 12px; 
      display: flex; align-items: center; justify-content: center;
      color: white; font-size: 1.25rem;
    }
    .page-title { margin: 0; font-size: 1.5rem; font-weight: 600; }
    .page-subtitle { margin: 0.25rem 0 0; color: var(--text-color-secondary); font-size: 0.875rem; }
    
    .empty-state { 
      display: flex; flex-direction: column; align-items: center; 
      padding: 4rem 2rem; text-align: center;
    }
    .empty-state i { font-size: 4rem; color: var(--primary-color); opacity: 0.5; margin-bottom: 1rem; }
    .empty-state h2 { margin: 0 0 0.5rem; font-size: 1.25rem; }
    .empty-state p { margin: 0 0 1.5rem; color: var(--text-color-secondary); }
    
    .asset-info { display: flex; align-items: center; gap: 0.75rem; }
    .asset-icon { font-size: 1.25rem; color: var(--primary-color); }
    .asset-title { font-weight: 500; display: block; }
    .asset-desc { font-size: 0.75rem; color: var(--text-color-secondary); display: block; }
    
    .action-buttons { display: flex; gap: 0.25rem; }
    
    .form-field { margin-bottom: 1.25rem; }
    .form-field label { display: block; margin-bottom: 0.5rem; font-weight: 500; }
    .form-field input, .form-field textarea { width: 100%; }
    .error-text { color: var(--red-500); margin-top: 0.25rem; display: block; }
    .file-info { color: var(--primary-color); margin-top: 0.5rem; display: block; }
    
    .dialog-footer { 
      display: flex; justify-content: flex-end; gap: 0.5rem; 
      margin-top: 1.5rem; padding-top: 1rem; border-top: 1px solid var(--surface-border);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AssetsComponent implements OnInit {
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

  readonly subjectId = computed(() => this.route.snapshot.paramMap.get('subjectId') ?? '');
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
    this.db.subjects.getById(id).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
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
    this.db.assets.getBySubject(subjectId, { page: 1, pageSize: 100 }).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
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
      this.db.assets.update(this.editingAsset()!.id, {
        title: formValue.title ?? undefined,
        description: formValue.description ?? undefined,
        assetType: formValue.assetType as AssetType,
        externalUrl: formValue.externalUrl ?? undefined,
      }).pipe(
        takeUntilDestroyed(this.destroyRef)
      ).subscribe({
        next: (updated) => {
          this.assets.update(list => list.map(a => a.id === updated.id ? updated : a));
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
        this.db.assets.uploadFile(file, path).pipe(
          takeUntilDestroyed(this.destroyRef)
        ).subscribe({
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
    this.db.assets.create(dto).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (created) => {
        this.assets.update(list => [...list, created]);
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
    this.db.assets.delete(asset.id).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: () => {
        this.assets.update(list => list.filter(a => a.id !== asset.id));
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
    return this.assetTypeOptions.find(o => o.value === type)?.label ?? type;
  }

  getAssetTypeSeverity(type: AssetType): 'success' | 'info' | 'warn' | 'danger' | 'secondary' {
    const map: Record<AssetType, 'success' | 'info' | 'warn' | 'danger' | 'secondary'> = {
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
