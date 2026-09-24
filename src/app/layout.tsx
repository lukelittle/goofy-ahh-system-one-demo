import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Goofy Ahh System One Demo",
  description: "Teaching serious AI concepts with extremely unserious classification problems. A bounded-decision demo on Circuit-VL.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
