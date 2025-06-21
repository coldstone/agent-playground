import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Agent Playground',
  description: 'A comprehensive playground for testing AI agents and models',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <meta name="google" content="notranslate"></meta>
      <body className={inter.className}>{children}</body>
    </html>
  )
}
