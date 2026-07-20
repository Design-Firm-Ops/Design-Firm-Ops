'use client';

import { useRef, useEffect } from 'react';

// A minimal contentEditable rich text editor (bold / italic / bullet
// list) — enough for payment instructions (ACH routing/account, wire
// details, Chase Bill Pay) without pulling in a full editor library.
// Stores its content as sanitized-on-render HTML.

const ALLOWED_COMMANDS = ['bold', 'italic', 'insertUnorderedList', 'insertOrderedList'] as const;

export default function RichTextEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (html: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (ref.current && isFirstRender.current) {
      ref.current.innerHTML = value || '';
      isFirstRender.current = false;
    }
  }, [value]);

  function exec(command: (typeof ALLOWED_COMMANDS)[number]) {
    document.execCommand(command);
    ref.current?.focus();
    if (ref.current) onChange(ref.current.innerHTML);
  }

  return (
    <div>
      <div className="mb-2 flex gap-1 rounded-md border border-taupe/60 bg-taupe/5 p-1">
        <button type="button" className="rounded px-2 py-1 text-sm font-medium hover:bg-taupe/20" onClick={() => exec('bold')}>
          B
        </button>
        <button type="button" className="rounded px-2 py-1 text-sm italic hover:bg-taupe/20" onClick={() => exec('italic')}>
          I
        </button>
        <button
          type="button"
          className="rounded px-2 py-1 text-sm hover:bg-taupe/20"
          onClick={() => exec('insertUnorderedList')}
        >
          • List
        </button>
        <button
          type="button"
          className="rounded px-2 py-1 text-sm hover:bg-taupe/20"
          onClick={() => exec('insertOrderedList')}
        >
          1. List
        </button>
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        className="input min-h-[140px] [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5"
        onInput={(e) => onChange(e.currentTarget.innerHTML)}
      />
    </div>
  );
}
