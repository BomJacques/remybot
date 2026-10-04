import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Remybot — Your virtual pet",
  description: "Choose a mystery egg, care for your LCD companion, and grow together through daily rituals. A new metamorphosis every five days.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}

