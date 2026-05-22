import type { Metadata } from "next"
import { Analytics } from "@vercel/analytics/next"
import "maplibre-gl/dist/maplibre-gl.css"
import "./globals.css"

export const metadata: Metadata = {
  title: "BRUX — Brussels Intel",
  description: "Live news, traffic, events and transit across Brussels' 19 communes",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  )
}
