import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { basename, dirname, resolve } from 'node:path'

import { serveStatic } from '@hono/node-server/serve-static'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { CommandCache } from './command-cache.js'
import type { RateLimiter } from './ratelimit.js'
import { createBash } from './shell/bash.js'

export interface ApiServerOptions {
  enableExec?: boolean
  execTimeout?: number
  commandCache?: CommandCache | null
  rateLimiter?: RateLimiter
  allowedOrigin?: string
  docsDir?: string
  webDir?: string
  enableEditor?: boolean
  editorApiKey?: string
}

type FileTreeNode =
  | { type: 'file'; name: string; path: string }
  | { type: 'directory'; name: string; path: string; children: FileTreeNode[] }

async function buildFileTree(dirPath: string, relBase: string): Promise<FileTreeNode[]> {
  const entries = await readdir(dirPath, { withFileTypes: true })
  const nodes: FileTreeNode[] = []
  for (const entry of [...entries].sort((a, b) => a.name.localeCompare(b.name))) {
    const relPath = relBase ? `${relBase}/${entry.name}` : entry.name
    if (entry.isDirectory()) {
      const children = await buildFileTree(`${dirPath}/${entry.name}`, relPath)
      nodes.push({ type: 'directory', name: entry.name, path: relPath, children })
    } else {
      nodes.push({ type: 'file', name: entry.name, path: relPath })
    }
  }
  return nodes
}

