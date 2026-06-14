import { useRef, useState, useCallback } from 'react';

const ACCEPTED = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];

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

function fmtTime(secs) {
  if (secs == null || secs < 0) return null;
  if (secs < 60) return `${secs}s`;
  return `${Math.floor(secs / 60)}m ${secs % 60}s`;
}

function formatBytes(bytes) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function Btn({ onClick, disabled, variant = 'primary', children, className = '' }) {
  const base = 'inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150 ' + className;
  if (variant === 'primary') return (
    <button onClick={onClick} disabled={disabled}
      className={base + ' disabled:opacity-50 disabled:cursor-not-allowed'}
      style={{ background: C.gold, color: C.text, boxShadow: '0 2px 10px rgba(250,207,71,.35)' }}
    >{children}</button>
  );
  return (
    <button onClick={onClick} disabled={disabled}
      className={base + ' disabled:opacity-40 disabled:cursor-not-allowed'}
      style={{ background: 'transparent', border: `1px solid ${C.border}`, color: C.muted }}
    >{children}</button>
  );
}

export default function LeftPanel({
  files, setFiles, mode, setMode,
  status, progress, positions, extractedTexts, errors,
  onProcess, onReset,
}) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const hasPdf = files.some(f => f.type === 'application/pdf');

  const addFiles = useCallback((incoming) => {
    const valid = Array.from(incoming).filter(f => ACCEPTED.includes(f.type));
    if (!valid.length) return;
    setFiles(prev => {
      const existing = new Set(prev.map(f => `${f.name}-${f.size}`));
      return [...prev, ...valid.filter(f => !existing.has(`${f.name}-${f.size}`))];
    });
  }, [setFiles]);

  const { current, total, message, elapsed, eta } = progress;
  const pct = total > 0 ? Math.min(Math.round((current / total) * 100), 99) : 0;

  // ── PROCESSING ────────────────────────────────────────────────────
  if (status === 'processing') {
    return (
      <div className="p-4 space-y-4">
        <div className="text-center py-5 space-y-2">
          <div className="flex justify-center gap-1 text-xl animate-pulse" style={{ color: C.goldDim }}>
            <span>♜</span><span>♞</span><span>♝</span><span>♛</span>
          </div>
          <p className="text-sm font-semibold" style={{ color: C.text }}>Extracting…</p>
        </div>

        <div className="space-y-2">
          <p className="text-xs truncate min-h-[1rem]" style={{ color: C.muted }}>{message || 'Preparing…'}</p>
          <div className="w-full rounded-full h-1.5 overflow-hidden" style={{ background: C.border }}>
            <div
              className="h-1.5 rounded-full transition-all duration-500"
              style={{ width: `${total > 0 ? pct : 20}%`, background: C.gold }}
            />
          </div>
          <div className="flex justify-between text-xs" style={{ color: C.dim }}>
            <span>{current}/{total || '?'}</span>
            {current >= total && total > 0
              ? <span style={{ color: C.goldDim, fontWeight: 600 }}>Finishing…</span>
              : eta != null && eta > 0
                ? <span style={{ color: C.goldDim }}>~{fmtTime(eta)} left</span>
                : <span>Elapsed: {fmtTime(elapsed) || '0s'}</span>
            }
          </div>
        </div>

        {positions.length > 0 && (
          <div className="rounded-xl p-3 text-xs" style={{ background: C.goldGlow, border: `1px solid ${C.goldDim}`, color: '#4D3F37' }}>
            {positions.length} position{positions.length !== 1 ? 's' : ''} found
          </div>
        )}

        {mode === 'text' && (
          <div className="rounded-xl p-3 text-xs" style={{ background: C.surface, border: `1px solid ${C.border}`, color: C.muted }}>
            {extractedTexts.length
              ? `Text extracted from ${extractedTexts.length} page${extractedTexts.length !== 1 ? 's' : ''}`
              : 'Extracting text…'}
          </div>
        )}
      </div>
    );
  }

  // ── DONE ─────────────────────────────────────────────────────────
  if (status === 'done') {
    const noText = mode === 'text' && extractedTexts.length === 0;
    return (
      <div className="p-4 space-y-3">
        <div className="rounded-2xl p-4 text-center space-y-1" style={{ background: C.goldGlow, border: `1px solid ${C.goldDim}` }}>
          <p className="text-xl">✓</p>
          <p className="text-sm font-semibold" style={{ color: '#4D3F37' }}>
            {positions.length} position{positions.length !== 1 ? 's' : ''} extracted
          </p>
          <p className="text-xs" style={{ color: C.muted }}>from {files.length} file{files.length !== 1 ? 's' : ''}</p>
        </div>

        {noText && (
          <div className="rounded-xl p-3 space-y-1" style={{ background: '#fff7ed', border: '1px solid #fed7aa' }}>
            <p className="text-xs font-semibold" style={{ color: '#c2410c' }}>No text found</p>
            <p className="text-xs" style={{ color: '#9a3412' }}>Scanned PDF — no text layer detected. FEN positions were still extracted.</p>
          </div>
        )}

        {mode === 'text' && extractedTexts.length > 0 && (
          <div className="rounded-xl p-3 space-y-1" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
            <p className="text-xs font-semibold mb-1" style={{ color: C.goldDim }}>Text extracted</p>
            {extractedTexts.map((t, i) => (
              <p key={i} className="text-xs truncate" style={{ color: C.muted }}>{t.label}: {t.text.length} chars</p>
            ))}
          </div>
        )}

        {errors.length > 0 && (
          <details className="rounded-xl p-3" style={{ background: '#fff7ed', border: '1px solid #fed7aa' }}>
            <summary className="text-xs font-medium cursor-pointer" style={{ color: '#c2410c' }}>
              {errors.length} error{errors.length !== 1 ? 's' : ''}
            </summary>
            <ul className="mt-2 space-y-1">
              {errors.map((e, i) => <li key={i} className="text-xs" style={{ color: C.muted }}>{e.name}: {e.error}</li>)}
            </ul>
          </details>
        )}

        <Btn variant="outline" onClick={onReset} className="w-full">← New Upload</Btn>
      </div>
    );
  }

  // ── IDLE ─────────────────────────────────────────────────────────
  return (
    <div className="p-4 space-y-3">
      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); }}
        onClick={() => inputRef.current?.click()}
        className="border-2 border-dashed rounded-2xl py-8 px-4 text-center cursor-pointer transition-all duration-200 select-none"
        style={{
          borderColor: dragging ? C.goldDim : C.border,
          background: dragging ? C.goldGlow : C.bg,
        }}
      >
        <div className="space-y-2 pointer-events-none">
          <div className="text-3xl">📄</div>
          <p className="text-sm font-semibold" style={{ color: C.text }}>Drop files here</p>
          <p className="text-xs" style={{ color: C.dim }}>or <span style={{ color: C.goldDim, fontWeight: 600 }}>browse</span></p>
          <div className="flex flex-wrap justify-center gap-1.5 pt-1">
            {['PDF', 'PNG', 'JPG', 'WEBP'].map(ext => (
              <span key={ext} className="text-xs px-1.5 py-0.5 rounded font-mono"
                style={{ background: C.surface, border: `1px solid ${C.border}`, color: C.dim }}>
                .{ext.toLowerCase()}
              </span>
            ))}
          </div>
        </div>
        <input ref={inputRef} type="file" accept=".pdf,image/*" multiple className="hidden"
          onChange={e => addFiles(e.target.files)} />
      </div>

      {/* File list */}
      {files.length > 0 && (
        <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${C.border}` }}>
          <div className="flex items-center justify-between px-3 py-2" style={{ background: C.surface, borderBottom: `1px solid ${C.border}` }}>
            <span className="text-xs font-medium" style={{ color: C.muted }}>{files.length} file{files.length !== 1 ? 's' : ''}</span>
            <button onClick={() => setFiles([])} className="text-xs transition-colors" style={{ color: C.dim }}>Clear all</button>
          </div>
          <ul className="max-h-40 overflow-y-auto divide-y" style={{ divideColor: C.border }}>
            {files.map((file, i) => (
              <li key={i} className="flex items-center justify-between px-3 py-2" style={{ background: C.bg }}>
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[10px] font-bold flex-shrink-0" style={{ color: file.type === 'application/pdf' ? '#c2410c' : C.goldDim }}>
                    {file.type === 'application/pdf' ? 'PDF' : 'IMG'}
                  </span>
                  <span className="text-xs truncate" style={{ color: C.text }}>{file.name}</span>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 ml-1">
                  <span className="text-[10px]" style={{ color: C.dim }}>{formatBytes(file.size)}</span>
                  <button
                    onClick={e => { e.stopPropagation(); setFiles(prev => prev.filter((_, idx) => idx !== i)); }}
                    className="text-lg leading-none transition-colors" style={{ color: C.dim }}
                  >×</button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Mode toggle */}
      {files.length > 0 && (
        <div className="rounded-xl p-3 space-y-2" style={{ background: C.bg, border: `1px solid ${C.border}` }}>
          <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: C.dim }}>Mode</p>
          <div className="flex gap-2">
            {[
              { id: 'fen', label: '♟ FEN Only' },
              { id: 'text', label: '📄 FEN + Text' },
            ].map(({ id, label }) => (
              <button key={id} onClick={() => setMode(id)}
                className="flex-1 py-2 px-2 rounded-xl text-xs font-semibold transition-all"
                style={{
                  background: mode === id ? C.gold : C.surface,
                  color: mode === id ? C.text : C.muted,
                  border: `1px solid ${mode === id ? C.goldDim : C.border}`,
                  boxShadow: mode === id ? '0 1px 6px rgba(250,207,71,.3)' : 'none',
                }}
              >
                {label}
              </button>
            ))}
          </div>
          {mode === 'text' && (
            <p className="text-[10px] leading-relaxed" style={{ color: C.dim }}>
              {hasPdf
                ? 'Extracts PDF text layer + GPT-4o builds annotated PGN.'
                : 'GPT-4o Vision reads text from image + builds annotated PGN. Requires OpenAI key.'}
            </p>
          )}
        </div>
      )}

      {/* Extract button */}
      {files.length > 0 && (
        <Btn onClick={onProcess} className="w-full">
          {mode === 'text' ? '📄' : '♟'} Extract →
        </Btn>
      )}

      {files.length === 0 && (
        <p className="text-xs text-center pt-2" style={{ color: C.dim }}>
          Multiple diagrams per page detected automatically
        </p>
      )}
    </div>
  );
}
