const NAV = [
  {
    id: 'pdf',
    label: 'PDF to PGN',
    sub: 'Extract positions',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-5 h-5 flex-shrink-0">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
      </svg>
    ),
  },
  {
    id: 'puzzles',
    label: 'Puzzle Generator',
    sub: 'Filter & export',
    icon: <span className="text-[20px] leading-none select-none flex-shrink-0">♞</span>,
  },
  {
    id: 'opening',
    label: 'Opening Explorer',
    sub: 'Variations & PGN',
    icon: <span className="text-[20px] leading-none select-none flex-shrink-0">♜</span>,
  },
  {
    id: 'curriculum',
    label: 'Curriculum Builder',
    sub: 'AI lesson from PDFs',
    icon: <span className="text-[20px] leading-none select-none flex-shrink-0">🎓</span>,
  },
  {
    id: 'imagegen',
    label: 'Image Generator',
    sub: 'Topic + PGN → infographic',
    icon: <span className="text-[20px] leading-none select-none flex-shrink-0">🖼️</span>,
  },
  {
    id: 'study',
    label: 'Study Generator',
    sub: 'Topic → annotated PGN',
    icon: <span className="text-[20px] leading-none select-none flex-shrink-0">📚</span>,
  },
];

function NavItems({ page, choose }) {
  return (
    <nav className="flex-1 px-3 py-4 space-y-0.5">
      <p className="px-3 pb-2 pt-1 text-[10px] font-semibold uppercase tracking-widest" style={{ color: '#6b5f58' }}>
        Tools
      </p>
      {NAV.map(item => {
        const active = page === item.id;
        return (
          <button
            key={item.id}
            onClick={() => choose(item.id)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all duration-150 group"
            style={{
              background: active ? 'rgba(250,207,71,0.15)' : 'transparent',
              color: active ? '#FACF47' : '#a89890',
            }}
            onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'rgba(250,207,71,0.07)'; }}
            onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
          >
            <span style={{ color: active ? '#FACF47' : '#6b5f58' }}>{item.icon}</span>
            <div className="min-w-0">
              <p className="text-sm font-semibold leading-tight" style={{ color: active ? '#FACF47' : '#FAF6EB' }}>
                {item.label}
              </p>
              <p className="text-[11px] leading-tight mt-0.5" style={{ color: active ? '#D1AB41' : '#6b5f58' }}>
                {item.sub}
              </p>
            </div>
            {active && (
              <span className="ml-auto w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: '#FACF47' }} />
            )}
          </button>
        );
      })}
    </nav>
  );
}

function SidebarContent({ page, choose }) {
  return (
    <div className="flex flex-col h-full" style={{ background: '#1C1917' }}>
      {/* Logo */}
      <div className="px-5 py-5" style={{ borderBottom: '1px solid #2d2724' }}>
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-base flex-shrink-0 font-bold"
            style={{ background: 'linear-gradient(135deg, #FACF47, #E17846)', boxShadow: '0 0 14px rgba(250,207,71,.3)' }}
          >
            ♟
          </div>
          <div>
            <p className="text-sm font-bold leading-tight" style={{ color: '#FACF47' }}>Chess Tools</p>
            <p className="text-[10px] leading-tight tracking-widest uppercase" style={{ color: '#6b5f58' }}>
              circlechess.com
            </p>
          </div>
        </div>
      </div>

      <NavItems page={page} choose={choose} />

      {/* Footer */}
      <div className="px-5 py-4" style={{ borderTop: '1px solid #2d2724' }}>
        <p className="text-[10px]" style={{ color: '#6b5f58' }}>Chess Tools v1.0</p>
      </div>
    </div>
  );
}

export default function Sidebar({ page, setPage, mobileOpen, setMobileOpen }) {
  const choose = (id) => { setPage(id); setMobileOpen(false); };

  return (
    <>
      {/* Desktop — always visible */}
      <aside className="hidden md:flex flex-col w-56 flex-shrink-0 h-full" style={{ borderRight: '1px solid #2d2724' }}>
        <SidebarContent page={page} choose={choose} />
      </aside>

      {/* Mobile overlay drawer */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-40 flex">
          <div
            className="fixed inset-0"
            style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)' }}
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative w-64 h-full shadow-2xl z-50">
            <SidebarContent page={page} choose={choose} />
          </aside>
        </div>
      )}
    </>
  );
}
