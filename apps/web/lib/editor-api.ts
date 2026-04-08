export type FileNode =
  | { type: 'file'; name: string; path: string }
  | { type: 'directory'; name: string; path: string; children: FileNode[] }

const BASE_URL =
  (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_EDITOR_API_URL) || ''

const API_KEY =
  typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_EDITOR_API_KEY : undefined

function headers(): HeadersInit {
  return API_KEY ? { Authorization: `Bearer ${API_KEY}` } : {}
}

export async function fetchFileTree(): Promise<FileNode> {
  const res = await fetch(`${BASE_URL}/api/editor/files`, { headers: headers() })
  if (!res.ok) throw new Error(`Failed to fetch file tree: HTTP ${res.status}`)
  return res.json() as Promise<FileNode>
}

export async function fetchFileContent(path: string): Promise<string> {
  const res = await fetch(
    `${BASE_URL}/api/editor/content?path=${encodeURIComponent(path)}`,
    { headers: headers() },
  )
  if (!res.ok) throw new Error(`Failed to fetch file: HTTP ${res.status}`)
  const body = (await res.json()) as { content: string }
  return body.content
}
