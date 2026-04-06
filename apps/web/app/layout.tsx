import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'Docs SSH',
  description: 'Browse personal developer docs over SSH.',
  openGraph: {
    title: 'Docs SSH',
    description: 'Browse personal developer docs over SSH.',
    siteName: 'Docs SSH',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Docs SSH',
    description: 'Browse personal developer docs over SSH.',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-[#0a0a0a]">{children}</body>
    </html>
  )
}
