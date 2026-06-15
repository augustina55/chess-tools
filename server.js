import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { Jimp } from 'jimp';
import OpenAI from 'openai';
import { createClient } from '@libsql/client';
import { Chess } from 'chess.js';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

const turso = (process.env.TURSO_DATABASE_URL && process.env.TURSO_AUTH_TOKEN)
  ? createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN })
  : null;

const app = express();
app.use(cors({
  origin: process.env.VERCEL
    ? true
    : ['http://localhost:5155', 'http://localhost:3001']
}));
app.use(express.json({ limit: '10mb' }));

// ── Puzzle Generator helpers ──────────────────────────────────────────────────

function applyFirstMoveAndFixFen(fen, movesStr) {
  const chess = new Chess(fen);
  const moves = movesStr.trim().split(' ');
  if (!moves.length) return { fen, remainingMoves: '' };
  const applied = chess.move({ from: moves[0].slice(0,2), to: moves[0].slice(2,4), promotion: moves[0][4] });
  if (!applied) return { fen, remainingMoves: '' };
  const parts = chess.fen().split(' ');
  parts[4] = '0'; parts[5] = '1';
  return { fen: parts.join(' '), remainingMoves: moves.slice(1).join(' ') };
}

function convertMovesToSAN(fen, movesStr) {
  if (!movesStr) return '';
  const chess = new Chess(fen);
  const uciMoves = movesStr.trim().split(/\s+/);
  const output = [];
  let moveNumber = 1;
  for (let i = 0; i < uciMoves.length; i++) {
    const uci = uciMoves[i];
    const move = chess.move({ from: uci.slice(0,2), to: uci.slice(2,4), promotion: uci[4] || undefined });
    if (!move) break;
    if (move.color === 'w') {
      output.push(`${moveNumber}. ${move.san}`);
    } else if (move.color === 'b' && output.length === 0) {
      output.push(`${moveNumber}... ${move.san}`);
    } else {
      output[output.length - 1] += ` ${move.san}`;
      moveNumber++;
    }
  }
  return output.join(' ');
}

// ── Puzzle filter cache ───────────────────────────────────────────────────────

let filtersCache = null;

async function buildFiltersCache() {
  if (!turso) return;
  const [themesRes, openingsRes] = await Promise.all([
    turso.execute({ sql: `SELECT DISTINCT Themes FROM puzzles WHERE Themes != ''`, args: [] }),
    turso.execute({ sql: `SELECT DISTINCT OpeningTags FROM puzzles WHERE OpeningTags != '' ORDER BY OpeningTags`, args: [] }),
  ]);
  const themeSet = new Set();
  themesRes.rows.forEach(r => String(r.Themes).split(' ').forEach(t => t && themeSet.add(t)));
  filtersCache = {
    themes:   [...themeSet].sort(),
    openings: openingsRes.rows.map(r => r.OpeningTags),
  };
}

if (turso) {
  buildFiltersCache()
    .then(() => console.log(`✓ Puzzle filter cache ready (${filtersCache.themes.length} themes, ${filtersCache.openings.length} openings)`))
    .catch(e  => console.error('Puzzle cache warm failed:', e.message));
}

// ── Puzzle routes ─────────────────────────────────────────────────────────────

