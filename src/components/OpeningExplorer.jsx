import { useEffect, useMemo, useState } from 'react';
import { Chess } from 'chess.js';
import BoardPreview from './BoardPreview';

const C = {
  bg:       '#FAF6EB',
  surface:  '#F5EFE6',
  border:   '#E8E0D0',
  gold:     '#FACF47',
  goldDim:  '#D1AB41',
  goldGlow: 'rgba(250,207,71,.15)',
  text:     '#262322',
  muted:    '#6b5f58',
  dim:      '#a89890',
  dark:     '#1C1917',
};

function downloadFile(content, filename) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([content], { type: 'text/plain' }));
  a.download = filename;
  a.click();
}

function slugify(str) {
  return str.replace(/[^a-z0-9]+/gi, '_').toLowerCase();
}

function computeFinalFen(openingMoves, varMoves) {
  try {
    const chess = new Chess();
    for (const san of [...openingMoves, ...varMoves]) chess.move(san);
    return chess.fen();
  } catch { return null; }
}

function Slider({ label, value, onChange, min, max, step = 1, hint }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center text-xs" style={{ color: C.muted }}>
        <span>{label}</span>
        <span className="font-bold" style={{ color: C.goldDim }}>{value}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(+e.target.value)}
        className="w-full h-1 rounded-full accent-yellow-400"
      />
      {hint && <p className="text-[10px]" style={{ color: C.dim }}>{hint}</p>}
    </div>
  );
}

function PgnCard({ item, isOpen, onToggle, onPreview, isCopied, onCopy, onDownload }) {
  return (
    <div
      className="rounded-xl overflow-hidden transition-all"
      style={{ border: `1px solid ${isOpen ? C.goldDim : C.border}`, background: isOpen ? C.goldGlow : C.surface }}
    >
      <div className="flex items-start gap-2 px-3 py-2.5">
        <button
          onClick={onToggle}
          className="flex-1 min-w-0 text-left"
        >
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="text-[10px] font-bold flex-shrink-0" style={{ color: C.goldDim }}>
              #{item.id}
            </span>
            {item.moves.length > 0 ? (
              <span className="text-xs font-mono truncate" style={{ color: C.text }}>
                {item.moves.join(' ')}
              </span>
            ) : (
              <span className="text-xs italic" style={{ color: C.muted }}>Main Line</span>
            )}
          </div>
          <p className="text-[10px] truncate" style={{ color: C.muted }}>{item.name}</p>
        </button>

        <div className="flex gap-1 flex-shrink-0 items-center">
          <button
            onClick={onPreview}
            className="text-[10px] px-2 py-1 rounded-lg transition-all"
            style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.dim }}
            title="Preview board position"
          >
            ♟
          </button>
          <button
            onClick={onCopy}
            className="text-[10px] px-2 py-1 rounded-lg transition-all"
            style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.muted }}
          >
            {isCopied ? '✓' : 'Copy'}
          </button>
          <button
            onClick={onDownload}
            className="text-[10px] px-2 py-1 rounded-lg font-semibold transition-all"
            style={{ background: C.gold, color: C.text }}
            title="Download PGN"
          >
            ↓
          </button>
        </div>
      </div>

      {isOpen && (
        <div className="px-3 pb-3">
          <div
            className="rounded-lg p-2.5 font-mono text-[10px] leading-relaxed whitespace-pre-wrap break-all"
            style={{ background: C.bg, border: `1px solid ${C.border}`, color: '#4D3F37' }}
          >
            {item.pgn}
          </div>
        </div>
      )}
    </div>
  );
}

