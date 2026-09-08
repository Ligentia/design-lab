import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'dl-search-bar',
  standalone: true,
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="search-wrap">
      <svg class="icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="11" cy="11" r="8"/>
        <path d="M21 21l-4.35-4.35"/>
      </svg>
      <input
        class="search-input"
        type="search"
        [placeholder]="placeholder"
        [(ngModel)]="value"
        (ngModelChange)="onInput($event)"
      />
    </div>
  `,
  styles: [`
    .search-wrap {
      position: relative;
      display: flex;
      align-items: center;
    }
    .icon {
      position: absolute;
      left: 12px;
      color: var(--color-text-tertiary);
      pointer-events: none;
    }
    .search-input {
      width: 100%;
      height: 38px;
      padding: 0 var(--space-4) 0 38px;
      font-size: var(--text-sm);
      font-family: var(--font-sans);
      color: var(--color-text-primary);
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      outline: none;
      transition: border-color var(--transition-fast);
    }
    .search-input:focus { border-color: var(--color-accent); }
    .search-input::placeholder { color: var(--color-text-tertiary); }
    .search-input::-webkit-search-cancel-button { cursor: pointer; }
  `]
})
export class SearchBarComponent {
  @Input() placeholder = 'Search prototypes…';
  @Output() searched = new EventEmitter<string>();
  value = '';
  private debounce: ReturnType<typeof setTimeout> | null = null;

  onInput(val: string) {
    if (this.debounce) clearTimeout(this.debounce);
    this.debounce = setTimeout(() => this.searched.emit(val), 250);
  }
}