app.get('/api/puzzle/filters', async (req, res) => {
  if (!turso) return res.status(503).json({ error: 'Turso DB not configured' });
  try {
    if (!filtersCache) await buildFiltersCache();
    res.set('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=3600');
    res.json(filtersCache);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/puzzle/pgn', async (req, res) => {
  if (!turso) return res.status(503).json({ error: 'Turso DB not configured' });
  try {
    const { themes = '[]', openings = '', minRating = 800, maxRating = 2500, count = 50 } = req.query;
    const themeList = JSON.parse(themes);
    const where = [], args = [];

    if (themeList.length) {
      where.push(`(${themeList.map(() => 'Themes LIKE ?').join(' OR ')})`);
      themeList.forEach(t => args.push(`%${t}%`));
    }
    if (openings) { where.push('OpeningTags LIKE ?'); args.push(`%${openings}%`); }
    where.push('Rating BETWEEN ? AND ?');
    args.push(+minRating, +maxRating);

    const wantedCount = Math.min(+count, 500);

    // Fast random: count first, then pick a random OFFSET — avoids ORDER BY RANDOM() on 1M rows
    const filterArgs = [...args];
    const countResult = await turso.execute({
      sql: `SELECT COUNT(*) as n FROM puzzles ${where.length ? 'WHERE ' + where.join(' AND ') : ''}`,
      args: filterArgs,
    });
    const total = Number(countResult.rows[0]?.n ?? 0);
    const offset = total > wantedCount ? Math.floor(Math.random() * (total - wantedCount)) : 0;

    const sql = `SELECT * FROM puzzles ${where.length ? 'WHERE ' + where.join(' AND ') : ''} LIMIT ? OFFSET ?`;
    args.push(wantedCount, offset);

    const result = await turso.execute({ sql, args });
    let pgn = '';
    result.rows.forEach((row, i) => {
      const mainTheme = row.Themes?.split(' ')[0] || 'Puzzle';
      const { fen: fixedFen, remainingMoves } = applyFirstMoveAndFixFen(row.FEN, row.Moves);
      if (!remainingMoves) return;
      const sanMoves = convertMovesToSAN(fixedFen, remainingMoves);
      const side = fixedFen.split(' ')[1] === 'w' ? '{White to play}' : '{Black to play}';
      pgn += `[Event "Puzzle ${i+1}"]\n[Date "????.??.??"]\n[White "Easy Exercises"]\n[Black "Exercise ${i+1}"]\n[Result "*"]\n[Variant "Standard"]\n[puzzleId "${row.PuzzleId}"]\n[Opening "${row.OpeningTags||'?'}"]\n[StudyName "Custom PGN"]\n[ChapterName "${mainTheme} Exercise ${i+1}"]\n[ChapterURL "${row.GameUrl||''}"]\n[Annotator "CircleChess"]\n[FEN "${fixedFen}"]\n\n${side}\n${sanMoves}\n\n`;
    });
    res.type('text/plain').send(pgn);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }
});

// ── ChessVision helper ────────────────────────────────────────────────────────

async function chessVisionPredict(buffer, mediaType = 'image/jpeg') {
  const base64 = buffer.toString('base64');
  try {
    const res = await fetch('http://app.chessvision.ai/predict', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        board_orientation: 'predict',
        cropped: false,
        current_player: 'white',
        image: `data:${mediaType};base64,${base64}`,
        predict_turn: false
      })
    });
    if (!res.ok) return null;
    const data = await res.json();
    return (data.success && data.result) ? data.result.replace(/_/g, ' ') : null;
  } catch {
    return null;
  }
}

// ── Multi-board extraction ────────────────────────────────────────────────────

function gridCrops(cols, rows, width, height) {
  const crops = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const left   = Math.floor(c * width  / cols);
      const top    = Math.floor(r * height / rows);
      const right  = Math.floor((c + 1) * width  / cols);
      const bottom = Math.floor((r + 1) * height / rows);
      crops.push({ left, top, width: right - left, height: bottom - top });
    }
  }
  return crops;
}

