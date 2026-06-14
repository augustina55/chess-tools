import { useRef, useState, useCallback } from 'react';

const ACCEPTED = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];

function formatBytes(bytes) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FileIcon({ type }) {
  if (type === 'application/pdf') return <span className="text-red-500 font-bold">PDF</span>;
  return <span className="text-blue-500 font-bold">IMG</span>;
}

export default function UploadZone({ files, setFiles, mode, setMode, onProcess }) {
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

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    addFiles(e.dataTransfer.files);
  }, [addFiles]);

  const handleDragOver = (e) => { e.preventDefault(); setDragging(true); };
  const handleDragLeave = () => setDragging(false);
  const removeFile = (i) => setFiles(prev => prev.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`
          border-2 border-dashed rounded-2xl p-14 text-center cursor-pointer
          transition-all duration-200 select-none
          ${dragging
            ? 'border-green-400 bg-green-50 scale-[1.01]'
            : 'border-gray-300 hover:border-gray-400 bg-white hover:bg-gray-50'
          }
        `}
      >
        <div className="space-y-3 pointer-events-none">
          <div className="text-6xl">📄</div>
          <p className="text-xl font-semibold text-gray-800">
            Drop chess board images or PDFs here
          </p>
          <p className="text-sm text-gray-400">
            or <span className="text-green-600 font-medium">click to browse</span>
          </p>
          <div className="flex flex-wrap justify-center gap-2 pt-1">
            {['PDF', 'PNG', 'JPG', 'WEBP'].map(ext => (
              <span key={ext} className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded font-mono border border-gray-200">
                .{ext.toLowerCase()}
              </span>
            ))}
          </div>
          <p className="text-xs text-gray-400 pt-1">
            Multiple diagrams per page detected automatically
          </p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,image/*"
          multiple
          className="hidden"
          onChange={e => addFiles(e.target.files)}
        />
      </div>

      {/* File list */}
      {files.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50">
            <span className="text-sm font-medium text-gray-700">
              {files.length} file{files.length !== 1 ? 's' : ''} selected
            </span>
            <button
              onClick={() => setFiles([])}
              className="text-xs text-gray-400 hover:text-red-500 transition-colors"
            >
              Clear all
            </button>
          </div>
          <ul className="max-h-52 overflow-y-auto divide-y divide-gray-100">
            {files.map((file, i) => (
              <li key={i} className="flex items-center justify-between px-4 py-2.5 hover:bg-gray-50">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-xs font-bold font-mono w-8 flex-shrink-0">
                    <FileIcon type={file.type} />
                  </span>
                  <span className="text-sm text-gray-700 truncate">{file.name}</span>
                  <span className="text-xs text-gray-400 flex-shrink-0">{formatBytes(file.size)}</span>
                </div>
                <button
                  onClick={e => { e.stopPropagation(); removeFile(i); }}
                  className="ml-2 text-gray-300 hover:text-red-400 transition-colors text-xl leading-none flex-shrink-0"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Mode toggle — only relevant when a PDF is selected */}
      {files.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm space-y-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Extraction mode</p>
          <div className="flex gap-3">
            <button
              onClick={() => setMode('fen')}
              className={`flex-1 py-2.5 px-4 rounded-lg border text-sm font-medium transition-all ${
                mode === 'fen'
                  ? 'bg-green-600 border-green-600 text-white shadow-sm'
                  : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
              }`}
            >
              ♟ FEN Only
              <span className="block text-xs font-normal mt-0.5 opacity-75">Chess positions only</span>
            </button>
            <button
              onClick={() => setMode('text')}
              className={`flex-1 py-2.5 px-4 rounded-lg border text-sm font-medium transition-all ${
                mode === 'text'
                  ? 'bg-green-600 border-green-600 text-white shadow-sm'
                  : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300 ' + (!hasPdf ? 'opacity-40 cursor-not-allowed' : '')
              }`}
              disabled={!hasPdf}
              title={!hasPdf ? 'Text extraction requires a PDF file' : ''}
            >
              📄 FEN + Text
              <span className="block text-xs font-normal mt-0.5 opacity-75">
                {hasPdf ? 'Positions + page text' : 'PDF required'}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Extract button */}
      {files.length > 0 && (
        <button
          onClick={onProcess}
          className="w-full py-4 rounded-xl text-base font-semibold transition-all duration-200 bg-green-600 hover:bg-green-500 active:bg-green-700 text-white shadow-md shadow-green-200"
        >
          {mode === 'text' ? '📄' : '♟'} Extract {mode === 'text' ? 'FEN + Text' : 'Chess Positions'} from {files.length} file{files.length !== 1 ? 's' : ''} →
        </button>
      )}
    </div>
  );
}
