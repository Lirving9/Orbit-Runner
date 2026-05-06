const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const scoreValue = document.getElementById("scoreValue");
const bestValue = document.getElementById("bestValue");
const timeValue = document.getElementById("timeValue");
const shieldBar = document.getElementById("shieldBar");
const pauseButton = document.getElementById("pauseButton");
const startButton = document.getElementById("startButton");
const restartButton = document.getElementById("restartButton");
const startPanel = document.getElementById("startPanel");
const endPanel = document.getElementById("endPanel");
const resultLabel = document.getElementById("resultLabel");
const finalScore = document.getElementById("finalScore");
const finalBest = document.getElementById("finalBest");
const finalCombo = document.getElementById("finalCombo");
const finalShards = document.getElementById("finalShards");
const finalDodged = document.getElementById("finalDodged");
const toastEl = document.getElementById("toast");
const waveLabelEl = document.getElementById("waveLabel");
const comboLabelEl = document.getElementById("comboLabel");
const soundBtn = document.getElementById("soundBtn");
const diffBtns = document.querySelectorAll(".diff-btn");
const bombBadge = document.getElementById("bombBadge");
const bombCountEl = document.getElementById("bombCount");
const magnetBadge = document.getElementById("magnetBadge");
const magnetTimerEl = document.getElementById("magnetTimer");
const boostBadge = document.getElementById("boostBadge");
const boostTimerBadgeEl = document.getElementById("boostTimerBadge");
const gradeLabel = document.getElementById("gradeLabel");
let audioCtx = null;
let soundOn = true;
const DIFF = { easy:{spawnMul:1.4,speedMul:0.7,dmgMul:0.7}, normal:{spawnMul:1,speedMul:1,dmgMul:1}, hard:{spawnMul:0.7,speedMul:1.35,dmgMul:1.3} };
let difficulty = 'normal';
const floatingTexts = [];
const nebulae = [];

const pauseIcon = `
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M8 5v14M16 5v14"></path>
  </svg>`;
const playIcon = `
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M7 4.8v14.4L18.5 12 7 4.8Z"></path>
  </svg>`;

const view = {
  width: 0,
  height: 0,
  dpr: 1
};

const game = {
  state: "ready",
  score: 0,
  best: readBest(),
  remaining: 60,
  combo: 0,
  maxCombo: 0,
  spawnClock: 0,
  elapsed: 0,
  shakeTimer: 0,
  wave: 1,
  lastWave: 0,
  shardsCollected: 0,
  meteorsDodged: 0,
  bombs: 0,
  boostTimer: 0,
  magnetTimer: 0
};

const player = {
  x: 0,
  y: 0,
  vx: 0,
  vy: 0,
  radius: 18,
  shield: 100,
  maxShield: 100,
  invulnerable: 0,
  thrusting: false
};

const input = {
  left: false,
  right: false,
  up: false,
  down: false,
  pointer: false,
  targetX: 0,
  targetY: 0
};

const objects = [];
const particles = [];
let stars = [];
let lastTime = performance.now();
buildNebulae();

bestValue.textContent = game.best;
resizeCanvas();
resetPlayer();
updateHud();
requestAnimationFrame(loop);

window.addEventListener("resize", resizeCanvas);
window.addEventListener("keydown", handleKeyDown);
window.addEventListener("keyup", handleKeyUp);
canvas.addEventListener("pointerdown", handlePointer);
canvas.addEventListener("pointermove", handlePointer);
canvas.addEventListener("pointerleave", () => {
  input.pointer = false;
});

startButton.addEventListener("click", startGame);
restartButton.addEventListener("click", startGame);
pauseButton.addEventListener("click", togglePause);
if(soundBtn) soundBtn.addEventListener("click", ()=>{ soundOn=!soundOn; soundBtn.textContent=soundOn?'🔊':'🔇'; });
diffBtns.forEach(b=>b.addEventListener("click",()=>{ diffBtns.forEach(x=>x.classList.remove('is-active')); b.classList.add('is-active'); difficulty=b.dataset.diff; }));

