import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    rules: {
      // Pages read browser-only state (localStorage, URL) in effects after hydration on purpose,
      // so server and client render the same markup. Kept as a warning until those are refactored.
      "react-hooks/set-state-in-effect": "warn",
    },
  },
  {
    // Only lib/llm/providers may talk to model vendors; everything else goes through lib/llm.
    files: ["**/*.{ts,tsx,js,mjs}"],
    ignores: ["lib/llm/providers/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: ["openai", "@google/genai", "@google/generative-ai", "@anthropic-ai/sdk"].map((name) => ({
            name,
            message: "Call models through lib/llm (getChatProvider) instead of importing a vendor SDK.",
          })),
        },
      ],
      "no-restricted-syntax": [
        "error",
        ...["Literal", "TemplateElement"].map((node) => ({
          selector: `${node}[value=/generativelanguage\\.googleapis\\.com|api\\.deepseek\\.com|api\\.openai\\.com/]`,
          message: "Vendor API URLs belong in lib/llm/providers.",
        })),
      ],
    },
  },
  {
    ignores: [".next/**", "node_modules/**", "next-env.d.ts"],
  },
];

export default eslintConfig;
