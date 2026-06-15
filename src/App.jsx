import { useState } from 'react';
import Sidebar from './components/Sidebar';
import PdfToPgn from './components/PdfToPgn';
import PuzzleGenerator from './components/PuzzleGenerator';
import OpeningExplorer from './components/OpeningExplorer';
import CurriculumBuilder from './components/CurriculumBuilder';

export default function App() {
  const [page, setPage] = useState('pdf');
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="h-screen flex overflow-hidden font-sans" style={{ background: '#F1EDE4' }}>
      <Sidebar page={page} setPage={setPage} mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />

      <div className="flex-1 min-w-0 overflow-hidden flex flex-col">
        {/* Mobile top bar */}
        <div
          className="md:hidden flex items-center gap-3 px-4 py-3 flex-shrink-0"
          style={{ background: '#1C1917', borderBottom: '1px solid #2d2724' }}
        >
          <button
            onClick={() => setMobileOpen(true)}
            className="p-1.5 rounded-lg transition-colors"
            style={{ color: '#a89890' }}
            aria-label="Open menu"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16"/>
            </svg>
          </button>
          <span className="text-sm font-bold" style={{ color: '#FACF47' }}>
            Chess Tools
          </span>
          <span className="text-xs ml-1" style={{ color: '#6b5f58' }}>
            — {{ pdf: 'PDF to PGN', puzzles: 'Puzzle Generator', opening: 'Opening Explorer', curriculum: 'Curriculum Builder' }[page]}
          </span>
        </div>

        {/* Page content */}
        <div className="flex-1 min-h-0 overflow-hidden">
          {page === 'pdf'     && <PdfToPgn />}
          {page === 'puzzles' && <PuzzleGenerator />}
          {page === 'opening'     && <OpeningExplorer />}
          {page === 'curriculum'  && <CurriculumBuilder />}
        </div>
      </div>
    </div>
  );
}
