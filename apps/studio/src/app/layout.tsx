import "./globals.css";
import type { Metadata } from "next";
import { Fira_Code, Plus_Jakarta_Sans } from "next/font/google";

const fontSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const fontMono = Fira_Code({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Codalyn - AI Web App Builder",
  description: "Build web apps from natural language specifications",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${fontSans.variable} ${fontMono.variable}`}
      suppressHydrationWarning
    >
      <body className="relative min-h-screen bg-background font-sans text-foreground antialiased">
        <div className="relative flex min-h-screen flex-col">{children}</div>
      </body>
    </html>
  );
}