bindHoldButton("leftButton", "left");
bindHoldButton("rightButton", "right");
bindHoldButton("thrustButton", "up");

function loop(now) {
  const dt = Math.min(0.033, (now - lastTime) / 1000);
  lastTime = now;

  updateBackground(dt);
  if (game.state === "playing") {
    updateGame(dt);
  }
  updateParticles(dt);
  draw();
  requestAnimationFrame(loop);
}

function startGame() {
  game.state = "playing";
  game.score = 0;
  game.remaining = 60;
  game.combo = 0;
  game.maxCombo = 0;
  game.spawnClock = 0.35;
  game.elapsed = 0;
  game.shakeTimer = 0;
  game.wave = 1;
  game.lastWave = 0;
  game.shardsCollected = 0;
  game.meteorsDodged = 0;
  game.bombs = 0;
  game.boostTimer = 0;
  game.magnetTimer = 0;
  floatingTexts.length = 0;
  objects.length = 0;
  particles.length = 0;
  resetPlayer();
  setPanelVisibility(startPanel, false);
  setPanelVisibility(endPanel, false);
  setPauseIcon(false);
  showWave(1);
  updateHud();
}

function togglePause() {
  if (game.state === "ready" || game.state === "ended") {
    startGame();
    return;
  }

  if (game.state === "playing") {
    game.state = "paused";
    setPauseIcon(true);
    return;
  }

  if (game.state === "paused") {
    game.state = "playing";
    setPauseIcon(false);
  }
}

function endGame(completed) {
  game.state = "ended";
  if (game.score > game.best) {
    game.best = game.score;
    writeBest(game.best);
  }
  resultLabel.textContent = completed ? "RUN COMPLETE" : "SIGNAL LOST";
  finalScore.textContent = game.score;
  finalBest.textContent = game.best;
  finalCombo.textContent = `${game.maxCombo}x`;
  if(finalShards) finalShards.textContent = game.shardsCollected;
  if(finalDodged) finalDodged.textContent = game.meteorsDodged;
  bestValue.textContent = game.best;
  if(gradeLabel){ const g=calcGrade(game.score); gradeLabel.textContent=g; gradeLabel.className='grade'+(g==='S'?' grade-s':g==='D'?' grade-d':''); }
  setPanelVisibility(endPanel, true);
  setPauseIcon(true);
  playSound(completed?660:220, 0.4);
}

function updateGame(dt) {
  game.elapsed += dt;
  game.remaining = Math.max(0, 60 - game.elapsed);
  game.spawnClock -= dt;
  game.boostTimer = Math.max(0, game.boostTimer - dt);
  game.magnetTimer = Math.max(0, game.magnetTimer - dt);
  player.invulnerable = Math.max(0, player.invulnerable - dt);
  game.shakeTimer = Math.max(0, game.shakeTimer - dt);
  const newWave = Math.floor(game.elapsed / 15) + 1;
  if (newWave > game.wave) { game.wave = newWave; showWave(newWave); }
  const d = DIFF[difficulty];
  if (game.spawnClock <= 0) {
    spawnObject();
    const pressure = Math.min(1, game.elapsed / 60);
    game.spawnClock = (random(0.34, 0.68) - pressure * 0.14) * d.spawnMul;
  }
  updatePlayer(dt);
  updateObjects(dt);
  checkCollisions();
  if (game.magnetTimer > 0) attractShards(dt);
  updateFloatingTexts(dt);
  if (Math.random() < 0.45) addEngineParticle();
  if (game.remaining <= 0) endGame(true);
  updateHud();
}

