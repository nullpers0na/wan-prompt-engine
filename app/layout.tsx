import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "P4G Fusion Calculator",
  description: "Persona 4 Golden fusion calculator — forward fusion, reverse fusion, and persona compendium",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full bg-[#0f1117] text-slate-200 antialiased">{children}</body>
    </html>
  );
}
