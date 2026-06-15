import { useState, useRef, useCallback } from 'react';
import AnnotatedBoard from './AnnotatedBoard';

const LEVELS = ['beginner', 'intermediate', 'advanced'];
const LEVEL_LABEL = { beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced' };

const LEGEND = [
  { color: 'rgb(0, 171, 84)',   label: 'Good move / active square' },
  { color: 'rgb(220, 38, 38)',  label: 'Threat / weakness' },
  { color: 'rgb(250, 207, 71)', label: 'Key idea / important square' },
  { color: 'rgb(59, 130, 246)', label: 'Alternative plan' },
];

// ── PDF → pages ─────────────────────────────────────────────────────────────

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
    const viewport = page.getViewport({ scale: 2.0 });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
    const blob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', 0.92));
    const tc = await page.getTextContent();
    const text = tc.items.map(i => i.str).join(' ').replace(/\s+/g, ' ').trim();
    pages.push({ blob, name: `${file.name}_p${p}.jpg`, text });
  }
  return pages;
}

// ── Upload zone ──────────────────────────────────────────────────────────────

function UploadZone({ onFiles, disabled }) {
  const inputRef = useRef(null);
  const [over, setOver] = useState(false);

  const handle = useCallback(list => {
    const valid = Array.from(list).filter(f =>
      f.type === 'application/pdf' || f.type.startsWith('image/')
    );
    if (valid.length) onFiles(prev => [...prev, ...valid]);
  }, [onFiles]);

  return (
    <div
      className="border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all"
      style={{ borderColor: over ? '#FACF47' : '#D1AB41', background: over ? 'rgba(250,207,71,0.08)' : 'rgba(250,207,71,0.03)' }}
      onClick={() => !disabled && inputRef.current.click()}
      onDrop={e => { e.preventDefault(); setOver(false); if (!disabled) handle(e.dataTransfer.files); }}
      onDragOver={e => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
    >
      <div className="text-xl mb-1">📄</div>
      <p className="text-xs font-semibold" style={{ color: '#FACF47' }}>Upload PDFs or Images</p>
      <p className="text-[11px] mt-0.5" style={{ color: '#6b5f58' }}>Drag & drop or click to browse</p>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,image/*"
        multiple
        className="hidden"
        onChange={e => handle(e.target.files)}
        disabled={disabled}
      />
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────

export default function CurriculumBuilder() {
  const [files, setFiles]               = useState([]);
  const [topic, setTopic]               = useState('');
  const [level, setLevel]               = useState('intermediate');
  const [numSections, setNumSections]   = useState(5);
  const [status, setStatus]             = useState('idle');
  const [progress, setProgress]         = useState('');
  const [curriculum, setCurriculum]     = useState(null);
  const [activeSection, setActiveSection] = useState(null);
  const [expandedQ, setExpandedQ]       = useState({});

  const processing = status === 'processing';
  const canGenerate = topic.trim().length > 0 && files.length > 0 && !processing;

  const generate = async () => {
    if (!canGenerate) return;
    setStatus('processing');
    setProgress('Preparing files…');
    setCurriculum(null);
    setActiveSection(null);
    setExpandedQ({});

    try {
      const formData = new FormData();
      formData.append('topic', topic.trim());
      formData.append('level', level);
      formData.append('numSections', String(numSections));

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

      setProgress('Building curriculum with GPT-4o…');
      const r = await fetch('/api/curriculum/build', { method: 'POST', body: formData });
      if (!r.ok) { const e = await r.json(); throw new Error(e.error || `Error ${r.status}`); }
      const data = await r.json();
      setCurriculum(data);
      setActiveSection(data.sections?.[0] || null);
      setStatus('done');
    } catch (err) {
      setProgress(err.message);
      setStatus('error');
    }
  };

  const removeFile = idx => setFiles(prev => prev.filter((_, i) => i !== idx));

  const activeSectionIdx = curriculum?.sections?.findIndex(s => s.id === activeSection?.id) ?? -1;
  const total = curriculum?.sections?.length ?? 0;

  const goPrev = () => activeSectionIdx > 0 && setActiveSection(curriculum.sections[activeSectionIdx - 1]);
  const goNext = () => activeSectionIdx < total - 1 && setActiveSection(curriculum.sections[activeSectionIdx + 1]);

  const exportText = () => {
    if (!curriculum) return;
    const body = curriculum.sections.map(s => [
      `## ${s.heading}`,
      '',
      s.explanation,
      '',
      'Key Points:',
      ...(s.keyPoints || []).map(k => `• ${k}`),
      '',
      `Position (FEN): ${s.fen}`,
      '',
      ...(s.questions || []).flatMap(q => [`Q: ${q.q}`, `A: ${q.a}`, '']),
    ].join('\n')).join('\n---\n\n');
    const txt = `# ${curriculum.title}\n\n${curriculum.summary || ''}\n\n${body}`;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([txt], { type: 'text/plain' }));
    a.download = `${curriculum.topic || 'curriculum'}.txt`;
    a.click();
  };

  return (
    <div className="flex h-full overflow-hidden">

      {/* ── Left: Config ──────────────────────────────────────────────── */}
      <aside
        className="w-64 flex-shrink-0 overflow-y-auto"
        style={{ borderRight: '1px solid #DDD5C8', background: '#FAF8F4' }}
      >
        <div className="px-4 py-5 space-y-5">

          <div>
            <h2 className="text-sm font-bold" style={{ color: '#1C1917' }}>Curriculum Builder</h2>
            <p className="text-[11px] mt-0.5" style={{ color: '#6b5f58' }}>Upload materials → AI lesson</p>
          </div>

          {/* Upload */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest mb-2" style={{ color: '#9a8070' }}>
              Reference Files
            </p>
            <UploadZone onFiles={setFiles} disabled={processing} />
            {files.length > 0 && (
              <div className="mt-2 space-y-1">
                {files.map((f, i) => (
                  <div key={i} className="flex items-center gap-2 px-2 py-1.5 rounded-lg"
                    style={{ background: 'rgba(250,207,71,0.07)' }}>
                    <span className="text-[11px] flex-1 truncate" style={{ color: '#78655A' }}>{f.name}</span>
                    <button
                      onClick={() => removeFile(i)}
                      disabled={processing}
                      style={{ color: '#9a8070', background: 'rgba(0,0,0,0.06)', border: 'none', borderRadius: 4, padding: '1px 5px', cursor: 'pointer', fontSize: 10 }}
                    >✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Topic */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest mb-1.5" style={{ color: '#9a8070' }}>Topic</p>
            <input
              type="text"
              value={topic}
              onChange={e => setTopic(e.target.value)}
              placeholder="e.g. Isolated Queen's Pawn"
              disabled={processing}
              className="w-full px-3 py-2 text-sm rounded-lg outline-none"
              style={{
                border: '1px solid #DDD5C8',
                background: '#fff',
                color: '#1C1917',
                fontFamily: 'inherit',
              }}
              onKeyDown={e => e.key === 'Enter' && generate()}
            />
          </div>

          {/* Level */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest mb-2" style={{ color: '#9a8070' }}>Level</p>
            <div className="flex gap-1.5">
              {LEVELS.map(l => (
                <button key={l} onClick={() => setLevel(l)} disabled={processing}
                  className="flex-1 text-[10px] font-semibold py-1.5 rounded-lg"
                  style={{
                    background: level === l ? '#FACF47' : 'rgba(0,0,0,0.05)',
                    color: level === l ? '#1C1917' : '#6b5f58',
                    border: 'none', cursor: 'pointer',
                  }}>
                  {l.slice(0,3).toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Sections */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: '#9a8070' }}>Sections</p>
              <span className="text-sm font-bold" style={{ color: '#FACF47' }}>{numSections}</span>
            </div>
            <input
              type="range" min={3} max={8} value={numSections}
              onChange={e => setNumSections(+e.target.value)}
              disabled={processing}
              className="w-full accent-amber-400"
            />
            <div className="flex justify-between text-[10px]" style={{ color: '#9a8070' }}>
              <span>3</span><span>8</span>
            </div>
          </div>

          {/* Generate */}
          <button
            onClick={generate}
            disabled={!canGenerate}
            className="w-full py-2.5 text-sm font-bold rounded-xl"
            style={{
              background: canGenerate ? 'linear-gradient(135deg, #FACF47, #E17846)' : 'rgba(0,0,0,0.08)',
              color: canGenerate ? '#1C1917' : '#9a8070',
              border: 'none',
              cursor: canGenerate ? 'pointer' : 'not-allowed',
              boxShadow: canGenerate ? '0 4px 14px rgba(250,207,71,0.3)' : 'none',
              transition: 'all 0.2s',
            }}
          >
            {processing ? 'Building…' : 'Generate Curriculum'}
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
        </div>
      </aside>

      {/* ── Middle: Curriculum ────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto" style={{ background: '#F1EDE4' }}>

        {/* Empty state */}
        {!curriculum && status !== 'processing' && (
          <div className="flex flex-col items-center justify-center h-full p-8 text-center">
            <div className="text-5xl mb-4">🎓</div>
            <h3 className="text-lg font-bold mb-2" style={{ color: '#1C1917' }}>Chess Curriculum Builder</h3>
            <p className="text-sm max-w-xs" style={{ color: '#6b5f58' }}>
              Upload reference PDFs, enter a chess topic, and GPT-4o builds a complete
              annotated lesson with board positions, arrows, and study questions.
            </p>
            <div className="mt-6 flex gap-3">
              {['Upload PDFs', 'Enter Topic', 'Generate'].map((step, i) => (
                <div key={step} className="rounded-xl px-4 py-3 text-center" style={{ background: 'rgba(250,207,71,0.1)' }}>
                  <div className="text-lg font-bold mb-1" style={{ color: '#FACF47' }}>{i + 1}</div>
                  <div className="text-[11px] font-semibold" style={{ color: '#78655A' }}>{step}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Loading */}
        {status === 'processing' && (
          <div className="flex flex-col items-center justify-center h-full">
            <div className="w-10 h-10 border-4 rounded-full animate-spin mb-4"
              style={{ borderColor: '#FACF47', borderTopColor: 'transparent' }} />
            <p className="text-sm font-semibold" style={{ color: '#78655A' }}>{progress}</p>
          </div>
        )}

        {/* Curriculum */}
        {curriculum && (
          <div className="p-6 max-w-3xl mx-auto">

            {/* Title */}
            <div className="mb-6 pb-5" style={{ borderBottom: '1px solid #DDD5C8' }}>
              <h1 className="text-2xl font-bold" style={{ color: '#1C1917' }}>{curriculum.title}</h1>
              <div className="flex items-center gap-2 mt-1.5">
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                  style={{ background: 'rgba(250,207,71,0.2)', color: '#D1AB41' }}>
                  {LEVEL_LABEL[curriculum.level?.toLowerCase()] || curriculum.level}
                </span>
                <span className="text-xs" style={{ color: '#9a8070' }}>{curriculum.sections?.length} sections</span>
              </div>
              {curriculum.summary && (
                <p className="mt-3 text-sm leading-relaxed" style={{ color: '#4A3728' }}>{curriculum.summary}</p>
              )}
            </div>

            {/* Sections */}
            <div className="space-y-5">
              {curriculum.sections?.map((section, i) => {
                const isActive = activeSection?.id === section.id;
                const qOpen = !!expandedQ[section.id];
                return (
                  <article
                    key={section.id}
                    className="rounded-2xl overflow-hidden cursor-pointer"
                    style={{
                      background: '#fff',
                      boxShadow: isActive
                        ? '0 0 0 2px #FACF47, 0 6px 24px rgba(0,0,0,0.08)'
                        : '0 2px 8px rgba(0,0,0,0.06)',
                      transition: 'box-shadow 0.15s',
                    }}
                    onClick={() => setActiveSection(section)}
                  >
                    {/* Card header */}
                    <div className="flex items-center gap-3 px-5 py-4"
                      style={{ borderBottom: '1px solid #F0EBE4' }}>
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0"
                        style={{ background: isActive ? '#FACF47' : 'rgba(250,207,71,0.15)', color: '#1C1917' }}>
                        {i + 1}
                      </div>
                      <h2 className="text-sm font-bold" style={{ color: '#1C1917' }}>{section.heading}</h2>
                    </div>

                    {/* Card body */}
                    <div className="p-5">
                      <div className="flex gap-5">

                        {/* Board thumbnail */}
                        <div className="flex-shrink-0">
                          <AnnotatedBoard
                            fen={section.fen}
                            arrows={section.arrows}
                            highlights={section.highlights}
                            width={160}
                          />
                        </div>

                        {/* Text content */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm leading-relaxed"
                            style={{
                              color: '#4A3728',
                              display: '-webkit-box',
                              WebkitLineClamp: 5,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden',
                            }}>
                            {section.explanation}
                          </p>

                          {section.keyPoints?.length > 0 && (
                            <div className="mt-3">
                              <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: '#9a8070' }}>Key Points</p>
                              <ul className="space-y-1">
                                {section.keyPoints.map((kp, ki) => (
                                  <li key={ki} className="flex items-start gap-1.5 text-xs" style={{ color: '#4A3728' }}>
                                    <span style={{ color: '#FACF47', flexShrink: 0, marginTop: 2 }}>▸</span>
                                    {kp}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Questions */}
                      {section.questions?.length > 0 && (
                        <div className="mt-4 pt-3" style={{ borderTop: '1px solid #F0EBE4' }}>
                          <button
                            onClick={e => { e.stopPropagation(); setExpandedQ(p => ({ ...p, [section.id]: !p[section.id] })); }}
                            className="flex items-center gap-1.5 text-xs font-semibold"
                            style={{ color: '#D1AB41', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                          >
                            <span>{qOpen ? '▾' : '▸'}</span>
                            {section.questions.length} Study Question{section.questions.length !== 1 ? 's' : ''}
                          </button>
                          {qOpen && (
                            <div className="mt-3 space-y-2">
                              {section.questions.map((q, qi) => (
                                <div key={qi} className="rounded-xl p-3" style={{ background: '#FAF8F4' }}>
                                  <p className="text-xs font-semibold mb-1" style={{ color: '#1C1917' }}>Q: {q.q}</p>
                                  <p className="text-xs leading-relaxed" style={{ color: '#6b5f58' }}>A: {q.a}</p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>

            {/* Export */}
            <div className="mt-6 flex gap-3 pb-6">
              <button onClick={exportText}
                className="text-xs font-semibold px-4 py-2 rounded-xl"
                style={{ background: 'rgba(250,207,71,0.15)', color: '#D1AB41', border: 'none', cursor: 'pointer' }}>
                Export as Text
              </button>
            </div>
          </div>
        )}
      </main>

      {/* ── Right: Board preview ───────────────────────────────────────── */}
      <aside
        className="w-72 flex-shrink-0 flex flex-col"
        style={{ borderLeft: '1px solid #DDD5C8', background: '#FAF8F4' }}
      >
        {!activeSection ? (
          <div className="flex-1 flex items-center justify-center p-6 text-center">
            <div>
              <div className="text-4xl mb-3">♟</div>
              <p className="text-xs" style={{ color: '#9a8070' }}>Click a section to see the annotated board</p>
            </div>
          </div>
        ) : (
          <>
            {/* Nav */}
            <div className="flex items-center justify-between px-4 py-3 flex-shrink-0"
              style={{ borderBottom: '1px solid #DDD5C8' }}>
              <button onClick={goPrev} disabled={activeSectionIdx <= 0}
                style={{ background: 'none', border: 'none', cursor: activeSectionIdx > 0 ? 'pointer' : 'default', color: activeSectionIdx > 0 ? '#FACF47' : '#9a8070', fontSize: 16 }}>
                ◂
              </button>
              <span className="text-xs font-semibold" style={{ color: '#78655A' }}>
                Section {activeSectionIdx + 1} / {total}
              </span>
              <button onClick={goNext} disabled={activeSectionIdx >= total - 1}
                style={{ background: 'none', border: 'none', cursor: activeSectionIdx < total - 1 ? 'pointer' : 'default', color: activeSectionIdx < total - 1 ? '#FACF47' : '#9a8070', fontSize: 16 }}>
                ▸
              </button>
            </div>

            {/* Board */}
            <div className="p-3 flex justify-center flex-shrink-0">
              <AnnotatedBoard
                fen={activeSection.fen}
                arrows={activeSection.arrows}
                highlights={activeSection.highlights}
                width={264}
              />
            </div>

            {/* Info */}
            <div className="flex-1 overflow-y-auto px-4 pb-4">
              <h3 className="text-sm font-bold mb-3" style={{ color: '#1C1917' }}>{activeSection.heading}</h3>

              {activeSection.keyPoints?.length > 0 && (
                <div className="mb-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: '#9a8070' }}>Key Points</p>
                  <ul className="space-y-1.5">
                    {activeSection.keyPoints.map((kp, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-xs" style={{ color: '#4A3728' }}>
                        <span style={{ color: '#FACF47', flexShrink: 0, marginTop: 2 }}>▸</span>
                        {kp}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Legend */}
              <div className="rounded-xl p-3" style={{ background: 'rgba(0,0,0,0.04)' }}>
                <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: '#9a8070' }}>Annotation Legend</p>
                {LEGEND.map(({ color, label }) => (
                  <div key={label} className="flex items-center gap-2 mb-1.5">
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: color }} />
                    <span className="text-[10px]" style={{ color: '#6b5f58' }}>{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </aside>

    </div>
  );
}
