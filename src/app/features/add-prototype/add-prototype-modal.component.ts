import { Component, Input, Output, EventEmitter, OnInit, HostListener, ChangeDetectionStrategy, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Prototype, CREATORS } from '../../core/models/prototype.model';

const PAT_KEY = 'dl_github_pat';

@Component({
  selector: 'dl-add-prototype-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.Default,
  template: `
    <div class="overlay" (click)="onOverlayClick($event)">
      <div class="modal" role="dialog" aria-modal="true">
        <div class="modal-header">
          <h2 class="modal-title">{{ editMode ? 'Edit prototype' : 'Add prototype' }}</h2>
          <button class="close-btn" (click)="cancel.emit()">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <div class="modal-body">
          <div class="field" *ngIf="showPatPrompt">
            <label class="label">GitHub Personal Access Token</label>
            <p class="hint">Required to save to GitHub. Stored only in this browser session.</p>
            <input class="input" type="password" placeholder="ghp_…" [(ngModel)]="pat" />
          </div>

          <!-- File upload (new prototypes only) -->
          <div class="field">
            <label class="label">
              {{ editMode ? 'Replace files' : 'Exploration files' }}
              <span class="optional">{{ editMode ? '(optional — leave empty to keep existing)' : '(ZIP or individual files)' }}</span>
            </label>
            <div
              class="drop-zone"
              [class.has-file]="processing || uploadedFiles.length > 0"
              (dragover)="$event.preventDefault()"
              (drop)="onDrop($event)"
              (click)="fileInput.click()"
            >
              <input
                #fileInput
                type="file"
                multiple
                style="display:none"
                (change)="onFileSelected($event)"
              />
              <ng-container *ngIf="processing">
                <svg class="spin-icon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                </svg>
                <p class="drop-filename">Adding file…</p>
              </ng-container>
              <ng-container *ngIf="!processing && uploadedFiles.length === 0">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                  <polyline points="17 8 12 3 7 8"/>
                  <line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
                <p class="drop-label">Drop a ZIP or individual files, or <span class="drop-link">browse</span></p>
                <p class="hint">CLAUDE.md will be included and stored with the prototype</p>
              </ng-container>
              <ng-container *ngIf="!processing && uploadedFiles.length > 0">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                </svg>
                <p class="drop-filename">{{ uploadedFiles.length }} file{{ uploadedFiles.length > 1 ? 's' : '' }} ready</p>
                <div class="file-list">
                  <span *ngFor="let f of uploadedFiles" class="file-item">{{ f.name }}</span>
                </div>
                <button class="drop-clear" (click)="clearFiles($event)">Remove all</button>
              </ng-container>
            </div>
          </div>

          <div class="field">
            <label class="label">Title <span class="required">*</span></label>
            <input
              class="input"
              type="text"
              placeholder="e.g. Button hover animation"
              [(ngModel)]="form.title"
              (ngModelChange)="onTitleChange($event)"
            />
          </div>

          <div class="field">
            <label class="label">Description</label>
            <textarea class="input textarea" placeholder="Short description of this exploration…" [(ngModel)]="form.description" rows="2"></textarea>
          </div>

          <div class="row">
            <div class="field">
              <label class="label">Creator <span class="required">*</span></label>
              <div class="creator-combo" (click)="$event.stopPropagation()">
                <input
                  class="input creator-input"
                  type="text"
                  placeholder="Select or type name…"
                  [(ngModel)]="creatorSearch"
                  (ngModelChange)="onCreatorInput()"
                  (focus)="creatorDropdownOpen = true"
                  autocomplete="off"
                />
                <button class="creator-caret" type="button" (click)="creatorDropdownOpen = !creatorDropdownOpen; $event.stopPropagation()">
                  <svg [class.open]="creatorDropdownOpen" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M6 9l6 6 6-6"/>
                  </svg>
                </button>
                <div class="creator-dropdown" *ngIf="creatorDropdownOpen">
                  <button
                    *ngFor="let c of filteredCreators()"
                    class="creator-option"
                    [class.selected]="form.creator === c"
                    (click)="selectCreator(c); $event.stopPropagation()"
                  >{{ c }}</button>
                  <button
                    *ngIf="newCreatorValue()"
                    class="creator-add-new"
                    (click)="selectNewCreator(); $event.stopPropagation()"
                  >+ Add "{{ newCreatorValue() }}"</button>
                  <div *ngIf="filteredCreators().length === 0 && !newCreatorValue()" class="creator-empty">No matches.</div>
                </div>
              </div>
            </div>
            <div class="field">
              <label class="label">Folder path <span class="required">*</span></label>
              <input class="input" type="text" placeholder="prototypes/my-exploration" [(ngModel)]="form.folder" />
              <p class="hint" *ngIf="!editMode">Auto-filled from title. Edit if needed.</p>
            </div>
          </div>

          <!-- Tags multi-select dropdown -->
          <div class="field">
            <label class="label">Tags</label>
            <div class="tag-selector" (click)="$event.stopPropagation()">
              <div class="tag-selected" [class.open]="dropdownOpen" (click)="toggleDropdown()">
                <span *ngFor="let t of form.tags" class="chip">
                  {{ t }}
                  <button class="chip-remove" (click)="removeTag(t); $event.stopPropagation()">×</button>
                </span>
                <span *ngIf="form.tags.length === 0" class="tag-placeholder">Select tags…</span>
                <svg class="tag-caret" [class.open]="dropdownOpen" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M6 9l6 6 6-6"/>
                </svg>
              </div>

              <div class="tag-dropdown" *ngIf="dropdownOpen">
                <input
                  class="tag-search"
                  type="text"
                  placeholder="Search or add tag…"
                  [(ngModel)]="tagSearch"
                  (click)="$event.stopPropagation()"
                  autofocus
                />
                <div class="tag-options">
                  <label
                    *ngFor="let t of filteredAllTags()"
                    class="tag-option"
                    (click)="$event.stopPropagation()"
                  >
                    <input
                      type="checkbox"
                      [checked]="form.tags.includes(t)"
                      (change)="toggleTag(t)"
                    />
                    {{ t }}
                  </label>
                  <button
                    *ngIf="tagSearch.trim() && !allTagsInclude(tagSearch.trim())"
                    class="tag-add-new"
                    (click)="addNewTag(); $event.stopPropagation()"
                  >
                    + Add "{{ tagSearch.trim() }}"
                  </button>
                  <div *ngIf="filteredAllTags().length === 0 && !tagSearch.trim()" class="tag-empty">
                    No tags yet. Type to create one.
                  </div>
                </div>
              </div>
            </div>
          </div>

          <p *ngIf="errorMsg" class="error-msg">{{ errorMsg }}</p>
        </div>

        <div class="modal-footer">
          <button class="btn-secondary" (click)="cancel.emit()" [disabled]="saving">Cancel</button>
          <button class="btn-primary" (click)="submit()" [disabled]="!isValid() || saving">
            <svg *ngIf="saving" class="spin-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
            </svg>
            {{ savingLabel }}
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .overlay { position: fixed; inset: 0; background: rgba(0,0,0,.45); display: flex; align-items: center; justify-content: center; z-index: 100; padding: var(--space-4); }
    .modal { background: var(--color-surface); border-radius: var(--radius-lg); box-shadow: var(--shadow-modal); width: 100%; max-width: 560px; max-height: 90vh; overflow-y: auto; display: flex; flex-direction: column; }
    .modal-header { display: flex; align-items: center; justify-content: space-between; padding: var(--space-5) var(--space-6); border-bottom: 1px solid var(--color-border); position: sticky; top: 0; background: var(--color-surface); z-index: 1; }
    .modal-title { font-size: var(--text-lg); font-weight: var(--weight-semibold); color: var(--color-text-primary); margin: 0; }
    .close-btn { background: none; border: none; cursor: pointer; padding: var(--space-1); color: var(--color-text-tertiary); border-radius: var(--radius-sm); display: flex; align-items: center; transition: color var(--transition-fast), background var(--transition-fast); }
    .close-btn:hover { color: var(--color-text-primary); background: var(--color-surface-hover); }
    .modal-body { padding: var(--space-5) var(--space-6); display: flex; flex-direction: column; gap: var(--space-5); }
    .modal-footer { padding: var(--space-4) var(--space-6); border-top: 1px solid var(--color-border); display: flex; justify-content: flex-end; gap: var(--space-3); position: sticky; bottom: 0; background: var(--color-surface); }
    .field { display: flex; flex-direction: column; gap: var(--space-1); }
    .row { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-4); }
    .label { font-size: var(--text-sm); font-weight: var(--weight-medium); color: var(--color-text-primary); }
    .required { color: var(--color-danger); }
    .optional { font-size: var(--text-xs); color: var(--color-text-tertiary); font-weight: 400; }
    .hint { font-size: var(--text-xs); color: var(--color-text-tertiary); margin: 0; }
    .input { font-size: var(--text-sm); font-family: var(--font-sans); color: var(--color-text-primary); border: 1px solid var(--color-border); border-radius: var(--radius-sm); padding: 8px 12px; outline: none; background: var(--color-surface); transition: border-color var(--transition-fast); width: 100%; box-sizing: border-box; }
    .input:focus { border-color: var(--color-accent); }
    .textarea { resize: vertical; min-height: 64px; }
    .select { cursor: pointer; }

    /* Creator combobox */
    .creator-combo { position: relative; }
    .creator-input { padding-right: 36px; }
    .creator-caret {
      position: absolute; right: 8px; top: 50%; transform: translateY(-50%);
      background: none; border: none; cursor: pointer; padding: 4px;
      color: var(--color-text-tertiary); display: flex; align-items: center;
      border-radius: var(--radius-sm); transition: color var(--transition-fast);
    }
    .creator-caret:hover { color: var(--color-text-primary); }
    .creator-caret svg { transition: transform var(--transition-fast); }
    .creator-caret svg.open { transform: rotate(180deg); }
    .creator-dropdown {
      position: absolute; top: calc(100% + 2px); left: 0; right: 0;
      background: var(--color-surface); border: 1px solid var(--color-border);
      border-radius: var(--radius-sm); box-shadow: var(--shadow-modal);
      z-index: 200; max-height: 180px; overflow-y: auto;
    }
    .creator-option, .creator-add-new {
      display: block; width: 100%; padding: 8px 12px;
      font-size: var(--text-sm); font-family: var(--font-sans);
      text-align: left; background: none; border: none; cursor: pointer;
      color: var(--color-text-primary); transition: background var(--transition-fast);
    }
    .creator-option:hover, .creator-add-new:hover { background: var(--color-surface-hover); }
    .creator-option.selected { font-weight: var(--weight-medium); color: var(--color-accent); }
    .creator-add-new { color: var(--color-accent); }
    .creator-empty { padding: 8px 12px; font-size: var(--text-sm); color: var(--color-text-tertiary); }

    /* Drop zone */
    .drop-zone { border: 1.5px dashed var(--color-border); border-radius: var(--radius-md); padding: var(--space-6); display: flex; flex-direction: column; align-items: center; gap: var(--space-2); cursor: pointer; transition: border-color var(--transition-fast), background var(--transition-fast); text-align: center; color: var(--color-text-tertiary); }
    .drop-zone:hover { border-color: var(--color-accent); background: var(--color-accent-subtle); }
    .drop-zone.has-file { border-style: solid; border-color: var(--color-accent); background: var(--color-accent-subtle); color: var(--color-text-primary); }
    .drop-label { font-size: var(--text-sm); margin: 0; }
    .drop-link { color: var(--color-accent); text-decoration: underline; }
    .drop-filename { font-size: var(--text-sm); font-weight: var(--weight-medium); margin: 0; color: var(--color-accent); }
    .drop-clear { font-size: var(--text-xs); color: var(--color-text-tertiary); background: none; border: none; cursor: pointer; text-decoration: underline; font-family: var(--font-sans); padding: 0; }
    .file-list { display: flex; flex-wrap: wrap; gap: 4px; justify-content: center; }
    .file-item { font-size: var(--text-xs); color: var(--color-accent); background: rgba(0,102,255,.08); border-radius: var(--radius-full); padding: 2px 8px; }

    /* Tag multi-select */
    .tag-selector { position: relative; }
    .tag-selected {
      display: flex; flex-wrap: wrap; gap: var(--space-1); align-items: center;
      min-height: 40px; border: 1px solid var(--color-border); border-radius: var(--radius-sm);
      padding: 6px 8px; background: var(--color-surface); cursor: pointer;
      transition: border-color var(--transition-fast); box-sizing: border-box;
    }
    .tag-selected:hover, .tag-selected.open { border-color: var(--color-accent); }
    .tag-placeholder { font-size: var(--text-sm); color: var(--color-text-tertiary); flex: 1; }
    .tag-caret { margin-left: auto; color: var(--color-text-tertiary); transition: transform var(--transition-fast); flex-shrink: 0; }
    .tag-caret.open { transform: rotate(180deg); }
    .chip { display: flex; align-items: center; gap: 4px; font-size: var(--text-xs); font-weight: var(--weight-medium); color: var(--color-tag-text); background: var(--color-tag-bg); border-radius: var(--radius-full); padding: 3px 8px; }
    .chip-remove { background: none; border: none; cursor: pointer; color: var(--color-tag-text); padding: 0; font-size: 14px; line-height: 1; }

    .tag-dropdown {
      position: absolute; bottom: calc(100% + 4px); left: 0; right: 0;
      background: var(--color-surface); border: 1px solid var(--color-border);
      border-radius: var(--radius-sm); box-shadow: var(--shadow-modal);
      z-index: 200; display: flex; flex-direction: column;
    }
    .tag-search {
      border: none; border-bottom: 1px solid var(--color-border);
      padding: 8px 12px; font-size: var(--text-sm); font-family: var(--font-sans);
      outline: none; background: var(--color-surface); width: 100%; box-sizing: border-box;
      border-radius: var(--radius-sm) var(--radius-sm) 0 0;
    }
    .tag-options { overflow-y: auto; max-height: 180px; }
    .tag-option {
      display: flex; align-items: center; gap: var(--space-2);
      padding: 8px 12px; font-size: var(--text-sm); cursor: pointer;
      transition: background var(--transition-fast); user-select: none;
    }
    .tag-option:hover { background: var(--color-surface-hover); }
    .tag-option input[type="checkbox"] { accent-color: var(--color-accent); cursor: pointer; flex-shrink: 0; }
    .tag-add-new {
      display: flex; align-items: center; padding: 8px 12px;
      font-size: var(--text-sm); font-family: var(--font-sans);
      color: var(--color-accent); background: none; border: none;
      cursor: pointer; width: 100%; text-align: left;
      transition: background var(--transition-fast);
    }
    .tag-add-new:hover { background: var(--color-accent-subtle); }
    .tag-empty { padding: 12px; font-size: var(--text-sm); color: var(--color-text-tertiary); text-align: center; }

    /* Buttons */
    .btn-primary { display: flex; align-items: center; gap: var(--space-2); font-size: var(--text-sm); font-weight: var(--weight-medium); font-family: var(--font-sans); color: #fff; background: var(--color-accent); border: none; border-radius: var(--radius-sm); padding: 8px 20px; cursor: pointer; transition: background var(--transition-fast); }
    .btn-primary:hover:not(:disabled) { background: var(--color-accent-hover); }
    .btn-primary:disabled { opacity: .5; cursor: not-allowed; }
    .btn-secondary { font-size: var(--text-sm); font-weight: var(--weight-medium); font-family: var(--font-sans); color: var(--color-text-secondary); background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-sm); padding: 8px 20px; cursor: pointer; transition: background var(--transition-fast); }
    .btn-secondary:hover:not(:disabled) { background: var(--color-surface-hover); }
    .btn-secondary:disabled { opacity: .5; cursor: not-allowed; }
    .error-msg { color: var(--color-danger); font-size: var(--text-sm); margin: 0; }
    .spin-icon { animation: spin .7s linear infinite; flex-shrink: 0; }
    @keyframes spin { to { transform: rotate(360deg); } }
  `]
})
export class AddPrototypeModalComponent implements OnInit {
  @Input() existingTags: string[] = [];
  @Input() editing: Prototype | null = null;
  @Input() set externalError(msg: string) {
    if (msg) {
      this.saving = false;
      this.errorMsg = msg;
      if (msg.includes('PAT') || msg.includes('expired') || msg.includes('permission')) {
        this.pat = '';
        this.showPatPrompt = true;
      }
    }
  }
  @Output() saved = new EventEmitter<{ prototype: Prototype; pat: string; files?: { name: string; content: string }[] }>();
  @Output() cancel = new EventEmitter<void>();

