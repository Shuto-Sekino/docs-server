'use client'

import { ChevronDown, ChevronRight, File, Folder, FolderOpen, Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { fetchFileTree, type FileNode } from '@/lib/editor-api'

interface FileTreeProps {
  selectedPath: string | null
  onSelect: (path: string) => void
}

interface TreeNodeProps {
  node: FileNode
  depth: number
  selectedPath: string | null
  onSelect: (path: string) => void
}

function TreeNode({ node, depth, selectedPath, onSelect }: TreeNodeProps) {
  const [open, setOpen] = useState(depth === 0)
  const indent = depth * 12

  if (node.type === 'directory') {
    return (
      <div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-1.5 w-full text-left px-2 py-0.5 rounded hover:bg-[#1a1a1a] text-[#888] hover:text-[#ccc] transition-colors text-xs"
          style={{ paddingLeft: `${8 + indent}px` }}
        >
          <span className="text-[#555] shrink-0">
            {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </span>
          <span className="text-[#3ecf8e] shrink-0">
            {open ? <FolderOpen size={13} /> : <Folder size={13} />}
          </span>
          <span className="truncate">{node.name}</span>
        </button>
        {open && (
          <div>
            {node.children.map((child) => (
              <TreeNode
                key={child.path}
                node={child}
                depth={depth + 1}
                selectedPath={selectedPath}
                onSelect={onSelect}
              />
            ))}
          </div>
        )}
      </div>
    )
  }

  const isSelected = node.path === selectedPath

  return (
    <button
      type="button"
      onClick={() => onSelect(node.path)}
      className={`flex items-center gap-1.5 w-full text-left px-2 py-0.5 rounded text-xs transition-colors ${
        isSelected
          ? 'bg-[#1a2e22] text-[#3ecf8e]'
          : 'text-[#888] hover:bg-[#1a1a1a] hover:text-[#ccc]'
      }`}
      style={{ paddingLeft: `${8 + indent}px` }}
    >
      <span className={`shrink-0 ${isSelected ? 'text-[#3ecf8e]' : 'text-[#555]'}`}>
        <File size={13} />
      </span>
      <span className="truncate">{node.name}</span>
    </button>
  )
}

export function FileTree({ selectedPath, onSelect }: FileTreeProps) {
  const [root, setRoot] = useState<FileNode | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchFileTree()
      .then(setRoot)
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : 'Failed to load files'),
      )
  }, [])

  if (error) {
    return (
      <div className="p-3 text-xs text-red-400 font-mono">
        <p className="text-[#555] mb-1">Error</p>
        <p>{error}</p>
      </div>
    )
  }

  if (!root) {
    return (
      <div className="p-3 flex items-center gap-2 text-[#555] text-xs font-mono">
        <Loader2 size={12} className="animate-spin" />
        Loading…
      </div>
    )
  }

  if (root.type !== 'directory') return null

  return (
    <nav className="py-2 select-none">
      {root.children.map((child) => (
        <TreeNode
          key={child.path}
          node={child}
          depth={0}
          selectedPath={selectedPath}
          onSelect={onSelect}
        />
      ))}
    </nav>
  )
}
