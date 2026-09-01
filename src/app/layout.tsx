import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "The Cartographer's Cabinet",
  description: "A spatial worldbuilding workshop built around WebMCP.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
