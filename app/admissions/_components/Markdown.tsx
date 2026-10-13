"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const CITATION_PREFIX = "#cite-";

// Turns "[1]" and "[1, 2]" into links the renderer shows as citation chips.
function linkCitations(text: string): string {
  return text.replace(/\[(\d+(?:\s*,\s*\d+)*)\](?!\()/g, (_, numbers: string) =>
    numbers
      .split(",")
      .map((number) => `[${number.trim()}](${CITATION_PREFIX}${number.trim()})`)
      .join("")
  );
}

type MarkdownProps = {
  children: string;
  citations?: { anchorPrefix: string; available: number[] };
};

export function Markdown({ children, citations }: MarkdownProps) {
  const source = citations ? linkCitations(children) : children;

  return (
    <div className="adm-prose">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a({ href = "", children: label }) {
            if (citations && href.startsWith(CITATION_PREFIX)) {
              const number = Number(href.slice(CITATION_PREFIX.length));

              if (!citations.available.includes(number)) {
                return null;
              }

              return (
                <a className="adm-cite" href={`#${citations.anchorPrefix}-${number}`}>
                  {number}
                </a>
              );
            }

            const external = /^https?:\/\//.test(href);

            return (
              <a href={href} target={external ? "_blank" : undefined} rel={external ? "noopener noreferrer" : undefined}>
                {label}
              </a>
            );
          },
        }}
      >
        {source}
      </ReactMarkdown>
    </div>
  );
}
