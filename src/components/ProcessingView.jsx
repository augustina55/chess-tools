function fmtTime(secs) {
  if (secs == null || secs < 0) return null;
  if (secs < 60) return `${secs}s`;
  return `${Math.floor(secs / 60)}m ${secs % 60}s`;
}

export default function ProcessingView({ progress }) {
  const { current, total, message, elapsed, eta } = progress;
  const pct = total > 0 ? Math.min(Math.round((current / total) * 100), 99) : 0;

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-10 text-center space-y-7 shadow-sm">
      <div className="flex justify-center gap-2 text-3xl animate-pulse">
        <span>♜</span>
        <span className="animate-bounce delay-75">♞</span>
        <span>♝</span>
        <span className="animate-bounce delay-150">♛</span>
        <span>♚</span>
      </div>

      <div className="space-y-1.5">
        <p className="text-xl font-semibold text-gray-900">Extracting Chess Positions</p>
        <p className="text-sm text-gray-400 min-h-[1.25rem] truncate px-4">
          {message || 'Preparing…'}
        </p>
      </div>

      <div className="space-y-2 max-w-sm mx-auto">
        <div className="flex justify-between text-xs text-gray-400">
          <span>{current} / {total || '?'} images</span>
          <span>{pct}%</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
          <div
            className="bg-green-500 h-2 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${total > 0 ? pct : 30}%` }}
          />
        </div>

        {/* Timing row */}
        <div className="flex justify-between text-xs text-gray-400 pt-0.5">
          <span>Elapsed: {fmtTime(elapsed) ?? '—'}</span>
          {current >= total
            ? <span className="text-green-600 font-medium">Finishing up…</span>
            : eta != null && eta > 0
              ? <span className="text-green-600 font-medium">~{fmtTime(eta)} remaining</span>
              : <span>Estimating…</span>
          }
        </div>
      </div>

      <p className="text-xs text-gray-400">
        ChessVision scans each image — large PDFs may take a moment
      </p>
    </div>
  );
}