  form: Partial<Prototype> & { tags: string[] } = {
    title: '', description: '', creator: '', folder: '', tags: []
  };
  pat = '';
  showPatPrompt = false;
  saving = false;
  errorMsg = '';
  uploadedFiles: { name: string; content: string }[] = [];
  processing = false;
  private cdr = inject(ChangeDetectorRef);

  // Tag dropdown state
  dropdownOpen = false;
  tagSearch = '';
  localNewTags: string[] = [];

  // Creator combobox state
  creatorSearch = '';
  creatorDropdownOpen = false;
  localNewCreators: string[] = [];

  get allCreators(): string[] {
    return [...CREATORS, ...this.localNewCreators];
  }

  get editMode() { return !!this.editing; }

  get savingLabel(): string {
    if (!this.saving) return this.editMode ? 'Save changes' : 'Add prototype';
    return this.uploadedFiles.length > 0 ? 'Uploading…' : 'Saving…';
  }

  get allTags(): string[] {
    const combined = new Set([...this.existingTags, ...this.localNewTags]);
    return Array.from(combined).sort();
  }

  @HostListener('document:click')
  onDocumentClick() {
    this.dropdownOpen = false;
    this.creatorDropdownOpen = false;
  }

  ngOnInit() {
    const stored = sessionStorage.getItem(PAT_KEY);
    this.showPatPrompt = !stored;
    if (stored) this.pat = stored;
    if (this.editing) {
      this.form = { ...this.editing, tags: [...this.editing.tags] };
      this.creatorSearch = this.editing.creator;
    }
  }

