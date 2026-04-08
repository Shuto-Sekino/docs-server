import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createApiServer } from './api.js'
import { CommandCache } from './command-cache.js'
import type { RateLimiter } from './ratelimit.js'

const docsDir = mkdtempSync(join(tmpdir(), 'api-test-docs-'))

let app: ReturnType<typeof createApiServer>

beforeAll(() => {
  app = createApiServer({
    enableExec: true,
    execTimeout: 5000,
    docsDir,
    allowedOrigin: 'https://example.com',
  })
})

afterAll(() => {})

// ---------------------------------------------------------------------------
// POST /api/exec
// ---------------------------------------------------------------------------
describe('POST /api/exec', () => {
  it('valid command returns stdout and exitCode 0', async () => {
    const res = await app.request('/api/exec', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command: 'echo hello' }),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.stdout).toContain('hello')
    expect(body.exitCode).toBe(0)
  })

  it('failed command returns stderr and non-zero exitCode', async () => {
    const res = await app.request('/api/exec', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command: 'exit 42' }),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.exitCode).toBe(42)
  })

  it('empty command returns 400', async () => {
    const res = await app.request('/api/exec', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command: '' }),
    })
    expect(res.status).toBe(400)
  })

  it('missing command field returns 400', async () => {
    const res = await app.request('/api/exec', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(400)
  })

  it('command over 1000 chars returns 400', async () => {
    const res = await app.request('/api/exec', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command: 'a'.repeat(1001) }),
    })
    expect(res.status).toBe(400)
  })

  it('non-string command returns 400', async () => {
    const res = await app.request('/api/exec', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command: 123 }),
    })
    expect(res.status).toBe(400)
  })
})

// ---------------------------------------------------------------------------
// CORS
// ---------------------------------------------------------------------------
describe('CORS', () => {
  it('CORS headers present on POST response', async () => {
    const res = await app.request('/api/exec', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'https://example.com',
      },
      body: JSON.stringify({ command: 'echo cors' }),
    })
    expect(res.status).toBe(200)
    expect(res.headers.get('access-control-allow-origin')).toBeTruthy()
  })

  it('OPTIONS preflight returns 204', async () => {
    const res = await app.request('/api/exec', {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://example.com',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type',
      },
    })
    expect(res.status).toBe(204)
  })
})

// ---------------------------------------------------------------------------
// Command cache
// ---------------------------------------------------------------------------
describe('command cache', () => {
  it('uses cache when provided', async () => {
    const cache = new CommandCache()
    const cwd = '/docs'
    cache.set(cwd, 'echo cached', { stdout: 'from-cache\n', stderr: '', exitCode: 0, env: {} })

    const cachedApp = createApiServer({
      enableExec: true,
      execTimeout: 5000,
      docsDir,
      commandCache: cache,
    })

    const res = await cachedApp.request('/api/exec', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command: 'echo cached' }),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.stdout).toBe('from-cache\n')
  })
})

// ---------------------------------------------------------------------------
// Rate limiting
// ---------------------------------------------------------------------------
describe('rate limiting', () => {
  it('returns 429 when rate limited', async () => {
    const rateLimiter: RateLimiter = {
      limit: async () => ({ success: false, reset: Date.now() + 30_000 }),
    }
    const rlApp = createApiServer({
      enableExec: true,
      execTimeout: 5000,
      docsDir,
      rateLimiter,
    })

    const res = await rlApp.request('/api/exec', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-forwarded-for': '1.2.3.4',
      },
      body: JSON.stringify({ command: 'echo hi' }),
    })
    expect(res.status).toBe(429)
  })

  it('proceeds when rate limit passes', async () => {
    const rateLimiter: RateLimiter = {
      limit: async () => ({ success: true, reset: 0 }),
    }
    const rlApp = createApiServer({
      enableExec: true,
      execTimeout: 5000,
      docsDir,
      rateLimiter,
    })

    const res = await rlApp.request('/api/exec', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-forwarded-for': '1.2.3.4',
      },
      body: JSON.stringify({ command: 'echo hi' }),
    })
    expect(res.status).toBe(200)
  })

  it('fails open when rate limiter throws', async () => {
    const rateLimiter: RateLimiter = {
      limit: async () => {
        throw new Error('Redis down')
      },
    }
    const rlApp = createApiServer({
      enableExec: true,
      execTimeout: 5000,
      docsDir,
      rateLimiter,
    })

    const res = await rlApp.request('/api/exec', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-forwarded-for': '1.2.3.4',
      },
      body: JSON.stringify({ command: 'echo hi' }),
    })
    expect(res.status).toBe(200)
  })
})

