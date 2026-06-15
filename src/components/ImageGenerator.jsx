import { useState, useRef } from 'react';
import { Chessboard } from 'react-chessboard';
import { Chess } from 'chess.js';

// ── Constants ─────────────────────────────────────────────────────────────────

const CARD_SIZE = 1500; // square output: 1500 × 1500 px

const PATTERN_COLORS = [
  { bg: '#2563EB', light: '#EFF6FF' },
  { bg: '#7C3AED', light: '#F5F3FF' },
  { bg: '#059669', light: '#ECFDF5' },
];

const TAGLINE_COLORS = ['#1D4ED8', '#16A34A', '#DC2626', '#7C3AED', '#D97706'];

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

function isValidFen(fen) {
  if (!fen) return false;
  try { new Chess(fen); return true; } catch { return false; }
}

// ── Board inside card ─────────────────────────────────────────────────────────

function CardBoard({ fen, arrows, highlights, size }) {
  const sq = {};
  for (const [s, c] of Object.entries(highlights || {})) sq[s] = { backgroundColor: c };
  return (
    <Chessboard
      position={isValidFen(fen) ? fen : START_FEN}
      customArrows={arrows || []}
      customSquareStyles={sq}
      arePiecesDraggable={false}
      boardWidth={size}
      customBoardStyle={{ borderRadius: 6, boxShadow: '0 4px 16px rgba(0,0,0,0.25)' }}
      customDarkSquareStyle={{ backgroundColor: '#769656' }}
      customLightSquareStyle={{ backgroundColor: '#eeeed2' }}
    />
  );
}

// ── Pattern card ──────────────────────────────────────────────────────────────