  filteredCreators(): string[] {
    const q = this.creatorSearch.trim().toLowerCase();
    return q ? this.allCreators.filter(c => c.toLowerCase().includes(q)) : this.allCreators;
  }

  newCreatorValue(): string {
    const q = this.creatorSearch.trim();
    if (!q) return '';
    return this.allCreators.some(c => c.toLowerCase() === q.toLowerCase()) ? '' : q;
  }

  selectCreator(name: string) {
    this.form.creator = name;
    this.creatorSearch = name;
    this.creatorDropdownOpen = false;
  }

  selectNewCreator() {
    const name = this.creatorSearch.trim();
    if (!name) return;
    if (!this.allCreators.some(c => c.toLowerCase() === name.toLowerCase())) {
      this.localNewCreators.push(name);
    }
    this.selectCreator(name);
  }

  onCreatorInput() {
    this.form.creator = this.creatorSearch.trim() as any;
    this.creatorDropdownOpen = true;
  }

  onTitleChange(title: string) {
    if (!this.editMode && !this._folderManuallyEdited) {
      this.form.folder = 'prototypes/' + this.slugify(title);
    }
  }

  private _folderManuallyEdited = false;

  toggleDropdown() {
    this.dropdownOpen = !this.dropdownOpen;
    if (this.dropdownOpen) this.tagSearch = '';
  }

