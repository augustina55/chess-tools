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

function buildFenPGN(diagrams) {
  if (!diagrams.length) return '';
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '.');
  return diagrams.map((d, i) =>
    `[Event "${d.description || `Position ${i + 1}`}"]
[Site "PDF to PGN Extractor"]
[Date "${today}"]
[Round "${i + 1}"]
[White "?"]
[Black "?"]
[Result "*"]
[SetUp "1"]
[FEN "${d.fen}"]

*`
  ).join('\n\n');
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
    pgn = buildFenPGN(allDiagrams);
    pgnSource = 'fen';
  }

  res.json({ diagrams: allDiagrams, fenList, pgn, pgnSource, pageText: textForPGN || null, errors, total: allDiagrams.length });
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