function updatePlayer(dt) {
  const horizontal = Number(input.right) - Number(input.left);
  const vertical = Number(input.down) - Number(input.up);
  player.thrusting = input.up || input.pointer;
  const boost = game.boostTimer > 0 ? 1.6 : 1;
  player.vx += horizontal * 1450 * boost * dt;
  player.vy += 520 * dt + vertical * 1150 * boost * dt;
  if (input.pointer) {
    const dx = input.targetX - player.x;
    const dy = input.targetY - player.y;
    player.vx += clamp(dx * 9, -1200, 1200) * dt;
    player.vy += clamp(dy * 9, -1200, 1200) * dt;
  }
  player.vx *= Math.pow(0.035, dt);
  player.vy *= Math.pow(0.08, dt);
  player.x += player.vx * dt;
  player.y += player.vy * dt;
  const topLimit = Math.max(110, view.height * 0.18);
  const bottomLimit = view.height - 58;
  player.x = clamp(player.x, 28, view.width - 28);
  player.y = clamp(player.y, topLimit, bottomLimit);
  if (player.x <= 28 || player.x >= view.width - 28) player.vx *= -0.28;
  if (player.y <= topLimit || player.y >= bottomLimit) player.vy *= -0.22;
}

function updateObjects(dt) {
  for (let i = objects.length - 1; i >= 0; i -= 1) {
    const item = objects[i];
    item.x += item.vx * dt;
    item.y += item.vy * dt;
    item.rotation += item.spin * dt;
    if (item.x < item.radius || item.x > view.width - item.radius) item.vx *= -1;
    if (item.y > view.height + 80) {
      objects.splice(i, 1);
      if (item.type === "meteor") game.meteorsDodged++;
      if (item.type === "shard") game.combo = 0;
    }
  }
}

function checkCollisions() {
  for (let i = objects.length - 1; i >= 0; i -= 1) {
    const item = objects[i];
    const dx = item.x - player.x;
    const dy = item.y - player.y;
    const touch = Math.hypot(dx, dy) < item.radius + player.radius;
    if (!touch) continue;
    objects.splice(i, 1);
    if (item.type === "meteor") {
      if (player.invulnerable > 0) continue;
      const d = DIFF[difficulty];
      player.shield = Math.max(0, player.shield - item.damage * d.dmgMul);
      player.invulnerable = 0.85;
      game.combo = 0;
      addBurst(item.x, item.y, "#ff6f61", 24);
      triggerShake();
      playSound(180, 0.3);
      if (player.shield <= 0) endGame(false);
      continue;
    }
    if (item.type === "cell") {
      player.shield = Math.min(player.maxShield, player.shield + 28);
      game.score += 20;
      addBurst(item.x, item.y, "#55ef9f", 18);
      playSound(880, 0.15);
      continue;
    }
    if (item.type === "bomb") {
      game.bombs++;
      addBurst(item.x, item.y, "#b89cff", 20);
      showToast("💣 BOMB +1 — press B!");
      playSound(440, 0.2);
      continue;
    }
    if (item.type === "boost") {
      game.boostTimer = 4;
      addBurst(item.x, item.y, "#ffc857", 20);
      showToast("⚡ SPEED BOOST!");
      playSound(660, 0.2);
      continue;
    }
    if (item.type === "magnet") {
      game.magnetTimer = 6;
      addBurst(item.x, item.y, "#ff6fff", 20);
      showToast("🧲 MAGNET! Shards attracted!");
      playSound(550, 0.2);
      continue;
    }
    game.combo += 1;
    game.maxCombo = Math.max(game.maxCombo, game.combo);
    const isGold = item.type === "golden";
    const pts = isGold ? 50 + game.combo * 5 : 12 + game.combo * 3;
    game.score += pts;
    game.shardsCollected++;
    addBurst(item.x, item.y, item.color, isGold ? 24 : 16);
    addFloatingText(item.x, item.y - 20, "+" + pts, item.color);
    playSound(isGold ? 880 : 520 + game.combo * 40, isGold ? 0.2 : 0.1);
    if (game.combo > 0 && game.combo % 5 === 0) showCombo(game.combo);
  }
}

