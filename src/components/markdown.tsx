import type { ReactNode } from "react";

/**
 * Small markdown subset for ProjectDoc bodies: headings, paragraphs, lists,
 * fenced code, hr, plus inline code / emphasis / links. Renders React nodes
 * (no `dangerouslySetInnerHTML`) so guest-visible docs cannot inject HTML.
 */

type Block =
  | { type: "heading"; level: 1 | 2 | 3; text: string }
  | { type: "paragraph"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] }
  | { type: "code"; text: string }
  | { type: "hr" };

function parseBlocks(source: string): Block[] {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let i = 0;

  const flushParagraph = (buf: string[]) => {
    const text = buf.join("\n").trim();
    if (text) blocks.push({ type: "paragraph", text });
    buf.length = 0;
  };

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim() === "") {
      i += 1;
      continue;
    }

    if (/^---+$/.test(line.trim())) {
      blocks.push({ type: "hr" });
      i += 1;
      continue;
    }

    const fence = line.match(/^```/);
    if (fence) {
      const body: string[] = [];
      i += 1;
      while (i < lines.length && !lines[i].startsWith("```")) {
        body.push(lines[i]);
        i += 1;
      }
      if (i < lines.length) i += 1;
      blocks.push({ type: "code", text: body.join("\n") });
      continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      blocks.push({
        type: "heading",
        level: heading[1].length as 1 | 2 | 3,
        text: heading[2].trim(),
      });
      i += 1;
      continue;
    }

    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*]\s+/, ""));
        i += 1;
      }
      blocks.push({ type: "ul", items });
      continue;
    }

    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, ""));
        i += 1;
      }
      blocks.push({ type: "ol", items });
      continue;
    }

    const buf: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !lines[i].startsWith("#") &&
      !lines[i].startsWith("```") &&
      !/^\s*[-*]\s+/.test(lines[i]) &&
      !/^\s*\d+\.\s+/.test(lines[i]) &&
      !/^---+$/.test(lines[i].trim())
    ) {
      buf.push(lines[i]);
      i += 1;
    }
    flushParagraph(buf);
  }

  return blocks;
}

const INLINE = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;

function safeHref(href: string): string | null {
  const trimmed = href.trim();
  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) return trimmed;
  try {
    const url = new URL(trimmed);
    if (url.protocol === "http:" || url.protocol === "https:") return url.toString();
  } catch {
    return null;
  }
  return null;
}

function renderInline(text: string): ReactNode[] {
  const parts = text.split(INLINE);
  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
      return <em key={index}>{part.slice(1, -1)}</em>;
    }
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
      return (
        <code key={index} className="bg-muted rounded px-1 py-0.5 font-mono text-[0.85em]">
          {part.slice(1, -1)}
        </code>
      );
    }
    const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (link) {
      const href = safeHref(link[2]);
      if (!href) return <span key={index}>{link[1]}</span>;
      const external = href.startsWith("http");
      return (
        <a
          key={index}
          href={href}
          className="underline underline-offset-4"
          {...(external ? { target: "_blank", rel: "noreferrer noopener" } : {})}
        >
          {link[1]}
        </a>
      );
    }
    return <span key={index}>{part}</span>;
  });
}

const headingClass: Record<1 | 2 | 3, string> = {
  1: "font-heading text-2xl font-semibold tracking-tight",
  2: "font-heading mt-8 text-lg font-semibold tracking-tight first:mt-0",
  3: "font-heading mt-6 text-base font-semibold tracking-tight",
};

export function Markdown({ source }: { source: string }) {
  const blocks = parseBlocks(source);

  return (
    <div className="text-sm leading-relaxed">
      {blocks.map((block, index) => {
        if (block.type === "heading") {
          const Tag = (`h${block.level}` as "h1" | "h2" | "h3");
          return (
            <Tag key={index} className={headingClass[block.level]}>
              {renderInline(block.text)}
            </Tag>
          );
        }
        if (block.type === "paragraph") {
          return (
            <p key={index} className="text-foreground/90 mt-3 first:mt-0">
              {renderInline(block.text)}
            </p>
          );
        }
        if (block.type === "ul") {
          return (
            <ul key={index} className="mt-3 list-disc space-y-1.5 pl-5">
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>{renderInline(item)}</li>
              ))}
            </ul>
          );
        }
        if (block.type === "ol") {
          return (
            <ol key={index} className="mt-3 list-decimal space-y-1.5 pl-5">
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>{renderInline(item)}</li>
              ))}
            </ol>
          );
        }
        if (block.type === "code") {
          return (
            <pre
              key={index}
              className="bg-muted/60 mt-3 overflow-x-auto rounded-md p-3 font-mono text-xs leading-relaxed"
            >
              {block.text}
            </pre>
          );
        }
        return <hr key={index} className="border-border my-6" />;
      })}
    </div>
  );
}
