import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Collection } from '../../core/models/collection.model';

@Component({
  selector: 'dl-folder-card',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article class="card" (click)="openDetail()">
      <div class="preview">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4">
          <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"/>
        </svg>
        <span class="count-badge">{{ collection.prototypeIds.length }}</span>
      </div>

      <div class="body">
        <div class="meta">
          <span class="creator">{{ collection.creator }}</span>
          <span class="date">{{ collection.date | date:'MMM d, y' }}</span>
        </div>
        <h3 class="name">{{ collection.name }}</h3>
        <p *ngIf="collection.description" class="description">{{ collection.description }}</p>
        <div class="count-line">
          {{ collection.prototypeIds.length }}
          {{ collection.prototypeIds.length === 1 ? 'prototype' : 'prototypes' }}
        </div>
      </div>

      <div class="actions" (click)="$event.stopPropagation()">
        <button class="action-btn" (click)="edit.emit(collection)">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
          Edit
        </button>
        <button class="action-btn action-btn--danger" (click)="delete.emit(collection)">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
          </svg>
          Delete
        </button>
      </div>
    </article>
  `,
  styles: [`
    .card { background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-md); box-shadow: var(--shadow-card); cursor: pointer; display: flex; flex-direction: column; overflow: hidden; transition: box-shadow var(--transition-base), transform var(--transition-base); }
    .card:hover { box-shadow: var(--shadow-card-hover); transform: translateY(-2px); }
    .preview { position: relative; height: 120px; display: flex; align-items: center; justify-content: center; background: var(--color-surface-subtle); border-bottom: 1px solid var(--color-border); color: var(--color-text-tertiary); }
    .count-badge { position: absolute; top: var(--space-3); right: var(--space-3); min-width: 20px; height: 20px; padding: 0 6px; display: flex; align-items: center; justify-content: center; font-size: var(--text-xs); font-weight: var(--weight-semibold); color: #fff; background: var(--color-accent); border-radius: var(--radius-full); }
    .body { padding: var(--space-4); flex: 1; display: flex; flex-direction: column; gap: var(--space-2); }
    .meta { display: flex; align-items: center; gap: var(--space-2); font-size: var(--text-xs); color: var(--color-text-tertiary); }
    .creator { font-weight: var(--weight-medium); color: var(--color-text-secondary); }
    .date::before { content: '·'; margin-right: var(--space-2); }
    .name { font-size: var(--text-base); font-weight: var(--weight-semibold); color: var(--color-text-primary); margin: 0; line-height: 1.3; }
    .description { font-size: var(--text-sm); color: var(--color-text-secondary); margin: 0; line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    .count-line { font-size: var(--text-xs); color: var(--color-text-tertiary); margin-top: auto; padding-top: var(--space-2); }
    .actions { display: flex; gap: var(--space-1); padding: var(--space-2) var(--space-4); border-top: 1px solid var(--color-border); background: var(--color-surface-subtle); }
    .action-btn { display: flex; align-items: center; gap: var(--space-1); font-size: var(--text-xs); font-weight: var(--weight-medium); color: var(--color-text-secondary); background: none; border: none; border-radius: var(--radius-sm); padding: 4px 8px; cursor: pointer; transition: background var(--transition-fast), color var(--transition-fast); font-family: var(--font-sans); }
    .action-btn:hover { background: var(--color-surface-hover); color: var(--color-text-primary); }
    .action-btn--danger:hover { color: var(--color-danger); }
  `]
})
export class FolderCardComponent {
  @Input({ required: true }) collection!: Collection;
  @Output() edit = new EventEmitter<Collection>();
  @Output() delete = new EventEmitter<Collection>();

  private router = inject(Router);

  openDetail() {
    this.router.navigate(['/folder', this.collection.id]);
  }
}