function spawnObject() {
  const pressure = Math.min(1, game.elapsed / 60);
  const roll = Math.random();
  let type = "shard";
  if (roll > 0.67 - pressure * 0.1) type = "meteor";
  else if (roll < 0.025) type = "bomb";
  else if (roll < 0.05) type = "boost";
  else if (roll < 0.065) type = "magnet";
  else if (roll < 0.09) type = "golden";
  else if (roll < 0.16) type = "cell";
  const radiusMap = {meteor:random(18,31),cell:16,bomb:14,boost:14,magnet:15,golden:random(13,18),shard:random(11,17)};
  const radius = radiusMap[type];
  const d = DIFF[difficulty];
  const speed = (random(120,220) + pressure*130) * d.speedMul;
  const palette = ["#62e3ff","#55ef9f","#ffc857","#b89cff"];
  objects.push({
    type, x:random(radius+12,view.width-radius-12), y:-radius-24,
    vx:random(-42,42)*(type==="meteor"?1.3:1), vy:speed*(type==="meteor"?1.04:1),
    radius, rotation:random(0,Math.PI*2), spin:random(-2.8,2.8),
    color:palette[Math.floor(Math.random()*palette.length)],
    damage:type==="meteor"?Math.round(random(24,35)):0, seed:Math.random()
  });
}

function updateBackground(dt) {
  for (const star of stars) {
    star.y += star.speed * dt;
    if (star.y > view.height + 8) {
      star.x = Math.random() * view.width;
      star.y = -8;
      star.speed = random(20, 95);
    }
  }
}

function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i -= 1) {
    const part = particles[i];
    part.life -= dt;
    part.x += part.vx * dt;
    part.y += part.vy * dt;
    part.vy += 90 * dt;
    if (part.life <= 0) {
      particles.splice(i, 1);
    }
  }
}

function draw() {
  ctx.clearRect(0, 0, view.width, view.height);
  drawSpace();
  drawObjects();
  drawParticles();
  drawFloatingTexts();
  drawPlayer();
  if (game.state === "paused") {
    drawCenterLabel("PAUSED", "rgba(8, 10, 14, 0.55)");
  }
}

function drawSpace() {
  const background = ctx.createLinearGradient(0, 0, 0, view.height);
  background.addColorStop(0, "#08090d");
  background.addColorStop(0.54, "#111017");
  background.addColorStop(1, "#07080b");
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, view.width, view.height);

  ctx.save();
  ctx.globalAlpha = 0.2;
  ctx.strokeStyle = "#62e3ff";
  ctx.lineWidth = 1;
  const gap = 74;
  const offset = (game.elapsed * 32) % gap;
  for (let y = -gap; y < view.height + gap; y += gap) {
    ctx.beginPath();
    ctx.moveTo(0, y + offset);
    ctx.lineTo(view.width, y + offset + 28);
    ctx.stroke();
  }
  ctx.restore();

  for (const star of stars) {
    ctx.globalAlpha = star.alpha;
    ctx.fillStyle = star.color;
    ctx.fillRect(star.x, star.y, star.size, star.size);
  }
  ctx.globalAlpha = 1;
  for (const nb of nebulae) {
    ctx.globalAlpha = nb.alpha * 0.12;
    const grd = ctx.createRadialGradient(nb.x, nb.y, 0, nb.x, nb.y, nb.r);
    grd.addColorStop(0, nb.color);
    grd.addColorStop(1, 'transparent');
    ctx.fillStyle = grd;
    ctx.fillRect(nb.x - nb.r, nb.y - nb.r, nb.r * 2, nb.r * 2);
  }
  ctx.globalAlpha = 1;
}

function drawObjects() {
  for (const item of objects) {
    ctx.save();
    ctx.translate(item.x, item.y);
    ctx.rotate(item.rotation);
    if (item.type === "meteor") drawMeteor(item);
    else if (item.type === "cell") drawCell(item);
    else if (item.type === "bomb") drawBomb(item);
    else if (item.type === "boost") drawBoost(item);
    else if (item.type === "magnet") drawMagnet(item);
    else if (item.type === "golden") drawGolden(item);
    else drawShard(item);
    ctx.restore();
  }
}

