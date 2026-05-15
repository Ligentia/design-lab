import { Component, OnInit, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PrototypeService } from '../../core/services/prototype.service';
import { UiStateService } from '../../core/services/ui-state.service';
import { PrototypeCardComponent } from '../prototype-card/prototype-card.component';
import { TagFilterComponent } from '../tag-filter/tag-filter.component';
import { SearchBarComponent } from '../search-bar/search-bar.component';
import { AddPrototypeModalComponent } from '../add-prototype/add-prototype-modal.component';
import { Prototype } from '../../core/models/prototype.model';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
  selector: 'dl-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    PrototypeCardComponent,
    TagFilterComponent,
    SearchBarComponent,
    AddPrototypeModalComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dashboard">
      <!-- Toolbar -->
      <div class="toolbar">
        <dl-search-bar (searched)="svc.setSearch($event)" />
        <dl-tag-filter
          [tags]="svc.allTags()"
          [activeTags]="svc.activeTags()"
          (toggle)="svc.toggleTag($event)"
          (clear)="svc.clearFilters()"
        />
      </div>

      <!-- Loading -->
      <div *ngIf="svc.loading()" class="state-msg">
        <span class="spinner"></span> Loading prototypes…
      </div>

      <!-- Error -->
      <div *ngIf="svc.error() && !svc.loading()" class="state-msg error">
        {{ svc.error() }}
        <button class="retry-btn" (click)="svc.load()">Retry</button>
      </div>

      <!-- Grid -->
      <div *ngIf="!svc.loading() && !svc.error()" class="grid">
        <dl-prototype-card
          *ngFor="let p of svc.filtered()"
          [prototype]="p"
          (edit)="openEdit($event)"
          (archive)="onArchive($event)"
        />
      </div>

      <!-- Empty state -->
      <div *ngIf="!svc.loading() && !svc.error() && svc.filtered().length === 0" class="empty">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2">
          <path d="M3 7h18M3 12h12M3 17h8"/>
        </svg>
        <p>No prototypes found.</p>
        <button class="clear-link" (click)="svc.clearFilters()">Clear filters</button>
      </div>

    </div>

    <!-- Modal -->
    <dl-add-prototype-modal
      *ngIf="showModal()"
      [existingTags]="svc.allTags()"
      [editing]="editingPrototype()"
      (saved)="onSaved($event)"
      (cancel)="closeModal()"
      #addModal
    />
  `,
  styles: [`
    .dashboard { display: flex; flex-direction: column; gap: var(--space-6); }
    .toolbar { display: flex; flex-direction: column; gap: var(--space-4); }
    .grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: var(--space-5);
    }
    @media (max-width: 900px) { .grid { grid-template-columns: repeat(2, 1fr); } }
    @media (max-width: 560px) { .grid { grid-template-columns: 1fr; } }
    .state-msg {
      display: flex; align-items: center; gap: var(--space-3);
      font-size: var(--text-sm); color: var(--color-text-secondary);
      padding: var(--space-10) 0;
    }
    .state-msg.error { color: var(--color-danger); }
    .retry-btn {
      font-size: var(--text-sm); color: var(--color-accent);
      background: none; border: none; cursor: pointer; padding: 0;
      font-family: var(--font-sans); text-decoration: underline;
    }
    .spinner {
      width: 16px; height: 16px; border: 2px solid var(--color-border);
      border-top-color: var(--color-accent); border-radius: 50%;
      animation: spin .7s linear infinite; flex-shrink: 0;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .empty {
      display: flex; flex-direction: column; align-items: center;
      gap: var(--space-3); padding: var(--space-12) 0;
      color: var(--color-text-tertiary);
    }
    .empty p { font-size: var(--text-base); margin: 0; }
    .clear-link {
      font-size: var(--text-sm); color: var(--color-accent);
      background: none; border: none; cursor: pointer;
      font-family: var(--font-sans); text-decoration: underline;
    }
  `]
})
export class DashboardComponent implements OnInit {
  svc = inject(PrototypeService);
  private ui = inject(UiStateService);
  showModal = signal(false);
  editingPrototype = signal<Prototype | null>(null);

  constructor() {
    this.ui.triggerAdd$.pipe(takeUntilDestroyed()).subscribe(() => this.openAdd());
  }

  ngOnInit() { this.svc.load(); }

  openAdd() { this.editingPrototype.set(null); this.showModal.set(true); }
  openEdit(p: Prototype) { this.editingPrototype.set(p); this.showModal.set(true); }
  closeModal() { this.showModal.set(false); this.editingPrototype.set(null); }

  async onSaved({ prototype, pat, files }: { prototype: Prototype; pat: string; files?: { name: string; content: string }[] }) {
    try {
      if (this.editingPrototype()) {
        await this.svc.updatePrototype(prototype, pat);
      } else {
        await this.svc.addPrototype(prototype, pat, files);
      }
      this.closeModal();
    } catch (err: unknown) {
      console.error('Save failed', err);
    }
  }

  async onArchive(p: Prototype) {
    const pat = sessionStorage.getItem('dl_github_pat') ?? '';
    if (!pat) { alert('Enter your GitHub PAT first by opening the "Add prototype" modal.'); return; }
    try { await this.svc.archivePrototype(p, pat); } catch (err) { console.error('Archive failed', err); }
  }
}
