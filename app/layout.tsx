import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Header from "@/components/Header";
import PerspectiveSwitch from "@/components/PerspectiveSwitch";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "VKRPG — ShieldFrog",
  description: "A platform for playing games and telling stories.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-zinc-900 text-zinc-100">
        <Header />
        <main className="flex-1">{children}</main>
        <PerspectiveSwitch />
      </body>
    </html>
  );
}