async function extractAllFens(fileBuffer, mediaType) {
  const image = await Jimp.read(fileBuffer);
  const { width, height } = image.bitmap;

  const layouts = [[1,1],[2,1],[1,2],[2,2],[3,1],[1,3],[3,2],[2,3],[3,3]];

  const regionKeys = new Set();
  const regions = [];
  for (const [cols, rows] of layouts) {
    for (const crop of gridCrops(cols, rows, width, height)) {
      if (crop.width < 150 || crop.height < 150) continue;
      const key = `${crop.left},${crop.top},${crop.width},${crop.height}`;
      if (regionKeys.has(key)) continue;
      regionKeys.add(key);
      regions.push({ crop, area: crop.width * crop.height });
    }
  }

  const results = await Promise.all(
    regions.map(async ({ crop, area }) => {
      const buf = await image.clone()
        .crop({ x: crop.left, y: crop.top, w: crop.width, h: crop.height })
        .getBuffer('image/jpeg');
      const fen = await chessVisionPredict(buf, 'image/jpeg');
      return { fen, top: crop.top, left: crop.left, area };
    })
  );

  const fenMap = new Map();
  for (const { fen, top, left, area } of results) {
    if (!fen) continue;
    const existing = fenMap.get(fen);
    if (!existing || area < existing.area) {
      fenMap.set(fen, { top, left, area });
    }
  }

  return [...fenMap.entries()]
    .sort(([, a], [, b]) => a.top !== b.top ? a.top - b.top : a.left - b.left)
    .map(([fen]) => fen);
}

// ── GPT-4o Vision OCR (for images / scanned pages) ───────────────────────────

async function imageToText(buffer, mediaType) {
  if (!openai) return null;
  const base64 = buffer.toString('base64');
  try {
    const res = await openai.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: { url: `data:${mediaType};base64,${base64}`, detail: 'high' }
          },
          {
            type: 'text',
            text: `Extract all the TEXT visible on this chess book page.

Include:
- Player names and scores (e.g. "Kasparov – Karpov", "A. Smith vs B. Jones")
- Tournament name, location, year (e.g. "Olginka 2011", "World Championship")
- Chapter or section title (e.g. "Candidate Moves", "Tactics")
- Side-to-move hint (e.g. "Black to play", "White to move")
- Chess move sequences in algebraic notation (e.g. "1.e4 e5 2.Nf3 Nc6")
- Annotation symbols attached to moves (!, ?, !?, ?!, !!, ??)
- Variation moves in parentheses
- All commentary, explanations, analysis, and narrative text

Do NOT describe or transcribe the chess board/diagram itself.
Return only the raw text exactly as it appears on the page, preserving line breaks.`
          }
        ]
      }]
    });
    return res.choices[0].message.content.trim();
  } catch (err) {
    console.error('GPT-4o vision OCR error:', err.message);
    return null;
  }
}

// ── Text → PGN via GPT-4o ────────────────────────────────────────────────────

async function textToPGN(pageText, fens) {
  if (!openai) return null;

  const fenBlock = fens.length
    ? fens.map((f, i) => `Diagram ${i + 1}: ${f}`).join('\n')
    : '(no diagrams found)';

  const prompt = `You are an expert chess PGN editor. Convert chess book page content into valid PGN.

PAGE TEXT:
"""
${pageText}
"""

DIAGRAM POSITIONS (FEN) extracted from this page in reading order:
${fenBlock}

RULES:

HEADERS — extract from the text:
- [White "..."] and [Black "..."] — look for "Name – Name", "Name - Name", "Name vs Name" patterns. The first name is White, second is Black.
- [Event "..."] — use the tournament/event name if present (e.g. "Olginka 2011"), otherwise use the chapter title if present, otherwise "?"
- [Date "..."] — extract year if mentioned, format as "YYYY.??.??"
- [Round "?"] unless a round number is clearly stated
- [Result "*"] unless 1-0, 0-1, or 1/2-1/2 is explicitly stated
- [SetUp "1"] and [FEN "..."] — always include when a diagram FEN is provided

SIDE TO MOVE — CRITICAL:
- If the text says "Black to play", "Black to move", or similar → change the FEN's side-to-move field from "w" to "b"
- If the text says "White to play", "White to move" → keep "w"
- Apply this correction to the FEN before putting it in the [FEN "..."] tag

MOVES:
- Extract chess moves in SAN notation (e4, Nf3, O-O, Bxe5+, g8=Q#, etc.)
- Attach nnotation symbols directly to the move with no space: e4! Nf3? Bxe5!! Qd3?? Nc6!? Bd3?!
- Wrap variations in (parentheses)

COMMENTARY:
- Put ALL narrative text/explanations as PGN comments in {curly braces}
- Place text that appears before the first move as an opening comment: {text here} 1. e4 ...
- Place text between moves as inline comments

MULTIPLE GAMES:
- If the page has multiple independent positions/games, output multiple PGN blocks separated by a blank line

NO MOVES FOUND:
- If the text has no chess moves at all, output one position-only PGN per FEN with the commentary as an opening comment:
  [Event "..."][White "..."][Black "..."][SetUp "1"][FEN "..."][Result "*"]\n\n{commentary here}\n\n*

Output ONLY raw PGN. No markdown, no explanation, no code fences.`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 2048,
      temperature: 0.1,
      messages: [{ role: 'user', content: prompt }]
    });
    const raw = completion.choices[0].message.content.trim();
    // Strip accidental markdown code fences
    return raw.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/i, '').trim();
  } catch (err) {
    console.error('GPT-4o PGN error:', err.message);
    return null;
  }
}

