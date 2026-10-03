import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Bookmark Graph",
  description: "Private bookmark knowledge graph for @alangnative.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="dark h-full antialiased">
      <body className="bg-background text-foreground flex min-h-full flex-col font-sans">
        {children}
      </body>
    </html>
  );
}
