const SIZE = 8;
const STORAGE_KEY = 'block-blast-best-score';
const SHAPES = [
  { color: '#ff6b6b', cells: [[0, 0]] },
  { color: '#ffd166', cells: [[0, 0], [1, 0]] },
  { color: '#06d6a0', cells: [[0, 0], [0, 1], [1, 0]] },
  { color: '#4cc9f0', cells: [[0, 0], [1, 0], [2, 0]] },
  { color: '#a78bfa', cells: [[0, 0], [1, 0], [1, 1]] },
  { color: '#f72585', cells: [[0, 0], [1, 0], [2, 0], [1, 1]] },
  { color: '#7c9cff', cells: [[0, 0], [1, 0], [0, 1], [1, 1]] },
  { color: '#ff9f1c', cells: [[0, 0], [1, 0], [2, 0], [2, 1]] },
  { color: '#2dd4bf', cells: [[0, 0], [1, 0], [1, 1], [2, 1]] },
  { color: '#f472b6', cells: [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1]] }
];

const boardEl = document.getElementById('board');
const trayEl = document.getElementById('tray');
const scoreEl = document.getElementById('scoreValue');
const bestEl = document.getElementById('bestValue');
const movesEl = document.getElementById('movesValue');
const messageEl = document.getElementById('message');
const newGameBtn = document.getElementById('newGameBtn');
const shuffleBtn = document.getElementById('shuffleBtn');

const state = {
  board: createBoard(),
  tray: [],
  selectedPieceIndex: null,
  score: 0,
  moves: 0,
  best: Number(localStorage.getItem(STORAGE_KEY) || 0),
  gameOver: false
};

function createBoard() {
  return Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
}

function randomShape() {
  const template = SHAPES[Math.floor(Math.random() * SHAPES.length)];
  return {
    color: template.color,
    cells: template.cells.map(([r, c]) => [r, c])
  };
}

function refillTray() {
  while (state.tray.length < 3) {
    state.tray.push(randomShape());
  }
}

function cloneBoard() {
  return state.board.map(row => [...row]);
}

function updateBest() {
  if (state.score > state.best) {
    state.best = state.score;
    localStorage.setItem(STORAGE_KEY, String(state.best));
  }
  bestEl.textContent = state.best;
}

function updateHud() {
  scoreEl.textContent = state.score;
  movesEl.textContent = state.moves;
  updateBest();
}

function setMessage(text) {
  messageEl.textContent = text;
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
      for (let r = 0; r < SIZE; r += 1) {
        state.board[r][c] = null;
      }
      cleared += 1;
    }
  }

  if (cleared > 0) {
    state.score += cleared * 100;
    setMessage(`Cleared ${cleared} line${cleared > 1 ? 's' : ''}!`);
  }
}

function hasAnyMove() {
  for (const piece of state.tray) {
    for (let row = 0; row < SIZE; row += 1) {
      for (let col = 0; col < SIZE; col += 1) {
        if (canPlaceShape(piece, row, col)) {
          return true;
        }
      }
    }
  }
  return false;
}

function renderBoard() {
  boardEl.innerHTML = '';

  for (let row = 0; row < SIZE; row += 1) {
    for (let col = 0; col < SIZE; col += 1) {
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'cell';
      const value = state.board[row][col];
      if (value) {
        cell.classList.add('filled');
        cell.style.background = value;
      }
      cell.dataset.row = String(row);
      cell.dataset.col = String(col);
      cell.addEventListener('click', () => handleBoardClick(row, col));
      boardEl.appendChild(cell);
    }
  }
}

function renderTray() {
  trayEl.innerHTML = '';

  state.tray.forEach((piece, idx) => {
    const pieceWrap = document.createElement('div');
    pieceWrap.className = 'piece-grid';
    pieceWrap.setAttribute('title', 'Select piece');
    pieceWrap.style.borderColor = state.selectedPieceIndex === idx ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.08)';
    pieceWrap.style.background = state.selectedPieceIndex === idx ? 'rgba(124,156,255,0.12)' : 'rgba(255,255,255,0.02)';

    const mini = document.createElement('div');
    mini.className = 'piece';
    mini.style.background = piece.color;
    mini.style.gridTemplateColumns = 'repeat(3, 1fr)';
    mini.style.gridTemplateRows = 'repeat(3, 1fr)';
    mini.style.display = 'grid';
    mini.style.position = 'relative';
    mini.style.cursor = 'pointer';

    const maxRow = Math.max(...piece.cells.map(([r]) => r));
    const maxCol = Math.max(...piece.cells.map(([, c]) => c));
    const cellMap = new Map(piece.cells.map(([r, c]) => [`${r}:${c}`, [r, c]]));

    for (let r = 0; r <= Math.max(2, maxRow); r += 1) {
      for (let c = 0; c <= Math.max(2, maxCol); c += 1) {
        const cell = document.createElement('div');
        cell.className = 'piece-cell';
        if (cellMap.has(`${r}:${c}`)) {
          cell.style.background = piece.color;
          cell.style.borderRadius = '8px';
        } else {
          cell.style.background = 'transparent';
        }
        mini.appendChild(cell);
      }
    }

    mini.addEventListener('click', () => {
      state.selectedPieceIndex = state.selectedPieceIndex === idx ? null : idx;
      setMessage(state.selectedPieceIndex === null ? 'Pick a piece' : 'Click a spot on the board');
      render();
    });

    pieceWrap.appendChild(mini);
    trayEl.appendChild(pieceWrap);
  });
}

function handleBoardClick(row, col) {
  if (state.gameOver || state.selectedPieceIndex === null) {
    setMessage('Select a piece first');
    return;
  }

  const piece = state.tray[state.selectedPieceIndex];
  if (!piece) return;

  if (!canPlaceShape(piece, row, col)) {
    setMessage('That spot is blocked. Try another spot.');
    return;
  }

  for (const [dr, dc] of piece.cells) {
    const r = row + dr;
    const c = col + dc;
    state.board[r][c] = piece.color;
  }

  state.tray.splice(state.selectedPieceIndex, 1);
  state.selectedPieceIndex = null;
  state.moves += 1;

  clearCompleteLines();
  refillTray();

  if (!hasAnyMove()) {
    state.gameOver = true;
    setMessage('No moves left — game over!');
  } else {
    setMessage('Nice move!');
  }

  updateHud();
  render();
}

function resetGame() {
  state.board = createBoard();
  state.tray = [];
  state.selectedPieceIndex = null;
  state.score = 0;
  state.moves = 0;
  state.gameOver = false;
  refillTray();
  setMessage('Pick a piece');
  updateHud();
  render();
}

function shuffleTray() {
  if (state.gameOver) return;
  state.tray = state.tray.map(piece => ({ ...piece, cells: [...piece.cells.map(([r, c]) => [r, c])] }));
  for (let i = state.tray.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [state.tray[i], state.tray[j]] = [state.tray[j], state.tray[i]];
  }
  setMessage('Pieces shuffled');
  render();
}

function render() {
  renderBoard();
  renderTray();
  updateHud();
}

newGameBtn.addEventListener('click', resetGame);
shuffleBtn.addEventListener('click', shuffleTray);

resetGame();
