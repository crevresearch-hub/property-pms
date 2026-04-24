import type { Metadata } from "next"
import { Inter } from "next/font/google"
import { Providers } from "@/components/providers"
import "./globals.css"

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
})

export const metadata: Metadata = {
  title: "Alwaan System | Alwaan",
  description: "Alwaan — Property Management Platform",
}

// Runs before React hydration so the theme is applied on first paint (no flash).
const themeInitScript = `
(function(){try{var t=localStorage.getItem('theme');
if(t!=='light'&&t!=='dark'){t=window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark';}
document.documentElement.setAttribute('data-theme',t);
document.documentElement.style.colorScheme=t;}catch(e){}})();
`

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-full bg-[#0a0a0a] font-sans text-white">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