export default function OpeningExplorer() {
  const [tab, setTab] = useState('variations'); // 'variations' | 'detect'

  // ── Variations tab state ──────────────────────────────────────────────────
  const [openings, setOpenings]       = useState([]);
  const [loadingList, setLoadingList] = useState(true);

  const [selectedFamily, setSelectedFamily] = useState('');
  const [selectedEco, setSelectedEco]       = useState('');

  const [depth, setDepth]       = useState(2);
  const [topMoves, setTopMoves] = useState(3);
  const [minGames, setMinGames] = useState(50);

  const [generating, setGenerating] = useState(false);
  const [pgns, setPgns]             = useState([]);
  const [openCard, setOpenCard]     = useState(null);
  const [copiedId, setCopiedId]     = useState(null);
  const [error, setError]           = useState('');

  const [previewFen, setPreviewFen]     = useState('');
  const [previewLabel, setPreviewLabel] = useState('');

  // ── Detect tab state ──────────────────────────────────────────────────────
  const [detectPgn, setDetectPgn]         = useState('');
  const [detecting, setDetecting]         = useState(false);
  const [detectResult, setDetectResult]   = useState(null);
  const [detectError, setDetectError]     = useState('');
  const [detectPreviewFen, setDetectPreviewFen] = useState('');
  const [detectPreviewLabel, setDetectPreviewLabel] = useState('');

  // Load opening list once
  useEffect(() => {
    fetch('/api/opening/list')
      .then(r => r.json())
      .then(data => { setOpenings(Array.isArray(data) ? data : []); setLoadingList(false); })
      .catch(() => setLoadingList(false));
  }, []);

  // Group into families
  const families = useMemo(() => {
    const map = {};
    for (const o of openings) {
      const ci = o.name.indexOf(':');
      const family = ci > -1 ? o.name.slice(0, ci).trim() : o.name;
      (map[family] = map[family] || []).push(o);
    }
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  }, [openings]);

  const variations = useMemo(
    () => families.find(([f]) => f === selectedFamily)?.[1] ?? [],
    [families, selectedFamily]
  );

  const selectedOpening = useMemo(
    () => openings.find(o => o.eco === selectedEco),
    [openings, selectedEco]
  );

  // Update board when opening selection changes
  useEffect(() => {
    if (selectedOpening) {
      setPreviewFen(selectedOpening.fen);
      setPreviewLabel(selectedOpening.name);
    }
  }, [selectedOpening]);

  const handleFamilyChange = (f) => {
    setSelectedFamily(f);
    setSelectedEco('');
    setPgns([]);
    setError('');
  };

  const handleVariationChange = (eco) => {
    setSelectedEco(eco);
    setPgns([]);
    setError('');
    setOpenCard(null);
  };

  const generate = async () => {
    if (!selectedEco) return;
    setGenerating(true);
    setPgns([]);
    setError('');
    setOpenCard(null);
    try {
      const params = new URLSearchParams({ eco: selectedEco, depth, topMoves, minGames });
      const r = await fetch(`/api/opening/pgn?${params}`);
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Generation failed');
      setPgns(data.pgns || []);
      if (data.pgns?.length === 0) setError('No master games found for this opening at current settings. Try lowering Min Games.');
    } catch (e) {
      setError(e.message);
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = async (item) => {
    await navigator.clipboard.writeText(item.pgn);
    setCopiedId(item.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handlePreview = (item) => {
    if (!selectedOpening) return;
    const fen = computeFinalFen(item.openingMoves, item.moves);
    if (fen) { setPreviewFen(fen); setPreviewLabel(item.name); }
  };

  const downloadAll = () => {
    if (!pgns.length) return;
    downloadFile(
      pgns.map(p => p.pgn).join('\n\n'),
      `${slugify(selectedOpening?.name || 'openings')}_variations.pgn`
    );
  };

  const runDetect = async () => {
    if (!detectPgn.trim()) return;
    setDetecting(true);
    setDetectResult(null);
    setDetectError('');
    try {
      const r = await fetch('/api/opening/detect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pgn: detectPgn.trim() }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Detection failed');
      setDetectResult(data);
      // Show the last in-book position on the board
      if (data.lastOpening && data.moves?.length) {
        const lastInBook = [...data.moves].reverse().find(m => m.opening);
        if (lastInBook) {
          setDetectPreviewFen(lastInBook.fen);
          setDetectPreviewLabel(`${lastInBook.opening.name} (move ${lastInBook.n})`);
        }
      }
    } catch (e) {
      setDetectError(e.message);
    } finally {
      setDetecting(false);
    }
  };

  // ─── estimate API call count for warning ──────────────────────────────────
  const estimatedCalls = useMemo(() => {
    let n = 0;
    for (let d = 0; d < depth; d++) n += Math.pow(topMoves, d);
    return n;
  }, [depth, topMoves]);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Tool header */}
      <div
        className="flex-shrink-0 px-5 py-3 flex items-center gap-3"
        style={{ background: C.dark, borderBottom: '1px solid #2d2724' }}
      >
        <span className="text-lg select-none">♜</span>
        <h1 className="text-sm font-bold tracking-wide" style={{ color: C.gold }}>
          Opening Explorer
        </h1>
        <div className="ml-auto flex gap-1">
          {[
            { id: 'variations', label: '♟ Variations' },
            { id: 'detect',     label: '🔍 Detect' },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="text-xs px-3 py-1 rounded-lg font-medium transition-all"
              style={{
                background: tab === t.id ? C.gold : 'transparent',
                color: tab === t.id ? C.text : '#6b5f58',
                border: `1px solid ${tab === t.id ? C.goldDim : '#2d2724'}`,
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* 3-column layout */}
      <div className="flex-1 min-h-0 flex overflow-hidden">

        {/* ── Left: Config ── */}
        <div
          className="w-72 flex-shrink-0 overflow-y-auto p-4 space-y-4"
          style={{ background: C.bg, borderRight: `1px solid ${C.border}` }}
        >
          {/* Family */}
          <div className="space-y-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: C.dim }}>
              Opening
            </p>
            <select
              value={selectedFamily}
              onChange={e => handleFamilyChange(e.target.value)}
              disabled={loadingList}
              className="w-full text-sm rounded-xl px-3 py-2.5 focus:outline-none"
              style={{ background: C.surface, border: `1px solid ${C.border}`, color: selectedFamily ? C.text : C.dim }}
            >
              <option value="">
                {loadingList ? 'Loading openings…' : `Choose opening (${families.length})`}
              </option>
              {families.map(([f, list]) => (
                <option key={f} value={f}>{f} ({list.length})</option>
              ))}
            </select>
          </div>

          {/* Variation */}
          <div className="space-y-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: C.dim }}>
              Variation
            </p>
            <select
              value={selectedEco}
              onChange={e => handleVariationChange(e.target.value)}
              disabled={!selectedFamily}
              className="w-full text-sm rounded-xl px-3 py-2.5 focus:outline-none"
              style={{
                background: selectedFamily ? C.surface : C.bg,
                border: `1px solid ${C.border}`,
                color: selectedEco ? C.text : C.dim,
              }}
            >
              <option value="">
                {selectedFamily ? `Choose variation (${variations.length})` : '— select opening first —'}
              </option>
              {variations.map(o => {
                const ci = o.name.indexOf(':');
                const varName = ci > -1 ? o.name.slice(ci + 1).trim() : 'Main Line';
                return <option key={o.eco} value={o.eco}>{o.eco} · {varName}</option>;
              })}
            </select>
          </div>

          {/* Selected opening card */}
          {selectedOpening && (
            <div
              className="rounded-xl p-3 space-y-1.5"
              style={{ background: C.goldGlow, border: `1px solid ${C.goldDim}` }}
            >
              <p className="text-xs font-semibold leading-snug" style={{ color: '#4D3F37' }}>
                {selectedOpening.name}
              </p>
              <p className="text-[10px] font-mono font-bold" style={{ color: C.goldDim }}>
                {selectedOpening.eco}
              </p>
              {selectedOpening.pgn && (
                <p className="text-[10px] font-mono break-all leading-relaxed" style={{ color: C.muted }}>
                  {selectedOpening.pgn}
                </p>
              )}
            </div>
          )}

          {/* Options */}
          {selectedEco && (
            <div
              className="rounded-xl p-3 space-y-4"
              style={{ background: C.surface, border: `1px solid ${C.border}` }}
            >
              <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: C.dim }}>
                Options
              </p>
              <Slider
                label="Depth (plies after opening)"
                value={depth} onChange={setDepth} min={1} max={4}
                hint="1 = one extra move per side"
              />
              <Slider
                label="Top moves per position"
                value={topMoves} onChange={setTopMoves} min={1} max={5}
                hint="Higher = more variations"
              />
              <Slider
                label="Min games (Lichess token)"
                value={minGames} onChange={setMinGames} min={0} max={500} step={10}
                hint="Ignored when using ChessDB (no token)"
              />
              <p className="text-[10px]" style={{ color: C.dim }}>
                ≈ {estimatedCalls} Lichess API calls · {Math.pow(topMoves, depth)} max PGNs
              </p>
            </div>
          )}

          {/* Generate */}
          <button
            onClick={generate}
            disabled={!selectedEco || generating}
            className="w-full py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: C.gold, color: C.text, boxShadow: '0 2px 10px rgba(250,207,71,.35)' }}
          >
            {generating ? 'Exploring…' : '♟ Generate Variations'}
          </button>

          {error && (
            <div
              className="rounded-xl p-3 text-xs leading-relaxed"
              style={{ background: '#fff7ed', border: '1px solid #fed7aa', color: '#c2410c' }}
            >
              {error}
            </div>
          )}
        </div>

        {/* ── Middle: tab content ── */}
        <div className="flex-1 min-w-0 flex flex-col overflow-hidden" style={{ background: C.bg }}>

          {/* ── VARIATIONS tab ── */}
          {tab === 'variations' && (
            <>
              {pgns.length === 0 && !generating && (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-8 space-y-4">
                  <div className="text-5xl opacity-20" style={{ color: C.goldDim }}>♖</div>
                  <div className="space-y-1">
                    <p className="font-medium" style={{ color: C.muted }}>No variations yet</p>
                    <p className="text-xs" style={{ color: C.dim }}>
                      {selectedEco ? 'Click Generate to explore →' : 'Select an opening on the left'}
                    </p>
                  </div>
                </div>
              )}

              {generating && (
                <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8">
                  <div className="flex gap-1 text-3xl animate-pulse" style={{ color: C.goldDim }}>
                    <span>♜</span><span>♞</span><span>♝</span><span>♛</span>
                  </div>
                  <p className="text-sm font-medium animate-pulse" style={{ color: C.muted }}>
                    Exploring via Lichess Masters…
                  </p>
                  <p className="text-xs" style={{ color: C.dim }}>~{estimatedCalls} positions to check</p>
                </div>
              )}

              {pgns.length > 0 && (
                <>
                  <div
                    className="flex-shrink-0 px-4 py-3 flex items-center justify-between"
                    style={{ background: C.surface, borderBottom: `1px solid ${C.border}` }}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold" style={{ color: C.text }}>
                        {pgns.length} variation{pgns.length !== 1 ? 's' : ''}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                        style={{ background: C.goldGlow, color: '#4D3F37' }}>
                        {selectedOpening?.eco} · {selectedOpening?.name}
                      </span>
                    </div>
                    <button onClick={downloadAll}
                      className="text-xs px-3 py-1.5 rounded-lg font-semibold"
                      style={{ background: C.gold, color: C.text }}>
                      ↓ Download All
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4 space-y-2">
                    {pgns.map(item => (
                      <PgnCard key={item.id} item={item}
                        isOpen={openCard === item.id}
                        onToggle={() => setOpenCard(openCard === item.id ? null : item.id)}
                        onPreview={() => handlePreview(item)}
                        isCopied={copiedId === item.id}
                        onCopy={() => handleCopy(item)}
                        onDownload={() => downloadFile(item.pgn, `${slugify(item.name)}.pgn`)}
                      />
                    ))}
                  </div>
                </>
              )}
            </>
          )}

          {/* ── DETECT tab ── */}
          {tab === 'detect' && (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Input */}
              <div className="flex-shrink-0 p-4 space-y-3" style={{ borderBottom: `1px solid ${C.border}` }}>
                <p className="text-xs font-semibold" style={{ color: C.muted }}>
                  Paste any PGN — detects where theory ends (ECO map + Lichess Masters)
                </p>
                <textarea
                  value={detectPgn}
                  onChange={e => setDetectPgn(e.target.value)}
                  placeholder={'[Event "..."]\n\n1. e4 e5 2. Nf3 Nc6 3. Bb5 ...'}
                  className="w-full font-mono text-xs rounded-xl p-3 resize-none focus:outline-none leading-relaxed"
                  style={{ background: C.surface, border: `1px solid ${C.border}`, color: '#4D3F37', height: 110 }}
                />
                <button
                  onClick={runDetect}
                  disabled={!detectPgn.trim() || detecting}
                  className="w-full py-2 rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
                  style={{ background: C.gold, color: C.text }}
                >
                  {detecting ? 'Analyzing…' : '🔍 Detect Opening'}
                </button>
                {detectError && (
                  <p className="text-xs rounded-xl px-3 py-2" style={{ background: '#fff7ed', border: '1px solid #fed7aa', color: '#c2410c' }}>
                    {detectError}
                  </p>
                )}
              </div>

              {/* Results */}
              {detecting && (
                <div className="flex-1 flex flex-col items-center justify-center gap-3">
                  <div className="flex gap-1 text-2xl animate-pulse" style={{ color: C.goldDim }}>
                    <span>♟</span><span>♞</span><span>♜</span>
                  </div>
                  <p className="text-sm animate-pulse" style={{ color: C.muted }}>Checking each position…</p>
                </div>
              )}

              {detectResult && !detecting && (
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {/* Summary card */}
                  <div className="rounded-xl p-4 space-y-2" style={{ background: C.goldGlow, border: `1px solid ${C.goldDim}` }}>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-xs font-bold" style={{ color: C.goldDim }}>
                          {detectResult.lastOpening?.eco}
                        </p>
                        <p className="text-sm font-semibold leading-snug" style={{ color: '#4D3F37' }}>
                          {detectResult.lastOpening?.name || 'No named opening found'}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-[10px]" style={{ color: C.muted }}>Theory ended</p>
                        <p className="text-lg font-bold" style={{ color: C.goldDim }}>
                          Move {detectResult.openingEndMove}
                        </p>
                        <p className="text-[10px]" style={{ color: C.muted }}>
                          {detectResult.openingEndColor === 'w' ? 'after White' : 'after Black'}
                        </p>
                      </div>
                    </div>
                    {detectResult.lastOpening?.source && (
                      <p className="text-[10px]" style={{ color: C.muted }}>
                        Source: {detectResult.lastOpening.source === 'eco' ? 'ECO database' : 'Lichess Masters'}
                      </p>
                    )}
                  </div>

                  {/* Move-by-move list */}
                  <p className="text-[10px] font-semibold uppercase tracking-widest px-1" style={{ color: C.dim }}>
                    Move by move
                  </p>
                  <div className="space-y-1">
                    {detectResult.moves.map((m, i) => {
                      const isEnd = i === detectResult.moves.findIndex(mv => !mv.opening && detectResult.moves.slice(i).every(mv2 => !mv2.opening));
                      return (
                        <button
                          key={i}
                          onClick={() => {
                            setDetectPreviewFen(m.fen);
                            setDetectPreviewLabel(m.opening?.name || `Move ${m.n} — out of book`);
                          }}
                          className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-left transition-all"
                          style={{
                            background: m.opening ? C.surface : C.bg,
                            border: `1px solid ${m.opening ? C.border : 'transparent'}`,
                          }}
                        >
                          <span className="text-[10px] font-mono w-10 flex-shrink-0" style={{ color: C.dim }}>
                            {m.n}{m.color === 'w' ? '.' : '…'}
                          </span>
                          <span className="text-xs font-mono font-semibold w-12 flex-shrink-0" style={{ color: C.text }}>
                            {m.san}
                          </span>
                          {m.opening ? (
                            <span className="text-[10px] truncate" style={{ color: C.goldDim }}>
                              {m.opening.eco} · {m.opening.name}
                            </span>
                          ) : (
                            <span className="text-[10px]" style={{ color: C.dim }}>— out of book</span>
                          )}
                          <span className="ml-auto text-[10px] flex-shrink-0" style={{ color: C.dim }}>♟</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {!detectResult && !detecting && !detectError && (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-8 space-y-4">
                  <div className="text-5xl opacity-20" style={{ color: C.goldDim }}>🔍</div>
                  <div className="space-y-1">
                    <p className="font-medium" style={{ color: C.muted }}>Opening Detector</p>
                    <p className="text-xs" style={{ color: C.dim }}>Paste a PGN above and click Detect</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Right: Board preview ── */}
        <div
          className="w-72 flex-shrink-0 overflow-y-auto p-4"
          style={{ background: C.bg, borderLeft: `1px solid ${C.border}` }}
        >
          <BoardPreview
            fen={tab === 'detect' ? detectPreviewFen : previewFen}
            label={tab === 'detect' ? detectPreviewLabel : previewLabel}
          />
          <p className="text-[10px] mt-3 text-center" style={{ color: C.dim }}>
            {tab === 'detect' ? 'Click any move row to preview that position' : 'Click ♟ on any variation to preview'}
          </p>
        </div>
      </div>
    </div>
  );
}
