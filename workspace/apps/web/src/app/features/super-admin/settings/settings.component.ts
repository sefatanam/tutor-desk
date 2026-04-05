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
  templateUrl: './settings.component.html',
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
    this.categories().map((c) => ({ label: c.label, value: c.id }))
  );

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.loading.set(true);
    forkJoin({
      categories: this.db.settings.getAllCategories(),
      settings: this.db.settings.getAllSettings(),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
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
    settings.forEach((s) => {
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

  private stringifyValue(
    value: unknown,
    type: SettingValueType
  ): string | null {
    if (value === null || value === undefined || value === '') return null;
    if (type === 'boolean') return value ? 'true' : 'false';
    return String(value);
  }

  getSettingsForCategory(categoryId: string): SystemSetting[] {
    return this.settings().filter((s) => s.categoryId === categoryId);
  }

  getSettingsCountForCategory(categoryId: string): number {
    return this.getSettingsForCategory(categoryId).length;
  }

  getSelectOptions(setting: SystemSetting): string[] {
    return setting.options ?? [];
  }

  getTypeSeverity(
    type: SettingValueType
  ): 'success' | 'info' | 'warn' | 'danger' | 'secondary' | 'contrast' {
    const map: Record<
      SettingValueType,
      'success' | 'info' | 'warn' | 'danger' | 'secondary' | 'contrast'
    > = {
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

    this.db.settings
      .updateSettingValue(setting.id, stringValue)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated) => {
          // Update local state
          this.settings.update((list) =>
            list.map((s) => (s.id === updated.id ? updated : s))
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
          this.editingValues[setting.id] = this.parseValue(
            setting.value,
            setting.valueType
          );
        },
      });
  }

  // === Category Management ===
  addCategory(): void {
    if (!this.newCategory.name || !this.newCategory.label) return;

    this.db.settings
      .createCategory(this.newCategory)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (created) => {
          this.categories.update((list) => [...list, created]);
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
      message: `Delete category "${category.label}"?${
        settingsCount > 0
          ? ` This will also delete ${settingsCount} setting(s).`
          : ''
      }`,
      header: 'Confirm Delete',
      icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => this.deleteCategory(category),
    });
  }

  private deleteCategory(category: SettingsCategory): void {
    this.db.settings
      .deleteCategory(category.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.categories.update((list) =>
            list.filter((c) => c.id !== category.id)
          );
          this.settings.update((list) =>
            list.filter((s) => s.categoryId !== category.id)
          );
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
        ? this.settingForm.optionsText
            .split(',')
            .map((o) => o.trim())
            .filter(Boolean)
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
      this.db.settings
        .updateSetting(this.editingSettingId, dto)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (updated) => {
            this.settings.update((list) =>
              list.map((s) => (s.id === updated.id ? updated : s))
            );
            this.editingValues[updated.id] = this.parseValue(
              updated.value,
              updated.valueType
            );
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
      this.db.settings
        .createSetting(dto)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (created) => {
            this.settings.update((list) => [...list, created]);
            this.editingValues[created.id] = this.parseValue(
              created.value,
              created.valueType
            );
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
    this.db.settings
      .deleteSetting(setting.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.settings.update((list) =>
            list.filter((s) => s.id !== setting.id)
          );
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
    link.download = `settings-export-${
      new Date().toISOString().split('T')[0]
    }.json`;
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
      detail:
        'Import functionality requires database tables. Use Supabase migration first.',
    });
  }
}
