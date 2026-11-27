import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { PrototypeService, DuplicatePrototypeError } from './prototype.service';
import { GithubService } from './github.service';
import { Prototype } from '../models/prototype.model';

const proto = (id: string, extra: Partial<Prototype> = {}): Prototype =>
  ({
    id,
    title: id,
    tags: [],
    creator: 'Chukwuka',
    date: '2026-11-27',
    description: '',
    folder: `prototypes/${id}`,
    ...extra,
  }) as Prototype;

describe('PrototypeService uniqueness', () => {
  let svc: PrototypeService;
  let github: { [k: string]: any };

  beforeEach(() => {
    github = {
      getPrototypes: () =>
        of({
          prototypes: [proto('design-notes', { title: 'Design Notes' }), proto('old-one', { archived: true })],
          sha: 'sha1',
        }),
      savePrototypes: vi.fn(() => of({ content: { sha: 'sha2' } })),
      commitFiles: vi.fn(async () => new Map([['prototypes.json', 'sha2']])),
    };
    TestBed.configureTestingModule({ providers: [{ provide: GithubService, useValue: github }] });
    svc = TestBed.inject(PrototypeService);
    svc.load();
  });

  const files = [{ name: 'index.html', content: btoa('<p>hi</p>') }];

  it('refuses to add a prototype whose id already exists, before uploading anything', async () => {
    await expect(svc.addPrototype(proto('design-notes'), 'pat', files)).rejects.toThrow(
      /A prototype called "Design Notes" already exists/
    );
    expect(github['commitFiles']).not.toHaveBeenCalled();
    expect(github['savePrototypes']).not.toHaveBeenCalled();
    expect(svc.all().length).toBe(2);
  });

  it('counts archived prototypes as taken', async () => {
    await expect(svc.addPrototype(proto('old-one'), 'pat')).rejects.toThrow(/\(archived\)/);
  });

  it("refuses to add into another prototype's folder", async () => {
    const p = proto('fresh', { folder: 'prototypes/design-notes' });
    await expect(svc.addPrototype(p, 'pat', files)).rejects.toBeInstanceOf(DuplicatePrototypeError);
    expect(github['commitFiles']).not.toHaveBeenCalled();
  });

  it("refuses an edit that moves into another prototype's folder", () => {
    const moved = proto('old-one', { archived: true, folder: 'prototypes/design-notes' });
    expect(() => svc.updatePrototype(moved, 'pat')).toThrow(DuplicatePrototypeError);
    expect(github['savePrototypes']).not.toHaveBeenCalled();
  });

  it('still allows a new, unique prototype and normal edits', async () => {
    await svc.addPrototype(proto('brand-new'), 'pat', files);
    expect(github['commitFiles']).toHaveBeenCalledTimes(1);
    await svc.updatePrototype({ ...svc.findById('design-notes')!, description: 'edited' }, 'pat');
    expect(github['savePrototypes']).toHaveBeenCalledTimes(1);
  });
});
