import { Component, Input, Output, EventEmitter, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Collection } from '../../core/models/collection.model';
import { Prototype, CREATORS } from '../../core/models/prototype.model';

const PAT_KEY = 'dl_github_pat';

@Component({
  selector: 'dl-add-folder-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="overlay" (click)="onOverlayClick($event)">
      <div class="modal" role="dialog" aria-modal="true">
        <div class="modal-header">
          <h2 class="modal-title">{{ editing ? 'Edit folder' : 'Add folder' }}</h2>
          <button class="close-btn" (click)="cancel.emit()">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>
        <div class="modal-body">
          <div class="field" *ngIf="showPatPrompt">
            <label class="label">GitHub Personal Access Token</label>
            <p class="hint">Required to save changes. Stored only in this browser session.</p>
            <input class="input" type="password" placeholder="ghp_…" [(ngModel)]="pat" />
          </div>
          <div class="field">
            <label class="label">Name <span class="required">*</span></label>
            <input class="input" type="text" placeholder="e.g. Checkout redesign" [(ngModel)]="form.name" />
          </div>
          <div class="field">
            <label class="label">Description</label>
            <textarea class="input textarea" placeholder="What is this folder for?" [(ngModel)]="form.description" rows="2"></textarea>
          </div>
          <div class="field">
            <label class="label">Creator <span class="required">*</span></label>
            <select class="input select" [(ngModel)]="form.creator">
              <option *ngFor="let c of creators" [value]="c">{{ c }}</option>
            </select>
          </div>

          <div class="field">
            <label class="label">
              Prototypes
              <span class="optional">({{ selectedIds().size }} selected)</span>
            </label>
            <input class="input" type="search" placeholder="Filter prototypes…" [ngModel]="protoQuery()" (ngModelChange)="protoQuery.set($event)" />
            <div class="proto-list">
              <label *ngFor="let p of filteredPrototypes()" class="proto-item">
                <input type="checkbox" [checked]="selectedIds().has(p.id)" (change)="toggle(p.id)" />
                <span class="proto-title">{{ p.title }}</span>
                <span class="proto-creator">{{ p.creator }}</span>
              </label>
              <p *ngIf="filteredPrototypes().length === 0" class="proto-empty">No prototypes match.</p>
            </div>
          </div>

          <p *ngIf="errorMsg" class="error-msg">{{ errorMsg }}</p>
        </div>
        <div class="modal-footer">
          <button class="btn-secondary" (click)="cancel.emit()" [disabled]="saving">Cancel</button>
          <button class="btn-primary" (click)="submit()" [disabled]="!isValid() || saving">
            {{ saving ? 'Saving…' : (editing ? 'Save changes' : 'Add folder') }}
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .overlay { position: fixed; inset: 0; background: rgba(0,0,0,.45); display: flex; align-items: center; justify-content: center; z-index: 100; padding: var(--space-4); }
    .modal { background: var(--color-surface); border-radius: var(--radius-lg); box-shadow: var(--shadow-modal); width: 100%; max-width: 520px; max-height: 90vh; overflow-y: auto; display: flex; flex-direction: column; }
    .modal-header { display: flex; align-items: center; justify-content: space-between; padding: var(--space-5) var(--space-6); border-bottom: 1px solid var(--color-border); position: sticky; top: 0; background: var(--color-surface); z-index: 1; }
    .modal-title { font-size: var(--text-lg); font-weight: var(--weight-semibold); color: var(--color-text-primary); margin: 0; }
    .close-btn { background: none; border: none; cursor: pointer; padding: var(--space-1); color: var(--color-text-tertiary); border-radius: var(--radius-sm); display: flex; align-items: center; }
    .close-btn:hover { color: var(--color-text-primary); background: var(--color-surface-hover); }
    .modal-body { padding: var(--space-5) var(--space-6); display: flex; flex-direction: column; gap: var(--space-5); }
    .modal-footer { padding: var(--space-4) var(--space-6); border-top: 1px solid var(--color-border); display: flex; justify-content: flex-end; gap: var(--space-3); position: sticky; bottom: 0; background: var(--color-surface); }
    .field { display: flex; flex-direction: column; gap: var(--space-1); }
    .label { font-size: var(--text-sm); font-weight: var(--weight-medium); color: var(--color-text-primary); }
    .required { color: var(--color-danger); }
    .optional { font-size: var(--text-xs); color: var(--color-text-tertiary); font-weight: 400; }
    .hint { font-size: var(--text-xs); color: var(--color-text-tertiary); margin: 0; }
    .input { font-size: var(--text-sm); font-family: var(--font-sans); color: var(--color-text-primary); border: 1px solid var(--color-border); border-radius: var(--radius-sm); padding: 8px 12px; outline: none; background: var(--color-surface); transition: border-color var(--transition-fast); width: 100%; box-sizing: border-box; }
    .input:focus { border-color: var(--color-accent); }
    .textarea { resize: vertical; min-height: 64px; }
    .select { cursor: pointer; }
    .proto-list { border: 1px solid var(--color-border); border-radius: var(--radius-sm); max-height: 200px; overflow-y: auto; display: flex; flex-direction: column; }
    .proto-item { display: flex; align-items: center; gap: var(--space-3); padding: 8px 12px; cursor: pointer; border-bottom: 1px solid var(--color-border); }
    .proto-item:last-child { border-bottom: none; }
    .proto-item:hover { background: var(--color-surface-hover); }
    .proto-item input { cursor: pointer; margin: 0; flex-shrink: 0; }
    .proto-title { font-size: var(--text-sm); color: var(--color-text-primary); flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .proto-creator { font-size: var(--text-xs); color: var(--color-text-tertiary); flex-shrink: 0; }
    .proto-empty { font-size: var(--text-sm); color: var(--color-text-tertiary); margin: 0; padding: 12px; }
    .btn-primary { font-size: var(--text-sm); font-weight: var(--weight-medium); font-family: var(--font-sans); color: #fff; background: var(--color-accent); border: none; border-radius: var(--radius-sm); padding: 8px 20px; cursor: pointer; transition: background var(--transition-fast); }
    .btn-primary:hover:not(:disabled) { background: var(--color-accent-hover); }
    .btn-primary:disabled { opacity: .5; cursor: not-allowed; }
    .btn-secondary { font-size: var(--text-sm); font-weight: var(--weight-medium); font-family: var(--font-sans); color: var(--color-text-secondary); background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-sm); padding: 8px 20px; cursor: pointer; }
    .btn-secondary:hover:not(:disabled) { background: var(--color-surface-hover); }
    .error-msg { color: var(--color-danger); font-size: var(--text-sm); margin: 0; }
  `]
})
export class AddFolderModalComponent implements OnInit {
  @Input() editing: Collection | null = null;
  @Input() prototypes: Prototype[] = [];
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
  @Output() saved = new EventEmitter<{ collection: Collection; pat: string }>();
  @Output() cancel = new EventEmitter<void>();

  creators = CREATORS;
  form: { name: string; description: string; creator: string } = {
    name: '', description: '', creator: 'Craig',
  };
  // Signals so the checkbox list re-renders in this OnPush-friendly modal.
  selectedIds = signal<Set<string>>(new Set());
  protoQuery = signal('');
  pat = '';
  showPatPrompt = false;
  saving = false;
  errorMsg = '';

  filteredPrototypes = computed(() => {
    const q = this.protoQuery().toLowerCase().trim();
    return this.prototypes
      .filter(p => !p.archived)
      .filter(p => !q || p.title.toLowerCase().includes(q) || p.creator.toLowerCase().includes(q));
  });

  ngOnInit() {
    const stored = sessionStorage.getItem(PAT_KEY);
    this.showPatPrompt = !stored;
    if (stored) this.pat = stored;
    if (this.editing) {
      this.form = {
        name: this.editing.name,
        description: this.editing.description ?? '',
        creator: this.editing.creator,
      };
      this.selectedIds.set(new Set(this.editing.prototypeIds));
    }
  }

  toggle(id: string) {
    const next = new Set(this.selectedIds());
    next.has(id) ? next.delete(id) : next.add(id);
    this.selectedIds.set(next);
  }

  isValid() { return !!(this.form.name?.trim() && this.form.creator && this.pat); }

  submit() {
    if (!this.isValid()) return;
    sessionStorage.setItem(PAT_KEY, this.pat);
    this.saving = true;
    this.errorMsg = '';
    const collection: Collection = {
      id: this.editing?.id ?? this.slugify(this.form.name),
      name: this.form.name.trim(),
      description: this.form.description?.trim() || undefined,
      creator: this.form.creator,
      date: this.editing?.date ?? new Date().toISOString().slice(0, 10),
      updatedAt: this.editing ? new Date().toISOString().slice(0, 10) : undefined,
      prototypeIds: [...this.selectedIds()],
    };
    this.saved.emit({ collection, pat: this.pat });
  }

  private slugify(s: string) {
    return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '-' + Date.now().toString(36);
  }

  onOverlayClick(e: MouseEvent) {
    if ((e.target as HTMLElement).classList.contains('overlay')) this.cancel.emit();
  }
}