  filteredAllTags(): string[] {
    const q = this.tagSearch.trim().toLowerCase();
    return q ? this.allTags.filter(t => t.includes(q)) : this.allTags;
  }

  allTagsInclude(value: string): boolean {
    return this.allTags.some(t => t.toLowerCase() === value.toLowerCase());
  }

  toggleTag(tag: string) {
    if (this.form.tags.includes(tag)) {
      this.form.tags = this.form.tags.filter(t => t !== tag);
    } else {
      this.form.tags = [...this.form.tags, tag];
    }
  }

  removeTag(tag: string) {
    this.form.tags = this.form.tags.filter(t => t !== tag);
  }

  addNewTag() {
    const tag = this.tagSearch.trim().toLowerCase();
    if (!tag) return;
    if (!this.allTagsInclude(tag)) this.localNewTags.push(tag);
    if (!this.form.tags.includes(tag)) this.form.tags = [...this.form.tags, tag];
    this.tagSearch = '';
  }

  async onFileSelected(event: Event) {
    const picked = Array.from((event.target as HTMLInputElement).files ?? []);
    if (!picked.length) return;
    await this.processFiles(picked);
  }

  async onDrop(event: DragEvent) {
    event.preventDefault();
    const dropped = Array.from(event.dataTransfer?.files ?? []);
    if (!dropped.length) return;
    await this.processFiles(dropped);
  }

