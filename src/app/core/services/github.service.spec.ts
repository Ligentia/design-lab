import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, TestRequest, provideHttpClientTesting } from '@angular/common/http/testing';
import { GithubService, GithubConflictError } from './github.service';

const REPO = 'https://api.github.com/repos/Ligentia/design-lab';

describe('GithubService.commitFiles', () => {
  let svc: GithubService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    svc = TestBed.inject(GithubService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  // The service awaits each response before sending the next request, so let
  // its continuation run before looking for the request.
  async function next(method: string, path: string): Promise<TestRequest> {
    await new Promise((r) => setTimeout(r));
    return http.expectOne((r) => r.method === method && r.url.startsWith(`${REPO}${path}`));
  }

  async function flushBlobs(n: number) {
    for (let i = 0; i < n; i++) {
      await new Promise((r) => setTimeout(r));
      const pending = http.match((r) => r.method === 'POST' && r.url === `${REPO}/git/blobs`);
      pending.forEach((req) => req.flush({ sha: `blob-${atob(req.request.body.content)}` }));
      i += pending.length - 1;
    }
  }

  const files = [
    { path: 'prototypes/demo/index.html', content: btoa('index') },
    { path: 'prototypes/demo/a.css', content: btoa('css') },
    { path: 'prototypes.json', content: btoa('json') },
  ];

  it('writes all files as one commit and reports progress per file', async () => {
    const progress: number[] = [];
    const result = svc.commitFiles(files, 'Add prototype', 'pat', {
      expect: { path: 'prototypes.json', sha: 'json-v1' },
      onProgress: (done) => progress.push(done),
    });

    await flushBlobs(3);
    (await next('GET', '/git/ref/heads/main')).flush({ object: { sha: 'head1' } });
    (await next('GET', '/contents/prototypes.json?ref=head1')).flush({ sha: 'json-v1' });
    (await next('GET', '/git/commits/head1')).flush({ tree: { sha: 'tree1' } });

    const tree = await next('POST', '/git/trees');
    expect(tree.request.body.base_tree).toBe('tree1');
    expect(tree.request.body.tree).toEqual([
      { path: 'prototypes/demo/index.html', mode: '100644', type: 'blob', sha: 'blob-index' },
      { path: 'prototypes/demo/a.css', mode: '100644', type: 'blob', sha: 'blob-css' },
      { path: 'prototypes.json', mode: '100644', type: 'blob', sha: 'blob-json' },
    ]);
    tree.flush({ sha: 'tree2' });

    const commit = await next('POST', '/git/commits');
    expect(commit.request.body).toEqual({ message: 'Add prototype', tree: 'tree2', parents: ['head1'] });
    commit.flush({ sha: 'commit2' });

    const ref = await next('PATCH', '/git/refs/heads/main');
    expect(ref.request.body).toEqual({ sha: 'commit2' });
    expect(ref.request.headers.get('Authorization')).toBe('token pat');
    ref.flush({});

    const blobs = await result;
    expect(blobs.get('prototypes.json')).toBe('blob-json');
    expect(progress).toEqual([1, 2, 3]);
    // No Contents API PUTs — those are what made a commit per file.
    http.expectNone((r) => r.method === 'PUT');
  });

  it('writes nothing if the guarded file changed on GitHub', async () => {
    const result = svc.commitFiles(files, 'Add prototype', 'pat', {
      expect: { path: 'prototypes.json', sha: 'json-v1' },
    });
    const failed = expect(result).rejects.toBeInstanceOf(GithubConflictError);

    await flushBlobs(3);
    (await next('GET', '/git/ref/heads/main')).flush({ object: { sha: 'head1' } });
    (await next('GET', '/contents/prototypes.json?ref=head1')).flush({ sha: 'json-v2' });

    await failed;
    http.expectNone((r) => r.url.includes('/git/trees') || r.url.includes('/git/commits'));
  });

  it('rebuilds on the new head when the branch moved, without re-uploading blobs', async () => {
    const result = svc.commitFiles(files, 'Add prototype', 'pat', {
      expect: { path: 'prototypes.json', sha: 'json-v1' },
    });

    await flushBlobs(3);
    (await next('GET', '/git/ref/heads/main')).flush({ object: { sha: 'head1' } });
    (await next('GET', '/contents/prototypes.json?ref=head1')).flush({ sha: 'json-v1' });
    (await next('GET', '/git/commits/head1')).flush({ tree: { sha: 'tree1' } });
    (await next('POST', '/git/trees')).flush({ sha: 'tree2' });
    (await next('POST', '/git/commits')).flush({ sha: 'commit2' });
    (await next('PATCH', '/git/refs/heads/main')).flush(
      { message: 'Update is not a fast forward' },
      { status: 422, statusText: 'Unprocessable Entity' }
    );

    // Someone else committed (head1b) without touching prototypes.json.
    (await next('GET', '/git/ref/heads/main')).flush({ object: { sha: 'head1b' } });
    (await next('GET', '/contents/prototypes.json?ref=head1b')).flush({ sha: 'json-v1' });
    (await next('GET', '/git/commits/head1b')).flush({ tree: { sha: 'tree1b' } });
    const tree = await next('POST', '/git/trees');
    expect(tree.request.body.base_tree).toBe('tree1b');
    tree.flush({ sha: 'tree3' });
    const commit = await next('POST', '/git/commits');
    expect(commit.request.body.parents).toEqual(['head1b']);
    commit.flush({ sha: 'commit3' });
    (await next('PATCH', '/git/refs/heads/main')).flush({});

    await result;
    http.expectNone((r) => r.url === `${REPO}/git/blobs`);
  });
});