// ── Simple FEN-only PGN builder (fallback) ───────────────────────────────────

async function buildFenPGN(diagrams) {
  if (!diagrams.length) return '';
  const map = await getEcoFenMap();
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '.');
  return diagrams.map((d, i) => {
    const key = normFen(d.fen);
    const opening = map.get(key);
    const extra = opening
      ? `\n[ECO "${opening.eco}"]\n[Opening "${opening.name}"]`
      : '';
    return `[Event "${opening?.name || d.description || `Position ${i + 1}`}"]
[Site "Chess Tools"]
[Date "${today}"]
[Round "${i + 1}"]
[White "?"]
[Black "?"]
[Result "*"]${extra}
[SetUp "1"]
[FEN "${d.fen}"]

*`;
  }).join('\n\n');
}

// ── Analysis route ────────────────────────────────────────────────────────────

app.post('/api/analyze', upload.array('images', 100), async (req, res) => {
  const files = req.files;
  if (!files?.length) {
    return res.status(400).json({ error: 'No images received' });
  }

  // pageText: text layer from PDF (sent by client in text mode)
  // extractText: flag meaning "please OCR this image if no text layer"
  const pageText = (req.body.pageText || '').trim();
  const doExtractText = req.body.extractText === '1';

  const allDiagrams = [];
  const errors = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    let mediaType = file.mimetype;
    if (mediaType === 'image/jpg') mediaType = 'image/jpeg';

    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!validTypes.includes(mediaType)) {
      errors.push({ image: i + 1, name: file.originalname, error: `Unsupported type: ${mediaType}` });
      continue;
    }

    try {
      const fens = await extractAllFens(file.buffer, mediaType);
      if (fens.length === 0) {
        errors.push({ image: i + 1, name: file.originalname, error: 'No chess board detected in this image' });
      } else {
        fens.forEach((fen, j) => {
          allDiagrams.push({
            fen,
            description: fens.length > 1 ? `Image ${i + 1}, board ${j + 1}` : `Image ${i + 1}`,
            imageIndex: i + 1,
            positionNumber: allDiagrams.length + 1
          });
        });
      }
    } catch (err) {
      console.error(`Image ${i + 1} error:`, err.message);
      errors.push({ image: i + 1, name: file.originalname, error: err.message });
    }
  }

  const fenList = allDiagrams.map(d => d.fen);

  // Resolve the text to use for PGN generation:
  // 1. PDF text layer (already extracted client-side) — preferred
  // 2. GPT-4o Vision OCR on the image — fallback when text mode but no text layer
  let textForPGN = pageText;
  let textSource = pageText ? 'pdf' : null;

  if (!textForPGN && doExtractText && files.length > 0) {
    let mt = files[0].mimetype;
    if (mt === 'image/jpg') mt = 'image/jpeg';
    console.log(`Vision OCR requested for: ${files[0].originalname}`);
    textForPGN = await imageToText(files[0].buffer, mt);
    if (textForPGN) {
      textSource = 'vision';
      console.log(`Vision OCR result (${textForPGN.length} chars): ${textForPGN.slice(0, 120)}…`);
    } else {
      console.log('Vision OCR returned nothing (no OpenAI key or API error)');
    }
  }

  let pgn = '';
  let pgnSource = 'fen';

  if (textForPGN) {
    const aiPgn = await textToPGN(textForPGN, fenList);
    if (aiPgn) {
      pgn = aiPgn;
      pgnSource = textSource;
    }
  }

  // Fallback: simple FEN-only PGN
  if (!pgn) {
    pgn = await buildFenPGN(allDiagrams);
    pgnSource = 'fen';
  }

  res.json({ diagrams: allDiagrams, fenList, pgn, pgnSource, pageText: textForPGN || null, errors, total: allDiagrams.length });
});

