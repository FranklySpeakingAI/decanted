import type { Metadata, Viewport } from "next"
import { Geist } from "next/font/google"
import { Cormorant_Garamond, Inter } from "next/font/google"
import "./globals.css"
import { APP } from "@/lib/constants"

const geist = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
})

const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["400", "600"],
  style: ["normal", "italic"],
  display: "swap",
})

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
})

export const metadata: Metadata = {
  title: APP.pageTitle,
  description: APP.description,
  robots: { index: false, follow: false },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#2C0A0E",
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="de" className={`${geist.variable} ${cormorant.variable} ${inter.variable}`}>
      {/* Prevent theme flash: read localStorage before first paint */}
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('decanted-theme');if(t==='red-wine')document.documentElement.setAttribute('data-theme','red-wine')}catch(e){}`,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  )
}
