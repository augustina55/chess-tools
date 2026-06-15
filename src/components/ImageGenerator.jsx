import { useState, useRef } from 'react';
import { Chessboard } from 'react-chessboard';
import { Chess } from 'chess.js';

// ── Constants ─────────────────────────────────────────────────────────────────

const CARD_WIDTH = 800;

const PATTERN_COLORS = [
  { bg: '#2563EB', light: '#EFF6FF', border: '#2563EB' },
  { bg: '#7C3AED', light: '#F5F3FF', border: '#7C3AED' },
  { bg: '#059669', light: '#ECFDF5', border: '#059669' },
];

const TAGLINE_COLORS = ['#1D4ED8', '#16A34A', '#DC2626', '#7C3AED', '#D97706'];

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

function isValidFen(fen) {
  if (!fen) return false;
  try { new Chess(fen); return true; } catch { return false; }
}

// ── Board inside card ─────────────────────────────────────────────────────────

function CardBoard({ fen, arrows, highlights, size }) {
  const sqStyles = {};
  for (const [sq, color] of Object.entries(highlights || {})) {
    sqStyles[sq] = { backgroundColor: color };
  }
  return (
    <Chessboard
      position={isValidFen(fen) ? fen : START_FEN}
      customArrows={arrows || []}
      customSquareStyles={sqStyles}
      arePiecesDraggable={false}
      boardWidth={size}
      customBoardStyle={{ borderRadius: 4, boxShadow: '0 2px 10px rgba(0,0,0,0.25)' }}
      customDarkSquareStyle={{ backgroundColor: '#769656' }}
      customLightSquareStyle={{ backgroundColor: '#eeeed2' }}
    />
  );
}

// ── Pattern card ──────────────────────────────────────────────────────────────