// ── Opening Explorer ─────────────────────────────────────────────────────────

let ecoCache = null;

async function loadECO() {
  if (ecoCache) return ecoCache;
  const all = [];
  for (const letter of ['a', 'b', 'c', 'd', 'e']) {
    try {
      const r = await fetch(
        `https://raw.githubusercontent.com/lichess-org/chess-openings/master/${letter}.tsv`
      );
      if (!r.ok) continue;
      const lines = (await r.text()).trim().split('\n').slice(1);
      for (const line of lines) {
        const [eco, name, pgn] = line.split('\t');
        if (!eco || !name || !pgn) continue;
        try {
          const chess = new Chess();
          chess.loadPgn(pgn.trim());
          all.push({ eco, name, pgn: pgn.trim(), fen: chess.fen() });
        } catch { /* skip invalid */ }
      }
    } catch { /* skip file */ }
  }
  ecoCache = all;
  return all;
}

loadECO()
  .then(d => console.log(`✓ ECO openings loaded: ${d.length}`))
  .catch(e => console.warn('ECO preload failed:', e.message));

// ── ECO FEN map (Option A) ────────────────────────────────────────────────────

const normFen = fen => fen.split(' ').slice(0, 4).join(' ');

let ecoFenMap = null;

async function getEcoFenMap() {
  if (ecoFenMap) return ecoFenMap;
  const openings = await loadECO();
  ecoFenMap = new Map();
  for (const o of openings) {
    const key = normFen(o.fen);
    const existing = ecoFenMap.get(key);
    // Keep most specific (longest) name for each position
    if (!existing || o.name.length > existing.name.length) {
      ecoFenMap.set(key, { eco: o.eco, name: o.name });
    }
  }
  return ecoFenMap;
}

// Build map once after ECO loads
loadECO().then(() => getEcoFenMap()).catch(() => {});

// ── Hybrid opening lookup: ECO map → Lichess API ─────────────────────────────

async function lookupOpening(fen) {
  // Option A — instant ECO FEN map
  const map = await getEcoFenMap();
  const fromMap = map.get(normFen(fen));
  if (fromMap) return { ...fromMap, source: 'eco' };

  // Option B — Lichess Masters API (needs LICHESS_TOKEN)
  if (!process.env.LICHESS_TOKEN) return null;
  try {
    await new Promise(r => setTimeout(r, 80));
    const r = await fetch(
      `https://explorer.lichess.ovh/masters?fen=${encodeURIComponent(fen)}&moves=0&topGames=0&recentGames=0`,
      { headers: {
        'User-Agent': 'ChessTools/1.0 augustin@circlechess.com',
        'Authorization': `Bearer ${process.env.LICHESS_TOKEN}`,
      }}
    );
    if (!r.ok) return null;
    const d = await r.json();
    return d.opening ? { ...d.opening, source: 'lichess' } : null;
  } catch { return null; }
}

// ── Opening detect route ──────────────────────────────────────────────────────

