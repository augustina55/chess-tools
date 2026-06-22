import { useState, useRef, useCallback } from 'react';
import AnnotatedBoard from './AnnotatedBoard';

// ── PDF → pages (reused pattern) ─────────────────────────────────────────────

async function renderPdfFile(file, onProgress) {
  const pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  const pages = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    onProgress?.(`Rendering "${file.name}" page ${p}/${pdf.numPages}…`);
    const page = await pdf.getPage(p);
    const vp = page.getViewport({ scale: 2.0 });
    const canvas = document.createElement('canvas');
    canvas.width = vp.width; canvas.height = vp.height;
    await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
    const blob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', 0.92));
    const tc = await page.getTextContent();
    const text = tc.items.map(i => i.str).join(' ').replace(/\s+/g, ' ').trim();
    pages.push({ blob, name: `${file.name}_p${p}.jpg`, text });
  }
  return pages;
}

function downloadText(text, filename) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
  a.download = filename;
  a.click();
}

// ── Position card ─────────────────────────────────────────────────────────────

function PositionCard({ pos, type, index, active, onClick }) {
  const [showMoves, setShowMoves] = useState(false);
  const isBook = type === 'book';
  const accent = isBook ? '#D1AB41' : '#6b9fd4';
  const bg     = isBook ? 'rgba(250,207,71,0.07)' : 'rgba(107,159,212,0.07)';

  return (
    <div
      className="rounded-2xl overflow-hidden cursor-pointer transition-all"
      style={{
        background: '#fff',
        boxShadow: active
          ? `0 0 0 2px ${accent}, 0 4px 16px rgba(0,0,0,0.08)`
          : '0 2px 8px rgba(0,0,0,0.06)',
      }}
      onClick={onClick}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: '1px solid #F0EBE4' }}>
        <div
          className="w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
          style={{ background: active ? accent : bg, color: active ? '#1C1917' : accent }}
        >
          {index}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold truncate" style={{ color: '#1C1917' }}>{pos.title}</p>
          <p className="text-[10px]" style={{ color: isBook ? '#D1AB41' : '#6b9fd4' }}>
            {isBook ? 'Book Position' : 'Related Position'}
          </p>
        </div>
      </div>

      {/* Body */}
      <div className="p-4">
        <div className="flex gap-4">
          {/* Mini board */}
          <div className="flex-shrink-0">
            <AnnotatedBoard fen={pos.fen} arrows={[]} highlights={{}} width={130} />
          </div>

          {/* Text */}
          <div className="flex-1 min-w-0">
            <p
              className="text-xs leading-relaxed"
              style={{
                color: '#4A3728',
                display: '-webkit-box',
                WebkitLineClamp: 4,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {pos.explanation}
            </p>

            {pos.moves?.length > 0 && (
              <button
                onClick={e => { e.stopPropagation(); setShowMoves(v => !v); }}
                className="mt-2 text-[11px] font-semibold flex items-center gap-1"
                style={{ color: accent, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
              >
                <span>{showMoves ? '▾' : '▸'}</span>
                {pos.moves.length} move{pos.moves.length !== 1 ? 's' : ''}
              </button>
            )}

            {showMoves && (
              <div className="mt-2 space-y-1">
                {pos.moves.map((mv, i) => (
                  <div key={i} className="text-[11px] leading-snug" style={{ color: '#4A3728' }}>
                    <span className="font-bold mr-1" style={{ color: accent }}>{mv.san}</span>
                    {mv.comment && <span style={{ color: '#6b5f58' }}>{mv.comment}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function StudyGenerator() {
  const [topic, setTopic]     = useState('');
  const [files, setFiles]     = useState([]);
  const [status, setStatus]   = useState('idle');
  const [progress, setProgress] = useState('');
  const [study, setStudy]     = useState(null);
  const [selected, setSelected] = useState(null);
  const [activeTab, setActiveTab] = useState('book'); // 'book' | 'related'
  const inputRef = useRef(null);

  const processing = status === 'processing';
  const canGenerate = topic.trim().length > 0 && !processing;

  const handleFiles = useCallback(list => {
    const valid = Array.from(list).filter(f =>
      f.type === 'application/pdf' || f.type.startsWith('image/')
    );
    if (valid.length) setFiles(prev => [...prev, ...valid]);
  }, []);

  const generate = async () => {
    if (!canGenerate) return;
    setStatus('processing');
    setProgress('Preparing…');
    setStudy(null);
    setSelected(null);

    try {
      const formData = new FormData();
      formData.append('topic', topic.trim());
      const pageTexts = [];

      for (const file of files) {
        if (file.type === 'application/pdf') {
          const pages = await renderPdfFile(file, msg => setProgress(msg));
          pages.forEach(p => {
            formData.append('images', p.blob, p.name);
            if (p.text) pageTexts.push(p.text);
          });
        } else {
          formData.append('images', file, file.name);
        }
      }
      formData.append('pageTexts', JSON.stringify(pageTexts));

      setProgress('Generating study with GPT-4o…');
      const r = await fetch('/api/study/generate', { method: 'POST', body: formData });
      if (!r.ok) { const e = await r.json(); throw new Error(e.error || `Error ${r.status}`); }
      const data = await r.json();
      setStudy(data);
      setSelected(data.bookPositions?.[0] || null);
      setActiveTab('book');
      setStatus('done');
    } catch (err) {
      setProgress(err.message);
      setStatus('error');
    }
  };

  const allPositions = study
    ? [
        ...(study.bookPositions || []).map(p => ({ ...p, type: 'book' })),
        ...(study.relatedPositions || []).map(p => ({ ...p, type: 'related' })),
      ]
    : [];

  const displayList = study
    ? (activeTab === 'book' ? study.bookPositions || [] : study.relatedPositions || [])
    : [];

  return (
    <div className="flex h-full overflow-hidden">

      {/* ── Left: Config ─────────────────────────────────────────── */}
      <aside
        className="w-64 flex-shrink-0 overflow-y-auto"
        style={{ borderRight: '1px solid #DDD5C8', background: '#FAF8F4' }}
      >
        <div className="px-4 py-5 space-y-5">

          <div>
            <h2 className="text-sm font-bold" style={{ color: '#1C1917' }}>Study Generator</h2>
            <p className="text-[11px] mt-0.5" style={{ color: '#6b5f58' }}>Topic → 4 book + 10 related positions</p>
          </div>

          {/* Topic */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest mb-1.5" style={{ color: '#9a8070' }}>Chess Topic</p>
            <input
              ref={inputRef}
              type="text"
              value={topic}
              onChange={e => setTopic(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && generate()}
              placeholder="e.g. Prophylaxis, IQP, Back Rank..."
              className="w-full px-3 py-2 text-sm rounded-lg outline-none"
              style={{ border: '1px solid #DDD5C8', background: '#fff', color: '#1C1917', fontFamily: 'inherit' }}
            />
          </div>

          {/* PDFs */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest mb-1.5" style={{ color: '#9a8070' }}>
              Reference PDFs <span style={{ textTransform: 'none', fontWeight: 400, fontSize: 10 }}>(optional)</span>
            </p>
            <div
              className="border-2 border-dashed rounded-xl p-4 text-center cursor-pointer"
              style={{ borderColor: '#D1AB41', background: 'rgba(250,207,71,0.03)' }}
              onClick={() => document.getElementById('study-file-input').click()}
              onDrop={e => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
              onDragOver={e => e.preventDefault()}
            >
              <p className="text-xs font-semibold" style={{ color: '#FACF47' }}>Upload PDFs or Images</p>
              <p className="text-[10px] mt-0.5" style={{ color: '#6b5f58' }}>Positions come from your books</p>
              <input id="study-file-input" type="file" accept=".pdf,image/*" multiple className="hidden"
                onChange={e => handleFiles(e.target.files)} />
            </div>
            {files.length > 0 && (
              <div className="mt-2 space-y-1">
                {files.map((f, i) => (
                  <div key={i} className="flex items-center gap-2 px-2 py-1.5 rounded-lg"
                    style={{ background: 'rgba(250,207,71,0.07)' }}>
                    <span className="text-[11px] flex-1 truncate" style={{ color: '#78655A' }}>{f.name}</span>
                    <button onClick={() => setFiles(p => p.filter((_, j) => j !== i))}
                      style={{ color: '#9a8070', background: 'rgba(0,0,0,0.06)', border: 'none', borderRadius: 4, padding: '1px 5px', cursor: 'pointer', fontSize: 10 }}>✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Generate */}
          <button
            onClick={generate}
            disabled={!canGenerate}
            className="w-full py-2.5 text-sm font-bold rounded-xl"
            style={{
              background: canGenerate ? 'linear-gradient(135deg,#FACF47,#E17846)' : 'rgba(0,0,0,0.08)',
              color: canGenerate ? '#1C1917' : '#9a8070',
              border: 'none',
              cursor: canGenerate ? 'pointer' : 'not-allowed',
              boxShadow: canGenerate ? '0 4px 14px rgba(250,207,71,0.3)' : 'none',
            }}
          >
            {processing ? 'Generating…' : 'Generate Study'}
          </button>

          {/* Status */}
          {(status === 'processing' || status === 'error') && (
            <div className="text-[11px] text-center px-3 py-2 rounded-lg"
              style={{
                background: status === 'error' ? 'rgba(220,38,38,0.08)' : 'rgba(250,207,71,0.08)',
                color: status === 'error' ? '#DC2626' : '#78655A',
              }}>
              {status === 'processing' && (
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mx-auto mb-1.5" />
              )}
              {progress}
            </div>
          )}

          {/* Download PGN */}
          {study?.pgn && (
            <button
              onClick={() => downloadText(study.pgn, `${study.topic || 'study'}.pgn`)}
              className="w-full py-2.5 text-sm font-bold rounded-xl"
              style={{ border: '2px solid #FACF47', background: 'transparent', color: '#D1AB41', cursor: 'pointer' }}
            >
              ⬇ Download PGN
            </button>
          )}

          {/* Info */}
          <div className="rounded-xl p-3 text-[11px] space-y-1.5" style={{ background: 'rgba(250,207,71,0.07)', color: '#78655A' }}>
            <p className="font-bold mb-1">Output</p>
            <p>• 4 deeply annotated book positions</p>
            <p>• 10 related positions with moves</p>
            <p>• PGN opens in Lichess &amp; ChessBase</p>
            <p>• Upload PDFs for book-specific content</p>
          </div>
        </div>
      </aside>

      {/* ── Middle: Position list ─────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto" style={{ background: '#F1EDE4' }}>

        {!study && status !== 'processing' && (
          <div className="flex flex-col items-center justify-center h-full p-8 text-center">
            <div className="text-5xl mb-4">📚</div>
            <h3 className="text-lg font-bold mb-2" style={{ color: '#1C1917' }}>Chess Study Generator</h3>
            <p className="text-sm max-w-sm" style={{ color: '#6b5f58' }}>
              Enter any chess topic — Prophylaxis, Isolated Queen's Pawn, Rook Endings — and get
              4 deeply annotated book positions + 10 related positions as a downloadable PGN.
            </p>
            <div className="mt-5 flex gap-3">
              {[['📖', '4 Book Positions', 'Deeply annotated'], ['♟', '10 Related', 'With moves'], ['⬇', 'PGN Export', 'Lichess / ChessBase']].map(([icon, title, sub]) => (
                <div key={title} className="rounded-xl px-4 py-3 text-center" style={{ background: 'rgba(250,207,71,0.1)' }}>
                  <div className="text-xl mb-1">{icon}</div>
                  <div className="text-xs font-bold" style={{ color: '#1C1917' }}>{title}</div>
                  <div className="text-[10px]" style={{ color: '#9a8070' }}>{sub}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {status === 'processing' && (
          <div className="flex flex-col items-center justify-center h-full">
            <div className="w-10 h-10 border-4 rounded-full animate-spin mb-4"
              style={{ borderColor: '#FACF47', borderTopColor: 'transparent' }} />
            <p className="text-sm font-semibold" style={{ color: '#78655A' }}>{progress}</p>
          </div>
        )}

        {study && (
          <div className="p-5">
            {/* Title */}
            <div className="mb-5">
              <h1 className="text-xl font-bold" style={{ color: '#1C1917' }}>{study.title}</h1>
              {study.description && (
                <p className="text-sm mt-1" style={{ color: '#6b5f58' }}>{study.description}</p>
              )}
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mb-4">
              {[
                { key: 'book', label: `📖 Book Positions (${study.bookPositions?.length || 0})` },
                { key: 'related', label: `♟ Related Positions (${study.relatedPositions?.length || 0})` },
              ].map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className="px-4 py-2 text-xs font-bold rounded-xl transition-all"
                  style={{
                    background: activeTab === tab.key ? '#FACF47' : 'rgba(250,207,71,0.12)',
                    color: activeTab === tab.key ? '#1C1917' : '#78655A',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Position cards */}
            <div className="space-y-4 max-w-2xl">
              {displayList.map((pos, i) => (
                <PositionCard
                  key={pos.id || i}
                  pos={pos}
                  type={activeTab}
                  index={i + 1}
                  active={selected?.id === pos.id && selected?.title === pos.title}
                  onClick={() => setSelected({ ...pos, type: activeTab })}
                />
              ))}
            </div>
          </div>
        )}
      </main>

      {/* ── Right: Board + PGN ───────────────────────────────────── */}
      <aside
        className="w-72 flex-shrink-0 flex flex-col"
        style={{ borderLeft: '1px solid #DDD5C8', background: '#FAF8F4' }}
      >
        {!selected ? (
          <div className="flex-1 flex items-center justify-center p-6 text-center">
            <div>
              <div className="text-3xl mb-2">♟</div>
              <p className="text-xs" style={{ color: '#9a8070' }}>Click a position to preview</p>
            </div>
          </div>
        ) : (
          <>
            <div className="px-4 py-3 flex-shrink-0" style={{ borderBottom: '1px solid #DDD5C8' }}>
              <p className="text-xs font-bold truncate" style={{ color: '#1C1917' }}>{selected.title}</p>
              <p className="text-[10px]" style={{ color: selected.type === 'book' ? '#D1AB41' : '#6b9fd4' }}>
                {selected.type === 'book' ? 'Book Position' : 'Related Position'}
              </p>
            </div>

            <div className="p-3 flex justify-center flex-shrink-0">
              <AnnotatedBoard fen={selected.fen} arrows={[]} highlights={{}} width={256} />
            </div>

            <div className="flex-1 overflow-y-auto px-4 pb-4">
              {/* Explanation */}
              {selected.explanation && (
                <p className="text-xs leading-relaxed mb-3" style={{ color: '#4A3728' }}>
                  {selected.explanation}
                </p>
              )}

              {/* Moves */}
              {selected.moves?.length > 0 && (
                <div className="mb-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: '#9a8070' }}>Moves</p>
                  <div className="space-y-1.5">
                    {selected.moves.map((mv, i) => (
                      <div key={i} className="rounded-lg px-3 py-2" style={{ background: 'rgba(250,207,71,0.07)' }}>
                        <span className="text-xs font-bold mr-2" style={{ color: '#D1AB41' }}>{mv.san}</span>
                        {mv.comment && <span className="text-[11px]" style={{ color: '#6b5f58' }}>{mv.comment}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* PGN snippet */}
              {study?.pgn && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: '#9a8070' }}>
                    Full PGN
                  </p>
                  <textarea
                    readOnly
                    value={study.pgn}
                    rows={6}
                    className="w-full text-[10px] rounded-lg px-2 py-2 resize-none outline-none font-mono"
                    style={{ background: '#fff', border: '1px solid #DDD5C8', color: '#4A3728' }}
                  />
                  <button
                    onClick={() => downloadText(study.pgn, `${study.topic || 'study'}.pgn`)}
                    className="w-full mt-2 py-2 text-xs font-bold rounded-xl"
                    style={{ background: 'linear-gradient(135deg,#FACF47,#E17846)', color: '#1C1917', border: 'none', cursor: 'pointer' }}
                  >
                    ⬇ Download PGN
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </aside>
    </div>
  );
}
