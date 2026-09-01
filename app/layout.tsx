import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata: Metadata = {
  title: {
    default: 'BlackChat — Instagram Automation',
    template: '%s | BlackChat',
  },
  description: 'Personal Instagram comment-to-DM automation powered by Meta\'s official API.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="antialiased bg-[#0a0a0f] text-white min-h-screen">
        {children}
      </body>
    </html>
  )
}