function drawShard(item) {
  const r = item.radius;
  ctx.shadowColor = item.color;
  ctx.shadowBlur = 18;
  ctx.fillStyle = item.color;
  ctx.strokeStyle = "rgba(255, 255, 255, 0.78)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, -r * 1.3);
  ctx.lineTo(r * 0.84, 0);
  ctx.lineTo(0, r * 1.3);
  ctx.lineTo(-r * 0.84, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.shadowBlur = 0;
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.moveTo(0, -r * 0.7);
  ctx.lineTo(r * 0.3, 0);
  ctx.lineTo(0, r * 0.72);
  ctx.lineTo(-r * 0.16, 0);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;
}

function drawCell(item) {
  const r = item.radius;
  ctx.shadowColor = "#55ef9f";
  ctx.shadowBlur = 16;
  ctx.strokeStyle = "#55ef9f";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = "#f5f7fb";
  ctx.beginPath();
  ctx.moveTo(-r * 0.56, 0);
  ctx.lineTo(r * 0.56, 0);
  ctx.moveTo(0, -r * 0.56);
  ctx.lineTo(0, r * 0.56);
  ctx.stroke();
}

function drawMeteor(item) {
  const r = item.radius;
  ctx.shadowColor = "#ff6f61";
  ctx.shadowBlur = 12;
  ctx.fillStyle = "#3c3430";
  ctx.strokeStyle = "#ff8f57";
  ctx.lineWidth = 2;
  ctx.beginPath();
  const points = 9;
  for (let i = 0; i < points; i += 1) {
    const angle = (Math.PI * 2 * i) / points;
    const wobble = 0.78 + Math.sin(item.seed * 30 + i * 1.8) * 0.18;
    const x = Math.cos(angle) * r * wobble;
    const y = Math.sin(angle) * r * wobble;
    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.shadowBlur = 0;
  ctx.strokeStyle = "rgba(255, 200, 87, 0.85)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-r * 0.36, -r * 0.08);
  ctx.lineTo(r * 0.14, r * 0.24);
  ctx.lineTo(r * 0.48, -r * 0.16);
  ctx.stroke();
}

function drawParticles() {
  for (const part of particles) {
    const alpha = Math.max(0, part.life / part.maxLife);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = part.color;
    ctx.beginPath();
    ctx.arc(part.x, part.y, part.size * alpha, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawPlayer() {
  const flicker = player.invulnerable > 0 && Math.floor(player.invulnerable * 18) % 2 === 0;
  if (flicker) {
    return;
  }

  ctx.save();
  ctx.translate(player.x, player.y);
  const lean = clamp(player.vx / 560, -0.5, 0.5);
  ctx.rotate(lean * 0.16);

  if (player.thrusting) {
    const flame = 16 + Math.sin(performance.now() / 42) * 5;
    const thrust = ctx.createLinearGradient(0, 14, 0, 14 + flame);
    thrust.addColorStop(0, "#62e3ff");
    thrust.addColorStop(0.48, "#ffc857");
    thrust.addColorStop(1, "rgba(255, 111, 97, 0)");
    ctx.fillStyle = thrust;
    ctx.beginPath();
    ctx.moveTo(-8, 14);
    ctx.lineTo(0, 18 + flame);
    ctx.lineTo(8, 14);
    ctx.closePath();
    ctx.fill();
  }

  ctx.shadowColor = "#62e3ff";
  ctx.shadowBlur = 22;
  ctx.fillStyle = "#e9faff";
  ctx.strokeStyle = "#62e3ff";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, -22);
  ctx.lineTo(15, 16);
  ctx.lineTo(0, 9);
  ctx.lineTo(-15, 16);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.shadowBlur = 0;
  ctx.fillStyle = "#10151c";
  ctx.beginPath();
  ctx.moveTo(0, -12);
  ctx.lineTo(6, 5);
  ctx.lineTo(0, 2);
  ctx.lineTo(-6, 5);
  ctx.closePath();
  ctx.fill();

  ctx.globalAlpha = 0.24 + (player.shield / player.maxShield) * 0.22;
  ctx.strokeStyle = player.shield < 30 ? "#ff6f61" : "#55ef9f";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, player.radius + 8, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.restore();
}

function drawCenterLabel(text, fill) {
  ctx.save();
  ctx.fillStyle = fill;
  ctx.fillRect(0, 0, view.width, view.height);
  ctx.fillStyle = "#f5f7fb";
  ctx.font = "900 56px Inter, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, view.width / 2, view.height / 2);
  ctx.restore();
}

function addEngineParticle() {
  if (!player.thrusting || game.state !== "playing") {
    return;
  }

  particles.push({
    x: player.x + random(-6, 6),
    y: player.y + 18,
    vx: random(-28, 28),
    vy: random(120, 220),
    life: random(0.18, 0.35),
    maxLife: 0.35,
    color: Math.random() > 0.45 ? "#62e3ff" : "#ffc857",
    size: random(2, 5)
  });
}

function addBurst(x, y, color, amount) {
  for (let i = 0; i < amount; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = random(90, 310);
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: random(0.28, 0.72),
      maxLife: 0.72,
      color,
      size: random(2, 5)
    });
  }
}

function triggerShake() {
  game.shakeTimer = 0.26;
  document.body.classList.add("is-shaking");
  window.setTimeout(() => document.body.classList.remove("is-shaking"), 340);
}

function updateHud() {
  scoreValue.textContent = game.score;
  bestValue.textContent = game.best;
  timeValue.textContent = Math.ceil(game.remaining);
  const sp = (player.shield / player.maxShield) * 100;
  shieldBar.style.width = sp + '%';
  shieldBar.classList.toggle('shield-low', sp < 30);
  if(bombBadge){ bombBadge.classList.toggle('is-hidden', game.bombs<=0); if(bombCountEl) bombCountEl.textContent=game.bombs; }
  if(magnetBadge){ magnetBadge.classList.toggle('is-hidden', game.magnetTimer<=0); if(magnetTimerEl) magnetTimerEl.textContent=Math.ceil(game.magnetTimer)+'s'; }
  if(boostBadge){ boostBadge.classList.toggle('is-hidden', game.boostTimer<=0); if(boostTimerBadgeEl) boostTimerBadgeEl.textContent=Math.ceil(game.boostTimer)+'s'; }
}

function resetPlayer() {
  player.x = view.width * 0.5;
  player.y = view.height * 0.72;
  player.vx = 0;
  player.vy = 0;
  player.shield = player.maxShield;
  player.invulnerable = 0;
}

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  view.dpr = Math.min(window.devicePixelRatio || 1, 2);
  view.width = rect.width;
  view.height = rect.height;
  canvas.width = Math.floor(rect.width * view.dpr);
  canvas.height = Math.floor(rect.height * view.dpr);
  ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
  buildStars();

  if (game.state === "ready") {
    resetPlayer();
  } else {
    player.x = clamp(player.x, 28, view.width - 28);
    player.y = clamp(player.y, 110, view.height - 58);
  }
}

function buildStars() {
  const count = Math.round(clamp((view.width * view.height) / 8500, 70, 180));
  stars = Array.from({ length: count }, () => ({
    x: Math.random() * view.width,
    y: Math.random() * view.height,
    size: random(1, 2.2),
    speed: random(20, 95),
    alpha: random(0.22, 0.9),
    color: Math.random() > 0.22 ? "#f5f7fb" : "#62e3ff"
  }));
}

function handlePointer(event) {
  const rect = canvas.getBoundingClientRect();
  input.targetX = event.clientX - rect.left;
  input.targetY = event.clientY - rect.top;
  input.pointer = game.state === "playing" || event.type === "pointerdown";

  if (event.type === "pointerdown" && (game.state === "ready" || game.state === "ended")) {
    startGame();
  }
}

function handleKeyDown(event) {
  setKey(event, true);
  if (event.code === "Space" || event.code === "Enter") {
    event.preventDefault();
    if (game.state === "ready" || game.state === "ended") startGame();
    else togglePause();
  }
  if (event.code === "KeyB" && game.state === "playing") useBomb();
}

function handleKeyUp(event) {
  setKey(event, false);
}

function setKey(event, active) {
  const map = {
    ArrowLeft: "left",
    KeyA: "left",
    ArrowRight: "right",
    KeyD: "right",
    ArrowUp: "up",
    KeyW: "up",
    ArrowDown: "down",
    KeyS: "down"
  };

  const key = map[event.code];
  if (!key) {
    return;
  }

  event.preventDefault();
  input[key] = active;
  if (active) {
    input.pointer = false;
  }
}

function bindHoldButton(id, property) {
  const button = document.getElementById(id);
  const setActive = (active) => {
    input[property] = active;
    if (active) {
      input.pointer = false;
    }
  };

  button.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    button.setPointerCapture(event.pointerId);
    setActive(true);
    if (game.state === "ready" || game.state === "ended") {
      startGame();
    }
  });
  button.addEventListener("pointerup", () => setActive(false));
  button.addEventListener("pointercancel", () => setActive(false));
  button.addEventListener("lostpointercapture", () => setActive(false));
}

