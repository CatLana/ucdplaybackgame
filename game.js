// Simple PlayBack prototype game
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

  // Game settings
  const ROUND_SECONDS = 45; // short round
  let score = 0;
  let startTime = null;
  let running = false;
  let collectibles = [];
  let lastSpawn = 0;
  let particles = [];
  const bgStars = [];
  for(let i=0;i<30;i++){ bgStars.push({x:Math.random()*canvas.width, y:Math.random()*canvas.height, r:Math.random()*2+0.5, a:Math.random()*0.7+0.2, vx:(Math.random()-0.5)*6}); }

  const player = { x: canvas.width/2, y: canvas.height/2, r: 14, speed: 220, vx:0, vy:0 };

  // Controls
  const input = { left:false, right:false, up:false, down:false, touchTarget:null };
  window.addEventListener('keydown', e=>{
    // prevent arrow keys / space from scrolling parent
    const block = ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown',' ','Spacebar'];
    if(block.includes(e.key)) { try{ e.preventDefault(); }catch(_){} }
    if(e.key==='ArrowLeft') input.left=true;
    if(e.key==='ArrowRight') input.right=true;
    if(e.key==='ArrowUp') input.up=true;
    if(e.key==='ArrowDown') input.down=true;
  });
  window.addEventListener('keyup', e=>{
    const block = ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown',' ','Spacebar'];
    if(block.includes(e.key)) { try{ e.preventDefault(); }catch(_){} }
    if(e.key==='ArrowLeft') input.left=false;
    if(e.key==='ArrowRight') input.right=false;
    if(e.key==='ArrowUp') input.up=false;
    if(e.key==='ArrowDown') input.down=false;
  });

  // Touch / pointer
  canvas.addEventListener('pointerdown', e=>{ input.touchTarget = getPointerPos(e); });
  canvas.addEventListener('pointermove', e=>{ if(e.pressure>0) input.touchTarget = getPointerPos(e); });
  canvas.addEventListener('pointerup', e=>{ input.touchTarget = null; });

  function getPointerPos(e){ const rect = canvas.getBoundingClientRect(); return { x:(e.clientX-rect.left)*(canvas.width/rect.width), y:(e.clientY-rect.top)*(canvas.height/rect.height) }; }

  function spawnCollectible(){
    const r = 10 + Math.random()*8;
    const x = Math.random()*(canvas.width - 2*r) + r;
    const y = Math.random()*(canvas.height - 2*r) + r;
    const hue = 45 + Math.random()*200;
    collectibles.push({x,y,r,hue,angle:Math.random()*Math.PI*2, bob:Math.random()*1.2});
  }

  function update(dt){
    // movement
    if(input.touchTarget){ const dx = input.touchTarget.x - player.x; const dy = input.touchTarget.y - player.y; const dist = Math.hypot(dx,dy); if(dist>2){ player.vx = (dx/dist)*player.speed; player.vy = (dy/dist)*player.speed; } else { player.vx=0; player.vy=0; } }
    else {
      player.vx = ((input.right?1:0) - (input.left?1:0))*player.speed;
      player.vy = ((input.down?1:0) - (input.up?1:0))*player.speed;
    }
    player.x += player.vx * dt;
    player.y += player.vy * dt;
    // clamp
    player.x = Math.max(player.r, Math.min(canvas.width-player.r, player.x));
    player.y = Math.max(player.r, Math.min(canvas.height-player.r, player.y));

  // spawn
  lastSpawn += dt;
  if(lastSpawn > 0.7){ spawnCollectible(); lastSpawn = 0; }

    // collisions
    for(let i=collectibles.length-1;i>=0;i--){ const c = collectibles[i]; const d = Math.hypot(c.x-player.x, c.y-player.y); if(d < c.r + player.r -2){ // collected
        // spawn particles
        for(let p=0;p<10;p++){ particles.push({x:c.x, y:c.y, vx:(Math.random()-0.5)*260, vy:(Math.random()-1.5)*200, a:1, r:2+Math.random()*4, hue:c.hue}); }
        collectibles.splice(i,1); score += Math.round(50 + c.r*6);
      }
    }

    // update particles
    for(let i=particles.length-1;i>=0;i--){ const p=particles[i]; p.vy += 600*dt; p.x += p.vx*dt; p.y += p.vy*dt; p.a -= 1.5*dt; if(p.a<=0) particles.splice(i,1); }
  }

  function draw(){
    // background gradient
    const g = ctx.createLinearGradient(0,0,0,canvas.height);
    g.addColorStop(0,'#8fd1ff'); g.addColorStop(1,'#2b7cff');
    ctx.fillStyle = g; ctx.fillRect(0,0,canvas.width,canvas.height);

    // subtle moving stars
    for(const s of bgStars){ s.x += s.vx*0.02; if(s.x>canvas.width+10) s.x=-10; if(s.x<-10) s.x=canvas.width+10; ctx.beginPath(); ctx.fillStyle = 'rgba(255,255,255,'+s.a+')'; ctx.arc(s.x,s.y,s.r,0,Math.PI*2); ctx.fill(); }

    // draw collectibles with glow
    for(const c of collectibles){
      c.angle += 0.03;
      const bob = Math.sin((Date.now()/1000)*3 + c.bob) * 6;
      ctx.save();
      ctx.translate(c.x, c.y + bob);
      ctx.rotate(Math.sin(c.angle)*0.4);
      // glow
      ctx.beginPath(); ctx.fillStyle = 'rgba(255,255,255,0.06)'; ctx.arc(0,0,c.r*1.8,0,Math.PI*2); ctx.fill();
      // main shape
      ctx.beginPath(); ctx.fillStyle = `hsl(${c.hue} 90% 55%)`; ctx.arc(0,0,c.r,0,Math.PI*2); ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = `rgba(255,255,255,0.15)`; ctx.stroke();
      ctx.restore();
    }

    // draw player with inner glow
    ctx.beginPath(); const grd = ctx.createRadialGradient(player.x-6, player.y-6, 2, player.x, player.y, player.r*1.8); grd.addColorStop(0,'#9fd7ff'); grd.addColorStop(1,'#0b57c8'); ctx.fillStyle = grd; ctx.arc(player.x,player.y,player.r,0,Math.PI*2); ctx.fill(); ctx.lineWidth=2; ctx.strokeStyle='rgba(0,0,0,0.15)'; ctx.stroke();

    // draw particles
    for(const p of particles){ ctx.beginPath(); ctx.fillStyle = `hsla(${p.hue} 90% 60% / ${p.a})`; ctx.arc(p.x,p.y,p.r,0,Math.PI*2); ctx.fill(); }
  }

  function gameLoop(ts){
    if(!startTime) startTime = ts;
    const elapsed = (ts - startTime)/1000;
    const dt = Math.min(0.05, (ts - (gameLoop._last||ts))/1000);
    gameLoop._last = ts;
    if(running){ update(dt); draw(); scoreEl.textContent = 'Score: '+score; timerEl.textContent = 'Time: '+Math.max(0, Math.ceil(ROUND_SECONDS - elapsed)) + 's'; }
    if(elapsed >= ROUND_SECONDS && running){ endRound(); }
    if(running) requestAnimationFrame(gameLoop);
  }

  function startRound(){ score=0; collectibles=[]; lastSpawn=0; startTime=null; running=true; overlay.style.display='none'; requestAnimationFrame(gameLoop); }

  function endRound(){ running=false; finalScoreEl.textContent = 'Your score: '+score; overlay.style.display='flex'; // prepare QR and share
    const origin = window.location.origin === 'null' ? window.location.href.replace(/\/[^/]*$/,'') : window.location.origin;
    const gameUrl = origin + window.location.pathname.replace(/[^/]*$/,'') + 'game.html?challenge=' + score;
    endQr.src = 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=' + encodeURIComponent(gameUrl);
  }

  // Pause/resume logic
  function pauseGame(){ if(!running) return; running=false; startPauseBtn.textContent = 'Resume'; }
  function resumeGame(){ if(running) return; running=true; // adjust startTime so timer continues correctly
    if(startTime === null) startTime = performance.now(); else { const now = performance.now(); // shift startTime forward by pause duration
      // compute elapsed displayed time and adjust
      // We track paused by not updating startTime while paused; to resume simply set startTime = now - elapsed
      const elapsedSoFar = parseInt(timerEl.textContent.replace(/[^0-9]/g,''));
      startTime = now - ( (ROUND_SECONDS - elapsedSoFar) * 1000 );
    }
    startPauseBtn.textContent = 'Pause';
    requestAnimationFrame(gameLoop);
  }

  startPauseBtn.addEventListener('click', ()=>{
    if(running) pauseGame(); else resumeGame();
  });

  // Pause when document hidden
  document.addEventListener('visibilitychange', ()=>{
    if(document.hidden){ if(running){ pauseGame(); }} else { /* do not auto-resume to avoid surprising the user */ }
  });

  function saveScore(){ const name = prompt('Enter name to save score (max 20 chars):',''); if(name===null) return; const entry = { name: (name||'Player').slice(0,20), score: score, date: (new Date()).toISOString() };
    const raw = localStorage.getItem('playback_leaderboard'); let list = raw?JSON.parse(raw):[]; list.push(entry); list.sort((a,b)=>b.score - a.score); list = list.slice(0,50); localStorage.setItem('playback_leaderboard', JSON.stringify(list)); alert('Score saved!'); }

  function shareChallenge(){ const origin = window.location.origin === 'null' ? window.location.href.replace(/\/[^/]*$/,'') : window.location.origin; const url = origin + window.location.pathname.replace(/[^/]*$/,'') + 'game.html?challenge=' + score; const text = `I scored ${score} on PlayBack! Beat my score and help bring the Museum of Childhood to Dublin: ` + url;
    if(navigator.share){ navigator.share({ title:'PlayBack challenge', text:text, url:url }).catch(()=>{}); }
    else { // fallback: open twitter
      const twitter = 'https://twitter.com/intent/tweet?text=' + encodeURIComponent(text);
      window.open(twitter,'_blank'); }
  }

  // UI hooks
  saveBtn.addEventListener('click', saveScore);
  shareBtn.addEventListener('click', shareChallenge);
  donateBtn.addEventListener('click', ()=>{ window.open('https://museumofchildhood.ie/support-us/','_blank'); });
  playAgainBtn.addEventListener('click', ()=>{ overlay.style.display='none'; startRound(); });

  // Start automatically
  startRound();

  // If page opened with ?challenge=### then show banner
  (function showChallengeBanner(){ const p = new URLSearchParams(window.location.search); const v = p.get('challenge'); if(v){ const b = document.createElement('div'); b.style.background='#fffbcc'; b.style.padding='8px'; b.style.border='1px solid #ffd24d'; b.style.margin='8px'; b.textContent = `You've been challenged to beat ${v} points — good luck!`; document.body.insertBefore(b, document.body.firstChild); } })();

})();
