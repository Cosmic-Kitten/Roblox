const SIZE = 8;
const PALETTES = Array.from({ length: 180 }, (_, index) => {
  const hue = (index * 47) % 360;
  return [
    `hsl(${hue} 88% 66%)`,
    `hsl(${(hue + 38) % 360} 86% 62%)`,
    `hsl(${(hue + 126) % 360} 78% 58%)`,
    `hsl(${(hue + 202) % 360} 84% 68%)`,
    `hsl(${(hue + 286) % 360} 82% 64%)`
  ];
});
const SHAPES = [
  { color: '#ff6b6b', cells: [[0,0]] },
  { color: '#ffd166', cells: [[0,0],[1,0]] },
  { color: '#06d6a0', cells: [[0,0],[0,1],[1,0]] },
  { color: '#4cc9f0', cells: [[0,0],[1,0],[2,0]] },
  { color: '#a78bfa', cells: [[0,0],[1,0],[1,1]] },
  { color: '#f72585', cells: [[0,0],[1,0],[2,0],[1,1]] },
  { color: '#7c9cff', cells: [[0,0],[1,0],[0,1],[1,1]] },
  { color: '#ff9f1c', cells: [[0,0],[1,0],[2,0],[2,1]] },
  { color: '#2dd4bf', cells: [[0,0],[1,0],[1,1],[2,1]] },
  { color: '#f472b6', cells: [[0,0],[1,0],[2,0],[0,1],[1,1]] }
];

const boardEl = document.getElementById('board');
const trayEl = document.getElementById('tray');
const scoreEl = document.getElementById('scoreValue');
const messageEl = document.getElementById('message');
const newGameBtn = document.getElementById('newGameBtn');
const shuffleBtn = document.getElementById('shuffleBtn');
let dragGhostEl = null;

const state = {
  board: createBoard(),
  tray: [],
  selectedPieceIndex: null,
  preview: null,
  dragging: false,
  score: 0,
  combo: 1,
  paletteIndex: 0,
  gameOver: false
};

function createBoard() {
  return Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
}

function randomShape() {
  const template = SHAPES[Math.floor(Math.random() * SHAPES.length)];
  const palette = PALETTES[state.paletteIndex];
  return {
    color: palette[Math.floor(Math.random() * palette.length)],
    cells: template.cells.map(([r, c]) => [r, c])
  };
}

function refillTray() {
  while (state.tray.length < 3) {
    state.tray.push(randomShape());
  }
}

function updateHud() {
  scoreEl.textContent = state.score;
}

function setMessage(text) {
  messageEl.textContent = text;
}

function changePalette() {
  state.paletteIndex = (state.paletteIndex + 1) % PALETTES.length;
  const palette = PALETTES[state.paletteIndex];
  state.board = state.board.map((line, row) => line.map((value, col) => (
    value ? palette[(row * SIZE + col) % palette.length] : null
  )));
}

function createDragGhost(piece, x, y) {
  removeDragGhost();
  const maxRow = Math.max(...piece.cells.map(([row]) => row));
  const maxCol = Math.max(...piece.cells.map(([, col]) => col));
  const cells = new Set(piece.cells.map(([row, col]) => `${row}:${col}`));
  dragGhostEl = document.createElement('div');
  dragGhostEl.className = 'drag-ghost';
  dragGhostEl.style.gridTemplateColumns = `repeat(${maxCol + 1}, 28px)`;
  dragGhostEl.style.gridTemplateRows = `repeat(${maxRow + 1}, 28px)`;
  for (let row = 0; row <= maxRow; row += 1) {
    for (let col = 0; col <= maxCol; col += 1) {
      const cell = document.createElement('div');
      cell.className = 'piece-cell';
      if (cells.has(`${row}:${col}`)) cell.style.background = piece.color;
      dragGhostEl.appendChild(cell);
    }
  }
  document.body.appendChild(dragGhostEl);
  moveDragGhost(x, y);
}

function moveDragGhost(x, y) {
  if (dragGhostEl) {
    dragGhostEl.style.left = `${x}px`;
    dragGhostEl.style.top = `${y - 34}px`;
  }
}

function removeDragGhost() {
  dragGhostEl?.remove();
  dragGhostEl = null;
}