function setPanelVisibility(panel, visible) {
  panel.classList.toggle("is-hidden", !visible);
}

function setPauseIcon(showPlay) {
  pauseButton.innerHTML = showPlay ? playIcon : pauseIcon;
  pauseButton.setAttribute("aria-label", showPlay ? "Resume" : "Pause");
  pauseButton.setAttribute("title", showPlay ? "Resume" : "Pause");
}

function readBest() {
  try {
    return Number(localStorage.getItem("orbitRunnerBest")) || 0;
  } catch {
    return 0;
  }
}

function writeBest(value) {
  try {
    localStorage.setItem("orbitRunnerBest", String(value));
  } catch {
    // Private browsing modes can disable storage.
  }
}

function random(min, max) {
  return min + Math.random() * (max - min);
}
function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
function useBomb() {
  if (game.bombs <= 0) return;
  game.bombs--;
  playSound(300, 0.4);
  for (let i = objects.length - 1; i >= 0; i--) {
    if (objects[i].type === "meteor") {
      addBurst(objects[i].x, objects[i].y, "#b89cff", 12);
      game.score += 5;
      objects.splice(i, 1);
    }
  }
  triggerShake();
  showToast("💥 BOMB!");
}
function showWave(n) {
  if (!waveLabelEl) return;
  waveLabelEl.textContent = "WAVE " + n;
  waveLabelEl.classList.remove('is-hidden');
  waveLabelEl.style.animation = 'none';
  waveLabelEl.offsetHeight;
  waveLabelEl.style.animation = '';
  setTimeout(() => waveLabelEl.classList.add('is-hidden'), 2100);
}
function showToast(msg) {
  if (!toastEl) return;
  toastEl.textContent = msg;
  toastEl.classList.remove('is-hidden');
  toastEl.style.animation = 'none';
  toastEl.offsetHeight;
  toastEl.style.animation = '';
  setTimeout(() => toastEl.classList.add('is-hidden'), 2600);
}
function showCombo(n) {
  if (!comboLabelEl) return;
  comboLabelEl.textContent = n + 'x COMBO!';
  comboLabelEl.classList.remove('is-hidden');
  comboLabelEl.style.animation = 'none';
  comboLabelEl.offsetHeight;
  comboLabelEl.style.animation = '';
  setTimeout(() => comboLabelEl.classList.add('is-hidden'), 1100);
}
function playSound(freq, dur) {
  if (!soundOn) return;
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(freq, audioCtx.currentTime);
    g.gain.setValueAtTime(0.15, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
    o.connect(g).connect(audioCtx.destination);
    o.start(); o.stop(audioCtx.currentTime + dur);
  } catch(e) {}
}
function drawBomb(item) {
  const r = item.radius;
  ctx.shadowColor = '#b89cff'; ctx.shadowBlur = 14;
  ctx.fillStyle = '#2a2040'; ctx.strokeStyle = '#b89cff'; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#b89cff'; ctx.font = `${r}px Inter,sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('💣', 0, 1);
}
function drawBoost(item) {
  const r = item.radius;
  ctx.shadowColor = '#ffc857'; ctx.shadowBlur = 14;
  ctx.fillStyle = '#2a2510'; ctx.strokeStyle = '#ffc857'; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#ffc857'; ctx.font = `${r}px Inter,sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('⚡', 0, 1);
}
function drawMagnet(item) {
  const r = item.radius;
  ctx.shadowColor = '#ff6fff'; ctx.shadowBlur = 16;
  ctx.fillStyle = '#301030'; ctx.strokeStyle = '#ff6fff'; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#ff6fff'; ctx.font = `${r}px Inter,sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('🧲', 0, 1);
}
function drawGolden(item) {
  const r = item.radius;
  ctx.shadowColor = '#f7c948'; ctx.shadowBlur = 22;
  ctx.fillStyle = '#f7c948';
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const a = (Math.PI * 2 * i) / 5 - Math.PI / 2;
    const a2 = a + Math.PI / 5;
    const ox = Math.cos(a) * r * 1.2, oy = Math.sin(a) * r * 1.2;
    const ix = Math.cos(a2) * r * 0.5, iy = Math.sin(a2) * r * 0.5;
    i === 0 ? ctx.moveTo(ox, oy) : ctx.lineTo(ox, oy);
    ctx.lineTo(ix, iy);
  }
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.shadowBlur = 0;
}
function attractShards(dt) {
  const range = 180;
  for (const item of objects) {
    if (item.type !== 'shard' && item.type !== 'golden') continue;
    const dx = player.x - item.x, dy = player.y - item.y;
    const dist = Math.hypot(dx, dy);
    if (dist < range && dist > 1) {
      const f = (1 - dist / range) * 600 * dt;
      item.vx += (dx / dist) * f;
      item.vy += (dy / dist) * f;
    }
  }
}
function addFloatingText(x, y, text, color) {
  floatingTexts.push({ x, y, text, color, life: 1, maxLife: 1 });
}
function updateFloatingTexts(dt) {
  for (let i = floatingTexts.length - 1; i >= 0; i--) {
    const ft = floatingTexts[i];
    ft.life -= dt;
    ft.y -= 60 * dt;
    if (ft.life <= 0) floatingTexts.splice(i, 1);
  }
}
function drawFloatingTexts() {
  for (const ft of floatingTexts) {
    const a = Math.max(0, ft.life / ft.maxLife);
    ctx.globalAlpha = a;
    ctx.fillStyle = ft.color;
    ctx.font = '800 16px Inter,sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(ft.text, ft.x, ft.y);
  }
  ctx.globalAlpha = 1;
}
function calcGrade(score) {
  if (score >= 800) return 'S';
  if (score >= 500) return 'A';
  if (score >= 300) return 'B';
  if (score >= 150) return 'C';
  return 'D';
}
function buildNebulae() {
  nebulae.length = 0;
  const colors = ['#62e3ff','#b89cff','#ff6fff','#55ef9f'];
  for (let i = 0; i < 4; i++) {
    nebulae.push({ x: Math.random() * 1400, y: Math.random() * 900, r: random(150, 350), alpha: random(0.5, 1), color: colors[i % colors.length] });
  }
}
