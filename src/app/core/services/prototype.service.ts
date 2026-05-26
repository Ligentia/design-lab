import { Injectable, signal, computed, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { GithubService } from './github.service';
import { Prototype } from '../models/prototype.model';

@Injectable({ providedIn: 'root' })
export class PrototypeService {
  private github = inject(GithubService);

  private _prototypes = signal<Prototype[]>([]);
  private _sha = signal<string>('');
  private _loading = signal(false);
  private _error = signal<string | null>(null);
  private _search = signal('');
  private _activeTags = signal<Set<string>>(new Set());

  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly search = this._search.asReadonly();
  readonly activeTags = this._activeTags.asReadonly();
  readonly sha = this._sha.asReadonly();
  readonly all = this._prototypes.asReadonly();

  findById(id: string): Prototype | undefined {
    return this._prototypes().find((p) => p.id === id);
  }

  readonly allTags = computed(() => {
    const tags = new Set<string>();
    this._prototypes().forEach((p) => p.tags.forEach((t) => tags.add(t)));
    return Array.from(tags).sort();
  });

  readonly filtered = computed(() => {
    const q = this._search().toLowerCase().trim();
    const active = this._activeTags();
    return this._prototypes()
      .filter((p) => {
        if (p.archived) return false;
        const matchesSearch =
          !q || p.title.toLowerCase().includes(q) || p.description.toLowerCase().includes(q);
        const matchesTags =
          active.size === 0 || p.tags.some((t) => active.has(t));
        return matchesSearch && matchesTags;
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  });

  readonly archivedPrototypes = computed(() =>
    this._prototypes().filter(p => p.archived)
  );

  load() {
    this._loading.set(true);
    this._error.set(null);
    this.github.getPrototypes().subscribe({
      next: ({ prototypes, sha }) => {
        this._prototypes.set(prototypes);
        this._sha.set(sha);
        this._loading.set(false);
      },
      error: (err) => {
        this._error.set('Could not load prototypes. Check your network or repo config.');
        this._loading.set(false);
        console.error(err);
      },
    });
  }

  setSearch(q: string) {
    this._search.set(q);
  }

  toggleTag(tag: string) {
    const current = new Set(this._activeTags());
    current.has(tag) ? current.delete(tag) : current.add(tag);
    this._activeTags.set(current);
  }

  clearFilters() {
    this._search.set('');
    this._activeTags.set(new Set());
  }

  async uploadFiles(prototype: Prototype, pat: string, files: { name: string; content: string }[]) {
    for (const file of files) {
      await firstValueFrom(
        this.github.uploadFile(`${prototype.folder}/${file.name}`, file.content, pat)
      );
    }
  }

  async addPrototype(prototype: Prototype, pat: string, files?: { name: string; content: string }[]) {
    if (files?.length) {
      for (const file of files) {
        await firstValueFrom(
          this.github.uploadFile(`${prototype.folder}/${file.name}`, file.content, pat)
        );
      }
    }
    const updated = [prototype, ...this._prototypes()];
    const res: any = await firstValueFrom(this.github.savePrototypes(updated, this._sha(), pat));
    this._prototypes.set(updated);
    if (res?.content?.sha) this._sha.set(res.content.sha);
  }

  updatePrototype(updated: Prototype, pat: string) {
    const list = this._prototypes().map((p) => (p.id === updated.id ? updated : p));
    return new Promise<void>((resolve, reject) => {
      this.github.savePrototypes(list, this._sha(), pat).subscribe({
        next: (res: any) => {
          this._prototypes.set(list);
          if (res?.content?.sha) this._sha.set(res.content.sha);
          resolve();
        },
        error: reject,
      });
    });
  }

  archivePrototype(prototype: Prototype, pat: string) {
    return this.updatePrototype({ ...prototype, archived: true }, pat);
  }

  restorePrototype(prototype: Prototype, pat: string) {
    return this.updatePrototype({ ...prototype, archived: false }, pat);
  }

  async downloadAsZip(prototype: Prototype) {
    const JSZip = (await import('jszip')).default;
    const files = await firstValueFrom(this.github.getFolderFiles(prototype.folder));
    const zip = new JSZip();
    files.forEach(f => zip.file(f.name, f.content));
    zip.file('CLAUDE.md', this.generateClaudeMd(prototype));
    const blob = await zip.generateAsync({ type: 'blob' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${prototype.id}.zip`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  private generateClaudeMd(p: Prototype): string {
    return [
      `# ${p.title}`,
      '',
      p.description || '(No description)',
      '',
      '## Original metadata (review all fields before re-uploading)',
      `- Title: ${p.title}`,
      `- Description: ${p.description || '(none)'}`,
      `- Creator: ${p.creator}`,
      `- Date: ${p.date}`,
      `- Tags: ${p.tags.join(', ') || '(none)'}`,
      `- Folder: ${p.folder}`,
      `- Design Lab ID: ${p.id}`,
      '',
      '## Re-uploading to Design Lab',
      '1. Edit the prototype files as needed.',
      '2. Go to https://design-lab-rouge.vercel.app and click "Add prototype".',
      '3. Upload the edited HTML file.',
      '4. Review and update every field — they reflect the original version and may no longer be accurate:',
      `   - **Title**: was "${p.title}" — update if the exploration has changed significantly`,
      `   - **Description**: was "${p.description || '(none)'}" — update to reflect what changed`,
      `   - **Creator**: was ${p.creator} — change to whoever is uploading this version`,
      `   - **Tags**: were [${p.tags.join(', ') || 'none'}] — add or remove tags to match the current state`,
      `   - **Folder**: was \`${p.folder}\` — if the title, description, creator, or tags have changed, always use a NEW folder path (this is a new prototype). Only keep the same path for minor bug fixes where nothing else has changed.`,
    ].join('\n');
  }
}
