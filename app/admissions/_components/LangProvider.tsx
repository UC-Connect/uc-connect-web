"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Bilingual, Lang } from "@/lib/admissions/presentation";

// Shares the main app's language preference key so the choice carries across pages.
const LANGUAGE_KEY = "uc-connect-language";

type LangContextValue = {
  lang: Lang;
  setLang: (lang: Lang) => void;
  L: (zh: string, en: string) => string;
  pick: (value: Bilingual) => string;
};

const LangContext = createContext<LangContextValue | null>(null);

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("zh");

  useEffect(() => {
    try {
      if (window.localStorage.getItem(LANGUAGE_KEY) === "en") setLangState("en");
    } catch {
      // Storage can be unavailable (private mode); Chinese stays the default.
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
  }, [lang]);

  function setLang(next: Lang) {
    setLangState(next);

    try {
      window.localStorage.setItem(LANGUAGE_KEY, next);
    } catch {
      // Preference simply won't persist.
    }
  }

  const value: LangContextValue = {
    lang,
    setLang,
    L: (zh, en) => (lang === "zh" ? zh : en),
    pick: (item) => item[lang],
  };

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useLang() {
  const context = useContext(LangContext);

  if (!context) {
    throw new Error("useLang must be used inside LangProvider");
  }

  return context;
}