app.post('/api/opening/detect', async (req, res) => {
  try {
    const { pgn } = req.body;
    if (!pgn) return res.status(400).json({ error: 'pgn required' });

    const chess = new Chess();
    try { chess.loadPgn(pgn); } catch { return res.status(400).json({ error: 'Invalid PGN' }); }

    const history = chess.history({ verbose: true });
    chess.reset();

    let lastOpening = null;
    let lastIdx = -1;
    const moves = [];
    let misses = 0;

    for (let i = 0; i < history.length; i++) {
      chess.move(history[i]);
      const fen = chess.fen();

      // Stop calling APIs after 3 consecutive out-of-book moves
      const opening = misses < 3 ? await lookupOpening(fen) : null;

      if (opening) { lastOpening = opening; lastIdx = i; misses = 0; }
      else misses++;

      moves.push({
        n: Math.ceil((i + 1) / 2),
        color: i % 2 === 0 ? 'w' : 'b',
        san: history[i].san,
        fen,
        opening: opening || null,
      });
    }

    res.json({
      lastOpening,
      openingEndMove: lastIdx >= 0 ? Math.ceil((lastIdx + 1) / 2) : 0,
      openingEndColor: lastIdx >= 0 ? (lastIdx % 2 === 0 ? 'w' : 'b') : null,
      moves,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/opening/list', async (req, res) => {
  try {
    const data = await loadECO();
    res.set('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=3600');
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

async function openingExplore(fen) {
  await new Promise(r => setTimeout(r, 100));
  // Prefer Lichess Masters if a personal token is configured
  if (process.env.LICHESS_TOKEN) {
    try {
      const r = await fetch(
        `https://explorer.lichess.ovh/masters?fen=${encodeURIComponent(fen)}&moves=15&topGames=0&recentGames=0`,
        { headers: {
          'User-Agent': 'ChessTools/1.0 augustin@circlechess.com',
          'Authorization': `Bearer ${process.env.LICHESS_TOKEN}`,
        }}
      );
      if (r.ok) {
        const d = await r.json();
        // Normalise to { moves: [{san, total}] }
        return { moves: d.moves?.map(m => ({ san: m.san, total: m.white + m.black + m.draws })) || [] };
      }
    } catch { /* fall through to ChessDB */ }
  }
  // Fallback: ChessDB (free, no auth required)
  try {
    const r = await fetch(
      `https://www.chessdb.cn/cdb.php?action=queryall&board=${encodeURIComponent(fen)}&json=1`,
      { headers: { 'User-Agent': 'ChessTools/1.0 augustin@circlechess.com' } }
    );
    if (!r.ok) return null;
    const d = await r.json();
    if (d.status !== 'ok' || !d.moves?.length) return null;
    // Sort: higher score = better move for side to move
    const sorted = [...d.moves].sort((a, b) => b.score - a.score);
    return { moves: sorted.map(m => ({ san: m.san, total: null, score: m.score, winrate: m.winrate })) };
  } catch { return null; }
}

async function exploreTree(fen, depth, topMoves, minGames, history = []) {
  if (depth === 0) return [{ moves: history, fen }];
  const data = await openingExplore(fen);
  if (!data?.moves?.length) return [{ moves: history, fen }];

  const chess = new Chess(fen);
  const candidates = data.moves
    .filter(m => m.total === null || m.total >= minGames)
    .slice(0, topMoves);

  if (!candidates.length) return [{ moves: history, fen }];

  const lines = [];
  for (const mv of candidates) {
    const applied = chess.move(mv.san);
    if (!applied) { chess.undo(); continue; }
    const newFen = chess.fen();
    chess.undo();
    const sub = await exploreTree(newFen, depth - 1, topMoves, minGames, [...history, mv.san]);
    lines.push(...sub);
  }
  return lines.length ? lines : [{ moves: history, fen }];
}

app.get('/api/opening/pgn', async (req, res) => {
  try {
    const { eco, depth = 2, topMoves = 3, minGames = 50 } = req.query;
    if (!eco) return res.status(400).json({ error: 'eco required' });

    const all = await loadECO();
    const opening = all.find(o => o.eco === eco);
    if (!opening) return res.status(404).json({ error: `ECO ${eco} not found` });

    let openingHistory = [];
    if (opening.pgn) {
      try { const t = new Chess(); t.loadPgn(opening.pgn); openingHistory = t.history(); } catch { /* ignore */ }
    }

    const lines = await exploreTree(
      opening.fen,
      Math.min(+depth, 4),
      Math.min(+topMoves, 5),
      Math.max(+minGames, 0)
    );

    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '.');

    const pgns = lines.map((line, i) => {
      const allMoves = [...openingHistory, ...line.moves];
      const varLabel = line.moves.length ? line.moves.join(' ') : 'Main Line';
      const name = `${opening.name}${line.moves.length ? ': ' + varLabel : ''}`;

      const header = [
        `[Event "${name}"]`,
        `[Site "Chess Tools"]`,
        `[Date "${date}"]`,
        `[White "?"]`,
        `[Black "?"]`,
        `[Result "*"]`,
      ].join('\n');

      const chess = new Chess();
      let moveTxt = '';
      for (const san of allMoves) {
        if (chess.turn() === 'w') moveTxt += `${chess.moveNumber()}. `;
        chess.move(san);
        moveTxt += san + ' ';
      }

      return {
        id: i + 1,
        name,
        moves: line.moves,
        openingMoves: openingHistory,
        pgn: `${header}\n\n${moveTxt.trim()} *`,
      };
    });

    res.json({
      pgns,
      count: pgns.length,
      opening: { eco: opening.eco, name: opening.name, fen: opening.fen },
    });
  } catch (err) {
    console.error('Opening PGN error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── Curriculum Builder ────────────────────────────────────────────────────────

const VALID_SQ = /^[a-h][1-8]$/;

function sanitizeArrows(arrows) {
  if (!Array.isArray(arrows)) return [];
  return arrows
    .filter(a => Array.isArray(a) && a.length >= 2 && VALID_SQ.test(a[0]) && VALID_SQ.test(a[1]))
    .map(a => [a[0], a[1], typeof a[2] === 'string' ? a[2] : 'rgb(0, 171, 84)']);
}

function sanitizeHighlights(h) {
  if (!h || typeof h !== 'object' || Array.isArray(h)) return {};
  const out = {};
  for (const [sq, color] of Object.entries(h)) {
    if (VALID_SQ.test(sq) && typeof color === 'string') out[sq] = color;
  }
  return out;
}

async function buildCurriculumGPT(topic, level, numSections, textContent, fens) {
  const fenBlock = fens.length
    ? `POSITIONS FROM REFERENCE MATERIAL (FEN):\n${fens.map((f, i) => `${i + 1}. ${f}`).join('\n')}`
    : 'No specific positions found — use well-known FENs appropriate to the topic.';

  const textBlock = textContent
    ? `REFERENCE MATERIAL:\n${textContent.slice(0, 6000)}`
    : 'No reference material provided. Build from general chess knowledge.';

  const userMsg = `TOPIC: ${topic}
LEVEL: ${level}
SECTIONS: ${numSections}

${textBlock}

${fenBlock}

Create a complete chess lesson with exactly ${numSections} sections covering distinct aspects of the topic.

ARROW COLORS (use exact strings):
- "rgb(0, 171, 84)" = green — recommended moves, good squares, active pieces
- "rgb(220, 38, 38)" = red — threats, weaknesses, moves to avoid
- "rgb(250, 207, 71)" = yellow — important squares, key ideas
- "rgb(59, 130, 246)" = blue — alternative plans, secondary ideas

HIGHLIGHT COLORS (use exact strings):
- "rgba(0, 171, 84, 0.3)" = green — strong squares
- "rgba(220, 38, 38, 0.3)" = red — weak squares, threats
- "rgba(250, 207, 71, 0.3)" = yellow — key squares
- "rgba(59, 130, 246, 0.3)" = blue — alternative plan squares

RULES:
1. arrows: [[from, to, color]] — from/to must be valid squares (a1–h8)
2. highlights: {square: rgba_color} — valid squares only
3. fen: must be a valid chess FEN for the illustrated position
4. explanation: 3-4 detailed paragraphs
5. keyPoints: 3-6 bullets (≤8 words each)
6. questions: 2-3 questions with detailed answers

Output ONLY valid JSON (no markdown fences):
{
  "title": "...",
  "topic": "...",
  "level": "...",
  "summary": "...",
  "sections": [
    {
      "id": 1,
      "heading": "...",
      "explanation": "...",
      "keyPoints": ["..."],
      "fen": "...",
      "arrows": [["e2","e4","rgb(0, 171, 84)"]],
      "highlights": {"e4": "rgba(0, 171, 84, 0.3)"},
      "questions": [{"q": "...", "a": "..."}]
    }
  ]
}`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 4096,
      temperature: 0.3,
      messages: [
        {
          role: 'system',
          content: 'You are an expert chess coach. Create structured curriculum lessons in JSON format only — no markdown, no extra text.',
        },
        { role: 'user', content: userMsg },
      ],
      response_format: { type: 'json_object' },
    });
    const data = JSON.parse(completion.choices[0].message.content.trim());
    data.sections = (data.sections || []).map((s, i) => ({
      ...s,
      id: i + 1,
      arrows: sanitizeArrows(s.arrows),
      highlights: sanitizeHighlights(s.highlights),
    }));
    return data;
  } catch (err) {
    console.error('Curriculum GPT error:', err.message);
    return null;
  }
}

app.post('/api/curriculum/build', upload.array('images', 50), async (req, res) => {
  if (!openai) return res.status(503).json({ error: 'OpenAI API key not configured' });
  try {
    const { topic, level = 'intermediate', numSections = '5' } = req.body;
    if (!topic?.trim()) return res.status(400).json({ error: 'topic required' });

    let combinedText = '';
    try {
      const pts = req.body.pageTexts ? JSON.parse(req.body.pageTexts) : [];
      combinedText = pts.filter(Boolean).join('\n\n');
    } catch { /* ignore */ }

    const files = req.files || [];
    const allFens = [];

    if (files.length) {
      const fenBatches = await Promise.all(
        files.slice(0, 20).map(async file => {
          const mt = file.mimetype === 'image/jpg' ? 'image/jpeg' : file.mimetype;
          try { return await extractAllFens(file.buffer, mt); } catch { return []; }
        })
      );
      fenBatches.forEach(b => allFens.push(...b));

      if (!combinedText) {
        const ocrResults = await Promise.all(
          files.slice(0, 5).map(f =>
            imageToText(f.buffer, f.mimetype === 'image/jpg' ? 'image/jpeg' : f.mimetype)
          )
        );
        combinedText = ocrResults.filter(Boolean).join('\n\n');
      }
    }

    const uniqueFens = [...new Set(allFens)].slice(0, 15);
    const curriculum = await buildCurriculumGPT(
      topic.trim(), level, parseInt(numSections, 10) || 5, combinedText, uniqueFens
    );

    if (!curriculum) return res.status(500).json({ error: 'Failed to generate curriculum' });
    res.json(curriculum);
  } catch (err) {
    console.error('Curriculum build error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── Static files (local production preview) ───────────────────────────────────

const distPath = join(__dirname, 'dist');
if (existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (_req, res) => res.sendFile(join(distPath, 'index.html')));
}

// ── Start (local only — Vercel imports app as a module) ───────────────────────

if (!process.env.VERCEL) {
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => {
    console.log(`\n✓ PDF-to-PGN server → http://localhost:${PORT}`);
    console.log('✓ ChessVision.ai — FEN extraction (no key required)');
    console.log(`✓ GPT-4o — text→PGN ${openai ? 'enabled' : 'disabled (no OPENAI_API_KEY)'}`);
  });
}

export default app;
