import { useState } from 'react';
import BoardPreview from './BoardPreview';

function downloadFile(content, filename) {
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
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
      className="text-xs px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 font-medium transition-colors border border-gray-200"
    >
      {copied ? '✓ Copied' : label}
    </button>
  );
}

export default function ResultsView({ results, onReset }) {
  const { diagrams, fenList, pgn, pageTexts, errors, total, imagesProcessed } = results;
  const hasText = pageTexts?.length > 0;

  const tabs = [
    { id: 'fen', label: `FEN List (${total})` },
    { id: 'pgn', label: 'PGN File' },
    ...(hasText ? [{ id: 'text', label: `Page Text (${pageTexts.length})` }] : []),
  ];

  const [tab, setTab] = useState('fen');
  const [selectedIdx, setSelectedIdx] = useState(0);
  const selectedDiagram = diagrams[selectedIdx] || null;

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-xl px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="text-2xl">✅</span>
          <div>
            <p className="font-semibold text-green-800 text-base">
              {total} chess position{total !== 1 ? 's' : ''} extracted
              {hasText && ` · ${pageTexts.length} page${pageTexts.length !== 1 ? 's' : ''} of text`}
            </p>
            <p className="text-xs text-gray-500">
              from {imagesProcessed} image{imagesProcessed !== 1 ? 's' : ''}
              {errors?.length > 0 && (
                <span className="text-amber-500 ml-2">· {errors.length} had errors</span>
              )}
            </p>
          </div>
        </div>
        <button
          onClick={onReset}
          className="px-4 py-2 rounded-lg bg-white hover:bg-gray-50 text-sm text-gray-600 hover:text-gray-900 transition-colors border border-gray-200 shadow-sm"
        >
          ← New Upload
        </button>
      </div>

      {total === 0 && !hasText ? (
        <div className="bg-white border border-gray-200 rounded-xl p-10 text-center space-y-3 shadow-sm">
          <p className="text-4xl">🔍</p>
          <p className="font-semibold text-gray-700">No chess diagrams found</p>
          <p className="text-sm text-gray-400 max-w-sm mx-auto">
            Try a page that contains a printed chess board diagram.
          </p>
        </div>
      ) : (
        <div className="flex gap-5 items-start">
          {/* ── Left panel ── */}
          <div className="flex-1 min-w-0 bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
            {/* Tab bar */}
            <div className="flex border-b border-gray-200 bg-gray-50">
              {tabs.map(t => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`px-5 py-3.5 text-sm font-medium transition-colors border-b-2 whitespace-nowrap ${
                    tab === t.id
                      ? 'text-green-700 border-green-500 bg-white'
                      : 'text-gray-500 hover:text-gray-700 border-transparent'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="p-4">
              {/* ── FEN tab ── */}
              {tab === 'fen' && (
                <div className="space-y-3">
                  <div className="space-y-1.5 max-h-[520px] overflow-y-auto pr-1">
                    {diagrams.map((d, i) => (
                      <button
                        key={i}
                        onClick={() => setSelectedIdx(i)}
                        className={`w-full text-left rounded-lg p-3.5 transition-all border ${
                          selectedIdx === i
                            ? 'bg-green-50 border-green-300 ring-1 ring-green-300'
                            : 'bg-gray-50 border-gray-100 hover:bg-gray-100 hover:border-gray-200'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className={`text-xs font-bold flex-shrink-0 ${selectedIdx === i ? 'text-green-600' : 'text-gray-400'}`}>
                              #{i + 1}
                            </span>
                            {d.description && (
                              <span className="text-xs text-gray-500 truncate">{d.description}</span>
                            )}
                          </div>
                          <span className={`text-xs font-medium flex-shrink-0 ${selectedIdx === i ? 'text-green-600' : 'text-gray-400'}`}>
                            {selectedIdx === i ? '● Preview' : 'Click to preview'}
                          </span>
                        </div>
                        <code className="block text-xs font-mono text-gray-600 break-all leading-relaxed">
                          {d.fen}
                        </code>
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2 pt-1 border-t border-gray-100">
                    <CopyButton text={fenList.join('\n')} label="Copy all FEN" />
                    <button
                      onClick={() => downloadFile(fenList.join('\n'), 'chess-positions.txt')}
                      className="text-xs px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 font-medium transition-colors border border-gray-200"
                    >
                      Download .txt
                    </button>
                  </div>
                </div>
              )}

              {/* ── PGN tab ── */}
              {tab === 'pgn' && (
                <div className="space-y-3">
                  <p className="text-xs text-gray-400">
                    Each position is a separate game entry — importable into ChessBase, Lichess, chess.com
                  </p>
                  <textarea
                    readOnly
                    value={pgn}
                    className="w-full h-[440px] bg-gray-50 text-gray-700 text-xs font-mono p-4 rounded-lg resize-none border border-gray-200 focus:outline-none focus:border-green-400"
                    spellCheck={false}
                  />
                  <div className="flex gap-2">
                    <CopyButton text={pgn} label="Copy PGN" />
                    <button
                      onClick={() => downloadFile(pgn, 'chess-positions.pgn')}
                      className="text-xs px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-500 text-white font-semibold transition-colors shadow-sm"
                    >
                      Download .pgn
                    </button>
                  </div>
                </div>
              )}

              {/* ── Text tab ── */}
              {tab === 'text' && hasText && (
                <div className="space-y-4">
                  <div className="max-h-[520px] overflow-y-auto space-y-4 pr-1">
                    {pageTexts.map((pt, i) => (
                      <div key={i} className="rounded-lg border border-gray-200 overflow-hidden">
                        <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 flex items-center justify-between">
                          <span className="text-xs font-semibold text-gray-600">{pt.label}</span>
                          <CopyButton text={pt.text} label="Copy" />
                        </div>
                        <p className="text-sm text-gray-700 leading-relaxed p-4 whitespace-pre-wrap">
                          {pt.text || <span className="text-gray-400 italic">No text found on this page</span>}
                        </p>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2 pt-1 border-t border-gray-100">
                    <CopyButton
                      text={pageTexts.map(pt => `--- ${pt.label} ---\n${pt.text}`).join('\n\n')}
                      label="Copy all text"
                    />
                    <button
                      onClick={() => downloadFile(
                        pageTexts.map(pt => `--- ${pt.label} ---\n${pt.text}`).join('\n\n'),
                        'pdf-text.txt'
                      )}
                      className="text-xs px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 font-medium transition-colors border border-gray-200"
                    >
                      Download .txt
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Right: Board preview (sticky) ── */}
          <div className="w-[358px] flex-shrink-0 sticky top-20">
            <BoardPreview
              fen={selectedDiagram?.fen}
              label={selectedDiagram?.description}
            />
          </div>
        </div>
      )}

      {/* Errors */}
      {errors?.length > 0 && (
        <details className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <summary className="text-sm text-amber-600 cursor-pointer font-medium">
            {errors.length} processing error{errors.length !== 1 ? 's' : ''} (click to expand)
          </summary>
          <ul className="mt-3 space-y-1.5">
            {errors.map((e, i) => (
              <li key={i} className="text-xs text-gray-500 flex gap-2">
                <span className="text-amber-500 flex-shrink-0">Image {e.image}:</span>
                <span>{e.error}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
