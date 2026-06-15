import { Chessboard } from 'react-chessboard';
import { Chess } from 'chess.js';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

function validFen(fen) {
  if (!fen || typeof fen !== 'string') return false;
  try { new Chess(fen); return true; }
  catch { return false; }
}

export default function AnnotatedBoard({ fen, arrows = [], highlights = {}, width = 300 }) {
  const safeFen = validFen(fen) ? fen : START_FEN;

  const squareStyles = {};
  for (const [sq, color] of Object.entries(highlights || {})) {
    squareStyles[sq] = { backgroundColor: color };
  }

  return (
    <Chessboard
      position={safeFen}
      customArrows={arrows || []}
      customSquareStyles={squareStyles}
      arePiecesDraggable={false}
      boardWidth={width}
      customBoardStyle={{ borderRadius: '6px', boxShadow: '0 4px 20px rgba(0,0,0,0.18)' }}
      customDarkSquareStyle={{ backgroundColor: '#B58863' }}
      customLightSquareStyle={{ backgroundColor: '#F0D9B5' }}
    />
  );
}