function canPlaceShape(shape, row, col) {
  if (state.gameOver) return false;
  for (const [dr, dc] of shape.cells) {
    const r = row + dr;
    const c = col + dc;
    if (r < 0 || r >= SIZE || c < 0 || c >= SIZE) return false;
    if (state.board[r][c]) return false;
  }
  return true;
}

function clearCompleteLines() {
  let cleared = 0;
  for (let r = 0; r < SIZE; r += 1) {
    if (state.board[r].every(Boolean)) {
      state.board[r].fill(null);
      cleared += 1;
    }
  }
  for (let c = 0; c < SIZE; c += 1) {
    const full = state.board.every(row => row[c]);
    if (full) {
      for (let r = 0; r < SIZE; r += 1) state.board[r][c] = null;
      cleared += 1;
    }
  }
  if (cleared > 0) {
    const bonus = 100 * cleared * state.combo;
    state.score += bonus;
    state.combo = Math.min(9, state.combo + 1);
    changePalette();
    setMessage(`Cleared ${cleared} line${cleared > 1 ? 's' : ''}. Palette ${state.paletteIndex + 1}/180.`);
  } else {
    state.combo = 1;
  }
  return cleared;
}

function hasAnyMove() {
  for (const piece of state.tray) {
    for (let row = 0; row < SIZE; row += 1) {
      for (let col = 0; col < SIZE; col += 1) {
        if (canPlaceShape(piece, row, col)) return true;
      }
    }
  }
  return false;
}

function placePieceAt(row, col, piece) {
  for (const [dr, dc] of piece.cells) {
    const r = row + dr;
    const c = col + dc;
    state.board[r][c] = piece.color;
  }
}

function renderPreview() {
  Array.from(boardEl.children).forEach(cell => {
    cell.classList.remove('preview-valid', 'preview-invalid');
  });
  if (!state.preview) return;

  const { row, col } = state.preview;
  const piece = state.tray[state.selectedPieceIndex];
  if (!piece) return;

  const valid = canPlaceShape(piece, row, col);
  piece.cells.forEach(([dr, dc]) => {
    const previewRow = row + dr;
    const previewCol = col + dc;
    if (previewRow >= 0 && previewRow < SIZE && previewCol >= 0 && previewCol < SIZE) {
      boardEl.children[previewRow * SIZE + previewCol]?.classList.add(valid ? 'preview-valid' : 'preview-invalid');
    }
  });
}

function updateDragPreview(event) {
  if (!state.dragging || state.selectedPieceIndex === null) return;
  moveDragGhost(event.clientX, event.clientY);
  const target = document.elementFromPoint(event.clientX, event.clientY)?.closest('.cell');
  if (!target) return;

  const nextPreview = { row: Number(target.dataset.row), col: Number(target.dataset.col) };
  if (!state.preview || state.preview.row !== nextPreview.row || state.preview.col !== nextPreview.col) {
    state.preview = nextPreview;
    renderPreview();
  }
}

function finishDrag(event) {
  if (!state.dragging) return;
  state.dragging = false;
  removeDragGhost();
  const target = document.elementFromPoint(event.clientX, event.clientY)?.closest('.cell');
  if (target) {
    handleBoardClick(Number(target.dataset.row), Number(target.dataset.col));
  } else {
    state.preview = null;
    render();
  }
}

function renderBoard() {
  boardEl.innerHTML = '';
  for (let row = 0; row < SIZE; row += 1) {
    for (let col = 0; col < SIZE; col += 1) {
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'cell';
      cell.dataset.row = row;
      cell.dataset.col = col;
      const value = state.board[row][col];
      if (value) {
        cell.classList.add('filled');
        cell.style.background = value;
      }
      if (state.preview && state.preview.row === row && state.preview.col === col) {
        const previewPiece = state.tray[state.selectedPieceIndex];
        cell.classList.add(previewPiece && canPlaceShape(previewPiece, row, col) ? 'preview-valid' : 'preview-invalid');
      }
      cell.addEventListener('mouseenter', () => {
        if (state.selectedPieceIndex !== null) {
          state.preview = { row, col };
          renderPreview();
        }
      });
      cell.addEventListener('click', () => handleBoardClick(row, col));
      boardEl.appendChild(cell);
    }
  }
}