// ---------------------------------------------------------------------------
// Static file serving
// ---------------------------------------------------------------------------
describe('static file serving', () => {
  const webDir = mkdtempSync(join(tmpdir(), 'api-test-web-'))

  beforeAll(() => {
    writeFileSync(join(webDir, 'index.html'), '<html>home</html>')
    mkdirSync(join(webDir, '_next', 'static'), { recursive: true })
    writeFileSync(join(webDir, '_next', 'static', 'chunk-abc123.js'), 'console.log("hi")')
    writeFileSync(join(webDir, '404.html'), '<html>not found</html>')
  })

  it('serves index.html at root', async () => {
    const staticApp = createApiServer({ execTimeout: 5000, docsDir, webDir })
    const res = await staticApp.request('/')
    expect(res.status).toBe(200)
    expect(await res.text()).toContain('home')
  })

  it('serves hashed assets with immutable cache headers', async () => {
    const staticApp = createApiServer({ execTimeout: 5000, docsDir, webDir })
    const res = await staticApp.request('/_next/static/chunk-abc123.js')
    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toBe('public, max-age=31536000, immutable')
  })

  it('serves HTML with must-revalidate cache headers', async () => {
    const staticApp = createApiServer({ execTimeout: 5000, docsDir, webDir })
    const res = await staticApp.request('/')
    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toBe('public, max-age=0, must-revalidate')
  })

  it('existing API routes still work with static serving enabled', async () => {
    const staticApp = createApiServer({ enableExec: true, execTimeout: 5000, docsDir, webDir })
    const res = await staticApp.request('/api/exec', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command: 'echo hello' }),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.stdout).toContain('hello')
  })

  it('healthz still works with static serving enabled', async () => {
    const staticApp = createApiServer({ execTimeout: 5000, docsDir, webDir })
    const res = await staticApp.request('/healthz')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('ok')
  })

  it('does not serve static files when webDir is not set', async () => {
    const res = await app.request('/')
    expect(res.status).toBe(404)
  })
})

