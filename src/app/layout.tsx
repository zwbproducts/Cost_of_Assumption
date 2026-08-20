import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bridge Validation: Cost of an Unchecked Assumption",
  description:
    "A safe, testnet-only dashboard demonstrating a valid-but-unsafe agent decision under an unresolved authority assumption.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased bg-slate-950 text-slate-100">{children}</body>
    </html>
  );
}
