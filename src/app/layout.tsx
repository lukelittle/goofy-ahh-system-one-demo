import type { Metadata } from "next";
import { Bungee, Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const bungee = Bungee({ variable: "--font-bungee", weight: "400", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Goofy Ahh System One Demo",
  description: "Teaching serious AI concepts with extremely unserious classification problems. A bounded-decision demo on Circuit-VL.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} ${bungee.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
