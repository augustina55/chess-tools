const PIECE_IMG = {
  K: '/pieces/wK.svg', Q: '/pieces/wQ.svg', R: '/pieces/wR.svg',
  B: '/pieces/wB.svg', N: '/pieces/wN.svg', P: '/pieces/wP.svg',
  k: '/pieces/bK.svg', q: '/pieces/bQ.svg', r: '/pieces/bR.svg',
  b: '/pieces/bB.svg', n: '/pieces/bN.svg', p: '/pieces/bP.svg',
};

const FILES = ['a','b','c','d','e','f','g','h'];
const RANKS = ['8','7','6','5','4','3','2','1'];

const C = {
  border:  '#E8E0D0',
  surface: '#F5EFE6',
  gold:    '#FACF47',
  goldDim: '#D1AB41',
  muted:   '#6b5f58',
  dim:     '#a89890',
  text:    '#262322',
};

function parseFen(fen) {
  return fen.split(' ')[0].split('/').map(row => {
    const squares = [];
    for (const ch of row) {
      const n = parseInt(ch);
      if (isNaN(n)) squares.push(ch);
      else for (let i = 0; i < n; i++) squares.push(null);
    }
    return squares;
  });
}

function ChessBoard({ fen }) {
  let board;
  try { board = parseFen(fen); }
  catch { return <p className="text-xs p-3" style={{ color: '#ef4444' }}>Invalid FEN</p>; }

  return (
    <div className="select-none">
      <div className="flex items-stretch">
        <div className="flex flex-col justify-around mr-1 py-px" style={{ width: 14 }}>
          {RANKS.map(r => (
            <div key={r} className="text-center text-[10px] font-semibold leading-none" style={{ color: C.dim }}>{r}</div>
          ))}
        </div>
        <div
          className="flex-1 rounded overflow-hidden"
          style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', aspectRatio: '1/1', border: `1px solid ${C.border}` }}
        >
          {board.map((row, ri) =>
            row.map((piece, ci) => (
              <div
                key={`${ri}-${ci}`}
                style={{
                  backgroundColor: (ri + ci) % 2 === 0 ? '#eeeed2' : '#769656',
                  aspectRatio: '1/1',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  padding: '4%',
                }}
              >
                {piece && (
                  <img src={PIECE_IMG[piece]} alt={piece} style={{ width: '100%', height: '100%', display: 'block' }} draggable={false} />
                )}
              </div>
            ))
          )}
        </div>
      </div>
      <div className="flex ml-4 mt-0.5">
        {FILES.map(f => (
          <div key={f} className="flex-1 text-center text-[10px] font-semibold" style={{ color: C.dim }}>{f}</div>
        ))}
      </div>
    </div>
  );
}

export default function BoardPreview({ fen, label }) {
  const [copied, setCopied] = useState(false);

  if (!fen) {
    return (
      <div className="rounded-2xl p-8 text-center" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
        <div className="text-5xl mb-3 opacity-20" style={{ color: C.goldDim }}>♟</div>
        <p className="text-sm" style={{ color: C.dim }}>Click any position to preview the board</p>
      </div>
    );
  }

  const copy = async () => {
    await navigator.clipboard.writeText(fen);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-2xl overflow-hidden shadow-sm" style={{ background: '#fff', border: `1px solid ${C.border}` }}>
      <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: `1px solid ${C.border}`, background: C.surface }}>
        <span className="text-sm font-semibold truncate" style={{ color: C.text }}>{label || 'Board Preview'}</span>
        <a
          href={`https://lichess.org/analysis/${encodeURIComponent(fen)}`}
          target="_blank" rel="noopener noreferrer"
          className="text-xs font-medium flex-shrink-0 ml-2 transition-colors"
          style={{ color: C.goldDim }}
        >
          Lichess ↗
        </a>
      </div>

      <div className="p-4">
        <ChessBoard fen={fen} />
      </div>

      <div className="px-4 pb-4 space-y-2">
        <p className="text-[11px] font-mono break-all leading-relaxed rounded-lg p-2.5" style={{ color: C.muted, background: C.surface, border: `1px solid ${C.border}` }}>
          {fen}
        </p>
        <button
          onClick={copy}
          className="w-full text-xs py-1.5 rounded-lg font-medium transition-all"
          style={{ background: C.surface, border: `1px solid ${C.border}`, color: C.muted }}
        >
          {copied ? '✓ Copied' : 'Copy FEN'}
        </button>
      </div>
    </div>
  );
}

// useState needed for copy button
import { useState } from 'react';