  private async processFiles(files: File[]) {
    // Zoneless: this synchronous flag flips with the triggering event's CD pass,
    // giving immediate "Adding file…" feedback before the async reads below.
    this.processing = true;
    try {
      if (files.length === 1 && files[0].name.endsWith('.zip')) {
        const JSZip = (await import('jszip')).default;
        const zip = await JSZip.loadAsync(files[0]);
        const result: { name: string; content: string }[] = [];
        for (const [name, entry] of Object.entries(zip.files)) {
          if (entry.dir || name.includes('__MACOSX') || name.startsWith('.')) continue;
          const basename = name.split('/').filter(s => s.length > 0).pop()!;
          result.push({ name: basename, content: await entry.async('base64') });
        }
        this.uploadedFiles = result;
      } else {
        const result: { name: string; content: string }[] = [];
        for (const file of files) {
          const name = file.name.endsWith('.html') ? 'index.html' : file.name;
          result.push({ name, content: await this.toBase64(file) });
        }
        this.uploadedFiles = result;
      }
    } finally {
      this.processing = false;
      // The reads above resolve outside any event, so nudge zoneless CD to render the result.
      this.cdr.markForCheck();
    }
  }

  private toBase64(file: File): Promise<string> {
    return new Promise(resolve => {
      const reader = new FileReader();
      reader.onload = e => resolve((e.target!.result as string).split(',')[1]);
      reader.readAsDataURL(file);
    });
  }

