import { Component, OnInit, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CollectionService } from '../../core/services/collection.service';
import { PrototypeService } from '../../core/services/prototype.service';
import { UiStateService } from '../../core/services/ui-state.service';
import { FolderCardComponent } from '../folder-card/folder-card.component';
import { AddFolderModalComponent } from '../add-folder/add-folder-modal.component';
import { SearchBarComponent } from '../search-bar/search-bar.component';
import { Collection } from '../../core/models/collection.model';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
  selector: 'dl-folders',
  standalone: true,
  imports: [CommonModule, FolderCardComponent, AddFolderModalComponent, SearchBarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="folders-page">
      <div class="toolbar">
        <dl-search-bar placeholder="Search folders…" (searched)="svc.setSearch($event)" />
      </div>

      <div *ngIf="svc.loading()" class="state-msg">
        <span class="spinner"></span> Loading folders…
      </div>
      <div *ngIf="svc.error() && !svc.loading()" class="state-msg error">
        {{ svc.error() }}
        <button class="retry-btn" (click)="svc.load()">Retry</button>
      </div>

      <div *ngIf="!svc.loading() && !svc.error()" class="grid">
        <dl-folder-card
          *ngFor="let c of svc.filtered()"
          [collection]="c"
          (edit)="openEdit($event)"
          (delete)="onDelete($event)"
        />
      </div>

      <div *ngIf="!svc.loading() && !svc.error() && svc.filtered().length === 0" class="empty">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2">
          <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"/>
        </svg>
        <p>No folders yet.</p>
        <span class="empty-sub">Create a folder to group prototypes by module, product area, or initiative.</span>
      </div>
    </div>

    <dl-add-folder-modal
      *ngIf="showModal()"
      [editing]="editing()"
      [prototypes]="protoSvc.all()"
      [externalError]="modalError()"
      (saved)="onSaved($event)"
      (cancel)="closeModal()"
    />
  `,
  styles: [`
    .folders-page { display: flex; flex-direction: column; gap: var(--space-6); }
    .toolbar { display: flex; flex-direction: column; gap: var(--space-4); }
    .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--space-5); }
    @media (max-width: 900px) { .grid { grid-template-columns: repeat(2, 1fr); } }
    @media (max-width: 560px) { .grid { grid-template-columns: 1fr; } }
    .state-msg { display: flex; align-items: center; gap: var(--space-3); font-size: var(--text-sm); color: var(--color-text-secondary); padding: var(--space-10) 0; }
    .state-msg.error { color: var(--color-danger); }
    .retry-btn { font-size: var(--text-sm); color: var(--color-accent); background: none; border: none; cursor: pointer; padding: 0; font-family: var(--font-sans); text-decoration: underline; }
    .spinner { width: 16px; height: 16px; border: 2px solid var(--color-border); border-top-color: var(--color-accent); border-radius: 50%; animation: spin .7s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .empty { display: flex; flex-direction: column; align-items: center; gap: var(--space-3); padding: var(--space-12) 0; color: var(--color-text-tertiary); }
    .empty p { font-size: var(--text-base); margin: 0; }
    .empty-sub { font-size: var(--text-sm); color: var(--color-text-tertiary); }
  `]
})
export class FoldersComponent implements OnInit {
  svc = inject(CollectionService);
  protoSvc = inject(PrototypeService);
  private ui = inject(UiStateService);
  // Signals: openAdd() runs from the triggerAdd$ subscription (outside this OnPush
  // component), so plain props wouldn't be picked up by change detection.
  showModal = signal(false);
  editing = signal<Collection | null>(null);
  modalError = signal('');

  constructor() {
    this.ui.triggerAdd$.pipe(takeUntilDestroyed()).subscribe(() => this.openAdd());
  }

  ngOnInit() {
    this.svc.load();
    this.protoSvc.load(); // needed for the modal's prototype multi-select
  }

  openAdd() { this.editing.set(null); this.modalError.set(''); this.showModal.set(true); }
  openEdit(c: Collection) { this.editing.set(c); this.modalError.set(''); this.showModal.set(true); }
  closeModal() { this.showModal.set(false); this.editing.set(null); this.modalError.set(''); }

  async onSaved({ collection, pat }: { collection: Collection; pat: string }) {
    try {
      if (this.editing()) {
        await this.svc.updateCollection(collection, pat);
      } else {
        await this.svc.addCollection(collection, pat);
      }
      this.closeModal();
    } catch (err: unknown) {
      console.error('Save failed', err);
      const status = (err as any)?.status;
      const msg = (err as any)?.error?.message ?? (err as any)?.message ?? 'Unknown error';
      if (status === 401 || status === 403 || status === 404) {
        this.modalError.set(`GitHub rejected the request (${status}). Your token is likely expired, missing the "Contents: write" permission, or has no access to this repository. Re-enter a valid token below.`);
        this.svc.clearPat();
      } else {
        this.modalError.set(`Save failed (${status ?? 'network error'}): ${msg}`);
      }
    }
  }

  async onDelete(c: Collection) {
    if (!confirm(`Delete the folder "${c.name}"? The prototypes inside it are not deleted.`)) return;
    const pat = sessionStorage.getItem('dl_github_pat') ?? '';
    if (!pat) { alert('Enter your GitHub PAT first by opening "Add folder".'); return; }
    try {
      await this.svc.deleteCollection(c.id, pat);
    } catch (err) {
      console.error('Delete failed', err);
      alert('Could not delete the folder. Check your token and try again.');
    }
  }
}