function PatternCard({ pattern, col, boardSize }) {
  return (
    <div style={{
      flex: 1,
      border: `3px solid ${col.bg}`,
      borderRadius: 18,
      overflow: 'hidden',
      background: '#fff',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{ background: col.bg, padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{
          width: 38, height: 38,
          background: '#fff',
          color: col.bg,
          borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 900, fontSize: 20, flexShrink: 0,
        }}>
          {pattern.number}
        </div>
        <span style={{ fontWeight: 900, fontSize: 18, letterSpacing: 1.5, color: '#fff' }}>
          {pattern.name?.toUpperCase()}
        </span>
        <span style={{ marginLeft: 'auto', fontSize: 24 }}>🏆</span>
      </div>

      {/* Description */}
      <div style={{ padding: '14px 20px 10px', fontSize: 15, fontWeight: 700, textAlign: 'center', color: '#1F2937', lineHeight: 1.4 }}>
        {pattern.description}
      </div>

      {/* Board + Caption */}
      <div style={{ display: 'flex', alignItems: 'flex-start', padding: '0 16px 12px', gap: 16 }}>
        <div>
          <div style={{
            background: '#3B82F6', color: '#fff', fontSize: 12, fontWeight: 800,
            padding: '3px 10px', letterSpacing: 1.5, borderRadius: 4, marginBottom: 6, display: 'inline-block',
          }}>POSITION</div>
          <CardBoard fen={pattern.fen} arrows={pattern.arrows} highlights={pattern.highlights} size={boardSize} />
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', paddingTop: 4 }}>
          <div style={{
            background: col.bg, color: '#fff', fontSize: 12, fontWeight: 800,
            padding: '3px 10px', letterSpacing: 1.5, borderRadius: 4, marginBottom: 14, display: 'inline-block',
          }}>EXPLANATION</div>
          <div style={{ fontSize: 20, fontWeight: 900, color: '#1F2937', lineHeight: 1.3, fontFamily: '"Arial Black", Arial, sans-serif' }}>
            {pattern.caption}
          </div>
        </div>
      </div>

      {/* Idea */}
      <div style={{
        margin: '0 14px 16px',
        background: col.light,
        border: `1.5px solid ${col.bg}33`,
        borderRadius: 10,
        padding: '10px 14px',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
      }}>
        <span style={{
          background: '#3B82F6', color: '#fff', fontWeight: 800, fontSize: 13,
          padding: '3px 8px', borderRadius: 5, flexShrink: 0, whiteSpace: 'nowrap',
        }}>IDEA:</span>
        <span style={{ fontSize: 14, color: '#1F2937', lineHeight: 1.55, fontFamily: 'Arial, sans-serif', fontWeight: 600 }}>
          {pattern.idea}
        </span>
      </div>
    </div>
  );
}

// ── The 1500×1500 lesson card ─────────────────────────────────────────────────

function LessonCard({ lesson, innerRef }) {
  const { title = 'CHESS LESSON', subtitle = '', patterns = [], generalIdea = [], bonusTips = [], tagline = '' } = lesson;

  const words  = title.trim().split(/\s+/);
  const half   = Math.ceil(words.length / 2);
  const blue   = words.slice(0, half).join(' ');
  const red    = words.slice(half).join(' ');
  const tags   = tagline.split(/\.\s*/).filter(Boolean);

  // Board size: each pattern card is roughly (1500 - 60 padding - gaps) / numPatterns wide
  // At 2 patterns: ~700px per card → board ~310px; at 3 patterns: ~460px → board ~210px
  const n         = patterns.length || 2;
  const cardInner = CARD_SIZE - 60; // 30px padding each side
  const perCard   = (cardInner - (n - 1) * 14) / n;
  const boardSize = Math.round(Math.min(perCard * 0.46, 320));

  return (
    <div
      ref={innerRef}
      style={{
        width: CARD_SIZE,
        height: CARD_SIZE,
        background: '#FFFFFF',
        fontFamily: '"Arial Black", Arial, sans-serif',
        padding: '30px 30px',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* ── Logos ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 48, height: 48,
            background: 'linear-gradient(135deg,#FACF47,#E17846)',
            borderRadius: 12,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 28, boxShadow: '0 3px 10px rgba(250,207,71,0.4)',
          }}>♟</div>
          <div style={{ lineHeight: 1.2 }}>
            <span style={{ fontWeight: 900, fontSize: 22, color: '#1C1917' }}>Circle</span>
            <span style={{ fontWeight: 900, fontSize: 22, color: '#E17846' }}>Chess</span>
            <div style={{ fontSize: 11, color: '#9a8070', fontWeight: 600, letterSpacing: 2 }}>CHESS TOOLS</div>
          </div>
        </div>
        <div style={{ textAlign: 'right', fontFamily: 'Arial, sans-serif' }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#4B5563' }}>Caissa</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#4B5563' }}>School of Chess</div>
        </div>
      </div>

      {/* ── Title ── */}
      <div style={{ textAlign: 'center', marginBottom: 18 }}>
        <div style={{ fontSize: 62, fontWeight: 900, lineHeight: 1.05, letterSpacing: 2, marginBottom: 14 }}>
          <span style={{ color: '#1D4ED8' }}>{blue} </span>
          {red && <span style={{ color: '#DC2626' }}>{red}</span>}
        </div>
        <div style={{
          background: 'linear-gradient(135deg,#16A34A,#059669)',
          color: '#fff',
          fontWeight: 900,
          fontSize: 18,
          padding: '10px 32px',
          borderRadius: 10,
          display: 'inline-block',
          letterSpacing: 1.5,
          boxShadow: '0 6px 18px rgba(22,163,74,0.35)',
        }}>
          🏆 {subtitle.toUpperCase()} 🏆
        </div>
      </div>

      {/* ── Pattern cards ── */}
      <div style={{ display: 'flex', gap: 14, marginBottom: 16, flex: '0 0 auto' }}>
        {patterns.map((p, i) => (
          <PatternCard key={i} pattern={p} col={PATTERN_COLORS[i % PATTERN_COLORS.length]} boardSize={boardSize} />
        ))}
      </div>

      {/* ── General Idea + Bonus Tips ── */}
      <div style={{ display: 'flex', gap: 14, marginBottom: 16, flex: '1 1 auto', minHeight: 0 }}>
        {/* General Idea */}
        <div style={{
          flex: 1,
          background: '#F0FDF4',
          border: '2.5px solid #16A34A',
          borderRadius: 16,
          padding: '16px 18px',
          overflow: 'hidden',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <span style={{ fontSize: 26 }}>💡</span>
            <span style={{ fontWeight: 900, color: '#15803D', fontSize: 17, letterSpacing: 1.5 }}>GENERAL IDEA</span>
          </div>
          {generalIdea.slice(0, 5).map((item, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 10, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 16, flexShrink: 0 }}>🎯</span>
              <span style={{ fontSize: 14, color: '#1F2937', fontFamily: 'Arial, sans-serif', fontWeight: 600, lineHeight: 1.45 }}>{item}</span>
            </div>
          ))}
        </div>

        {/* Bonus Tips */}
        <div style={{
          flex: 1,
          background: '#FFF0F9',
          border: '2.5px solid #DB2777',
          borderRadius: 16,
          padding: '16px 18px',
          overflow: 'hidden',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <span style={{ fontSize: 26 }}>⭐</span>
            <span style={{ fontWeight: 900, color: '#BE185D', fontSize: 17, letterSpacing: 1.5 }}>BONUS TIPS</span>
          </div>
          {bonusTips.slice(0, 5).map((tip, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 10, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 16, color: '#16A34A', flexShrink: 0 }}>✅</span>
              <span style={{ fontSize: 14, color: '#1F2937', fontFamily: 'Arial, sans-serif', fontWeight: 600, lineHeight: 1.45 }}>{tip}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Remember banner ── */}
      <div style={{
        background: 'linear-gradient(135deg,#1E3A8A,#3B82F6)',
        borderRadius: 14,
        padding: '14px 22px',
        marginBottom: 14,
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        color: '#fff',
        flexShrink: 0,
      }}>
        <span style={{ fontSize: 28 }}>🛡️</span>
        <div>
          <div style={{ fontWeight: 900, fontSize: 14, letterSpacing: 2, marginBottom: 6 }}>REMEMBER</div>
          <div style={{ fontFamily: 'Arial, sans-serif', fontSize: 14, fontWeight: 600, display: 'flex', gap: 20, flexWrap: 'wrap' }}>
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
        borderRadius: 14,
        padding: '16px',
        border: '2px solid #FDE68A',
        flexShrink: 0,
      }}>
        <span style={{ fontSize: 30, marginRight: 10 }}>👑</span>
        {tags.map((part, i) => (
          <span key={i} style={{ fontWeight: 900, fontSize: 24, color: TAGLINE_COLORS[i % TAGLINE_COLORS.length] }}>
            {part}{i < tags.length - 1 ? '. ' : ''}
          </span>
        ))}
        <span style={{ fontSize: 30, marginLeft: 10 }}>♚</span>
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

  const isLoading   = status === 'loading';
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
      setLesson(await r.json());
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
        pixelRatio: 1,          // 1× = exactly 1500×1500 px
        backgroundColor: '#ffffff',
        cacheBust: true,
        width: CARD_SIZE,
        height: CARD_SIZE,
      });
      const a = document.createElement('a');
      a.download = `${lesson.title?.replace(/\s+/g, '_') || 'chess_lesson'}.png`;
      a.href = dataUrl;
      a.click();
    } catch (err) {
      console.error('Download failed:', err);
    }
  };

  // Scale factor so card fits in the preview area (card is 1500px, preview ≈ 700-900px wide)
  const PREVIEW_SCALE = 0.52;

  return (
    <div className="flex h-full overflow-hidden">

      {/* ── Left panel ─────────────────────────────────────────── */}
      <aside
        className="w-64 flex-shrink-0 flex flex-col overflow-y-auto"
        style={{ borderRight: '1px solid #DDD5C8', background: '#FAF8F4' }}
      >
        <div className="px-4 py-5 space-y-5 flex-1 flex flex-col">

          <div>
            <h2 className="text-sm font-bold" style={{ color: '#1C1917' }}>Image Generator</h2>
            <p className="text-[11px] mt-0.5" style={{ color: '#6b5f58' }}>Topic + PGN → 1500×1500 infographic</p>
          </div>

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

          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest mb-1.5" style={{ color: '#9a8070' }}>
              PGN <span style={{ textTransform: 'none', fontWeight: 500, fontSize: 10 }}>(optional)</span>
            </p>
            <textarea
              value={pgn}
              onChange={e => setPgn(e.target.value)}
              placeholder="Paste PGN for position-specific content…"
              rows={8}
              className="w-full px-3 py-2 text-xs rounded-lg outline-none resize-y"
              style={{ border: '1px solid #DDD5C8', background: '#fff', color: '#1C1917', fontFamily: 'monospace' }}
            />
          </div>

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
            {isLoading ? 'Generating…' : 'Generate Image'}
          </button>

          {status === 'error' && (
            <div className="text-xs px-3 py-2 rounded-lg" style={{ background: 'rgba(220,38,38,0.08)', color: '#DC2626' }}>
              {errMsg}
            </div>
          )}

          {lesson && (
            <button
              onClick={download}
              className="w-full py-2.5 text-sm font-bold rounded-xl"
              style={{ border: '2px solid #FACF47', background: 'transparent', color: '#D1AB41', cursor: 'pointer' }}
            >
              ⬇ Download 1500×1500 PNG
            </button>
          )}

          <div className="mt-auto rounded-xl p-3 text-[11px] space-y-1.5" style={{ background: 'rgba(250,207,71,0.07)', color: '#78655A' }}>
            <p className="font-bold mb-1">Output</p>
            <p>• Fixed 1500 × 1500 px square</p>
            <p>• Perfect for Instagram posts</p>
            <p>• Paste PGN for real positions</p>
          </div>
        </div>
      </aside>

      {/* ── Center: preview ─────────────────────────────────────── */}
      <main className="flex-1 overflow-auto" style={{ background: '#E5E2DC' }}>

        {!lesson && !isLoading && (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <div className="text-5xl mb-4">🖼️</div>
            <h3 className="text-lg font-bold mb-2" style={{ color: '#1C1917' }}>Chess Lesson Image Generator</h3>
            <p className="text-sm max-w-xs" style={{ color: '#6b5f58' }}>
              Enter a topic + optional PGN → GPT-4o generates a 1500×1500 chess infographic ready for Instagram.
            </p>
          </div>
        )}

        {isLoading && (
          <div className="flex flex-col items-center justify-center h-full">
            <div className="w-10 h-10 border-4 rounded-full animate-spin mb-4"
              style={{ borderColor: '#FACF47', borderTopColor: 'transparent' }} />
            <p className="text-sm font-semibold" style={{ color: '#78655A' }}>Generating lesson…</p>
          </div>
        )}

        {lesson && (
          <div className="flex flex-col items-center py-6 px-4 gap-4">
            {/* Toolbar */}
            <div className="flex gap-3 self-end mr-2">
              <button onClick={download}
                className="text-sm font-bold px-5 py-2 rounded-xl"
                style={{ background: 'linear-gradient(135deg,#FACF47,#E17846)', color: '#1C1917', border: 'none', cursor: 'pointer', boxShadow: '0 4px 14px rgba(250,207,71,0.35)' }}>
                ⬇ Download PNG (1500×1500)
              </button>
              <button onClick={generate}
                className="text-sm font-semibold px-5 py-2 rounded-xl"
                style={{ background: '#fff', color: '#78655A', border: '1px solid #DDD5C8', cursor: 'pointer' }}>
                ↻ Regenerate
              </button>
            </div>

            {/* Scaled preview — card is 1500px, scaled to fit screen */}
            <div style={{
              width: CARD_SIZE * PREVIEW_SCALE,
              height: CARD_SIZE * PREVIEW_SCALE,
              flexShrink: 0,
              position: 'relative',
              overflow: 'hidden',
              borderRadius: 8,
              boxShadow: '0 8px 40px rgba(0,0,0,0.2)',
            }}>
              <div style={{
                position: 'absolute',
                top: 0, left: 0,
                transform: `scale(${PREVIEW_SCALE})`,
                transformOrigin: 'top left',
              }}>
                <LessonCard lesson={lesson} innerRef={cardRef} />
              </div>
            </div>

            <p className="text-xs" style={{ color: '#9a8070' }}>
              Preview scaled to {Math.round(PREVIEW_SCALE * 100)}% — download exports exactly 1500×1500 px
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
