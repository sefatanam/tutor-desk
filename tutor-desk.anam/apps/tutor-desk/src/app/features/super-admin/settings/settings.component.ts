// @REVIEW: Dynamic Settings Management Component
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
import { FormsModule } from '@angular/forms';
import { CardModule } from 'primeng/card';
import { TabsModule } from 'primeng/tabs';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { TextareaModule } from 'primeng/textarea';
import { SelectModule } from 'primeng/select';
import { ColorPickerModule } from 'primeng/colorpicker';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { TooltipModule } from 'primeng/tooltip';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DialogModule } from 'primeng/dialog';
import { SkeletonModule } from 'primeng/skeleton';
import { TagModule } from 'primeng/tag';
import { ConfirmationService, MessageService } from 'primeng/api';
import { SupabaseDatabaseAdapter } from '../../../core/adapters/supabase-database.adapter';
import {
  SettingsCategory,
  SystemSetting,
  SettingValueType,
  CreateSettingsCategoryDto,
  CreateSystemSettingDto,
  SettingsExportData,
} from '../../../core/models';
import { forkJoin } from 'rxjs';

interface SettingsByCategory {
  category: SettingsCategory;
  settings: SystemSetting[];
}

@Component({
  selector: 'app-settings',
  imports: [
    CommonModule,
    FormsModule,
    CardModule,
    TabsModule,
    TableModule,
    ButtonModule,
    InputTextModule,
    InputNumberModule,
    TextareaModule,
    SelectModule,
    ColorPickerModule,
    ToggleSwitchModule,
    TooltipModule,
    ToastModule,
    ConfirmDialogModule,
    DialogModule,
    SkeletonModule,
    TagModule,
  ],
  providers: [MessageService, ConfirmationService],
  template: `
    <div class="settings-page">
      <!-- Page Header -->
      <header class="page-header">
        <div class="page-header__content">
          <h1 class="page-header__title">System Settings</h1>
          <p class="page-header__subtitle">Configure application settings and preferences</p>
        </div>
        <div class="page-header__actions">
          <p-button
            label="Manage Categories"
            icon="pi pi-folder"
            severity="secondary"
            [outlined]="true"
            (click)="showCategoryDialog = true"
          />
          <p-button
            label="Add Setting"
            icon="pi pi-plus"
            severity="secondary"
            [outlined]="true"
            (click)="openAddSettingDialog()"
          />
          <p-button
            label="Import"
            icon="pi pi-upload"
            severity="secondary"
            [outlined]="true"
            (click)="fileInput.click()"
          />
          <input
            #fileInput
            type="file"
            accept=".json"
            style="display: none"
            (change)="onImportFile($event)"
          />
          <p-button
            label="Export"
            icon="pi pi-download"
            severity="secondary"
            [outlined]="true"
            (click)="exportSettings()"
          />
          <p-button
            label="Refresh"
            icon="pi pi-refresh"
            severity="primary"
            [outlined]="true"
            (click)="loadData()"
            [loading]="loading()"
          />
        </div>
      </header>

      <!-- Loading State -->
      @if (loading()) {
        <p-card>
          <div class="loading-skeleton">
            <p-skeleton width="100%" height="40px" styleClass="mb-3" />
            <p-skeleton width="100%" height="300px" />
          </div>
        </p-card>
      } @else if (categories().length === 0) {
        <!-- Empty State -->
        <p-card>
          <div class="empty-state">
            <i class="pi pi-cog"></i>
            <h2>No Settings Categories</h2>
            <p>Create your first category to start adding settings</p>
            <p-button
              label="Create Category"
              icon="pi pi-plus"
              (click)="showCategoryDialog = true"
            />
          </div>
        </p-card>
      } @else {
        <!-- Tabs for Categories -->
        <p-card styleClass="settings-card">
          <p-tabs [value]="activeTab()">
            <p-tablist>
              @for (cat of categories(); track cat.id; let i = $index) {
                <p-tab [value]="i.toString()">
                  <i [class]="'pi ' + cat.icon + ' mr-2'"></i>
                  {{ cat.label }}
                  <p-tag
                    [value]="getSettingsCountForCategory(cat.id).toString()"
                    [rounded]="true"
                    severity="secondary"
                    styleClass="ml-2"
                  />
                </p-tab>
              }
            </p-tablist>

            <p-tabpanels>
              @for (cat of categories(); track cat.id; let i = $index) {
                <p-tabpanel [value]="i.toString()">
                  @if (cat.description) {
                    <p class="category-description">{{ cat.description }}</p>
                  }

                  @if (getSettingsForCategory(cat.id).length === 0) {
                    <div class="empty-tab">
                      <i class="pi pi-inbox"></i>
                      <p>No settings in this category</p>
                      <p-button
                        label="Add Setting"
                        icon="pi pi-plus"
                        size="small"
                        (click)="openAddSettingDialog(cat.id)"
                      />
                    </div>
                  } @else {
                    <p-table
                      [value]="getSettingsForCategory(cat.id)"
                      styleClass="p-datatable-sm"
                      [rowHover]="true"
                    >
                      <ng-template #header>
                        <tr>
                          <th style="width: 200px">Key</th>
                          <th style="width: 200px">Label</th>
                          <th>Value</th>
                          <th style="width: 100px">Type</th>
                          <th style="width: 100px" class="text-center">Actions</th>
                        </tr>
                      </ng-template>
                      <ng-template #body let-setting>
                        <tr>
                          <td>
                            <code class="setting-key">{{ setting.key }}</code>
                          </td>
                          <td>
                            <span class="setting-label">{{ setting.label }}</span>
                            @if (setting.description) {
                              <i
                                class="pi pi-info-circle ml-2 info-icon"
                                [pTooltip]="setting.description"
                                tooltipPosition="top"
                              ></i>
                            }
                            @if (setting.isRequired) {
                              <span class="required-badge">Required</span>
                            }
                          </td>
                          <td class="value-cell">
                            <!-- Dynamic Value Editor based on valueType -->
                            @switch (setting.valueType) {
                              @case ('boolean') {
                                <p-toggleswitch
                                  [(ngModel)]="editingValues[setting.id]"
                                  (onChange)="onValueChange(setting)"
                                />
                              }
                              @case ('number') {
                                <p-inputnumber
                                  [(ngModel)]="editingValues[setting.id]"
                                  (onBlur)="onValueChange(setting)"
                                  [showButtons]="true"
                                  styleClass="value-input"
                                />
                              }
                              @case ('color') {
                                <div class="color-picker-wrapper">
                                  <p-colorpicker
                                    [(ngModel)]="editingValues[setting.id]"
                                    (onChange)="onValueChange(setting)"
                                  />
                                  <span class="color-value">{{ editingValues[setting.id] || 'None' }}</span>
                                </div>
                              }
                              @case ('url') {
                                <input
                                  type="url"
                                  pInputText
                                  [(ngModel)]="editingValues[setting.id]"
                                  (blur)="onValueChange(setting)"
                                  placeholder="https://..."
                                  class="value-input"
                                />
                              }
                              @case ('textarea') {
                                <textarea
                                  pTextarea
                                  [(ngModel)]="editingValues[setting.id]"
                                  (blur)="onValueChange(setting)"
                                  rows="2"
                                  class="value-input"
                                ></textarea>
                              }
                              @case ('select') {
                                <p-select
                                  [(ngModel)]="editingValues[setting.id]"
                                  [options]="getSelectOptions(setting)"
                                  (onChange)="onValueChange(setting)"
                                  placeholder="Select..."
                                  styleClass="value-input"
                                />
                              }
                              @case ('json') {
                                <textarea
                                  pTextarea
                                  [(ngModel)]="editingValues[setting.id]"
                                  (blur)="onValueChange(setting)"
                                  rows="3"
                                  class="value-input json-input"
                                  placeholder="{}"
                                ></textarea>
                              }
                              @default {
                                <input
                                  type="text"
                                  pInputText
                                  [(ngModel)]="editingValues[setting.id]"
                                  (blur)="onValueChange(setting)"
                                  class="value-input"
                                />
                              }
                            }
                          </td>
                          <td>
                            <p-tag
                              [value]="setting.valueType"
                              [severity]="getTypeSeverity(setting.valueType)"
                              [rounded]="true"
                            />
                          </td>
                          <td class="text-center">
                            <p-button
                              icon="pi pi-pencil"
                              severity="secondary"
                              [text]="true"
                              [rounded]="true"
                              pTooltip="Edit Setting"
                              (click)="editSetting(setting)"
                            />
                            <p-button
                              icon="pi pi-trash"
                              severity="danger"
                              [text]="true"
                              [rounded]="true"
                              pTooltip="Delete Setting"
                              (click)="confirmDeleteSetting(setting)"
                            />
                          </td>
                        </tr>
                      </ng-template>
                    </p-table>
                  }
                </p-tabpanel>
              }
            </p-tabpanels>
          </p-tabs>
        </p-card>
      }

      <!-- Category Manager Dialog -->
      <p-dialog
        header="Manage Categories"
        [(visible)]="showCategoryDialog"
        [modal]="true"
        [style]="{ width: '600px' }"
        [draggable]="false"
        [resizable]="false"
      >
        <div class="category-manager">
          <!-- Add New Category Form -->
          <div class="add-category-form">
            <h4>Add New Category</h4>
            <div class="form-row">
              <div class="form-field">
                <label>Name (unique key)</label>
                <input
                  type="text"
                  pInputText
                  [(ngModel)]="newCategory.name"
                  placeholder="e.g. branding"
                />
              </div>
              <div class="form-field">
                <label>Label</label>
                <input
                  type="text"
                  pInputText
                  [(ngModel)]="newCategory.label"
                  placeholder="e.g. Branding"
                />
              </div>
            </div>
            <div class="form-row">
              <div class="form-field">
                <label>Icon (PrimeIcons)</label>
                <input
                  type="text"
                  pInputText
                  [(ngModel)]="newCategory.icon"
                  placeholder="e.g. pi-palette"
                />
              </div>
              <div class="form-field">
                <label>Sort Order</label>
                <p-inputnumber
                  [(ngModel)]="newCategory.sortOrder"
                  [showButtons]="true"
                  [min]="0"
                />
              </div>
            </div>
            <div class="form-row">
              <div class="form-field full-width">
                <label>Description</label>
                <textarea
                  pTextarea
                  [(ngModel)]="newCategory.description"
                  rows="2"
                  placeholder="Optional description..."
                ></textarea>
              </div>
            </div>
            <div class="form-actions">
              <p-button
                label="Add Category"
                icon="pi pi-plus"
                (click)="addCategory()"
                [disabled]="!newCategory.name || !newCategory.label"
              />
            </div>
          </div>

          <!-- Existing Categories -->
          <div class="existing-categories">
            <h4>Existing Categories</h4>
            @if (categories().length === 0) {
              <p class="no-categories">No categories yet</p>
            } @else {
              <div class="category-list">
                @for (cat of categories(); track cat.id) {
                  <div class="category-item">
                    <div class="category-item__info">
                      <i [class]="'pi ' + cat.icon"></i>
                      <span class="category-item__label">{{ cat.label }}</span>
                      <span class="category-item__name">({{ cat.name }})</span>
                    </div>
                    <div class="category-item__actions">
                      <p-button
                        icon="pi pi-trash"
                        severity="danger"
                        [text]="true"
                        [rounded]="true"
                        pTooltip="Delete Category"
                        (click)="confirmDeleteCategory(cat)"
                      />
                    </div>
                  </div>
                }
              </div>
            }
          </div>
        </div>
      </p-dialog>

      <!-- Setting Editor Dialog -->
      <p-dialog
        [header]="editingSettingId ? 'Edit Setting' : 'Add New Setting'"
        [(visible)]="showSettingDialog"
        [modal]="true"
        [style]="{ width: '550px' }"
        [draggable]="false"
        [resizable]="false"
      >
        <div class="setting-form">
          <div class="form-row">
            <div class="form-field">
              <label>Category <span class="required">*</span></label>
              <p-select
                [(ngModel)]="settingForm.categoryId"
                [options]="categoryOptions()"
                optionLabel="label"
                optionValue="value"
                placeholder="Select category"
              />
            </div>
            <div class="form-field">
              <label>Value Type <span class="required">*</span></label>
              <p-select
                [(ngModel)]="settingForm.valueType"
                [options]="valueTypeOptions"
                placeholder="Select type"
              />
            </div>
          </div>
          <div class="form-row">
            <div class="form-field">
              <label>Key <span class="required">*</span></label>
              <input
                type="text"
                pInputText
                [(ngModel)]="settingForm.key"
                placeholder="e.g. app_name"
              />
            </div>
            <div class="form-field">
              <label>Label <span class="required">*</span></label>
              <input
                type="text"
                pInputText
                [(ngModel)]="settingForm.label"
                placeholder="e.g. Application Name"
              />
            </div>
          </div>
          <div class="form-row">
            <div class="form-field">
              <label>Default Value</label>
              <input
                type="text"
                pInputText
                [(ngModel)]="settingForm.defaultValue"
                placeholder="Default value"
              />
            </div>
            <div class="form-field">
              <label>Sort Order</label>
              <p-inputnumber
                [(ngModel)]="settingForm.sortOrder"
                [showButtons]="true"
                [min]="0"
              />
            </div>
          </div>
          @if (settingForm.valueType === 'select') {
            <div class="form-row">
              <div class="form-field full-width">
                <label>Options (comma-separated)</label>
                <input
                  type="text"
                  pInputText
                  [(ngModel)]="settingForm.optionsText"
                  placeholder="e.g. option1, option2, option3"
                />
              </div>
            </div>
          }
          <div class="form-row">
            <div class="form-field full-width">
              <label>Description</label>
              <textarea
                pTextarea
                [(ngModel)]="settingForm.description"
                rows="2"
                placeholder="Help text for this setting..."
              ></textarea>
            </div>
          </div>
          <div class="form-row">
            <div class="form-field">
              <p-toggleswitch
                [(ngModel)]="settingForm.isRequired"
              />
              <label class="inline-label">Required</label>
            </div>
          </div>
        </div>
        <ng-template #footer>
          <p-button
            label="Cancel"
            severity="secondary"
            [text]="true"
            (click)="showSettingDialog = false"
          />
          <p-button
            [label]="editingSettingId ? 'Update' : 'Create'"
            icon="pi pi-check"
            (click)="saveSetting()"
            [disabled]="!isSettingFormValid()"
          />
        </ng-template>
      </p-dialog>

      <p-toast />
      <p-confirmDialog />
    </div>
  `,
  styles: `
    .settings-page {
      padding: 1.5rem;
    }

    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 1.5rem;
      flex-wrap: wrap;
      gap: 1rem;
    }

    .page-header__title {
      margin: 0 0 0.25rem;
      font-size: 1.75rem;
      font-weight: 600;
    }

    .page-header__subtitle {
      margin: 0;
      color: var(--text-color-secondary);
    }

    .page-header__actions {
      display: flex;
      gap: 0.5rem;
      flex-wrap: wrap;
    }

    .loading-skeleton {
      padding: 1rem;
    }

    .empty-state, .empty-tab {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 4rem 2rem;
      text-align: center;
    }

    .empty-state i, .empty-tab i {
      font-size: 4rem;
      color: var(--primary-color);
      opacity: 0.4;
      margin-bottom: 1rem;
    }

    .empty-state h2 {
      margin: 0 0 0.5rem;
      font-size: 1.25rem;
    }

    .empty-state p, .empty-tab p {
      margin: 0 0 1.5rem;
      color: var(--text-color-secondary);
    }

    .category-description {
      color: var(--text-color-secondary);
      font-size: 0.875rem;
      margin: 0 0 1rem;
      padding: 0.75rem;
      background: var(--surface-ground);
      border-radius: 6px;
    }

    .setting-key {
      font-family: monospace;
      font-size: 0.8125rem;
      background: var(--surface-100);
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
      color: var(--primary-color);
    }

    .setting-label {
      font-weight: 500;
    }

    .info-icon {
      color: var(--text-color-secondary);
      cursor: help;
      font-size: 0.875rem;
    }

    .required-badge {
      font-size: 0.6875rem;
      background: var(--red-100);
      color: var(--red-700);
      padding: 0.125rem 0.375rem;
      border-radius: 4px;
      margin-left: 0.5rem;
      text-transform: uppercase;
      font-weight: 600;
    }

    .value-cell {
      min-width: 200px;
    }

    .value-input {
      width: 100%;
      max-width: 300px;
    }

    .json-input {
      font-family: monospace;
      font-size: 0.8125rem;
    }

    .color-picker-wrapper {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .color-value {
      font-family: monospace;
      font-size: 0.875rem;
      color: var(--text-color-secondary);
    }

    /* Category Manager Dialog */
    .category-manager {
      display: flex;
      flex-direction: column;
      gap: 2rem;
    }

    .add-category-form h4,
    .existing-categories h4 {
      margin: 0 0 1rem;
      font-size: 1rem;
      font-weight: 600;
    }

    .form-row {
      display: flex;
      gap: 1rem;
      margin-bottom: 1rem;
    }

    .form-field {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 0.375rem;
    }

    .form-field.full-width {
      flex: 1 1 100%;
    }

    .form-field label {
      font-size: 0.875rem;
      font-weight: 500;
      color: var(--text-color);
    }

    .form-field .inline-label {
      margin-left: 0.5rem;
    }

    .required {
      color: var(--red-500);
    }

    .form-actions {
      display: flex;
      justify-content: flex-end;
      padding-top: 0.5rem;
    }

    .existing-categories {
      border-top: 1px solid var(--surface-border);
      padding-top: 1.5rem;
    }

    .no-categories {
      color: var(--text-color-secondary);
      font-style: italic;
    }

    .category-list {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .category-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.75rem 1rem;
      background: var(--surface-ground);
      border-radius: 6px;
    }

    .category-item__info {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .category-item__info i {
      color: var(--primary-color);
    }

    .category-item__label {
      font-weight: 500;
    }

    .category-item__name {
      color: var(--text-color-secondary);
      font-size: 0.875rem;
    }

    /* Setting Form Dialog */
    .setting-form {
      padding: 0.5rem 0;
    }

    :host ::ng-deep {
      .settings-card .p-card-body {
        padding: 0;
      }
      .settings-card .p-card-content {
        padding: 0;
      }
      .p-tabs {
        margin: 0;
      }
      .p-tablist {
        border-bottom: 1px solid var(--surface-border);
        padding: 0 1rem;
      }
      .p-tabpanels {
        padding: 1.5rem;
      }
      .p-datatable .p-datatable-tbody > tr > td {
        padding: 0.75rem 1rem;
        vertical-align: middle;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsComponent implements OnInit {
  private readonly db = inject(SupabaseDatabaseAdapter);
  private readonly messageService = inject(MessageService);
  private readonly confirmationService = inject(ConfirmationService);
  // @REVIEW: DestroyRef for subscription cleanup
  private readonly destroyRef = inject(DestroyRef);

  // State
  readonly loading = signal(false);
  readonly categories = signal<SettingsCategory[]>([]);
  readonly settings = signal<SystemSetting[]>([]);
  readonly activeTab = signal('0');

  // Editing state - tracks current values for inline editing
  editingValues: Record<string, unknown> = {};

  // Dialog visibility
  showCategoryDialog = false;
  showSettingDialog = false;
  editingSettingId: string | null = null;

  // New category form
  newCategory: CreateSettingsCategoryDto = {
    name: '',
    label: '',
    icon: 'pi-cog',
    description: '',
    sortOrder: 0,
  };

  // Setting form
  settingForm = {
    categoryId: '',
    key: '',
    label: '',
    valueType: 'text' as SettingValueType,
    defaultValue: '',
    description: '',
    isRequired: false,
    sortOrder: 0,
    optionsText: '',
  };

  // Options
  readonly valueTypeOptions = [
    { label: 'Text', value: 'text' },
    { label: 'Number', value: 'number' },
    { label: 'Boolean', value: 'boolean' },
    { label: 'Color', value: 'color' },
    { label: 'URL', value: 'url' },
    { label: 'Textarea', value: 'textarea' },
    { label: 'Select', value: 'select' },
    { label: 'JSON', value: 'json' },
  ];

  readonly categoryOptions = computed(() =>
    this.categories().map(c => ({ label: c.label, value: c.id }))
  );

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.loading.set(true);
    forkJoin({
      categories: this.db.settings.getAllCategories(),
      settings: this.db.settings.getAllSettings(),
    }).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: ({ categories, settings }) => {
        this.categories.set(categories);
        this.settings.set(settings);
        this.initEditingValues(settings);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Failed to load settings:', err);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to load settings. Please try again.',
        });
        this.loading.set(false);
      },
    });
  }

  private initEditingValues(settings: SystemSetting[]): void {
    this.editingValues = {};
    settings.forEach(s => {
      this.editingValues[s.id] = this.parseValue(s.value, s.valueType);
    });
  }

  private parseValue(value: string | null, type: SettingValueType): unknown {
    if (value === null || value === '') return type === 'boolean' ? false : '';
    switch (type) {
      case 'boolean':
        return value === 'true';
      case 'number':
        return parseFloat(value) || 0;
      default:
        return value;
    }
  }

  private stringifyValue(value: unknown, type: SettingValueType): string | null {
    if (value === null || value === undefined || value === '') return null;
    if (type === 'boolean') return value ? 'true' : 'false';
    return String(value);
  }

  getSettingsForCategory(categoryId: string): SystemSetting[] {
    return this.settings().filter(s => s.categoryId === categoryId);
  }

  getSettingsCountForCategory(categoryId: string): number {
    return this.getSettingsForCategory(categoryId).length;
  }

  getSelectOptions(setting: SystemSetting): string[] {
    return setting.options ?? [];
  }

  getTypeSeverity(type: SettingValueType): 'success' | 'info' | 'warn' | 'danger' | 'secondary' | 'contrast' {
    const map: Record<SettingValueType, 'success' | 'info' | 'warn' | 'danger' | 'secondary' | 'contrast'> = {
      text: 'info',
      number: 'success',
      boolean: 'warn',
      color: 'contrast',
      url: 'info',
      textarea: 'secondary',
      select: 'success',
      json: 'danger',
    };
    return map[type] ?? 'secondary';
  }

  // === Value Change (Inline Edit) ===
  onValueChange(setting: SystemSetting): void {
    const newValue = this.editingValues[setting.id];
    const stringValue = this.stringifyValue(newValue, setting.valueType);

    this.db.settings.updateSettingValue(setting.id, stringValue).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (updated) => {
        // Update local state
        this.settings.update(list =>
          list.map(s => (s.id === updated.id ? updated : s))
        );
        this.messageService.add({
          severity: 'success',
          summary: 'Saved',
          detail: `${setting.label} updated`,
          life: 2000,
        });
      },
      error: (err) => {
        console.error('Failed to save setting:', err);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to save setting',
        });
        // Revert to original value
        this.editingValues[setting.id] = this.parseValue(setting.value, setting.valueType);
      },
    });
  }

  // === Category Management ===
  addCategory(): void {
    if (!this.newCategory.name || !this.newCategory.label) return;

    this.db.settings.createCategory(this.newCategory).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (created) => {
        this.categories.update(list => [...list, created]);
        this.messageService.add({
          severity: 'success',
          summary: 'Success',
          detail: `Category "${created.label}" created`,
        });
        this.resetNewCategory();
      },
      error: (err) => {
        console.error('Failed to create category:', err);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to create category. Name may already exist.',
        });
      },
    });
  }

  private resetNewCategory(): void {
    this.newCategory = {
      name: '',
      label: '',
      icon: 'pi-cog',
      description: '',
      sortOrder: 0,
    };
  }

  confirmDeleteCategory(category: SettingsCategory): void {
    const settingsCount = this.getSettingsCountForCategory(category.id);
    this.confirmationService.confirm({
      message: `Delete category "${category.label}"?${settingsCount > 0 ? ` This will also delete ${settingsCount} setting(s).` : ''}`,
      header: 'Confirm Delete',
      icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => this.deleteCategory(category),
    });
  }

  private deleteCategory(category: SettingsCategory): void {
    this.db.settings.deleteCategory(category.id).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: () => {
        this.categories.update(list => list.filter(c => c.id !== category.id));
        this.settings.update(list => list.filter(s => s.categoryId !== category.id));
        this.messageService.add({
          severity: 'success',
          summary: 'Deleted',
          detail: `Category "${category.label}" deleted`,
        });
      },
      error: (err) => {
        console.error('Failed to delete category:', err);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to delete category',
        });
      },
    });
  }

  // === Setting Management ===
  openAddSettingDialog(categoryId?: string): void {
    this.editingSettingId = null;
    this.settingForm = {
      categoryId: categoryId ?? this.categories()[0]?.id ?? '',
      key: '',
      label: '',
      valueType: 'text',
      defaultValue: '',
      description: '',
      isRequired: false,
      sortOrder: 0,
      optionsText: '',
    };
    this.showSettingDialog = true;
  }

  editSetting(setting: SystemSetting): void {
    this.editingSettingId = setting.id;
    this.settingForm = {
      categoryId: setting.categoryId,
      key: setting.key,
      label: setting.label,
      valueType: setting.valueType,
      defaultValue: setting.defaultValue ?? '',
      description: setting.description ?? '',
      isRequired: setting.isRequired,
      sortOrder: setting.sortOrder,
      optionsText: setting.options?.join(', ') ?? '',
    };
    this.showSettingDialog = true;
  }

  isSettingFormValid(): boolean {
    return !!(
      this.settingForm.categoryId &&
      this.settingForm.key &&
      this.settingForm.label &&
      this.settingForm.valueType
    );
  }

  saveSetting(): void {
    if (!this.isSettingFormValid()) return;

    const options =
      this.settingForm.valueType === 'select'
        ? this.settingForm.optionsText.split(',').map(o => o.trim()).filter(Boolean)
        : undefined;

    const dto: CreateSystemSettingDto = {
      categoryId: this.settingForm.categoryId,
      key: this.settingForm.key.toLowerCase().replace(/\s+/g, '_'),
      label: this.settingForm.label,
      valueType: this.settingForm.valueType,
      defaultValue: this.settingForm.defaultValue || undefined,
      description: this.settingForm.description || undefined,
      isRequired: this.settingForm.isRequired,
      sortOrder: this.settingForm.sortOrder,
      options,
    };

    if (this.editingSettingId) {
      // Update existing
      this.db.settings.updateSetting(this.editingSettingId, dto).pipe(
        takeUntilDestroyed(this.destroyRef)
      ).subscribe({
        next: (updated) => {
          this.settings.update(list =>
            list.map(s => (s.id === updated.id ? updated : s))
          );
          this.editingValues[updated.id] = this.parseValue(updated.value, updated.valueType);
          this.messageService.add({
            severity: 'success',
            summary: 'Success',
            detail: `Setting "${updated.label}" updated`,
          });
          this.showSettingDialog = false;
        },
        error: (err) => {
          console.error('Failed to update setting:', err);
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'Failed to update setting',
          });
        },
      });
    } else {
      // Create new
      this.db.settings.createSetting(dto).pipe(
        takeUntilDestroyed(this.destroyRef)
      ).subscribe({
        next: (created) => {
          this.settings.update(list => [...list, created]);
          this.editingValues[created.id] = this.parseValue(created.value, created.valueType);
          this.messageService.add({
            severity: 'success',
            summary: 'Success',
            detail: `Setting "${created.label}" created`,
          });
          this.showSettingDialog = false;
        },
        error: (err) => {
          console.error('Failed to create setting:', err);
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'Failed to create setting. Key may already exist.',
          });
        },
      });
    }
  }

  confirmDeleteSetting(setting: SystemSetting): void {
    this.confirmationService.confirm({
      message: `Delete setting "${setting.label}"?`,
      header: 'Confirm Delete',
      icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => this.deleteSetting(setting),
    });
  }

  private deleteSetting(setting: SystemSetting): void {
    this.db.settings.deleteSetting(setting.id).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: () => {
        this.settings.update(list => list.filter(s => s.id !== setting.id));
        delete this.editingValues[setting.id];
        this.messageService.add({
          severity: 'success',
          summary: 'Deleted',
          detail: `Setting "${setting.label}" deleted`,
        });
      },
      error: (err) => {
        console.error('Failed to delete setting:', err);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to delete setting',
        });
      },
    });
  }

  // === Import/Export ===
  exportSettings(): void {
    const exportData: SettingsExportData = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      categories: this.categories(),
      settings: this.settings(),
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `settings-export-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);

    this.messageService.add({
      severity: 'success',
      summary: 'Exported',
      detail: 'Settings exported successfully',
    });
  }

  onImportFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result as string) as SettingsExportData;
        this.confirmImport(data);
      } catch {
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Invalid JSON file',
        });
      }
    };
    reader.readAsText(file);
    input.value = ''; // Reset file input
  }

  private confirmImport(data: SettingsExportData): void {
    this.confirmationService.confirm({
      message: `Import ${data.categories.length} categories and ${data.settings.length} settings? This will replace existing settings.`,
      header: 'Confirm Import',
      icon: 'pi pi-exclamation-triangle',
      accept: () => this.performImport(data),
    });
  }

  private performImport(data: SettingsExportData): void {
    // For now, just reload after import
    // @TODO: Implement full import logic (delete all, recreate categories, recreate settings)
    this.messageService.add({
      severity: 'info',
      summary: 'Import',
      detail: 'Import functionality requires database tables. Use Supabase migration first.',
    });
  }
}
