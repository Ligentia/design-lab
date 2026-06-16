import { Component, inject, ChangeDetectionStrategy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PrototypeService } from '../../core/services/prototype.service';
import { PrototypeCardComponent } from '../prototype-card/prototype-card.component';
import { Prototype } from '../../core/models/prototype.model';

@Component({
  selector: 'dl-archived',
  standalone: true,
  imports: [CommonModule, PrototypeCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="archived-page">
      <!-- Loading -->
      <div *ngIf="svc.loading()" class="state-msg">
        <span class="spinner"></span> Loading…
      </div>

      <!-- Empty state -->
      <div *ngIf="!svc.loading() && svc.archivedPrototypes().length === 0" class="empty">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2">
          <polyline points="21 8 21 21 3 21 3 8"/>
          <rect x="1" y="3" width="22" height="5"/>
          <line x1="10" y1="12" x2="14" y2="12"/>
        </svg>
        <p>No archived prototypes yet.</p>
        <span class="empty-sub">Archived prototypes will appear here. They can be restored at any time.</span>
      </div>

      <!-- Grid -->
      <div *ngIf="!svc.loading() && svc.archivedPrototypes().length > 0" class="grid">
        <dl-prototype-card
          *ngFor="let p of svc.archivedPrototypes()"
          [prototype]="p"
          [isArchived]="true"
          (restore)="onRestore($event)"
        />
      </div>
    </div>
  `,
  styles: [`
    .archived-page { display: flex; flex-direction: column; gap: var(--space-6); }
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
    .spinner {
      width: 16px; height: 16px; border: 2px solid var(--color-border);
      border-top-color: var(--color-accent); border-radius: 50%;
      animation: spin .7s linear infinite; flex-shrink: 0;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .empty {
      display: flex; flex-direction: column; align-items: center;
      gap: var(--space-3); padding: var(--space-12) 0;
      color: var(--color-text-tertiary); text-align: center;
    }
    .empty p { font-size: var(--text-base); margin: 0; color: var(--color-text-secondary); }
    .empty-sub { font-size: var(--text-sm); max-width: 320px; line-height: 1.5; }
  `]
})
export class ArchivedComponent implements OnInit {
  svc = inject(PrototypeService);

  ngOnInit() { this.svc.load(); }

  async onRestore(p: Prototype) {
    const pat = sessionStorage.getItem('dl_github_pat') ?? '';
    if (!pat) { alert('Enter your GitHub PAT first by opening the "Add prototype" modal.'); return; }
    try { await this.svc.restorePrototype(p, pat); } catch (err) { console.error('Restore failed', err); }
  }
}