// ---------------------------------------------------------------------------
// Editor API
// ---------------------------------------------------------------------------
describe('editor API', () => {
  const editorDocsDir = mkdtempSync(join(tmpdir(), 'api-test-editor-docs-'))

  beforeAll(() => {
    mkdirSync(join(editorDocsDir, 'guides'), { recursive: true })
    writeFileSync(join(editorDocsDir, 'README.md'), '# Hello\n')
    writeFileSync(join(editorDocsDir, 'guides', 'start.md'), '# Start\n')
  })

  function makeApp(apiKey?: string) {
    return createApiServer({ docsDir: editorDocsDir, enableEditor: true, editorApiKey: apiKey })
  }

  const authHeaders = (key?: string) =>
    key ? { Authorization: `Bearer ${key}` } : {}

  // --- file tree ---
  it('GET /api/editor/files returns directory tree', async () => {
    const editorApp = makeApp()
    const res = await editorApp.request('/api/editor/files')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.type).toBe('directory')
    expect(body.children).toBeInstanceOf(Array)
    const names = body.children.map((n: { name: string }) => n.name)
    expect(names).toContain('README.md')
    expect(names).toContain('guides')
  })

  it('GET /api/editor/files nests subdirectory children', async () => {
    const editorApp = makeApp()
    const res = await editorApp.request('/api/editor/files')
    const body = await res.json()
    const guidesDir = body.children.find((n: { name: string }) => n.name === 'guides')
    expect(guidesDir?.type).toBe('directory')
    expect(guidesDir?.children[0]?.name).toBe('start.md')
  })

  // --- content read ---
  it('GET /api/editor/content returns file content', async () => {
    const editorApp = makeApp()
    const res = await editorApp.request('/api/editor/content?path=README.md')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.content).toBe('# Hello\n')
  })

  it('GET /api/editor/content returns 404 for missing file', async () => {
    const editorApp = makeApp()
    const res = await editorApp.request('/api/editor/content?path=missing.md')
    expect(res.status).toBe(404)
  })

  it('GET /api/editor/content returns 400 without path param', async () => {
    const editorApp = makeApp()
    const res = await editorApp.request('/api/editor/content')
    expect(res.status).toBe(400)
  })

  // --- content write ---
  it('PUT /api/editor/content saves file content', async () => {
    const editorApp = makeApp()
    const res = await editorApp.request('/api/editor/content', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: 'README.md', content: '# Updated\n' }),
    })
    expect(res.status).toBe(200)
    const saved = readFileSync(join(editorDocsDir, 'README.md'), 'utf-8')
    expect(saved).toBe('# Updated\n')
  })

  it('PUT /api/editor/content creates missing parent directories', async () => {
    const editorApp = makeApp()
    const res = await editorApp.request('/api/editor/content', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: 'deep/nested/new.md', content: 'hi\n' }),
    })
    expect(res.status).toBe(200)
    const saved = readFileSync(join(editorDocsDir, 'deep', 'nested', 'new.md'), 'utf-8')
    expect(saved).toBe('hi\n')
  })

  it('PUT /api/editor/content returns 400 when path is missing', async () => {
    const editorApp = makeApp()
    const res = await editorApp.request('/api/editor/content', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'hi' }),
    })
    expect(res.status).toBe(400)
  })

  // --- create file/directory ---
  it('POST /api/editor/files creates a new file', async () => {
    const editorApp = makeApp()
    const res = await editorApp.request('/api/editor/files', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: 'brand-new.md' }),
    })
    expect(res.status).toBe(201)
    const saved = readFileSync(join(editorDocsDir, 'brand-new.md'), 'utf-8')
    expect(saved).toBe('')
  })

  it('POST /api/editor/files creates a new directory', async () => {
    const editorApp = makeApp()
    const res = await editorApp.request('/api/editor/files', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: 'newdir', type: 'directory' }),
    })
    expect(res.status).toBe(201)
  })

  it('POST /api/editor/files returns 409 when file already exists', async () => {
    const editorApp = makeApp()
    const res = await editorApp.request('/api/editor/files', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: 'README.md' }),
    })
    expect(res.status).toBe(409)
  })

  // --- delete ---
  it('DELETE /api/editor/files deletes a file', async () => {
    const editorApp = makeApp()
    // create a temporary file to delete
    writeFileSync(join(editorDocsDir, 'to-delete.md'), '')
    const res = await editorApp.request('/api/editor/files?path=to-delete.md', {
      method: 'DELETE',
    })
    expect(res.status).toBe(200)
  })

  it('DELETE /api/editor/files returns 404 for missing path', async () => {
    const editorApp = makeApp()
    const res = await editorApp.request('/api/editor/files?path=ghost.md', {
      method: 'DELETE',
    })
    expect(res.status).toBe(404)
  })

  it('DELETE /api/editor/files returns 400 when trying to delete root', async () => {
    const editorApp = makeApp()
    const res = await editorApp.request('/api/editor/files?path=.', {
      method: 'DELETE',
    })
    expect(res.status).toBe(400)
  })

  // --- path traversal ---
  it('rejects path traversal in content read', async () => {
    const editorApp = makeApp()
    const res = await editorApp.request('/api/editor/content?path=../etc/passwd')
    expect(res.status).toBe(400)
  })

  it('rejects path traversal in content write', async () => {
    const editorApp = makeApp()
    const res = await editorApp.request('/api/editor/content', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: '../escape.txt', content: 'pwned' }),
    })
    expect(res.status).toBe(400)
  })

  it('rejects absolute path injection', async () => {
    const editorApp = makeApp()
    const res = await editorApp.request('/api/editor/content?path=/etc/passwd')
    // /etc/passwd is treated as relative (leading slash stripped), resolves to
    // <docsDir>/etc/passwd which doesn't exist → 404 not 200
    expect([400, 404]).toContain(res.status)
  })

  // --- auth ---
  it('returns 401 when API key is required and missing', async () => {
    const editorApp = makeApp('secret-key')
    const res = await editorApp.request('/api/editor/files')
    expect(res.status).toBe(401)
  })

  it('returns 401 when API key is wrong', async () => {
    const editorApp = makeApp('secret-key')
    const res = await editorApp.request('/api/editor/files', {
      headers: authHeaders('wrong-key'),
    })
    expect(res.status).toBe(401)
  })

  it('succeeds with correct API key', async () => {
    const editorApp = makeApp('secret-key')
    const res = await editorApp.request('/api/editor/files', {
      headers: authHeaders('secret-key'),
    })
    expect(res.status).toBe(200)
  })

  // --- editor disabled by default ---
  it('editor routes return 404 when enableEditor is false', async () => {
    const noEditorApp = createApiServer({ docsDir: editorDocsDir })
    const res = await noEditorApp.request('/api/editor/files')
    expect(res.status).toBe(404)
  })

  // --- cache invalidation ---
  it('PUT clears the command cache', async () => {
    const cache = new CommandCache()
    cache.set('/docs', 'cat README.md', { stdout: 'stale\n', stderr: '', exitCode: 0, env: {} })
    const editorApp = createApiServer({ docsDir: editorDocsDir, enableEditor: true, commandCache: cache })

    await editorApp.request('/api/editor/content', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: 'README.md', content: '# Fresh\n' }),
    })

    expect(cache.stats.entries).toBe(0)
  })
})
