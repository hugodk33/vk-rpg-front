"use client";

import Link from "next/link";
import LanguageSwitch from "./LanguageSwitch";

export default function Header() {
  return (
    <header className="bg-zinc-800/90 border-b border-zinc-700/50 sticky top-0 z-50 backdrop-blur-sm">
      <div className="max-w-5xl mx-auto px-4 relative">
        <div className="flex items-center justify-center h-14">
          <div className="w-14"></div>
          <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
            <LanguageSwitch />
          </div>
          <Link
            href="/"
            className="flex items-center gap-2 text-amber-400 font-bold text-xl tracking-tight"
          >
            <svg
              className="w-7 h-7"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              />
            </svg>
            ShieldFrog
          </Link>
        </div>
      </div>
    </header>
  );
}
