export default function Header() {
  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
      <div className="px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-3xl leading-none select-none">♟</span>
          <div>
            <h1 className="text-lg font-bold text-gray-900 leading-tight">PDF to PGN</h1>
            <p className="text-xs text-gray-400 leading-tight">Chess Position Extractor</p>
          </div>
        </div>
      </div>
    </header>
  );
}