/** Creates a public-facing HTTP API server with CORS and /api/exec endpoint. */
export function createApiServer(opts: ApiServerOptions = {}) {
  const {
    enableExec = false,
    execTimeout = 10_000,
    commandCache = null,
    rateLimiter,
    allowedOrigin = '*',
    docsDir,
    webDir,
    enableEditor = false,
    editorApiKey,
  } = opts

  const version = process.env.VERSION ?? 'dev'

  const app = new Hono()

  app.use('*', async (c, next) => {
    await next()
    c.header('X-Version', version)
  })

  app.get('/healthz', (c) => c.json({ status: 'ok', version }))

  if (enableExec) {
    app.use(
      '/api/*',
      cors({
        origin: allowedOrigin,
        allowMethods: ['POST', 'OPTIONS'],
        allowHeaders: ['Content-Type'],
      }),
    )

    app.post('/api/exec', async (c) => {
      // Rate limit by IP
      if (rateLimiter) {
        const ip =
          c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ??
          c.req.header('x-real-ip') ??
          'unknown'
        try {
          const { success, reset } = await rateLimiter.limit(ip)
          if (!success) {
            const retryIn = Math.max(1, Math.ceil((reset - Date.now()) / 1000))
            return c.json({ error: `Too many requests. Retry in ${retryIn}s.` }, 429)
          }
        } catch {
          // Fail open - don't block requests when rate limiter is down
        }
      }

      // Parse and validate body
      let body: unknown
      try {
        body = await c.req.json()
      } catch {
        return c.json({ error: 'Invalid JSON body.' }, 400)
      }

      if (!body || typeof body !== 'object' || !('command' in body)) {
        return c.json({ error: 'Missing required field: command.' }, 400)
      }

      const { command } = body as { command: unknown }

      if (typeof command !== 'string') {
        return c.json({ error: 'command must be a string.' }, 400)
      }
      if (command.length === 0) {
        return c.json({ error: 'command must not be empty.' }, 400)
      }
      if (command.length > 1000) {
        return c.json({ error: 'command must be 1000 characters or fewer.' }, 400)
      }

      const cwd = '/docs'

      // Check cache
      const cached = commandCache?.get(cwd, command)
      if (cached) {
        return c.json({
          stdout: cached.stdout ?? '',
          stderr: cached.stderr ?? '',
          exitCode: cached.exitCode,
        })
      }

      // Execute command
      try {
        const { bash } = await createBash(docsDir)
        const result = await bash.exec(command, { cwd, signal: AbortSignal.timeout(execTimeout) })
        commandCache?.set(cwd, command, result)
        return c.json({
          stdout: result.stdout ?? '',
          stderr: result.stderr ?? '',
          exitCode: result.exitCode,
        })
      } catch (err) {
        const timedOut = err instanceof Error && err.name === 'TimeoutError'
        if (timedOut) {
          return c.json({ error: 'Command timed out.' }, 504)
        }
        return c.json({ error: err instanceof Error ? err.message : String(err) }, 500)
      }
    })
  }

  if (enableEditor && docsDir) {
    const resolvedDocsDir = resolve(docsDir)

    // Resolve and validate that the path stays within docsDir.
    // Strips leading slashes to prevent absolute-path injection.
    function safeResolvePath(inputPath: string): string | null {
      const normalized = inputPath.replace(/^\/+/, '')
      if (!normalized) return null
      const resolved = resolve(resolvedDocsDir, normalized)
      if (!resolved.startsWith(`${resolvedDocsDir}/`) && resolved !== resolvedDocsDir) return null
      return resolved
    }

    app.use(
      '/api/editor/*',
      cors({
        origin: allowedOrigin,
        allowMethods: ['GET', 'PUT', 'POST', 'DELETE', 'OPTIONS'],
        allowHeaders: ['Content-Type', 'Authorization'],
      }),
    )

    // API-key auth middleware (skipped when no key is configured)
    app.use('/api/editor/*', async (c, next) => {
      if (editorApiKey) {
        const auth = c.req.header('Authorization')
        if (auth !== `Bearer ${editorApiKey}`) {
          return c.json({ error: 'Unauthorized.' }, 401)
        }
      }
      await next()
    })

    // GET /api/editor/files – file tree
    app.get('/api/editor/files', async (c) => {
      try {
        const children = await buildFileTree(resolvedDocsDir, '')
        return c.json({
          type: 'directory',
          name: basename(resolvedDocsDir),
          path: '',
          children,
        } satisfies FileTreeNode)
      } catch (err) {
        return c.json({ error: err instanceof Error ? err.message : String(err) }, 500)
      }
    })

    // GET /api/editor/content?path=<relative-path> – file content
    app.get('/api/editor/content', async (c) => {
      const inputPath = c.req.query('path')
      if (!inputPath) return c.json({ error: 'Missing required query param: path.' }, 400)

      const filePath = safeResolvePath(inputPath)
      if (!filePath) return c.json({ error: 'Invalid path.' }, 400)

      try {
        const content = await readFile(filePath, 'utf-8')
        return c.json({ content })
      } catch (err: unknown) {
        const code = (err as NodeJS.ErrnoException).code
        if (code === 'ENOENT') return c.json({ error: 'File not found.' }, 404)
        if (code === 'EISDIR') return c.json({ error: 'Path is a directory.' }, 400)
        return c.json({ error: err instanceof Error ? err.message : String(err) }, 500)
      }
    })

    // PUT /api/editor/content – save file { path, content }
    app.put('/api/editor/content', async (c) => {
      let body: unknown
      try {
        body = await c.req.json()
      } catch {
        return c.json({ error: 'Invalid JSON body.' }, 400)
      }

      if (!body || typeof body !== 'object') return c.json({ error: 'Invalid body.' }, 400)
      const { path: inputPath, content } = body as { path: unknown; content: unknown }

      if (typeof inputPath !== 'string' || !inputPath)
        return c.json({ error: 'path must be a non-empty string.' }, 400)
      if (typeof content !== 'string')
        return c.json({ error: 'content must be a string.' }, 400)

      const filePath = safeResolvePath(inputPath)
      if (!filePath) return c.json({ error: 'Invalid path.' }, 400)

      try {
        await mkdir(dirname(filePath), { recursive: true })
        await writeFile(filePath, content, 'utf-8')
        commandCache?.clear()
        return c.json({ ok: true })
      } catch (err) {
        return c.json({ error: err instanceof Error ? err.message : String(err) }, 500)
      }
    })

    // POST /api/editor/files – create file or directory { path, type? }
    app.post('/api/editor/files', async (c) => {
      let body: unknown
      try {
        body = await c.req.json()
      } catch {
        return c.json({ error: 'Invalid JSON body.' }, 400)
      }

      if (!body || typeof body !== 'object') return c.json({ error: 'Invalid body.' }, 400)
      const { path: inputPath, type = 'file' } = body as { path: unknown; type?: unknown }

      if (typeof inputPath !== 'string' || !inputPath)
        return c.json({ error: 'path must be a non-empty string.' }, 400)
      if (type !== 'file' && type !== 'directory')
        return c.json({ error: 'type must be "file" or "directory".' }, 400)

      const targetPath = safeResolvePath(inputPath)
      if (!targetPath) return c.json({ error: 'Invalid path.' }, 400)

      try {
        if (type === 'directory') {
          await mkdir(targetPath, { recursive: true })
        } else {
          await mkdir(dirname(targetPath), { recursive: true })
          await writeFile(targetPath, '', { flag: 'wx' }) // fail if exists
        }
        commandCache?.clear()
        return c.json({ ok: true }, 201)
      } catch (err: unknown) {
        if ((err as NodeJS.ErrnoException).code === 'EEXIST')
          return c.json({ error: 'Path already exists.' }, 409)
        return c.json({ error: err instanceof Error ? err.message : String(err) }, 500)
      }
    })

    // DELETE /api/editor/files?path=<relative-path> – delete file or directory
    app.delete('/api/editor/files', async (c) => {
      const inputPath = c.req.query('path')
      if (!inputPath) return c.json({ error: 'Missing required query param: path.' }, 400)

      const targetPath = safeResolvePath(inputPath)
      if (!targetPath) return c.json({ error: 'Invalid path.' }, 400)
      if (targetPath === resolvedDocsDir)
        return c.json({ error: 'Cannot delete the docs root directory.' }, 400)

      try {
        await rm(targetPath, { recursive: true, force: false })
        commandCache?.clear()
        return c.json({ ok: true })
      } catch (err: unknown) {
        if ((err as NodeJS.ErrnoException).code === 'ENOENT')
          return c.json({ error: 'Path not found.' }, 404)
        return c.json({ error: err instanceof Error ? err.message : String(err) }, 500)
      }
    })
  }

  if (webDir) {
    app.use('/_next/static/*', (c, next) => {
      c.header('Cache-Control', 'public, max-age=31536000, immutable')
      return next()
    })

    app.use('/_next/static/*', serveStatic({ root: webDir }))

    app.use('/*', (c, next) => {
      c.header('Cache-Control', 'public, max-age=0, must-revalidate')
      return next()
    })

    app.use('/*', serveStatic({ root: webDir }))

    app.notFound((c) => {
      return c.html('Not found', 404)
    })
  }

  return app
}
