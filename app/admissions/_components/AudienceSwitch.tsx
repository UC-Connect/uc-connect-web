"use client";

import { useEffect, useState } from "react";
import type { ApplicantType } from "@/lib/admissions/presentation";
import { useLang } from "./LangProvider";

const AUDIENCE_KEY = "uc-connect-admissions-audience";

export function readAudienceParam(): ApplicantType | null {
  const value = new URLSearchParams(window.location.search).get("for");
  return value === "freshman" || value === "transfer" ? value : null;
}

// Remembers whether the viewer is a high school or transfer applicant across admissions pages.
export function useApplicantType(initial: ApplicantType = "freshman") {
  const [audience, setAudienceState] = useState<ApplicantType>(initial);

  useEffect(() => {
    let stored: string | null = null;

    try {
      stored = window.localStorage.getItem(AUDIENCE_KEY);
    } catch {
      // Fall back to the default audience.
    }

    const fromUrl = readAudienceParam();
    const next = fromUrl ?? (stored === "freshman" || stored === "transfer" ? stored : null);

    if (next) setAudienceState(next);
  }, []);

  function setAudience(next: ApplicantType) {
    setAudienceState(next);

    try {
      window.localStorage.setItem(AUDIENCE_KEY, next);
    } catch {
      // Preference simply won't persist.
    }
  }

  return [audience, setAudience] as const;
}

type AudienceSwitchProps = {
  value: ApplicantType;
  onChange: (value: ApplicantType) => void;
};

export function AudienceSwitch({ value, onChange }: AudienceSwitchProps) {
  const { L } = useLang();
  const options: { value: ApplicantType; label: string; hint: string }[] = [
    { value: "freshman", label: L("高中生申请", "First-year"), hint: L("在读高中或刚毕业", "In high school or just graduated") },
    { value: "transfer", label: L("转学申请", "Transfer"), hint: L("从社区学院等转入", "From a community college or other college") },
  ];

  return (
    <div className="adm-switch" role="radiogroup" aria-label={L("申请类型", "Applicant type")}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          className={value === option.value ? "active" : ""}
          onClick={() => onChange(option.value)}
        >
          <strong>{option.label}</strong>
          <span>{option.hint}</span>
        </button>
      ))}
    </div>
  );
}
