'use client'

import Link from 'next/link'
import { useState } from 'react'
import { FileTree } from '@/components/docs/file-tree'
import { FileViewer } from '@/components/docs/file-viewer'

export default function DocsPage() {
  const [selectedPath, setSelectedPath] = useState<string | null>(null)

  return (
    <div className="h-screen flex flex-col bg-[#0a0a0a] font-mono">
      {/* Navbar */}
      <header className="flex items-center gap-4 px-4 py-2 border-b border-[#1a1a1a] shrink-0">
        <span className="text-[#3ecf8e] font-bold text-sm">docs.sh</span>
        <nav className="flex items-center gap-3 text-xs">
          <Link href="/" className="text-[#555] hover:text-[#888] transition-colors">
            Home
          </Link>
          <Link href="/docs" className="text-[#3ecf8e]">
            Docs
          </Link>
        </nav>
      </header>

      {/* Main layout */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-56 shrink-0 border-r border-[#1a1a1a] overflow-y-auto">
          <FileTree selectedPath={selectedPath} onSelect={setSelectedPath} />
        </aside>

        {/* Viewer */}
        <main className="flex-1 flex min-w-0">
          <FileViewer path={selectedPath} />
        </main>
      </div>
    </div>
  )
}
