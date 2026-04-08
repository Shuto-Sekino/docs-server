'use client'

import { marked } from 'marked'
import { useEffect, useState } from 'react'

interface MarkdownPreviewProps {
  content: string
}

export function MarkdownPreview({ content }: MarkdownPreviewProps) {
  const [html, setHtml] = useState('')

  useEffect(() => {
    const result = marked.parse(content)
    if (typeof result === 'string') {
      setHtml(result)
    } else {
      result.then(setHtml)
    }
  }, [content])

  return (
    <div
      // biome-ignore lint/security/noDangerouslySetInnerHtml: marked output from trusted local docs
      dangerouslySetInnerHTML={{ __html: html }}
      className="
        prose prose-invert max-w-none text-sm leading-relaxed
        [&_h1]:text-xl [&_h1]:font-bold [&_h1]:text-white [&_h1]:mt-6 [&_h1]:mb-3 [&_h1]:border-b [&_h1]:border-[#222] [&_h1]:pb-2
        [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-white [&_h2]:mt-5 [&_h2]:mb-2
        [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:text-[#ccc] [&_h3]:mt-4 [&_h3]:mb-1.5
        [&_p]:text-[#aaa] [&_p]:my-2
        [&_a]:text-[#3ecf8e] [&_a]:no-underline hover:[&_a]:underline
        [&_strong]:text-white [&_strong]:font-semibold
        [&_em]:text-[#aaa] [&_em]:italic
        [&_ul]:my-2 [&_ul]:pl-5 [&_ul]:list-disc [&_ul]:text-[#aaa]
        [&_ol]:my-2 [&_ol]:pl-5 [&_ol]:list-decimal [&_ol]:text-[#aaa]
        [&_li]:my-0.5
        [&_blockquote]:border-l-2 [&_blockquote]:border-[#3ecf8e] [&_blockquote]:pl-3 [&_blockquote]:my-3 [&_blockquote]:text-[#666]
        [&_hr]:border-[#222] [&_hr]:my-4
        [&_table]:w-full [&_table]:text-sm [&_table]:my-3
        [&_th]:text-left [&_th]:text-[#888] [&_th]:font-medium [&_th]:border-b [&_th]:border-[#333] [&_th]:pb-1.5 [&_th]:pr-4
        [&_td]:text-[#aaa] [&_td]:border-b [&_td]:border-[#1a1a1a] [&_td]:py-1.5 [&_td]:pr-4
        [&_code]:text-[#3ecf8e] [&_code]:bg-[#111] [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs [&_code]:font-mono
        [&_pre]:bg-[#0d0d0d] [&_pre]:border [&_pre]:border-[#222] [&_pre]:rounded-md [&_pre]:p-3 [&_pre]:my-3 [&_pre]:overflow-x-auto
        [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:text-[#ccc] [&_pre_code]:text-xs
      "
    />
  )
}
