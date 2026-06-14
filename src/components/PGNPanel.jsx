import { useEffect, useRef, useState } from 'react';

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
};

function downloadFile(content, filename) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([content], { type: 'text/plain' }));
  a.download = filename;
  a.click();
}

function CopyButton({ text, label = 'Copy' }) {
  const [copied, setCopied] = useState(false);
  const handle = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={handle}
      className="text-xs px-3 py-1.5 rounded-lg font-medium transition-all"
      style={{ background: C.surface, border: `1px solid ${C.border}`, color: C.muted }}
    >
      {copied ? '✓ Copied' : label}
    </button>
  );
}

export default function PGNPanel({ pgn, status, positions, onSelectFen, selectedFen }) {
  const [tab, setTab] = useState('pgn');
  const textareaRef = useRef(null);
  const bottomRef = useRef(null);

  useEffect(() => {
    if (status === 'processing' && textareaRef.current) {
      textareaRef.current.scrollTop = textareaRef.current.scrollHeight;
    }
  }, [pgn, status]);

  useEffect(() => {
    if (status === 'processing' && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [positions.length, status]);

  if (status === 'idle') {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-4">
        <div className="text-5xl opacity-20" style={{ color: C.goldDim }}>♟</div>
        <div className="space-y-1">
          <p className="font-medium" style={{ color: C.muted }}>PGN will appear here</p>
          <p className="text-xs" style={{ color: C.dim }}>Upload files and click Extract →</p>
        </div>
      </div>
    );
  }

  const hasPGN = pgn.length > 0;
  const hasPositions = positions.length > 0;

  return (
    <div className="h-full flex flex-col">
      {/* Tab bar */}
      <div
        className="flex-shrink-0 px-4 pt-3 flex items-center justify-between"
        style={{ background: C.bg, borderBottom: `1px solid ${C.border}` }}
      >
        <div className="flex gap-1">
          {[
            { id: 'pgn',       label: 'PGN',       badge: hasPGN ? `${pgn.split('\n').length} lines` : null },
            { id: 'positions', label: 'Positions', badge: hasPositions ? String(positions.length) : null },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors"
              style={{
                color: tab === t.id ? C.goldDim : C.muted,
                borderBottomColor: tab === t.id ? C.goldDim : 'transparent',
                background: tab === t.id ? C.surface : 'transparent',
              }}
            >
              {t.label}
              {t.badge && (
                <span className="ml-1.5 text-xs" style={{ color: C.dim }}>
                  {t.id === 'positions'
                    ? <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold" style={{ background: C.goldGlow, color: '#4D3F37' }}>{t.badge}</span>
                    : t.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {status === 'processing' && (
          <div className="flex items-center gap-1.5 text-xs animate-pulse pb-2" style={{ color: C.goldDim }}>
            <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: C.gold }} />
            Live
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden flex flex-col p-4" style={{ background: C.bg }}>
        {/* PGN tab */}
        {tab === 'pgn' && (
          <div className="flex-1 flex flex-col gap-3 min-h-0">
            {!hasPGN ? (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-sm animate-pulse" style={{ color: C.dim }}>Waiting for first result…</p>
              </div>
            ) : (
              <>
                <div className="relative flex-1 min-h-0 rounded-xl overflow-hidden" style={{ border: `1px solid ${C.border}` }}>
                  {/* lined paper effect */}
                  <div
                    className="absolute inset-0 pointer-events-none opacity-50"
                    style={{ background: `repeating-linear-gradient(0deg, transparent, transparent 23px, ${C.border} 23px, ${C.border} 24px)` }}
                  />
                  <textarea
                    ref={textareaRef}
                    readOnly value={pgn}
                    className="relative w-full h-full font-mono text-xs p-4 resize-none focus:outline-none leading-6 bg-transparent"
                    style={{ color: '#4D3F37' }}
                    spellCheck={false}
                  />
                </div>
                {status === 'done' && (
                  <div className="flex gap-2 flex-shrink-0">
                    <CopyButton text={pgn} label="Copy PGN" />
                    <button
                      onClick={() => downloadFile(pgn, 'chess-positions.pgn')}
                      className="text-xs px-3 py-1.5 rounded-lg font-semibold transition-all"
                      style={{ background: C.gold, color: C.text, boxShadow: '0 1px 6px rgba(250,207,71,.3)' }}
                    >
                      Download .pgn
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Positions tab */}
        {tab === 'positions' && (
          <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
            {!hasPositions ? (
              <div className="flex items-center justify-center h-32">
                <p className="text-sm animate-pulse" style={{ color: C.dim }}>Searching for chess positions…</p>
              </div>
            ) : (
              <>
                {positions.map((d, i) => {
                  const active = selectedFen === d.fen;
                  return (
                    <button
                      key={i}
                      onClick={() => onSelectFen(d.fen, d.description)}
                      className="w-full text-left rounded-xl p-3 transition-all"
                      style={{
                        background: active ? C.goldGlow : C.surface,
                        border: `1px solid ${active ? C.goldDim : C.border}`,
                        boxShadow: active ? `0 0 0 1px ${C.goldDim}` : 'none',
                      }}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-xs font-bold flex-shrink-0" style={{ color: active ? C.goldDim : C.dim }}>
                            #{i + 1}
                          </span>
                          {d.description && (
                            <span className="text-xs truncate" style={{ color: C.muted }}>{d.description}</span>
                          )}
                        </div>
                        <span className="text-xs flex-shrink-0 font-medium" style={{ color: active ? C.goldDim : C.dim }}>
                          {active ? '● Preview' : 'Preview →'}
                        </span>
                      </div>
                      <code className="block text-[10px] font-mono break-all leading-relaxed" style={{ color: C.muted }}>
                        {d.fen}
                      </code>
                    </button>
                  );
                })}
                <div ref={bottomRef} />
              </>
            )}

            {hasPositions && status === 'done' && (
              <div className="sticky bottom-0 pt-2 pb-1 flex gap-2" style={{ background: C.bg, borderTop: `1px solid ${C.border}` }}>
                <CopyButton text={positions.map(d => d.fen).join('\n')} label="Copy all FEN" />
                <button
                  onClick={() => downloadFile(positions.map(d => d.fen).join('\n'), 'chess-positions.txt')}
                  className="text-xs px-3 py-1.5 rounded-lg font-medium transition-all"
                  style={{ background: C.surface, border: `1px solid ${C.border}`, color: C.muted }}
                >
                  Download .txt
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
