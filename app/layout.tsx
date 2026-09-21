import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import Header from "@/components/Header";
import PerspectiveSwitch from "@/components/PerspectiveSwitch";
import { I18nProvider } from "@/lib/i18n";
import { DEFAULT_LANG, langFromCookieValue } from "@/lib/i18n-core";
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

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const lang = langFromCookieValue((await cookies()).get("vkrpg.lang")?.value) ?? DEFAULT_LANG;

  return (
    <html
      lang={lang === "pt" ? "pt-BR" : "en"}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-zinc-900 text-zinc-100">
        <I18nProvider initialLang={lang}>
          <Header />
          <main className="flex-1">{children}</main>
          <PerspectiveSwitch />
        </I18nProvider>
      </body>
    </html>
  );
}