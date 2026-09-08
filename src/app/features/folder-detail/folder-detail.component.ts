import { Component, OnInit, inject, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { CollectionService } from '../../core/services/collection.service';
import { PrototypeService } from '../../core/services/prototype.service';
import { PrototypeCardComponent } from '../prototype-card/prototype-card.component';
import { AddFolderModalComponent } from '../add-folder/add-folder-modal.component';
import { Collection } from '../../core/models/collection.model';
import { Prototype } from '../../core/models/prototype.model';

@Component({
  selector: 'dl-folder-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, PrototypeCardComponent, AddFolderModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="detail-page">
      <a class="back-link" routerLink="/folders">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M19 12H5M12 5l-7 7 7 7"/>
        </svg>
        All folders
      </a>

      <div *ngIf="svc.loading()" class="state-msg">
        <span class="spinner"></span> Loading…
      </div>

      <div *ngIf="!svc.loading() && !folder()" class="state-msg">
        Folder not found.
        <a routerLink="/folders" class="link">Back to folders</a>
      </div>

      <ng-container *ngIf="!svc.loading() && folder() as f">
        <div class="header">
          <div class="header-text">
            <h1 class="title">{{ f.name }}</h1>
            <p *ngIf="f.description" class="description">{{ f.description }}</p>
            <div class="meta">
              <span class="creator">{{ f.creator }}</span>
              <span class="date">{{ f.date | date:'MMM d, y' }}</span>
              <span class="count">· {{ f.prototypeIds.length }} {{ f.prototypeIds.length === 1 ? 'prototype' : 'prototypes' }}</span>
            </div>
          </div>
          <div class="header-actions">
            <button class="btn-secondary" (click)="openEdit()">Edit folder</button>
            <button class="btn-danger" (click)="onDelete(f)">Delete</button>
          </div>
        </div>

        <div *ngIf="members().length > 0" class="grid">
          <dl-prototype-card *ngFor="let p of members()" [prototype]="p" />
        </div>

        <div *ngIf="members().length === 0" class="empty">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2">
            <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"/>
          </svg>
          <p>No prototypes in this folder yet.</p>
          <button class="clear-link" (click)="openEdit()">Edit folder to add some</button>
        </div>
      </ng-container>
    </div>

    <dl-add-folder-modal
      *ngIf="showModal()"
      [editing]="folder()"
      [prototypes]="protoSvc.all()"
      [externalError]="modalError()"
      (saved)="onSaved($event)"
      (cancel)="closeModal()"
    />
  `,
  styles: [`
    .detail-page { max-width: 1280px; margin: 0 auto; }
    .back-link { display: inline-flex; align-items: center; gap: var(--space-2); font-size: var(--text-sm); font-weight: var(--weight-medium); color: var(--color-text-secondary); text-decoration: none; margin-bottom: var(--space-6); transition: color var(--transition-fast); }
    .back-link:hover { color: var(--color-text-primary); }
    .header { display: flex; justify-content: space-between; align-items: flex-start; gap: var(--space-6); margin-bottom: var(--space-8); }
    .title { font-size: var(--text-2xl); font-weight: var(--weight-semibold); color: var(--color-text-primary); line-height: 1.25; margin: 0; }
    .description { font-size: var(--text-base); color: var(--color-text-secondary); line-height: 1.6; margin: var(--space-2) 0 0; }
    .meta { display: flex; align-items: center; gap: var(--space-2); font-size: var(--text-sm); color: var(--color-text-tertiary); margin-top: var(--space-3); }
    .creator { font-weight: var(--weight-medium); color: var(--color-text-secondary); }
    .date::before { content: '·'; margin-right: var(--space-2); }
    .header-actions { display: flex; gap: var(--space-2); flex-shrink: 0; }
    .btn-secondary { font-size: var(--text-sm); font-weight: var(--weight-medium); font-family: var(--font-sans); color: var(--color-text-secondary); background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-sm); padding: 8px 16px; cursor: pointer; }
    .btn-secondary:hover { background: var(--color-surface-hover); }
    .btn-danger { font-size: var(--text-sm); font-weight: var(--weight-medium); font-family: var(--font-sans); color: var(--color-danger); background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-sm); padding: 8px 16px; cursor: pointer; }
    .btn-danger:hover { background: var(--color-surface-hover); border-color: var(--color-danger); }
    .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--space-5); }
    @media (max-width: 900px) { .grid { grid-template-columns: repeat(2, 1fr); } }
    @media (max-width: 560px) { .grid { grid-template-columns: 1fr; } }
    .state-msg { display: flex; align-items: center; gap: var(--space-3); font-size: var(--text-sm); color: var(--color-text-secondary); padding: var(--space-10) 0; }
    .link { color: var(--color-accent); margin-left: var(--space-2); }
    .spinner { width: 16px; height: 16px; border: 2px solid var(--color-border); border-top-color: var(--color-accent); border-radius: 50%; animation: spin .7s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .empty { display: flex; flex-direction: column; align-items: center; gap: var(--space-3); padding: var(--space-12) 0; color: var(--color-text-tertiary); }
    .empty p { font-size: var(--text-base); margin: 0; }
    .clear-link { font-size: var(--text-sm); color: var(--color-accent); background: none; border: none; cursor: pointer; font-family: var(--font-sans); text-decoration: underline; }
  `]
})
export class FolderDetailComponent implements OnInit {
  svc = inject(CollectionService);
  protoSvc = inject(PrototypeService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  folder = signal<Collection | null>(null);
  showModal = signal(false);
  modalError = signal('');

  members = computed(() => {
    const f = this.folder();
    if (!f) return [] as Prototype[];
    // Read the prototype signal so this recomputes once prototypes load.
    const all = this.protoSvc.all();
    return f.prototypeIds
      .map((id) => all.find((p) => p.id === id))
      .filter((p): p is Prototype => !!p && !p.archived);
  });

  ngOnInit() {
    this.protoSvc.load(); // resolve members (and populate the add-folder multi-select)
    const id = this.route.snapshot.paramMap.get('id')!;

    const tryFind = () => {
      const found = this.svc.findById(id);
      if (found) { this.folder.set(found); return true; }
      return false;
    };

    if (!tryFind()) {
      this.svc.load();
      const interval = setInterval(() => {
        if (!this.svc.loading()) {
          clearInterval(interval);
          tryFind();
        }
      }, 100);
    }
  }

  openEdit() { this.modalError.set(''); this.showModal.set(true); }
  closeModal() { this.showModal.set(false); this.modalError.set(''); }

  async onSaved({ collection, pat }: { collection: Collection; pat: string }) {
    try {
      await this.svc.updateCollection(collection, pat);
      this.folder.set(this.svc.findById(collection.id) ?? collection);
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

  async onDelete(f: Collection) {
    if (!confirm(`Delete the folder "${f.name}"? The prototypes inside it are not deleted.`)) return;
    const pat = sessionStorage.getItem('dl_github_pat') ?? '';
    if (!pat) { alert('Enter your GitHub PAT first (open a folder\'s Edit dialog).'); return; }
    try {
      await this.svc.deleteCollection(f.id, pat);
      this.router.navigate(['/folders']);
    } catch (err) {
      console.error('Delete failed', err);
      alert('Could not delete the folder. Check your token and try again.');
    }
  }
}
