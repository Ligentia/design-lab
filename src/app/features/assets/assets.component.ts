import { Component, OnInit, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AssetService } from '../../core/services/asset.service';
import { UiStateService } from '../../core/services/ui-state.service';
import { AssetCardComponent } from '../asset-card/asset-card.component';
import { AddAssetModalComponent } from '../add-asset/add-asset-modal.component';
import { SearchBarComponent } from '../search-bar/search-bar.component';
import { TagFilterComponent } from '../tag-filter/tag-filter.component';
import { Asset } from '../../core/models/asset.model';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
  selector: 'dl-assets',
  standalone: true,
  imports: [CommonModule, AssetCardComponent, AddAssetModalComponent, SearchBarComponent, TagFilterComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="assets-page">
      <div class="toolbar">
        <dl-search-bar (searched)="svc.setSearch($event)" />
        <dl-tag-filter
          [tags]="svc.allTypes()"
          [activeTags]="svc.activeTypes()"
          (toggle)="svc.toggleType($event)"
          (clear)="svc.clearFilters()"
        />
      </div>

      <div *ngIf="svc.loading()" class="state-msg">
        <span class="spinner"></span> Loading assets…
      </div>
      <div *ngIf="svc.error() && !svc.loading()" class="state-msg error">
        {{ svc.error() }}
        <button class="retry-btn" (click)="svc.load()">Retry</button>
      </div>

      <div *ngIf="!svc.loading() && !svc.error()" class="grid">
        <dl-asset-card
          *ngFor="let a of svc.filtered()"
          [asset]="a"
          (edit)="openEdit($event)"
        />
      </div>

      <div *ngIf="!svc.loading() && !svc.error() && svc.filtered().length === 0" class="empty">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2">
          <path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z"/>
          <polyline points="13 2 13 9 20 9"/>
        </svg>
        <p>No assets found.</p>
        <button class="clear-link" (click)="svc.clearFilters()">Clear filters</button>
      </div>
    </div>

    <dl-add-asset-modal
      *ngIf="showModal()"
      [editing]="editingAsset()"
      [externalError]="modalError()"
      (saved)="onSaved($event)"
      (cancel)="closeModal()"
    />
  `,
  styles: [`
    .assets-page { display: flex; flex-direction: column; gap: var(--space-6); }
    .toolbar { display: flex; flex-direction: column; gap: var(--space-4); }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: var(--space-5); }
    .state-msg { display: flex; align-items: center; gap: var(--space-3); font-size: var(--text-sm); color: var(--color-text-secondary); padding: var(--space-10) 0; }
    .state-msg.error { color: var(--color-danger); }
    .retry-btn { font-size: var(--text-sm); color: var(--color-accent); background: none; border: none; cursor: pointer; padding: 0; font-family: var(--font-sans); text-decoration: underline; }
    .spinner { width: 16px; height: 16px; border: 2px solid var(--color-border); border-top-color: var(--color-accent); border-radius: 50%; animation: spin .7s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .empty { display: flex; flex-direction: column; align-items: center; gap: var(--space-3); padding: var(--space-12) 0; color: var(--color-text-tertiary); }
    .empty p { font-size: var(--text-base); margin: 0; }
    .clear-link { font-size: var(--text-sm); color: var(--color-accent); background: none; border: none; cursor: pointer; font-family: var(--font-sans); text-decoration: underline; }
  `]
})
export class AssetsComponent implements OnInit {
  svc = inject(AssetService);
  private ui = inject(UiStateService);
  // Signals (not plain props): openAdd() runs from the triggerAdd$ subscription,
  // which originates outside this OnPush component, so a plain mutation would be
  // invisible to change detection until the next event. Mirrors DashboardComponent.
  showModal = signal(false);
  editingAsset = signal<Asset | null>(null);
  modalError = signal('');

  constructor() {
    this.ui.triggerAdd$.pipe(takeUntilDestroyed()).subscribe(() => this.openAdd());
  }

  ngOnInit() { this.svc.load(); }

  openAdd() { this.editingAsset.set(null); this.modalError.set(''); this.showModal.set(true); }
  openEdit(a: Asset) { this.editingAsset.set(a); this.modalError.set(''); this.showModal.set(true); }
  closeModal() { this.showModal.set(false); this.editingAsset.set(null); this.modalError.set(''); }

  async onSaved({ asset, pat }: { asset: Asset; pat: string }) {
    try {
      if (this.editingAsset()) {
        await this.svc.updateAsset(asset, pat);
      } else {
        await this.svc.addAsset(asset, pat);
      }
      this.closeModal();
    } catch (err: unknown) {
      console.error('Save failed', err);
      const status = (err as any)?.status;
      const msg = (err as any)?.error?.message ?? (err as any)?.message ?? 'Unknown error';
      if (status === 401 || status === 403 || status === 404) {
        // GitHub's Contents API returns 404 (not 403) when a token can't write to
        // the repo, so treat it as a permission problem and prompt for a new token.
        this.modalError.set(`GitHub rejected the request (${status}). Your token is likely expired, missing the "Contents: write" permission, or has no access to this repository. Re-enter a valid token below.`);
        this.svc.clearPat();
      } else {
        this.modalError.set(`Save failed (${status ?? 'network error'}): ${msg}`);
      }
    }
  }
}