  clearFiles(e: Event) {
    e.stopPropagation();
    this.uploadedFiles = [];
  }

  isValid(): boolean {
    return !!(this.form.title?.trim() && this.form.creator && this.form.folder?.trim() && this.pat);
  }

  async submit() {
    if (!this.isValid()) return;
    sessionStorage.setItem(PAT_KEY, this.pat);
    this.showPatPrompt = false;
    this.saving = true;
    this.errorMsg = '';
    this.dropdownOpen = false;

    const prototype: Prototype = {
      id: this.editing?.id ?? this.slugify(this.form.title!),
      title: this.form.title!.trim(),
      description: this.form.description?.trim() ?? '',
      creator: this.form.creator!,
      date: this.editing?.date ?? new Date().toISOString().slice(0, 10),
      tags: this.form.tags,
      folder: this.form.folder!.trim(),
    };

    this.saved.emit({ prototype, pat: this.pat, files: this.uploadedFiles.length ? this.uploadedFiles : undefined });
  }

  onSaveError(msg: string) { this.saving = false; this.errorMsg = msg; }
  onSaveSuccess() { this.saving = false; }

  private slugify(s: string): string {
    return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  }

  onOverlayClick(e: MouseEvent) {
    if ((e.target as HTMLElement).classList.contains('overlay')) this.cancel.emit();
  }
}
