import { useState, useCallback, useRef } from 'react';
import LeftPanel from './LeftPanel';
import PGNPanel from './PGNPanel';
import BoardPreview from './BoardPreview';

export default function PdfToPgn() {
  const [files, setFiles] = useState([]);
  const [mode, setMode] = useState('fen');
  const [status, setStatus] = useState('idle');
  const [progress, setProgress] = useState({ current: 0, total: 0, message: '', elapsed: 0, eta: null });
  const [livePGN, setLivePGN] = useState('');
  const [livePositions, setLivePositions] = useState([]);
  const [selectedFen, setSelectedFen] = useState(null);
  const [selectedLabel, setSelectedLabel] = useState('');
  const [errors, setErrors] = useState([]);
  const [globalError, setGlobalError] = useState(null);
  const [extractedTexts, setExtractedTexts] = useState([]);

  const startTimeRef = useRef(null);
  const timerRef = useRef(null);
  const pgnRef = useRef('');

  const startTimer = () => {
    startTimeRef.current = Date.now();
    timerRef.current = setInterval(() => {
      setProgress(prev => {
        const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
        const eta = prev.current > 0 && prev.current < prev.total
          ? Math.round((elapsed / prev.current) * (prev.total - prev.current))
          : null;
        return { ...prev, elapsed, eta };
      });
    }, 1000);
  };

  const stopTimer = () => { clearInterval(timerRef.current); timerRef.current = null; };

  const renderPdfPages = useCallback(async (file, extractText) => {
    const pdfjsLib = await import('pdfjs-dist');
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const pages = [];
    for (let p = 1; p <= pdf.numPages; p++) {
      setProgress(prev => ({ ...prev, message: `Rendering "${file.name}" page ${p}/${pdf.numPages}…` }));
      const page = await pdf.getPage(p);
      const viewport = page.getViewport({ scale: 2.0 });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
      const blob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', 0.92));
      let pageText = '';
      if (extractText) {
        const tc = await page.getTextContent();
        pageText = tc.items.map(i => i.str).join(' ').replace(/\s+/g, ' ').trim();
      }
      pages.push({ blob, name: `${file.name}_page${p}.jpg`, pageText, pageNum: p, fileName: file.name });
    }
    return pages;
  }, []);

  const handleProcess = useCallback(async () => {
    if (!files.length) return;
    const extractText = mode === 'text';
    setStatus('processing');
    setGlobalError(null);
    setLivePGN('');
    setLivePositions([]);
    setSelectedFen(null);
    setSelectedLabel('');
    setErrors([]);
    setExtractedTexts([]);
    pgnRef.current = '';

    try {
      const allImages = [];
      for (const file of files) {
        if (file.type === 'application/pdf') {
          allImages.push(...await renderPdfPages(file, extractText));
        } else {
          allImages.push({ blob: file, name: file.name });
        }
      }

      const total = allImages.length;
      startTimer();

      for (let i = 0; i < total; i++) {
        const img = allImages[i];
        setProgress(prev => ({ ...prev, current: i + 1, total, message: `Analyzing ${i + 1}/${total}: "${img.name}"…` }));

        const formData = new FormData();
        formData.append('images', img.blob, img.name);
        if (extractText) {
          formData.append('extractText', '1');
          if (img.pageText) formData.append('pageText', img.pageText);
        }

        const res = await fetch('/api/analyze', { method: 'POST', body: formData });
        if (!res.ok) throw new Error((await res.json()).error || `Server error ${res.status}`);
        const data = await res.json();

        if (data.pgn) {
          pgnRef.current = pgnRef.current ? pgnRef.current + '\n\n' + data.pgn : data.pgn;
          setLivePGN(pgnRef.current);
        }
        if (data.diagrams?.length) {
          setLivePositions(prev => [...prev, ...data.diagrams]);
          const last = data.diagrams[data.diagrams.length - 1];
          setSelectedFen(last.fen);
          setSelectedLabel(last.description);
        }
        if (data.pageText) {
          setExtractedTexts(prev => [...prev, {
            label: img.pageNum ? `${img.fileName} p.${img.pageNum}` : img.name,
            text: data.pageText,
          }]);
        }
        if (data.errors?.length) setErrors(prev => [...prev, ...data.errors]);
      }

      stopTimer();
      setStatus('done');
    } catch (err) {
      stopTimer();
      setGlobalError(err.message);
      setStatus('idle');
    }
  }, [files, mode, renderPdfPages]);

  const handleReset = () => {
    setStatus('idle');
    setFiles([]);
    setLivePGN('');
    setLivePositions([]);
    setSelectedFen(null);
    setSelectedLabel('');
    setErrors([]);
    setGlobalError(null);
    setExtractedTexts([]);
    setProgress({ current: 0, total: 0, message: '', elapsed: 0, eta: null });
    pgnRef.current = '';
  };

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: '#F1EDE4' }}>
      {/* Tool header */}
      <div
        className="flex-shrink-0 px-5 py-3 flex items-center gap-3"
        style={{ background: '#1C1917', borderBottom: '1px solid #2d2724' }}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4 flex-shrink-0" style={{ color: '#FACF47' }}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
        </svg>
        <h2 className="text-sm font-bold" style={{ color: '#FACF47' }}>PDF to PGN</h2>
        <span className="text-xs" style={{ color: '#6b5f58' }}>Extract chess positions from images &amp; PDFs</span>
        {globalError && (
          <span className="ml-auto text-xs font-medium truncate" style={{ color: '#f87171' }}>{globalError}</span>
        )}
      </div>

      {/* 3-column layout */}
      <div className="flex flex-1 overflow-hidden min-h-0">
        {/* Col 1: Upload */}
        <div
          className="w-64 flex-shrink-0 overflow-y-auto flex flex-col"
          style={{ background: '#FAF6EB', borderRight: '1px solid #E8E0D0' }}
        >
          <div className="px-4 py-2 flex-shrink-0" style={{ borderBottom: '1px solid #E8E0D0', background: '#F5EFE6' }}>
            <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: '#a89890' }}>
              Upload &amp; Config
            </p>
          </div>
          <LeftPanel
            files={files} setFiles={setFiles}
            mode={mode} setMode={setMode}
            status={status} progress={progress}
            positions={livePositions}
            extractedTexts={extractedTexts}
            errors={errors}
            onProcess={handleProcess}
            onReset={handleReset}
          />
        </div>

        {/* Col 2: PGN live */}
        <div className="flex-1 overflow-hidden flex flex-col" style={{ background: '#FAF6EB', borderRight: '1px solid #E8E0D0' }}>
          <PGNPanel
            pgn={livePGN} status={status}
            positions={livePositions}
            onSelectFen={(fen, label) => { setSelectedFen(fen); setSelectedLabel(label); }}
            selectedFen={selectedFen}
          />
        </div>

        {/* Col 3: Board */}
        <div className="w-72 flex-shrink-0 overflow-y-auto" style={{ background: '#FAF6EB' }}>
          <div className="px-4 py-2" style={{ borderBottom: '1px solid #E8E0D0', background: '#F5EFE6' }}>
            <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: '#a89890' }}>
              Board Preview
            </p>
          </div>
          <div className="p-4">
            <BoardPreview fen={selectedFen} label={selectedLabel} />
          </div>
        </div>
      </div>
    </div>
  );
}
