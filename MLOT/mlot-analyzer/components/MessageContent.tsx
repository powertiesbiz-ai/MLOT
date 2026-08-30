import React from 'react';

/**
 * Lightweight inline markdown for chat bubbles: **bold** / __bold__,
 * *italic*, and `code`. Dependency-free - the bot's messages (and our own
 * error strings) occasionally contain markdown, and a plain text node would
 * render the raw asterisks.
 *
 * Deliberately does NOT treat single underscores as italic: identifiers such
 * as GEMINI_API_KEY appear in these messages and must render verbatim.
 * `*italic*` requires a non-space next to each marker so arithmetic / globs
 * ("2 * 3", "*.env") are left alone.
 */
const INLINE = /(\*\*([^*]+?)\*\*|__([^_]+?)__|(?<![\w*])\*(?!\s)([^*\n]+?)(?<!\s)\*(?!\w)|`([^`]+?)`)/g;

const renderInline = (text: string, keyPrefix: string): React.ReactNode[] => {
  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  INLINE.lastIndex = 0;
  while ((match = INLINE.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }

    const bold = match[2] ?? match[3];
    const italic = match[4];
    const code = match[5];

    if (bold !== undefined) {
      nodes.push(<strong key={`${keyPrefix}-${key++}`}>{bold}</strong>);
    } else if (italic !== undefined) {
      nodes.push(<em key={`${keyPrefix}-${key++}`}>{italic}</em>);
    } else if (code !== undefined) {
      nodes.push(
        <code
          key={`${keyPrefix}-${key++}`}
          className="px-1 py-0.5 rounded bg-slate-900/60 text-emerald-300 text-[0.9em]"
        >
          {code}
        </code>
      );
    }

    lastIndex = INLINE.lastIndex;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
};

export const MessageContent: React.FC<{ content: string }> = ({ content }) => {
  const lines = content.replace('[[ANALYSIS_COMPLETE]]', '').split('\n');
  return (
    <>
      {lines.map((line, i) => (
        <p key={i} className="min-h-[1rem]">
          {line ? renderInline(line, `l${i}`) : ' '}
        </p>
      ))}
    </>
  );
};