function renderTray() {
  trayEl.innerHTML = '';
  state.tray.forEach((piece, idx) => {
    const wrap = document.createElement('div');
    wrap.className = 'piece-grid';
    wrap.style.borderColor = state.selectedPieceIndex === idx ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.08)';
    wrap.style.background = state.selectedPieceIndex === idx ? 'rgba(124,156,255,0.12)' : 'rgba(255,255,255,0.02)';

    const mini = document.createElement('div');
    mini.className = 'piece';
    if (state.selectedPieceIndex === idx) mini.classList.add('piece-selected');
    mini.style.background = 'transparent';
    mini.style.display = 'grid';
    mini.style.gridTemplateColumns = 'repeat(3, 1fr)';
    mini.style.gridTemplateRows = 'repeat(3, 1fr)';
    mini.style.cursor = 'pointer';

    const maxRow = Math.max(...piece.cells.map(([r]) => r));
    const maxCol = Math.max(...piece.cells.map(([, c]) => c));
    const cellsMap = new Map(piece.cells.map(([r, c]) => [`${r}:${c}`, true]));

    for (let r = 0; r <= Math.max(2, maxRow); r += 1) {
      for (let c = 0; c <= Math.max(2, maxCol); c += 1) {
        const node = document.createElement('div');
        node.className = 'piece-cell';
        node.style.background = cellsMap.has(`${r}:${c}`) ? piece.color : 'transparent';
        mini.appendChild(node);
      }
    }

    mini.addEventListener('click', () => {
      state.selectedPieceIndex = state.selectedPieceIndex === idx ? null : idx;
      state.preview = null;
      setMessage(state.selectedPieceIndex === null ? 'Pick a piece' : 'Click a board spot');
      render();
    });

    mini.addEventListener('pointerdown', event => {
      if (state.gameOver) return;
      event.preventDefault();
      state.selectedPieceIndex = idx;
      state.dragging = true;
      state.preview = null;
      createDragGhost(piece, event.clientX, event.clientY);
      setMessage('Release on the board');
      render();
    });

    wrap.appendChild(mini);
    trayEl.appendChild(wrap);
  });
}

function handleBoardClick(row, col) {
  if (state.gameOver || state.selectedPieceIndex === null) {
    setMessage('Select a piece first');
    return;
  }

  const piece = state.tray[state.selectedPieceIndex];
  if (!piece || !canPlaceShape(piece, row, col)) {
    setMessage('That spot is blocked. Try another.');
    return;
  }

  placePieceAt(row, col, piece);
  state.score += piece.cells.length * 10;
  state.tray.splice(state.selectedPieceIndex, 1);
  state.selectedPieceIndex = null;
  state.preview = null;
  const cleared = clearCompleteLines();
  if (state.tray.length === 0) refillTray();

  if (!hasAnyMove()) {
    state.gameOver = true;
    setMessage('No moves left. Start a new game.');
  } else if (cleared > 0) {
    setMessage(`Cleared ${cleared} line${cleared > 1 ? 's' : ''}. Palette ${state.paletteIndex + 1}/180.`);
  } else if (state.tray.length === 3) {
    setMessage('New pieces ready.');
  } else {
    setMessage('Choose another piece.');
  }

  updateHud();
  render();
}

function resetGame() {
  state.board = createBoard();
  state.tray = [];
  state.selectedPieceIndex = null;
  state.preview = null;
  state.dragging = false;
  state.score = 0;
  state.combo = 1;
  state.paletteIndex = 0;
  state.gameOver = false;
  refillTray();
  setMessage('Pick a piece');
  updateHud();
  render();
}

function shuffleTray() {
  if (state.gameOver) return;
  const copy = [...state.tray];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  state.tray = copy;
  setMessage('Pieces reordered.');
  render();
}

function render() {
  renderBoard();
  renderTray();
  updateHud();
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}

newGameBtn.addEventListener('click', resetGame);
shuffleBtn.addEventListener('click', shuffleTray);
document.addEventListener('pointermove', updateDragPreview);
document.addEventListener('pointerup', finishDrag);
document.addEventListener('pointercancel', finishDrag);

resetGame();
