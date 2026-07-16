'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

interface SearchResult {
  type: string;
  label: string;
  sublabel?: string;
  href: string;
}

export default function NavSearch() {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const handle = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(query.trim())}`)
        .then((res) => (res.ok ? res.json() : { results: [] }))
        .then((data) => {
          if (!cancelled) {
            setResults(data.results ?? []);
            setActiveIndex(0);
            setLoading(false);
          }
        })
        .catch(() => {
          if (!cancelled) setLoading(false);
        });
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [query]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function go(result: SearchResult) {
    setOpen(false);
    setQuery('');
    setResults([]);
    router.push(result.href);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open || results.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      go(results[activeIndex]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  return (
    <div ref={containerRef} className="relative w-full max-w-xs">
      <input
        className="w-full rounded-md border border-cream/30 bg-cream/10 px-3 py-1.5 text-sm text-cream placeholder-cream/50 focus:border-gold focus:outline-none"
        placeholder="Search anything…"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
      />
      {open && query.trim() && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-96 overflow-y-auto rounded-md border border-taupe/40 bg-white text-brown shadow-lg">
          {loading && <p className="px-3 py-2 text-sm text-brown/50">Searching…</p>}
          {!loading && results.length === 0 && <p className="px-3 py-2 text-sm text-brown/50">No matches.</p>}
          {!loading &&
            results.map((r, i) => (
              <button
                key={`${r.type}-${r.href}-${r.label}-${i}`}
                className={`flex w-full flex-col items-start px-3 py-2 text-left text-sm ${
                  i === activeIndex ? 'bg-gold/20' : 'hover:bg-taupe/10'
                }`}
                onMouseEnter={() => setActiveIndex(i)}
                onClick={() => go(r)}
              >
                <span className="font-medium">{r.label}</span>
                {r.sublabel && <span className="text-xs text-brown/50">{r.sublabel}</span>}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
