'use client'

import { FileText, Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { fetchFileContent } from '@/lib/editor-api'
import { MarkdownPreview } from './markdown-preview'

type ViewMode = 'preview' | 'raw'

interface FileViewerProps {
  path: string | null
}

export function FileViewer({ path }: FileViewerProps) {
  const [content, setContent] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<ViewMode>('preview')

  const isMarkdown = path?.endsWith('.md') ?? false

  useEffect(() => {
    if (!path) return
    setLoading(true)
    setError(null)
    setContent(null)
    // Reset to preview when switching files
    setMode('preview')
    fetchFileContent(path)
      .then(setContent)
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : 'Failed to load file'),
      )
      .finally(() => setLoading(false))
  }, [path])

  if (!path) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-[#333] gap-3">
        <FileText size={40} strokeWidth={1} />
        <p className="font-mono text-xs">Select a file to view</p>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 min-w-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[#1a1a1a] shrink-0">
        <span className="font-mono text-xs text-[#555] truncate">{path}</span>
        {isMarkdown && content !== null && (
          <div className="flex shrink-0 ml-3">
            <button
              type="button"
              onClick={() => setMode('raw')}
              className={`px-2.5 py-0.5 font-mono text-xs rounded-l border transition-colors ${
                mode === 'raw'
                  ? 'bg-[#1a2e22] text-[#3ecf8e] border-[#3ecf8e]'
                  : 'text-[#555] border-[#333] hover:text-[#888]'
              }`}
            >
              Raw
            </button>
            <button
              type="button"
              onClick={() => setMode('preview')}
              className={`px-2.5 py-0.5 font-mono text-xs rounded-r border-t border-b border-r transition-colors ${
                mode === 'preview'
                  ? 'bg-[#1a2e22] text-[#3ecf8e] border-[#3ecf8e]'
                  : 'text-[#555] border-[#333] hover:text-[#888]'
              }`}
            >
              Preview
            </button>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto min-h-0">
        {loading && (
          <div className="flex items-center gap-2 p-4 text-[#555] text-xs font-mono">
            <Loader2 size={12} className="animate-spin" />
            Loading…
          </div>
        )}
        {error && (
          <div className="p-4 text-red-400 text-xs font-mono">
            <p className="text-[#555] mb-1">Error</p>
            <p>{error}</p>
          </div>
        )}
        {content !== null && !loading && !error && (
          <>
            {isMarkdown && mode === 'preview' ? (
              <div className="p-6">
                <MarkdownPreview content={content} />
              </div>
            ) : (
              <pre className="p-4 font-mono text-xs text-[#aaa] whitespace-pre-wrap break-words leading-relaxed">
                {content}
              </pre>
            )}
          </>
        )}
      </div>
    </div>
  )
}
