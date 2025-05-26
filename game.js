window.addEventListener('DOMContentLoaded', () => {
  // 8192 oyunu JS - animasyonlu sayı hareketleri, renkler web sitesine uyumlu, yön tuşları doğru çalışıyor

  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const restartBtn = document.getElementById('restartBtn');
  const scoreBox = document.getElementById('scoreBox');

  const size = 4;
  const tileSize = canvas.width / size;

  let board = [];
  let score = 0;

  function createEmptyBoard() {
    board = [];
    for (let r = 0; r < size; r++) {
      board[r] = [];
      for (let c = 0; c < size; c++) {
        board[r][c] = 0;
      }
    }
  }

  function addRandomTile() {
    let emptyTiles = [];
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (board[r][c] === 0) emptyTiles.push({ r, c });
      }
    }
    if (emptyTiles.length === 0) return false;
    const { r, c } = emptyTiles[Math.floor(Math.random() * emptyTiles.length)];
    board[r][c] = Math.random() < 0.9 ? 2 : 4;
    return true;
  }

  function drawTile(x, y, value, alpha=1) {
    const colors = {
      0: '#121212',
      2: '#00ffe7',
      4: '#00bfff',
      8: '#00a0d1',
      16: '#0088b3',
      32: '#006699',
      64: '#004d7a',
      128: '#003d5c',
      256: '#002d3d',
      512: '#001f28',
      1024: '#001313',
      2048: '#000909',
      4096: '#001111',
      8192: '#001818'
    };

    ctx.fillStyle = colors[value] || '#000000';
    ctx.globalAlpha = alpha;
    ctx.roundRect(x, y, tileSize - 12, tileSize - 12, 14);
    ctx.fill();

    if (value !== 0) {
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${tileSize / 2}px 'Inter', sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = '#00ffe7';
      ctx.shadowBlur = 12;
      ctx.fillText(value, x + (tileSize - 12) / 2, y + (tileSize - 12) / 2);
      ctx.shadowBlur = 0;
    }
    ctx.globalAlpha = 1;
  }

  CanvasRenderingContext2D.prototype.roundRect = function(x, y, w, h, r) {
    if (w < 2 * r) r = w / 2;
    if (h < 2 * r) r = h / 2;
    this.beginPath();
    this.moveTo(x+r, y);
    this.arcTo(x+w, y, x+w, y+h, r);
    this.arcTo(x+w, y+h, x, y+h, r);
    this.arcTo(x, y+h, x, y, r);
    this.arcTo(x, y, x+w, y, r);
    this.closePath();
    return this;
  }

  function drawBoard() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        drawTile(c * tileSize + 6, r * tileSize + 6, board[r][c]);
      }
    }
  }

  function copyBoard(b) {
    return b.map(row => row.slice());
  }

  function boardsEqual(b1, b2) {
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (b1[r][c] !== b2[r][c]) return false;
      }
    }
    return true;
  }

  function rotateBoardLeft(b) {
    const newBoard = createEmptyBoardReturn();
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        newBoard[size - 1 - c][r] = b[r][c];
      }
    }
    return newBoard;
  }

  function createEmptyBoardReturn() {
    let b = [];
    for (let r = 0; r < size; r++) {
      b[r] = [];
      for (let c = 0; c < size; c++) b[r][c] = 0;
    }
    return b;
  }

  // Move and merge left helper
  function slideAndMergeRow(row) {
    let arr = row.filter(v => v !== 0);
    for (let i = 0; i < arr.length - 1; i++) {
      if (arr[i] === arr[i+1]) {
        arr[i] *= 2;
        score += arr[i];
        arr.splice(i+1, 1);
      }
    }
    while (arr.length < size) arr.push(0);
    return arr;
  }

  function move(direction) {
    // Directions corrected:
    // ArrowUp: move up (merge upwards)
    // ArrowDown: move down
    // ArrowLeft: move left
    // ArrowRight: move right

    let rotatedTimes = 0;
    let moved = false;

    let oldBoard = copyBoard(board);

    // rotate board so we can reuse slideAndMergeRow for left moves only
    switch(direction) {
      case 'ArrowUp': 
        board = rotateBoardLeft(board);
        board = rotateBoardLeft(board);
        board = rotateBoardLeft(board);
        rotatedTimes = 3;
        break;
      case 'ArrowDown':
        board = rotateBoardLeft(board);
        rotatedTimes = 1;
        break;
      case 'ArrowRight':
        board = rotateBoardLeft(board);
        board = rotateBoardLeft(board);
        rotatedTimes = 2;
        break;
      case 'ArrowLeft':
        rotatedTimes = 0;
        break;
    }

    for (let r = 0; r < size; r++) {
      const newRow = slideAndMergeRow(board[r]);
      if (!moved && newRow.some((v, i) => v !== board[r][i])) moved = true;
      board[r] = newRow;
    }

    // rotate back to original orientation
    for (let i = 0; i < (4 - rotatedTimes) % 4; i++) {
      board = rotateBoardLeft(board);
    }

    if (moved) {
      addRandomTile();
      updateScore();
      animateMove();
      drawBoard();
    }
  }

  function updateScore() {
    scoreBox.textContent = `Skor: ${score}`;
  }

  function animateMove() {
    // Basit geçiş animasyonu: canvas yarı saydam ve geri gelir
    let alpha = 0;
    const animDuration = 250;
    const startTime = performance.now();

    function animFrame(time) {
      alpha = (time - startTime) / animDuration;
      if (alpha > 1) alpha = 1;
      ctx.globalAlpha = alpha;
      drawBoard();
      ctx.globalAlpha = 1;
      if (alpha < 1) requestAnimationFrame(animFrame);
    }
    requestAnimationFrame(animFrame);
  }

  function checkGameOver() {
    // Basit kontrol: boş kare yoksa ve hareket ettirilemiyorsa oyun biter
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (board[r][c] === 0) return false;
        if (c < size - 1 && board[r][c] === board[r][c+1]) return false;
        if (r < size - 1 && board[r][c] === board[r+1][c]) return false;
      }
    }
    return true;
  }

  function gameOver() {
    alert(`Oyun bitti! Skorunuz: ${score}`);
  }

  function init() {
    score = 0;
    updateScore();
    createEmptyBoard();
    addRandomTile();
    addRandomTile();
    drawBoard();
  }

  document.addEventListener('keydown', e => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      e.preventDefault();
      move(e.key);
      if (checkGameOver()) gameOver();
    }
  });

  restartBtn.addEventListener('click', () => {
    init();
  });

  // İlk başlatma
  init();
});