function PatternCard({ pattern, col }) {
  const boardSize = 175;
  return (
    <div style={{
      flex: 1,
      border: `2px solid ${col.border}`,
      borderRadius: 14,
      overflow: 'hidden',
      background: '#fff',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{
        background: col.bg,
        padding: '9px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        flexShrink: 0,
      }}>
        <div style={{
          width: 30, height: 30,
          background: '#fff',
          color: col.bg,
          borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 900, fontSize: 16, flexShrink: 0,
        }}>
          {pattern.number}
        </div>
        <span style={{ fontWeight: 900, fontSize: 13, letterSpacing: 1, color: '#fff' }}>
          {pattern.name?.toUpperCase()}
        </span>
        <span style={{ marginLeft: 'auto', fontSize: 18 }}>🏆</span>
      </div>

      {/* Description */}
      <div style={{ padding: '10px 14px 8px', fontSize: 12, fontWeight: 700, textAlign: 'center', color: '#1F2937' }}>
        {pattern.description}
      </div>

      {/* Board + caption */}
      <div style={{ display: 'flex', gap: 0, padding: '0 10px 8px', alignItems: 'flex-start' }}>
        <div style={{ flexShrink: 0 }}>
          <div style={{
            background: '#3B82F6', color: '#fff', fontSize: 10, fontWeight: 800,
            padding: '2px 7px', letterSpacing: 1, borderRadius: 3, marginBottom: 4, display: 'inline-block',
          }}>POSITION</div>
          <CardBoard fen={pattern.fen} arrows={pattern.arrows} highlights={pattern.highlights} size={boardSize} />
        </div>

        <div style={{ flex: 1, padding: '0 0 0 10px', display: 'flex', flexDirection: 'column' }}>
          <div style={{
            background: col.bg, color: '#fff', fontSize: 10, fontWeight: 800,
            padding: '2px 7px', letterSpacing: 1, borderRadius: 3, marginBottom: 10, display: 'inline-block',
          }}>EXPLANATION</div>
          <div style={{
            fontSize: 15, fontWeight: 900, color: '#1F2937', lineHeight: 1.35,
            fontFamily: '"Arial Black", Arial, sans-serif',
          }}>
            {pattern.caption}
          </div>
        </div>
      </div>

      {/* Idea */}
      <div style={{
        margin: '0 10px 12px',
        background: col.light,
        border: `1px solid ${col.border}22`,
        borderRadius: 8,
        padding: '8px 10px',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 8,
      }}>
        <span style={{
          background: '#3B82F6', color: '#fff', fontWeight: 800, fontSize: 11,
          padding: '2px 6px', borderRadius: 4, flexShrink: 0, whiteSpace: 'nowrap',
        }}>IDEA:</span>
        <span style={{ fontSize: 12, color: '#1F2937', lineHeight: 1.5, fontFamily: 'Arial, sans-serif', fontWeight: 600 }}>
          {pattern.idea}
        </span>
      </div>
    </div>
  );
}

// ── The renderable lesson card ────────────────────────────────────────────────

function LessonCard({ lesson, innerRef }) {
  const { title = 'CHESS LESSON', subtitle = '', patterns = [], generalIdea = [], bonusTips = [], tagline = '' } = lesson;

  // Split title roughly in half for blue/red coloring
  const words = title.trim().split(/\s+/);
  const half = Math.ceil(words.length / 2);
  const blueWords = words.slice(0, half).join(' ');
  const redWords = words.slice(half).join(' ');

  // Tagline parts split by '. '
  const tagParts = tagline.split(/\.\s*/).filter(Boolean);

  return (
    <div ref={innerRef} style={{
      width: CARD_WIDTH,
      background: '#FFFFFF',
      fontFamily: '"Arial Black", Arial, sans-serif',
      padding: '20px 22px 18px',
      boxSizing: 'border-box',
      boxShadow: '0 8px 40px rgba(0,0,0,0.15)',
    }}>

      {/* ── Logos ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 34, height: 34,
            background: 'linear-gradient(135deg,#FACF47,#E17846)',
            borderRadius: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 20, boxShadow: '0 2px 8px rgba(250,207,71,0.4)',
          }}>♟</div>
          <div style={{ lineHeight: 1.2 }}>
            <span style={{ fontWeight: 900, fontSize: 15, color: '#1C1917' }}>Circle</span>
            <span style={{ fontWeight: 900, fontSize: 15, color: '#E17846' }}>Chess</span>
            <div style={{ fontSize: 9, color: '#9a8070', fontWeight: 600, letterSpacing: 1 }}>CHESS TOOLS</div>
          </div>
        </div>
        <div style={{ textAlign: 'right', fontFamily: 'Arial, sans-serif' }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: '#4B5563' }}>Caissa</div>
          <div style={{ fontSize: 12, fontWeight: 800, color: '#4B5563' }}>School of Chess</div>
        </div>
      </div>

      {/* ── Title ── */}
      <div style={{ textAlign: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: 38, fontWeight: 900, lineHeight: 1.1, letterSpacing: 1, marginBottom: 10 }}>
          <span style={{ color: '#1D4ED8' }}>{blueWords} </span>
          {redWords && <span style={{ color: '#DC2626' }}>{redWords}</span>}
        </div>
        <div style={{
          background: 'linear-gradient(135deg,#16A34A,#059669)',
          color: '#fff',
          fontWeight: 900,
          fontSize: 13,
          padding: '8px 24px',
          borderRadius: 8,
          display: 'inline-block',
          letterSpacing: 1,
          boxShadow: '0 4px 12px rgba(22,163,74,0.35)',
        }}>
          🏆 {subtitle.toUpperCase()} 🏆
        </div>
      </div>

      {/* ── Pattern cards ── */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
        {patterns.map((p, i) => (
          <PatternCard key={i} pattern={p} col={PATTERN_COLORS[i % PATTERN_COLORS.length]} />
        ))}
      </div>

      {/* ── General Idea + Bonus Tips ── */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
        {/* General Idea */}
        <div style={{
          flex: 1,
          background: '#F0FDF4',
          border: '2px solid #16A34A',
          borderRadius: 12,
          padding: '12px 14px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <span style={{ fontSize: 20 }}>💡</span>
            <span style={{ fontWeight: 900, color: '#15803D', fontSize: 13, letterSpacing: 1 }}>GENERAL IDEA</span>
          </div>
          {generalIdea.map((item, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 7, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 13, flexShrink: 0 }}>🎯</span>
              <span style={{ fontSize: 12, color: '#1F2937', fontFamily: 'Arial, sans-serif', fontWeight: 600, lineHeight: 1.4 }}>{item}</span>
            </div>
          ))}
        </div>

        {/* Bonus Tips */}
        <div style={{
          flex: 1,
          background: '#FFF0F9',
          border: '2px solid #DB2777',
          borderRadius: 12,
          padding: '12px 14px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <span style={{ fontSize: 20 }}>⭐</span>
            <span style={{ fontWeight: 900, color: '#BE185D', fontSize: 13, letterSpacing: 1 }}>BONUS TIPS</span>
          </div>
          {bonusTips.map((tip, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 7, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 13, color: '#16A34A', flexShrink: 0 }}>✅</span>
              <span style={{ fontSize: 12, color: '#1F2937', fontFamily: 'Arial, sans-serif', fontWeight: 600, lineHeight: 1.4 }}>{tip}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Remember banner ── */}
      <div style={{
        background: 'linear-gradient(135deg,#1E3A8A,#3B82F6)',
        borderRadius: 10,
        padding: '10px 18px',
        marginBottom: 12,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        color: '#fff',
      }}>
        <span style={{ fontSize: 22 }}>🛡️</span>
        <div>
          <div style={{ fontWeight: 900, fontSize: 12, letterSpacing: 1, marginBottom: 3 }}>REMEMBER</div>
          <div style={{ fontFamily: 'Arial, sans-serif', fontSize: 12, fontWeight: 600, display: 'flex', gap: 16 }}>
            {['Learn the patterns.', 'Understand the ideas.', 'Use them in your games!'].map((t, i) => (
              <span key={i}>✅ {t}</span>
            ))}
          </div>
        </div>
      </div>

      {/* ── Tagline ── */}
      <div style={{
        textAlign: 'center',
        background: '#FFFBEB',
        borderRadius: 10,
        padding: '12px 16px',
        border: '1px solid #FDE68A',
      }}>
        <span style={{ fontSize: 22, marginRight: 8 }}>👑</span>
        {tagParts.map((part, i) => (
          <span key={i} style={{ fontWeight: 900, fontSize: 18, color: TAGLINE_COLORS[i % TAGLINE_COLORS.length] }}>
            {part}{i < tagParts.length - 1 ? '. ' : ''}
          </span>
        ))}
        <span style={{ fontSize: 22, marginLeft: 8 }}>♚</span>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function ImageGenerator() {
  const [topic, setTopic]   = useState('');
  const [pgn, setPgn]       = useState('');
  const [status, setStatus] = useState('idle');
  const [lesson, setLesson] = useState(null);
  const [errMsg, setErrMsg] = useState('');
  const cardRef = useRef(null);

  const isLoading  = status === 'loading';
  const canGenerate = topic.trim().length > 0 && !isLoading;

  const generate = async () => {
    if (!canGenerate) return;
    setStatus('loading');
    setLesson(null);
    setErrMsg('');
    try {
      const r = await fetch('/api/lesson-image/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: topic.trim(), pgn }),
      });
      if (!r.ok) { const e = await r.json(); throw new Error(e.error || `Error ${r.status}`); }
      const data = await r.json();
      setLesson(data);
      setStatus('done');
    } catch (err) {
      setErrMsg(err.message);
      setStatus('error');
    }
  };

  const download = async () => {
    const el = cardRef.current;
    if (!el || !lesson) return;
    try {
      const { toPng } = await import('html-to-image');
      const dataUrl = await toPng(el, {
        pixelRatio: 2,
        backgroundColor: '#ffffff',
        cacheBust: true,
      });
      const a = document.createElement('a');
      a.download = `${lesson.title?.replace(/\s+/g, '_') || 'chess_lesson'}.png`;
      a.href = dataUrl;
      a.click();
    } catch (err) {
      console.error('Download failed:', err);
    }
  };

  return (
    <div className="flex h-full overflow-hidden">

      {/* ── Left panel ──────────────────────────────────────────────── */}
      <aside
        className="w-64 flex-shrink-0 flex flex-col overflow-y-auto"
        style={{ borderRight: '1px solid #DDD5C8', background: '#FAF8F4' }}
      >
        <div className="px-4 py-5 space-y-5 flex-1">

          <div>
            <h2 className="text-sm font-bold" style={{ color: '#1C1917' }}>Image Generator</h2>
            <p className="text-[11px] mt-0.5" style={{ color: '#6b5f58' }}>Topic + PGN → chess infographic</p>
          </div>

          {/* Topic */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest mb-1.5" style={{ color: '#9a8070' }}>Topic</p>
            <input
              type="text"
              value={topic}
              onChange={e => setTopic(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && generate()}
              placeholder="e.g. Checkmating Patterns"
              className="w-full px-3 py-2 text-sm rounded-lg outline-none"
              style={{ border: '1px solid #DDD5C8', background: '#fff', color: '#1C1917', fontFamily: 'inherit' }}
            />
          </div>

          {/* PGN */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest mb-1.5" style={{ color: '#9a8070' }}>
              PGN <span style={{ textTransform: 'none', fontWeight: 500, fontSize: 10 }}>(optional)</span>
            </p>
            <textarea
              value={pgn}
              onChange={e => setPgn(e.target.value)}
              placeholder="Paste PGN here for position-specific content…"
              rows={8}
              className="w-full px-3 py-2 text-xs rounded-lg outline-none resize-y"
              style={{ border: '1px solid #DDD5C8', background: '#fff', color: '#1C1917', fontFamily: 'monospace' }}
            />
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
              transition: 'all 0.2s',
            }}
          >
            {isLoading ? 'Generating…' : 'Generate Image'}
          </button>

          {/* Error */}
          {status === 'error' && (
            <div className="text-xs px-3 py-2 rounded-lg" style={{ background: 'rgba(220,38,38,0.08)', color: '#DC2626' }}>
              {errMsg}
            </div>
          )}

          {/* Download */}
          {lesson && (
            <button
              onClick={download}
              className="w-full py-2.5 text-sm font-bold rounded-xl"
              style={{
                border: '2px solid #FACF47',
                background: 'transparent',
                color: '#D1AB41',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              ⬇ Download PNG
            </button>
          )}

          {/* Tips */}
          <div className="mt-auto rounded-xl p-3 text-[11px] space-y-1.5"
            style={{ background: 'rgba(250,207,71,0.07)', color: '#78655A' }}>
            <p className="font-bold mb-1">Tips</p>
            <p>• Paste PGN for position-specific content</p>
            <p>• Topic name becomes the infographic title</p>
            <p>• Download exports at 2× resolution (1600px)</p>
            <p>• Works great for social media posts</p>
          </div>
        </div>
      </aside>

      {/* ── Center: preview ──────────────────────────────────────────── */}
      <main className="flex-1 overflow-auto" style={{ background: '#E5E2DC' }}>

        {/* Empty state */}
        {!lesson && !isLoading && (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <div className="text-5xl mb-4">🖼️</div>
            <h3 className="text-lg font-bold mb-2" style={{ color: '#1C1917' }}>Chess Lesson Image Generator</h3>
            <p className="text-sm max-w-xs" style={{ color: '#6b5f58' }}>
              Enter a chess topic (and optional PGN) — GPT-4o generates a beautiful teaching
              infographic with positions, patterns, and tips, ready to download as PNG.
            </p>
            <div className="mt-6 flex gap-3">
              {['Enter Topic', 'Add PGN', 'Download PNG'].map((s, i) => (
                <div key={s} className="rounded-xl px-4 py-3 text-center" style={{ background: 'rgba(250,207,71,0.12)' }}>
                  <div className="text-lg font-bold mb-1" style={{ color: '#FACF47' }}>{i + 1}</div>
                  <div className="text-[11px] font-semibold" style={{ color: '#78655A' }}>{s}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center h-full">
            <div className="w-10 h-10 border-4 rounded-full animate-spin mb-4"
              style={{ borderColor: '#FACF47', borderTopColor: 'transparent' }} />
            <p className="text-sm font-semibold" style={{ color: '#78655A' }}>Generating lesson…</p>
          </div>
        )}

        {/* Card preview */}
        {lesson && (
          <div className="flex flex-col items-center py-6 px-4 gap-4">
            {/* Top toolbar */}
            <div className="flex gap-3 self-end mr-2">
              <button
                onClick={download}
                className="text-sm font-bold px-5 py-2 rounded-xl"
                style={{
                  background: 'linear-gradient(135deg,#FACF47,#E17846)',
                  color: '#1C1917',
                  border: 'none',
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(250,207,71,0.35)',
                }}
              >
                ⬇ Download PNG
              </button>
              <button
                onClick={generate}
                className="text-sm font-semibold px-5 py-2 rounded-xl"
                style={{ background: '#fff', color: '#78655A', border: '1px solid #DDD5C8', cursor: 'pointer' }}
              >
                ↻ Regenerate
              </button>
            </div>

            {/* The card */}
            <LessonCard lesson={lesson} innerRef={cardRef} />

            <p className="text-xs" style={{ color: '#9a8070' }}>
              Click "Download PNG" to save at 1600×2× resolution
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
