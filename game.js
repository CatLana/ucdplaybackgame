// Simple retro Snake toy-collector
(function(){
  const canvas = document.getElementById('game-canvas');
  const ctx = canvas.getContext('2d');
  const scoreEl = document.getElementById('score');
  const timerEl = document.getElementById('timer');
  const overlay = document.getElementById('end-overlay');
  const finalScoreEl = document.getElementById('final-score');
  const saveBtn = document.getElementById('save-score');
  const shareBtn = document.getElementById('share-score');
  const donateBtn = document.getElementById('donate-btn');
  const playAgainBtn = document.getElementById('play-again');
  const endQr = document.getElementById('end-qr');
  const startPauseBtn = document.getElementById('start-pause');

  // Spec: 5s rounds, gentle speed, edge-wrapping, shapes for toys, different points
  const ROUND_SECONDS = 60;
  const CELL = 20; // grid cell size in px (adjusts game feel)
  const TICK_RATE = 8; // gentle speed: 8 ticks per second

  // compute grid size from canvas attributes
  const COLS = Math.floor(canvas.width / CELL);
  const ROWS = Math.floor(canvas.height / CELL);

  // Toy types (shapes only) with points and growth
  const TOY_TYPES = [
    { id:'ball', shape:'circle', color:'#ff6b6b', points:30, growth:1 },
    { id:'teddy', shape:'circle', color:'#ffd166', points:50, growth:1 },
    { id:'doll', shape:'triangle', color:'#4ecdc4', points:70, growth:2 },
    { id:'robot', shape:'square', color:'#5b8cfe', points:90, growth:2 }
  ];

  // Pre-render toy SVG sprites into Image objects
  const toySprites = [];
  function svgToDataUrl(svg){ return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg); }
  function makeToySVG(type){
    const size = 64;
    const color = type.color || '#fff';
    // simple svg variants per type.id
    if(type.id === 'ball'){
      return `<?xml version='1.0' encoding='utf-8'?><svg xmlns='http://www.w3.org/2000/svg' width='${size}' height='${size}' viewBox='0 0 ${size} ${size}'>
        <defs><radialGradient id='g' cx='30%' cy='30%'><stop offset='0' stop-color='#fff' stop-opacity='0.9'/><stop offset='1' stop-color='${color}' stop-opacity='1'/></radialGradient></defs>
        <circle cx='${size/2}' cy='${size/2}' r='${size*0.38}' fill='url(#g)' stroke='#000' stroke-opacity='0.12' stroke-width='2'/>
        <path d='M ${size*0.3} ${size*0.6} Q ${size*0.5} ${size*0.4} ${size*0.7} ${size*0.6}' stroke='rgba(255,255,255,0.6)' stroke-width='2' fill='none' stroke-linecap='round'/>
      </svg>`;
    }
    if(type.id === 'teddy'){
      return `<?xml version='1.0' encoding='utf-8'?><svg xmlns='http://www.w3.org/2000/svg' width='${size}' height='${size}' viewBox='0 0 ${size} ${size}'>
        <g fill='${color}' stroke='#000' stroke-opacity='0.12' stroke-width='2'>
          <circle cx='${size*0.35}' cy='${size*0.35}' r='${size*0.16}' />
          <circle cx='${size*0.65}' cy='${size*0.35}' r='${size*0.16}' />
          <circle cx='${size*0.5}' cy='${size*0.6}' r='${size*0.28}' />
        </g>
      </svg>`;
    }
    if(type.id === 'doll'){
      return `<?xml version='1.0' encoding='utf-8'?><svg xmlns='http://www.w3.org/2000/svg' width='${size}' height='${size}' viewBox='0 0 ${size} ${size}'>
        <rect x='${size*0.28}' y='${size*0.35}' width='${size*0.44}' height='${size*0.45}' rx='${size*0.06}' fill='${color}' stroke='#000' stroke-opacity='0.12' stroke-width='2'/>
        <circle cx='${size*0.5}' cy='${size*0.22}' r='${size*0.12}' fill='#fff' stroke='rgba(0,0,0,0.08)' stroke-width='1'/>
      </svg>`;
    }
    // robot
    return `<?xml version='1.0' encoding='utf-8'?><svg xmlns='http://www.w3.org/2000/svg' width='${size}' height='${size}' viewBox='0 0 ${size} ${size}'>
      <rect x='${size*0.22}' y='${size*0.25}' width='${size*0.56}' height='${size*0.5}' rx='${size*0.06}' fill='${type.color}' stroke='#000' stroke-opacity='0.12' stroke-width='2'/>
      <circle cx='${size*0.4}' cy='${size*0.45}' r='${size*0.06}' fill='#fff'/>
      <circle cx='${size*0.6}' cy='${size*0.45}' r='${size*0.06}' fill='#fff'/>
      <rect x='${size*0.45}' y='${size*0.6}' width='${size*0.1}' height='${size*0.08}' rx='2' fill='#000' opacity='0.12'/>
    </svg>`;
  }
  // create Image objects
  for(let i=0;i<TOY_TYPES.length;i++){ const data = svgToDataUrl(makeToySVG(TOY_TYPES[i])); const img = new Image(); img.src = data; toySprites.push(img); }

  // DOM element for toy legend (shows points and counts)
  const toyLegendEl = document.getElementById('toy-legend');


  // game state
  let snake = []; // array of {x,y} grid cells, head is snake[0]
  let dir = { x:1, y:0 }; // current direction
  let nextDir = { x:1, y:0 };
  let toys = []; // placed toys: {x,y,typeIndex}
  let toyCounts = new Array(TOY_TYPES.length).fill(0);
  let score = 0;
  let running = false;
  let startedOnce = false; // track if player started a round
  let startTime = null; // performance.now() at start
  let elapsedPaused = 0;

  // timing for tick loop
  let acc = 0;
  let lastTs = 0;

  // helpers
  function gridToPx(cell){ return { x: cell.x * CELL + CELL/2, y: cell.y * CELL + CELL/2 }; }

  function randCell(){ return { x: Math.floor(Math.random()*COLS), y: Math.floor(Math.random()*ROWS) }; }

  function cellEquals(a,b){ return a.x===b.x && a.y===b.y; }

  function placeToy(){
    // find empty cell
    for(let attempts=0; attempts<200; attempts++){
      const c = randCell();
      const occupied = snake.some(s=>cellEquals(s,c)) || toys.some(t=>cellEquals(t,c));
      if(!occupied){ toys.push({ x:c.x, y:c.y, typeIndex: Math.floor(Math.random()*TOY_TYPES.length) }); return; }
    }
  }

  function resetGame(){
    // center snake
    const cx = Math.floor(COLS/2);
    const cy = Math.floor(ROWS/2);
    snake = [];
    for(let i=0;i<4;i++) snake.push({ x: cx - i, y: cy });
    dir = { x:1, y:0 };
    nextDir = { x:1, y:0 };
    toys = [];
    score = 0;
    // reset toy counts and spawn a few toys
    toyCounts = new Array(TOY_TYPES.length).fill(0);
    for(let i=0;i<6;i++) placeToy();
    updateUI();
    renderToyLegend();
  }

  // input handling (keyboard)
  window.addEventListener('keydown', e=>{
    const block = ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown',' ','Spacebar'];
    if(block.includes(e.key)) try{ e.preventDefault(); }catch(_){}
    if(e.key==='ArrowLeft') nextDir = { x:-1, y:0 };
    if(e.key==='ArrowRight') nextDir = { x:1, y:0 };
    if(e.key==='ArrowUp') nextDir = { x:0, y:-1 };
    if(e.key==='ArrowDown') nextDir = { x:0, y:1 };
  });

  // pointer for mobile: tap on left/right/top/bottom halves to steer
  canvas.addEventListener('pointerdown', e=>{
    const rect = canvas.getBoundingClientRect();
    const px = (e.clientX - rect.left) * (canvas.width / rect.width);
    const py = (e.clientY - rect.top) * (canvas.height / rect.height);
    const headPx = gridToPx(snake[0]);
    const dx = px - headPx.x;
    const dy = py - headPx.y;
    if(Math.abs(dx) > Math.abs(dy)) nextDir = { x: dx>0 ? 1 : -1, y:0 };
    else nextDir = { x:0, y: dy>0 ? 1 : -1 };
  });

  // game tick (grid movement)
  function tick(){
    // apply nextDir
    dir = nextDir;
    // compute new head with wrapping
    let nx = snake[0].x + dir.x;
    let ny = snake[0].y + dir.y;
    if(nx < 0) nx = COLS - 1; if(nx >= COLS) nx = 0;
    if(ny < 0) ny = ROWS - 1; if(ny >= ROWS) ny = 0;
    const newHead = { x: nx, y: ny };

    // add head
    snake.unshift(newHead);

    // check toy collision
    let ate = -1;
    for(let i=0;i<toys.length;i++){
      if(toys[i].x === newHead.x && toys[i].y === newHead.y){ ate = i; break; }
    }
    if(ate >= 0){
      const t = TOY_TYPES[toys[ate].typeIndex];
      // increment collected count for this toy type
      toyCounts[toys[ate].typeIndex] = (toyCounts[toys[ate].typeIndex] || 0) + 1;
      score += t.points;
      // grow by leaving tail (growth handled by not popping for growth steps)
      for(let g=0; g < t.growth-1; g++){
        // duplicate last tail cell to grow
        const tail = snake[snake.length-1];
        snake.push({ x: tail.x, y: tail.y });
      }
      toys.splice(ate,1);
      // spawn a replacement toy
      placeToy();
      // update legend to reflect new counts
      renderToyLegend();
    } else {
      // normal movement: remove tail (no growth)
      snake.pop();
    }
  }

  function updateUI(){
    scoreEl.textContent = 'Score: ' + score;
    if(!startTime) timerEl.textContent = 'Time: 0s';
    else {
      const elapsed = (performance.now() - startTime - elapsedPaused)/1000;
      timerEl.textContent = 'Time: ' + Math.max(0, Math.ceil(ROUND_SECONDS - elapsed)) + 's';
    }
  }

  // Render toy legend with point values and counts
  function renderToyLegend(){
    if(!toyLegendEl) return;
    const parts = [];
    // description line (full width)
    parts.push(`<div class="legend-desc">Each toy gives a different number of points — collect the best ones to maximise your score.</div>`);
    for(let i=0;i<TOY_TYPES.length;i++){
      const ty = TOY_TYPES[i];
      const count = (toyCounts && toyCounts[i])? toyCounts[i] : 0;
      const imgHtml = toySprites[i] && toySprites[i].src ? `<img src="${toySprites[i].src}"/>` : `<span style="display:inline-block;width:20px;height:20px;background:${ty.color};border-radius:4px"></span>`;
      const name = ty.id.charAt(0).toUpperCase() + ty.id.slice(1);
      parts.push(`<div class="toy-item">${imgHtml}<span>${name} — ${ty.points} pts <strong style=\"margin-left:6px;color:#ffd\">x${count}</strong></span></div>`);
    }
    toyLegendEl.innerHTML = parts.join('');
  }

  function draw(){
    // clear
    ctx.fillStyle = '#071b14'; // dark retro background
    ctx.fillRect(0,0,canvas.width,canvas.height);

    // grid faint
    ctx.strokeStyle = 'rgba(255,255,255,0.03)';
    ctx.lineWidth = 1;
    for(let x=0;x<=COLS;x++){ ctx.beginPath(); ctx.moveTo(x*CELL,0); ctx.lineTo(x*CELL,canvas.height); ctx.stroke(); }
    for(let y=0;y<=ROWS;y++){ ctx.beginPath(); ctx.moveTo(0,y*CELL); ctx.lineTo(canvas.width,y*CELL); ctx.stroke(); }

    // draw toys (use pre-rendered SVG sprites when available)
    for(const t of toys){
      const p = gridToPx(t);
      const ty = TOY_TYPES[t.typeIndex];
      const sprite = toySprites[t.typeIndex];
      const size = Math.floor(CELL * 0.9);
      if(sprite && sprite.complete){
        ctx.drawImage(sprite, Math.round(p.x - size/2), Math.round(p.y - size/2), size, size);
      } else {
        // fallback to simple shape while image loads
        ctx.fillStyle = ty.color;
        ctx.strokeStyle = 'rgba(0,0,0,0.15)';
        ctx.lineWidth = 2;
        const s = CELL*0.4;
        ctx.beginPath();
        if(ty.shape === 'circle') ctx.arc(p.x, p.y, s/2, 0, Math.PI*2);
        else if(ty.shape === 'square') ctx.rect(p.x - s/2, p.y - s/2, s, s);
        else if(ty.shape === 'triangle') { ctx.moveTo(p.x, p.y - s/2); ctx.lineTo(p.x - s/2, p.y + s/2); ctx.lineTo(p.x + s/2, p.y + s/2); ctx.closePath(); }
        ctx.fill(); ctx.stroke();
      }
    }

    // draw snake
    for(let i=snake.length-1;i>=0;i--){
      const s = snake[i];
      const p = gridToPx(s);
      const alpha = 1 - (i / (snake.length + 3));
      ctx.fillStyle = `rgba(255,255,255,${0.12 + alpha*0.6})`;
      ctx.strokeStyle = 'rgba(0,0,0,0.2)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.rect(p.x - CELL*0.45, p.y - CELL*0.45, CELL*0.9, CELL*0.9); ctx.fill(); ctx.stroke();
    }

    // HUD handled by DOM
    updateUI();
  }

  // main loop using rAF + accumulator to drive fixed ticks
  function loop(ts){
    if(!lastTs) lastTs = ts;
    const dt = (ts - lastTs)/1000; lastTs = ts;
    if(running){
      acc += dt;
      const tickDt = 1 / TICK_RATE;
      while(acc >= tickDt){
        tick(); acc -= tickDt;
      }
    }
    draw();
    // check round end
    if(startTime && running){
      const elapsed = (performance.now() - startTime - elapsedPaused)/1000;
      if(elapsed >= ROUND_SECONDS){ endRound(); }
    }
    requestAnimationFrame(loop);
  }

  function startRound(){
    // start a fresh round
    resetGame();
    startTime = performance.now();
    elapsedPaused = 0;
    running = true;
    startedOnce = true;
    startPauseBtn.textContent = 'Pause';
    overlay.style.display = 'none';
  }

  function pauseRound(){ if(!running) return; running = false; startPauseBtn.textContent = 'Resume'; }
  function resumeRound(){ if(running) return; running = true; startPauseBtn.textContent = 'Pause'; }

  startPauseBtn.addEventListener('click', ()=>{
    // if never started, start the round
    if(!startedOnce){ startRound(); return; }
    if(running) pauseRound(); else resumeRound();
  });

  // do not auto-resume on visibilitychange, but pause when hidden
  document.addEventListener('visibilitychange', ()=>{ if(document.hidden && running) pauseRound(); });

  function endRound(){
    running = false;
    // only show overlay if round was actually started
    finalScoreEl.textContent = 'Your score: ' + score;
    overlay.style.display = 'flex';
    // prepare QR (optional)
    const origin = window.location.origin === 'null' ? window.location.href.replace(/\\[^/]*$/,'') : window.location.origin;
    const gameUrl = origin + window.location.pathname.replace(/[^/]*$/,'') + 'game.html?challenge=' + score;
    if(endQr) endQr.src = 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=' + encodeURIComponent(gameUrl);
  }

  // Save score: prefer parent.postMessage (parent handles modal). Fallback to local prompt save.
  function requestSave(){
    if(window.parent && window.parent !== window){
      window.parent.postMessage({ type:'request-save-score', score }, '*');
    } else {
      const name = prompt('Enter name to save score (max 20 chars):','');
      if(name===null) return;
      const entry = { name: (name||'Player').slice(0,20), score: score, date: (new Date()).toISOString() };
      const raw = localStorage.getItem('playback_leaderboard'); let list = raw?JSON.parse(raw):[]; list.push(entry); list.sort((a,b)=>b.score - a.score); list = list.slice(0,50); localStorage.setItem('playback_leaderboard', JSON.stringify(list)); alert('Score saved!');
    }
  }

  function shareChallenge(){ const origin = window.location.origin === 'null' ? window.location.href.replace(/\\[^/]*$/,'') : window.location.origin; const url = origin + window.location.pathname.replace(/[^/]*$/,'') + 'game.html?challenge=' + score; const text = `I scored ${score} on PlayBack! Beat my score: ` + url;
    if(navigator.share){ navigator.share({ title:'PlayBack challenge', text:text, url:url }).catch(()=>{}); }
    else { const twitter = 'https://twitter.com/intent/tweet?text=' + encodeURIComponent(text); window.open(twitter,'_blank'); }
  }

  // UI hooks
  saveBtn.addEventListener('click', requestSave);
  shareBtn.addEventListener('click', shareChallenge);
  donateBtn.addEventListener('click', ()=>{ window.open('https://museumofchildhood.ie/support-us/','_blank'); });
  playAgainBtn.addEventListener('click', ()=>{ overlay.style.display='none'; startRound(); });

  // initialize and start loop (do NOT auto-start round)
  resetGame();
  startPauseBtn.textContent = 'Start';
  requestAnimationFrame(loop);

  // show challenge banner if provided
  (function showChallengeBanner(){ const p = new URLSearchParams(window.location.search); const v = p.get('challenge'); if(v){ const b = document.createElement('div'); b.style.background='#fffbcc'; b.style.padding='8px'; b.style.border='1px solid #ffd24d'; b.style.margin='8px'; b.textContent = `You've been challenged to beat ${v} points — good luck!`; document.body.insertBefore(b, document.body.firstChild); } })();

})();
