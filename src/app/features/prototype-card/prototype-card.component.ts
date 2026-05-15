import {
  Component, Input, Output, EventEmitter, ChangeDetectionStrategy, inject,
  signal, ElementRef, ViewChild, AfterViewInit, OnDestroy, ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Prototype } from '../../core/models/prototype.model';
import { PrototypeService } from '../../core/services/prototype.service';

@Component({
  selector: 'dl-prototype-card',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article class="card" (click)="openDetail()">
      <div class="thumbnail" #thumbnail>
        <ng-container *ngIf="!showPlaceholder()">
          <div class="iframe-scale" [style.transform]="'scale(' + scale() + ')'">
            <iframe
              #previewFrame
              [src]="safeUrl"
              sandbox="allow-scripts allow-same-origin"
              scrolling="no"
              tabindex="-1"
              title="Preview"
              (load)="onIframeLoad(previewFrame)"
              (error)="showPlaceholder.set(true)"
            ></iframe>
          </div>
        </ng-container>
        <div *ngIf="showPlaceholder()" class="placeholder-icon">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <rect x="3" y="3" width="18" height="18" rx="2"/>
            <circle cx="8.5" cy="8.5" r="1.5"/>
            <path d="M21 15l-5-5L5 21"/>
          </svg>
        </div>
      </div>

      <div class="body">
        <div class="meta">
          <span class="creator">{{ prototype.creator }}</span>
          <span class="date">{{ prototype.date | date:'MMM d, y' }}</span>
        </div>
        <h3 class="title">{{ prototype.title }}</h3>
        <p *ngIf="prototype.description" class="description">{{ prototype.description }}</p>
        <div class="tags">
          <span *ngFor="let tag of prototype.tags" class="tag">{{ tag }}</span>
        </div>
      </div>

      <div class="actions" (click)="$event.stopPropagation()">
        <ng-container *ngIf="!isArchived">
          <button class="action-btn" title="Copy link" (click)="copyLink()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/>
              <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/>
            </svg>
            {{ copied ? 'Copied!' : 'Copy link' }}
          </button>
          <button class="action-btn" *ngIf="!showPlaceholder()" title="Download ZIP" (click)="download()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            Download
          </button>
          <button class="action-btn" title="Archive" (click)="archive.emit(prototype)">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="21 8 21 21 3 21 3 8"/>
              <rect x="1" y="3" width="22" height="5"/>
              <line x1="10" y1="12" x2="14" y2="12"/>
            </svg>
            Archive
          </button>
          <button class="action-btn" title="Edit" (click)="edit.emit(prototype)">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
            Edit
          </button>
        </ng-container>
        <ng-container *ngIf="isArchived">
          <button class="action-btn action-btn--restore" title="Restore" (click)="restore.emit(prototype)">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="1 4 1 10 7 10"/>
              <path d="M3.51 15a9 9 0 102.13-9.36L1 10"/>
            </svg>
            Restore
          </button>
          <button class="action-btn" title="Edit" (click)="edit.emit(prototype)">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
            Edit
          </button>
        </ng-container>
      </div>
    </article>
  `,
  styles: [`
    .card {
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      box-shadow: var(--shadow-card);
      cursor: pointer;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      transition: box-shadow var(--transition-base), transform var(--transition-base);
    }
    .card:hover { box-shadow: var(--shadow-card-hover); transform: translateY(-2px); }
    .thumbnail {
      position: relative;
      aspect-ratio: 16/9;
      background: var(--color-surface-subtle);
      overflow: hidden;
    }
    .iframe-scale {
      position: absolute;
      top: 0;
      left: 0;
      width: 1280px;
      height: 720px;
      transform-origin: top left;
      pointer-events: none;
    }
    iframe {
      width: 1280px;
      height: 720px;
      border: none;
      display: block;
    }
    .placeholder-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100%;
      color: var(--color-border-strong);
    }
    .body {
      padding: var(--space-4);
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
    }
    .meta {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      font-size: var(--text-xs);
      color: var(--color-text-tertiary);
    }
    .meta .creator { font-weight: var(--weight-medium); color: var(--color-text-secondary); }
    .meta .date::before { content: '·'; margin-right: var(--space-2); }
    .title {
      font-size: var(--text-base);
      font-weight: var(--weight-semibold);
      color: var(--color-text-primary);
      margin: 0;
      line-height: 1.3;
    }
    .description {
      font-size: var(--text-sm);
      color: var(--color-text-secondary);
      margin: 0;
      line-height: 1.5;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .tags {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-1);
      margin-top: auto;
      padding-top: var(--space-2);
    }
    .tag {
      font-size: var(--text-xs);
      font-weight: var(--weight-medium);
      color: var(--color-tag-text);
      background: var(--color-tag-bg);
      border-radius: var(--radius-full);
      padding: 2px 8px;
    }
    .actions {
      display: flex;
      gap: var(--space-1);
      padding: var(--space-2) var(--space-4);
      border-top: 1px solid var(--color-border);
      background: var(--color-surface-subtle);
    }
    .action-btn {
      display: flex;
      align-items: center;
      gap: var(--space-1);
      font-size: var(--text-xs);
      font-weight: var(--weight-medium);
      color: var(--color-text-secondary);
      background: none;
      border: none;
      border-radius: var(--radius-sm);
      padding: 4px 8px;
      cursor: pointer;
      transition: background var(--transition-fast), color var(--transition-fast);
      font-family: var(--font-sans);
    }
    .action-btn:hover { background: var(--color-surface-hover); color: var(--color-text-primary); }
    .action-btn--restore { color: var(--color-accent); }
    .action-btn--restore:hover { background: var(--color-accent-subtle, rgba(99,102,241,.08)); color: var(--color-accent); }
  `]
})
export class PrototypeCardComponent implements AfterViewInit, OnDestroy {
  @Input({ required: true }) prototype!: Prototype;
  @Input() isArchived = false;
  @Output() edit = new EventEmitter<Prototype>();
  @Output() archive = new EventEmitter<Prototype>();
  @Output() restore = new EventEmitter<Prototype>();
  @ViewChild('thumbnail') thumbnailEl!: ElementRef<HTMLDivElement>;

  private router = inject(Router);
  private sanitizer = inject(DomSanitizer);
  private cdr = inject(ChangeDetectorRef);
  private svc = inject(PrototypeService);

  copied = false;
  showPlaceholder = signal(false);
  scale = signal(0.25);

  private _safeUrl: SafeResourceUrl | null = null;
  private ro?: ResizeObserver;

  get safeUrl(): SafeResourceUrl {
    if (!this._safeUrl) {
      const url = `${window.location.origin}/${this.prototype.folder}/index.html`;
      this._safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(url);
    }
    return this._safeUrl;
  }

  ngAfterViewInit() {
    this.ro = new ResizeObserver(entries => {
      const w = entries[0].contentRect.width;
      this.scale.set(w / 1280);
      this.cdr.markForCheck();
    });
    this.ro.observe(this.thumbnailEl.nativeElement);
  }

  ngOnDestroy() {
    this.ro?.disconnect();
  }

  onIframeLoad(iframe: HTMLIFrameElement) {
    try {
      const isShell = !!iframe.contentDocument?.querySelector('meta[name="dl-shell"]');
      if (isShell) this.showPlaceholder.set(true);
    } catch {}
  }

  openDetail() {
    this.router.navigate(['/prototype', this.prototype.id]);
  }

  download() { this.svc.downloadAsZip(this.prototype); }

  copyLink() {
    const url = `${window.location.origin}/prototype/${this.prototype.id}`;
    navigator.clipboard.writeText(url).then(() => {
      this.copied = true;
      setTimeout(() => (this.copied = false), 2000);
    });
  }
}
