import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://cabinet.varera.studio"),
  title: "The Cartographer's Cabinet",
  description: "A spatial worldbuilding workshop built around WebMCP.",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "The Cartographer's Cabinet",
    title: "The Cartographer's Cabinet",
    description: "A spatial worldbuilding workshop for people and WebMCP agents.",
  },
  twitter: {
    card: "summary",
    title: "The Cartographer's Cabinet",
    description: "A spatial worldbuilding workshop for people and WebMCP agents.",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
