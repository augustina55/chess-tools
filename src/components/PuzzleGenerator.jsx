import { useState, useEffect, useRef, useCallback } from 'react';

function downloadFile(content, filename) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([content], { type: 'text/plain' }));
  a.download = filename;
  a.click();
}

// ── Theme multi-select ────────────────────────────────────────────────────────
function ThemeSelect({ themes, selected, onChange }) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const inputRef = useRef(null);
  const dropRef = useRef(null);

  const filtered = search
    ? themes.filter(t => t.toLowerCase().includes(search.toLowerCase()))
    : themes;

  const add = (t) => { if (!selected.includes(t)) onChange([...selected, t]); setSearch(''); };
  const remove = (t) => onChange(selected.filter(x => x !== t));

  useEffect(() => {
    const handler = (e) => {
      if (dropRef.current && !dropRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={dropRef} className="relative">
      <input
        ref={inputRef}
        value={search}
        onChange={e => setSearch(e.target.value)}
        onFocus={() => setOpen(true)}
        placeholder="Type to search — fork, pin, backRankMate…"
        className="w-full px-3.5 py-2.5 text-sm border border-stone-200 rounded-xl bg-amber-50/40 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 placeholder-stone-400 text-stone-800"
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-20 top-full left-0 right-0 mt-1.5 bg-white border border-amber-200 rounded-xl shadow-xl max-h-52 overflow-y-auto">
          {filtered.slice(0, 120).map(t => (
            <button
              key={t}
              onMouseDown={e => { e.preventDefault(); add(t); }}
              className="w-full text-left px-4 py-2 text-sm text-stone-700 hover:bg-amber-50 hover:text-stone-900 border-b border-stone-100 last:border-0 transition-colors"
            >
              {t}
            </button>
          ))}
        </div>
      )}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {selected.map(t => (
            <span
              key={t}
              className="inline-flex items-center gap-1.5 bg-amber-100 border border-amber-200 text-amber-800 text-xs font-medium px-2.5 py-1 rounded-full"
            >
              {t}
              <button onClick={() => remove(t)} className="opacity-60 hover:opacity-100 leading-none">✕</button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Opening single-select ────────────────────────────────────────────────────
function OpeningSelect({ openings, value, onChange }) {
  const [search, setSearch] = useState(value);
  const [open, setOpen] = useState(false);
  const dropRef = useRef(null);

  useEffect(() => { setSearch(value); }, [value]);

  const filtered = (search ? openings.filter(o => o.toLowerCase().includes(search.toLowerCase())) : openings).slice(0, 200);

  const select = (o) => { onChange(o); setSearch(o); setOpen(false); };
  const clear = () => { onChange(''); setSearch(''); };

  useEffect(() => {
    const handler = (e) => { if (dropRef.current && !dropRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={dropRef} className="relative">
      <div className="relative">
        <input
          value={search}
          onChange={e => { setSearch(e.target.value); if (!e.target.value) onChange(''); }}
          onFocus={() => setOpen(true)}
          placeholder="Search opening…"
          className="w-full px-3.5 py-2.5 pr-8 text-sm border border-stone-200 rounded-xl bg-amber-50/40 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 placeholder-stone-400 text-stone-800"
        />
        {value && (
          <button onClick={clear} className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 text-lg leading-none">×</button>
        )}
      </div>
      {open && filtered.length > 0 && (
        <div className="absolute z-20 top-full left-0 right-0 mt-1.5 bg-white border border-amber-200 rounded-xl shadow-xl max-h-52 overflow-y-auto">
          {filtered.map(o => (
            <button
              key={o}
              onMouseDown={e => { e.preventDefault(); select(o); }}
              className="w-full text-left px-4 py-2 text-sm text-stone-700 hover:bg-amber-50 hover:text-stone-900 border-b border-stone-100 last:border-0 transition-colors"
            >
              {o}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Field label wrapper (defined OUTSIDE to avoid remount-on-rerender focus loss) ──
function Field({ label, children }) {
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider">{label}</p>
      {children}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function PuzzleGenerator() {
  const [themes, setThemes] = useState([]);
  const [openings, setOpenings] = useState([]);
  const [filtersLoading, setFiltersLoading] = useState(true);
  const [filtersError, setFiltersError] = useState(null);

  const [selectedThemes, setSelectedThemes] = useState([]);
  const [selectedOpening, setSelectedOpening] = useState('');
  const [minRating, setMinRating] = useState('800');
  const [maxRating, setMaxRating] = useState('2000');
  const [count, setCount] = useState(20);

  const [pgn, setPgn] = useState('');
  const [puzzleCount, setPuzzleCount] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState('');

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 2500); };

  useEffect(() => {
    fetch('/api/puzzle/filters')
      .then(r => r.json())
      .then(d => {
        if (d.error) throw new Error(d.error);
        setThemes(d.themes || []);
        setOpenings(d.openings || []);
      })
      .catch(e => setFiltersError(e.message))
      .finally(() => setFiltersLoading(false));
  }, []);

  const generate = useCallback(async () => {
    setGenerating(true);
    try {
      const params = new URLSearchParams({
        themes: JSON.stringify(selectedThemes),
        openings: selectedOpening,
        minRating: String(minRating),
        maxRating: String(maxRating),
        count: String(count),
      });
      const res = await fetch('/api/puzzle/pgn?' + params);
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const text = await res.text();
      const n = (text.match(/\[Event /g) || []).length;
      setPgn(text);
      setPuzzleCount(n);
      if (n === 0) showToast('No puzzles matched your filters');
    } catch (e) {
      showToast('Error generating PGN: ' + e.message);
    } finally {
      setGenerating(false);
    }
  }, [selectedThemes, selectedOpening, minRating, maxRating, count]);

  const copyPgn = async () => {
    if (!pgn) return;
    await navigator.clipboard.writeText(pgn);
    setCopied(true);
    showToast('Copied to clipboard ✓');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="h-full overflow-y-auto" style={{ background: '#F5EFE6' }}>
      {/* Tool header */}
      <div className="sticky top-0 z-10 border-b border-stone-200 px-4 py-2.5 flex items-center gap-3" style={{ background: '#1C1917' }}>
        <span className="text-lg text-amber-400 leading-none">♞</span>
        <div>
          <h2 className="text-sm font-bold text-amber-400 leading-tight">Puzzle Generator</h2>
          <p className="text-[10px] text-stone-500 leading-tight">Filter &amp; export from 1M+ Lichess puzzles</p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
        {/* Filters card */}
        <div className="bg-white border border-stone-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-stone-100 bg-stone-50/60">
            <p className="text-xs font-semibold text-stone-500 uppercase tracking-widest">Filters</p>
          </div>

          <div className="p-6 space-y-5">
            {filtersLoading ? (
              <div className="flex items-center justify-center py-8 gap-4 text-stone-400">
                <div className="grid grid-cols-2 gap-1 w-9 h-9">
                  <div className="bg-amber-400 rounded animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="bg-stone-700 rounded animate-bounce" style={{ animationDelay: '180ms' }} />
                  <div className="bg-stone-700 rounded animate-bounce" style={{ animationDelay: '360ms' }} />
                  <div className="bg-amber-400 rounded animate-bounce" style={{ animationDelay: '540ms' }} />
                </div>
                <div>
                  <p className="text-sm font-medium text-stone-600">Loading puzzles…</p>
                  <p className="text-xs text-stone-400">Fetching themes &amp; openings from 1M+ puzzles</p>
                </div>
              </div>
            ) : filtersError ? (
              <div className="py-6 text-center space-y-2">
                <p className="text-red-500 text-sm font-medium">Failed to load filters</p>
                <p className="text-stone-400 text-xs">{filtersError}</p>
                <p className="text-stone-400 text-xs">Check TURSO_DATABASE_URL and TURSO_AUTH_TOKEN in .env</p>
              </div>
            ) : (
              <>
                {/* Themes */}
                <Field label="Themes">
                  <ThemeSelect themes={themes} selected={selectedThemes} onChange={setSelectedThemes} />
                </Field>

                {/* Opening */}
                <Field label="Opening">
                  <OpeningSelect openings={openings} value={selectedOpening} onChange={setSelectedOpening} />
                </Field>

                {/* Rating + Count */}
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Rating range">
                    <div className="flex items-center gap-2">
                      <input
                        type="text" inputMode="numeric" value={minRating}
                        onChange={e => { if (/^\d*$/.test(e.target.value)) setMinRating(e.target.value); }}
                        className="flex-1 px-3 py-2.5 text-sm border border-stone-200 rounded-xl bg-amber-50/40 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 text-stone-800 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                      <span className="text-stone-400 text-xs flex-shrink-0">—</span>
                      <input
                        type="text" inputMode="numeric" value={maxRating}
                        onChange={e => { if (/^\d*$/.test(e.target.value)) setMaxRating(e.target.value); }}
                        className="flex-1 px-3 py-2.5 text-sm border border-stone-200 rounded-xl bg-amber-50/40 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 text-stone-800 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                    </div>
                  </Field>

                  <Field label="Number of puzzles">
                    <input
                      type="number" value={count} min={1} max={500}
                      onChange={e => setCount(+e.target.value)}
                      className="w-full px-3 py-2.5 text-sm border border-stone-200 rounded-xl bg-amber-50/40 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 text-stone-800 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  </Field>
                </div>
              </>
            )}
          </div>

          {/* Actions */}
          {!filtersLoading && !filtersError && (
            <div className="px-6 pb-5 flex items-center gap-3">
              <button
                onClick={generate}
                disabled={generating}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-stone-900 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: generating ? '#e5c84a' : '#FACF47', boxShadow: '0 2px 10px rgba(250,207,71,.4)' }}
              >
                {generating ? (
                  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                  </svg>
                ) : (
                  <span>♟</span>
                )}
                {generating ? 'Generating…' : 'Generate PGN'}
              </button>

              <button
                onClick={() => downloadFile(pgn, 'circlechess_puzzles.pgn')}
                disabled={!pgn}
                className="px-4 py-2.5 rounded-xl text-sm font-medium text-stone-600 border border-stone-200 bg-white hover:border-amber-300 hover:bg-amber-50/40 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                ↓ Download .pgn
              </button>
            </div>
          )}
        </div>

        {/* Output card */}
        <div className="bg-white border border-stone-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-stone-100 bg-stone-50/60 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <p className="text-xs font-semibold text-stone-500 uppercase tracking-widest">Output</p>
              {puzzleCount > 0 && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 border border-amber-200 text-amber-800">
                  {puzzleCount} puzzle{puzzleCount !== 1 ? 's' : ''}
                </span>
              )}
            </div>
            {pgn && (
              <button
                onClick={copyPgn}
                className="text-xs px-3 py-1.5 rounded-lg border border-stone-200 text-stone-600 hover:border-amber-300 hover:bg-amber-50 transition-colors font-medium"
              >
                {copied ? '✓ Copied' : 'Copy'}
              </button>
            )}
          </div>

          {pgn ? (
            <div className="relative">
              <div
                className="absolute inset-0 pointer-events-none opacity-40"
                style={{ background: 'repeating-linear-gradient(0deg, transparent, transparent 23px, #e7e5e4 23px, #e7e5e4 24px)' }}
              />
              <textarea
                readOnly value={pgn}
                className="relative w-full h-80 bg-transparent text-stone-700 font-mono text-xs px-5 py-4 resize-none focus:outline-none leading-6"
                spellCheck={false}
              />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-stone-400">
              <span className="text-5xl opacity-30">♟</span>
              <p className="text-sm text-center">
                Set your filters and click{' '}
                <strong className="text-amber-600">Generate PGN</strong>
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl text-sm font-medium text-amber-50 shadow-xl" style={{ background: '#1C1917' }}>
          {toast}
        </div>
      )}
    </div>
  );
}
