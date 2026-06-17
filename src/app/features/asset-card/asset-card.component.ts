import { Component, Input, Output, EventEmitter, OnInit, ChangeDetectionStrategy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { inject } from '@angular/core';
import { Asset } from '../../core/models/asset.model';
import { environment } from '../../../environments/environment';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

@Component({
  selector: 'dl-asset-card',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article class="card">
      <!-- SVG preview -->
      <div class="preview" *ngIf="asset.type === 'svg'">
        <div class="svg-wrap" *ngIf="svgContent()" [innerHTML]="svgContent()"></div>
        <div class="preview-placeholder" *ngIf="!svgContent()">
          <span class="type-badge svg">SVG</span>
        </div>
      </div>
      <div class="preview type-preview" *ngIf="asset.type !== 'svg'">
        <span class="type-badge" [class]="asset.type">{{ asset.type }}</span>
      </div>

      <div class="body">
        <div class="meta">
          <span class="added-by">{{ asset.addedBy }}</span>
          <span class="date">{{ asset.date | date:'MMM d, y' }}</span>
        </div>
        <h3 class="name">{{ asset.name }}</h3>
        <p *ngIf="asset.description" class="description">{{ asset.description }}</p>
        <div class="tags" *ngIf="asset.tags?.length">
          <span *ngFor="let tag of asset.tags" class="tag">{{ tag }}</span>
        </div>
      </div>

      <div class="actions">
        <button class="action-btn" title="Copy file path" (click)="copyPath()">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="9" y="9" width="13" height="13" rx="2"/>
            <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
          </svg>
          {{ pathCopied() ? 'Copied!' : 'Copy path' }}
        </button>
        <a class="action-btn" [href]="rawUrl()" target="_blank" rel="noopener" title="Download">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          Download
        </a>
        <button class="action-btn" (click)="edit.emit(asset)">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
          Edit
        </button>
      </div>
    </article>
  `,
  styles: [`
    .card { background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-md); box-shadow: var(--shadow-card); display: flex; flex-direction: column; overflow: hidden; transition: box-shadow var(--transition-base), transform var(--transition-base); }
    .card:hover { box-shadow: var(--shadow-card-hover); transform: translateY(-2px); }
    .preview { height: 120px; display: flex; align-items: center; justify-content: center; background: var(--color-surface-subtle); border-bottom: 1px solid var(--color-border); padding: var(--space-4); }
    .svg-wrap { max-height: 80px; max-width: 100%; display: flex; align-items: center; justify-content: center; }
    .svg-wrap ::ng-deep svg { max-height: 80px; max-width: 100%; width: auto; height: auto; }
    .preview-placeholder { display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; }
    .type-preview { background: var(--color-surface-subtle); }
    .type-badge { font-size: var(--text-xs); font-weight: var(--weight-semibold); text-transform: uppercase; letter-spacing: .08em; border-radius: var(--radius-sm); padding: 4px 10px; }
    .type-badge.svg { background: #fef3c7; color: #92400e; }
    .type-badge.html { background: #fee2e2; color: #991b1b; }
    .type-badge.angular { background: #fce7f3; color: #9d174d; }
    .type-badge.other { background: var(--color-surface-hover); color: var(--color-text-secondary); }
    .body { padding: var(--space-4); flex: 1; display: flex; flex-direction: column; gap: var(--space-2); }
    .meta { display: flex; align-items: center; gap: var(--space-2); font-size: var(--text-xs); color: var(--color-text-tertiary); }
    .added-by { font-weight: var(--weight-medium); color: var(--color-text-secondary); }
    .date::before { content: '·'; margin-right: var(--space-2); }
    .name { font-size: var(--text-base); font-weight: var(--weight-semibold); color: var(--color-text-primary); margin: 0; line-height: 1.3; }
    .description { font-size: var(--text-sm); color: var(--color-text-secondary); margin: 0; line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    .tags { display: flex; flex-wrap: wrap; gap: var(--space-1); margin-top: auto; padding-top: var(--space-2); }
    .tag { font-size: var(--text-xs); font-weight: var(--weight-medium); color: var(--color-tag-text); background: var(--color-tag-bg); border-radius: var(--radius-full); padding: 2px 8px; }
    .actions { display: flex; gap: var(--space-1); padding: var(--space-2) var(--space-4); border-top: 1px solid var(--color-border); background: var(--color-surface-subtle); }
    .action-btn { display: flex; align-items: center; gap: var(--space-1); font-size: var(--text-xs); font-weight: var(--weight-medium); color: var(--color-text-secondary); background: none; border: none; border-radius: var(--radius-sm); padding: 4px 8px; cursor: pointer; text-decoration: none; transition: background var(--transition-fast), color var(--transition-fast); font-family: var(--font-sans); }
    .action-btn:hover { background: var(--color-surface-hover); color: var(--color-text-primary); }
  `]
})
export class AssetCardComponent implements OnInit {
  @Input({ required: true }) asset!: Asset;
  @Output() edit = new EventEmitter<Asset>();

  private http = inject(HttpClient);
  private sanitizer = inject(DomSanitizer);
  svgContent = signal<SafeHtml | null>(null);
  pathCopied = signal(false);

  ngOnInit() {
    if (this.asset.type === 'svg') {
      this.http.get(this.rawUrl(), { responseType: 'text' }).subscribe({
        next: (svg) => this.svgContent.set(this.sanitizer.bypassSecurityTrustHtml(svg)),
        error: () => {},
      });
    }
  }

  rawUrl(): string {
    return `https://raw.githubusercontent.com/${environment.githubOwner}/${environment.githubRepo}/${environment.githubBranch}/${this.asset.file}`;
  }

  copyPath() {
    navigator.clipboard.writeText(this.asset.file).then(() => {
      this.pathCopied.set(true);
      setTimeout(() => this.pathCopied.set(false), 2000);
    });
  }
}
