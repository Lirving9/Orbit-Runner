/* Orbit Runner — vanilla HTML5 canvas arcade game. */
(() => {
  "use strict";

  // ---------- DOM ----------
  const $ = (id) => document.getElementById(id);
  const canvas = $("gameCanvas");
  const ctx = canvas.getContext("2d");

  const scoreValue = $("scoreValue");
  const bestValue = $("bestValue");
  const timeValue = $("timeValue");
  const shieldBar = $("shieldBar");
  const pauseButton = $("pauseButton");
  const startButton = $("startButton");
  const restartButton = $("restartButton");
  const shareButton = $("shareButton");
  const startPanel = $("startPanel");
  const endPanel = $("endPanel");
  const resultLabel = $("resultLabel");
  const finalScore = $("finalScore");
  const finalBest = $("finalBest");
  const finalCombo = $("finalCombo");
  const finalShards = $("finalShards");
  const finalDodged = $("finalDodged");
  const toastEl = $("toast");
  const waveLabelEl = $("waveLabel");
  const comboLabelEl = $("comboLabel");
  const achievementEl = $("achievement");
  const damageFlashEl = $("damageFlash");
  const soundBtn = $("soundBtn");
  const diffBtns = document.querySelectorAll(".diff-btn");
  const bombBadge = $("bombBadge");
  const bombCountEl = $("bombCount");
  const magnetBadge = $("magnetBadge");
  const magnetTimerEl = $("magnetTimer");
  const boostBadge = $("boostBadge");
  const boostTimerBadgeEl = $("boostTimerBadge");
  const comboBadge = $("comboBadge");
  const comboCountEl = $("comboCount");
  const gradeLabel = $("gradeLabel");
  const leaderboardList = $("leaderboardList");
  const bombButton = $("bombButton");

  const pauseIcon = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14M16 5v14"></path></svg>`;
  const playIcon = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.8v14.4L18.5 12 7 4.8Z"></path></svg>`;

  // ---------- Storage ----------
  const LS = {
    best: "orbitRunnerBest",
    diff: "orbitRunnerDiff",
    sound: "orbitRunnerSound",
    board: "orbitRunnerBoard",
    ach: "orbitRunnerAch"
  };
  const storage = {
    get(key, fallback) {
      try { const v = localStorage.getItem(key); return v == null ? fallback : v; }
      catch { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem(key, value); } catch { /* noop */ }
    },
    getJSON(key, fallback) {
      try { const v = localStorage.getItem(key); return v == null ? fallback : JSON.parse(v); }
      catch { return fallback; }
    },
    setJSON(key, value) { this.set(key, JSON.stringify(value)); }
  };

  // ---------- Settings ----------
  const DIFF = {
    easy:   { spawnMul: 1.4, speedMul: 0.7,  dmgMul: 0.7 },
    normal: { spawnMul: 1.0, speedMul: 1.0,  dmgMul: 1.0 },
    hard:   { spawnMul: 0.7, speedMul: 1.35, dmgMul: 1.3 }
  };
  let difficulty = storage.get(LS.diff, "normal");
  if (!DIFF[difficulty]) difficulty = "normal";
  let soundOn = storage.get(LS.sound, "1") !== "0";
  if (soundBtn) soundBtn.textContent = soundOn ? "🔊" : "🔇";

  diffBtns.forEach((btn) => {
    if (btn.dataset.diff === difficulty) btn.classList.add("is-active");
    else btn.classList.remove("is-active");
  });

  const prefersReducedMotion = typeof window.matchMedia === "function"
    && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ---------- Achievements ----------
  const achievementsAll = [
    { id: "firstBlood", label: "First Contact", desc: "Collect your first shard." },
    { id: "combo10",    label: "On Fire",       desc: "Reach a 10x combo." },
    { id: "combo20",    label: "Unstoppable",   desc: "Reach a 20x combo." },
    { id: "flawless",   label: "Flawless",      desc: "Finish a run with full shield." },
    { id: "survivor",   label: "Survivor",      desc: "Survive 60 seconds on Hard." },
    { id: "score500",   label: "Stargazer",     desc: "Score 500 in a single run." },
    { id: "score1000",  label: "Constellation", desc: "Score 1000 in a single run." },
    { id: "bombMaster", label: "Demolitions",   desc: "Use a bomb." }
  ];
  const unlockedAch = new Set(storage.getJSON(LS.ach, []) || []);

  function unlockAchievement(id) {
    if (unlockedAch.has(id)) return;
    const a = achievementsAll.find((x) => x.id === id);
    if (!a) return;
    unlockedAch.add(id);
    storage.setJSON(LS.ach, [...unlockedAch]);
    showAchievement(a.label, a.desc);
  }

  // ---------- View / game / player ----------
  const view = { width: 0, height: 0, dpr: 1 };

  const game = {
    state: "ready",
    score: 0,
    best: Number(storage.get(LS.best, 0)) || 0,
    remaining: 60,
    combo: 0,
    maxCombo: 0,
    spawnClock: 0,
    elapsed: 0,
    shakeTimer: 0,
    shakeIntensity: 0,
    wave: 1,
    shardsCollected: 0,
    meteorsDodged: 0,
    bombs: 0,
    boostTimer: 0,
    magnetTimer: 0,
    slowmoTimer: 0,
    flashTimer: 0,
    damageTaken: 0
  };

  const player = {
    x: 0, y: 0, vx: 0, vy: 0,
    radius: 18,
    shield: 100,
    maxShield: 100,
    invulnerable: 0,
    thrusting: false
  };

  const input = {
    left: false, right: false, up: false, down: false,
    pointer: false, targetX: 0, targetY: 0
  };

  const objects = [];
  const particles = [];
  const floatingTexts = [];
  const trail = [];
  const nebulae = [];
  let stars = [];
  let lastTime = performance.now();

  // ---------- Init ----------
  buildNebulae();
  bestValue.textContent = game.best;
  resizeCanvas();
  resetPlayer();
  updateHud();
  renderLeaderboardPreview();
  requestAnimationFrame(loop);

  // ---------- Events ----------
  window.addEventListener("resize", resizeCanvas);
  window.addEventListener("keydown", handleKeyDown);
  window.addEventListener("keyup", handleKeyUp);
  window.addEventListener("blur", () => {
    input.left = input.right = input.up = input.down = false;
    if (game.state === "playing") togglePause();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && game.state === "playing") togglePause();
  });

  canvas.addEventListener("pointerdown", handlePointer);
  canvas.addEventListener("pointermove", handlePointer);
  canvas.addEventListener("pointerleave", () => { input.pointer = false; });

  startButton.addEventListener("click", startGame);
  restartButton.addEventListener("click", startGame);
  pauseButton.addEventListener("click", togglePause);
  if (shareButton) shareButton.addEventListener("click", shareResult);
  if (soundBtn) soundBtn.addEventListener("click", toggleSound);
  if (bombButton) bombButton.addEventListener("click", (e) => {
    e.preventDefault();
    if (game.state === "playing") useBomb();
  });

  diffBtns.forEach((b) => b.addEventListener("click", () => {
    diffBtns.forEach((x) => x.classList.remove("is-active"));
    b.classList.add("is-active");
    difficulty = b.dataset.diff;
    storage.set(LS.diff, difficulty);
  }));

  bindHoldButton("leftButton", "left");
  bindHoldButton("rightButton", "right");
  bindHoldButton("thrustButton", "up");

  // ---------- Main loop ----------
  function loop(now) {
    const rawDt = Math.min(0.033, (now - lastTime) / 1000);
    lastTime = now;
    const timeScale = game.slowmoTimer > 0 ? 0.45 : 1;
    const dt = rawDt * timeScale;

    updateBackground(rawDt); // stars keep moving even when paused
    if (game.state === "playing") {
      updateGame(dt);
    }
    updateParticles(dt);
    updateFloatingTexts(dt);
    updateTrail(dt);
    updateShake(rawDt);
    updateFlash(rawDt);

    draw();
    requestAnimationFrame(loop);
  }

  // ---------- Game state ----------
  function startGame() {
    game.state = "playing";
    game.score = 0;
    game.remaining = 60;
    game.combo = 0;
    game.maxCombo = 0;
    game.spawnClock = 0.35;
    game.elapsed = 0;
    game.shakeTimer = 0;
    game.shakeIntensity = 0;
    game.wave = 1;
    game.shardsCollected = 0;
    game.meteorsDodged = 0;
    game.bombs = 0;
    game.boostTimer = 0;
    game.magnetTimer = 0;
    game.slowmoTimer = 0;
    game.flashTimer = 0;
    game.damageTaken = 0;
    floatingTexts.length = 0;
    objects.length = 0;
    particles.length = 0;
    trail.length = 0;
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
      storage.set(LS.best, String(game.best));
    }

    // Push into leaderboard
    const board = storage.getJSON(LS.board, []) || [];
    board.push({
      score: game.score,
      combo: game.maxCombo,
      shards: game.shardsCollected,
      diff: difficulty,
      date: new Date().toISOString().slice(0, 10)
    });
    board.sort((a, b) => b.score - a.score);
    const top = board.slice(0, 5);
    storage.setJSON(LS.board, top);
    renderLeaderboard(top);

    resultLabel.textContent = completed ? "RUN COMPLETE" : "SIGNAL LOST";
    finalScore.textContent = game.score;
    finalBest.textContent = game.best;
    finalCombo.textContent = `${game.maxCombo}x`;
    if (finalShards) finalShards.textContent = game.shardsCollected;
    if (finalDodged) finalDodged.textContent = game.meteorsDodged;
    bestValue.textContent = game.best;
    if (gradeLabel) {
      const g = calcGrade(game.score);
      gradeLabel.textContent = g;
      gradeLabel.className = "grade" + (g === "S" ? " grade-s" : g === "D" ? " grade-d" : "");
    }
    setPanelVisibility(endPanel, true);
    setPauseIcon(true);

    if (completed) {
      if (game.damageTaken === 0) unlockAchievement("flawless");
      if (difficulty === "hard") unlockAchievement("survivor");
    }
    if (game.score >= 500) unlockAchievement("score500");
    if (game.score >= 1000) unlockAchievement("score1000");

    if (!completed) playNoise(0.6);
    playSound(completed ? 660 : 150, completed ? 0.4 : 0.6, completed ? "sine" : "square");
  }

  // ---------- Update ----------
  function updateGame(dt) {
    game.elapsed += dt;
    game.remaining = Math.max(0, 60 - game.elapsed);
    game.spawnClock -= dt;
    game.boostTimer = Math.max(0, game.boostTimer - dt);
    game.magnetTimer = Math.max(0, game.magnetTimer - dt);
    game.slowmoTimer = Math.max(0, game.slowmoTimer - dt);
    player.invulnerable = Math.max(0, player.invulnerable - dt);

    const newWave = Math.floor(game.elapsed / 15) + 1;
    if (newWave > game.wave) {
      game.wave = newWave;
      showWave(newWave);
    }

    const d = DIFF[difficulty];
    if (game.spawnClock <= 0) {
      spawnObject();
      const pressure = Math.min(1, game.elapsed / 60);
      game.spawnClock = (rand(0.34, 0.68) - pressure * 0.14) * d.spawnMul;
    }

    updatePlayer(dt);
    updateObjects(dt);
    checkCollisions();
    if (game.magnetTimer > 0) attractShards(dt);
    if (Math.random() < 0.45) addEngineParticle();
    emitTrail();

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
        if (item.type === "meteor") game.meteorsDodged += 1;
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
        const dmg = Math.round(item.damage * d.dmgMul);
        const wasAbove = player.shield;
        player.shield = Math.max(0, player.shield - dmg);
        game.damageTaken += dmg;
        player.invulnerable = 0.85;
        game.combo = 0;
        addBurst(item.x, item.y, "#ff6f61", 24);
        triggerShake(0.3);
        triggerFlash(0.35);
        playNoise(0.4);
        playSound(100, 0.4, "square");
        if (wasAbove > 25 && player.shield <= 25) {
          game.slowmoTimer = 0.8; // brief slow-mo when dropping into critical shield
          showToast("⚠ CRITICAL SHIELD");
        }
        if (player.shield <= 0) endGame(false);
        continue;
      }
      if (item.type === "cell") {
        player.shield = Math.min(player.maxShield, player.shield + 28);
        game.score += 20;
        addBurst(item.x, item.y, "#55ef9f", 18);
        addFloatingText(item.x, item.y - 20, "+20", "#55ef9f");
        playSound(880, 0.15);
        continue;
      }
      if (item.type === "bomb") {
        game.bombs += 1;
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
        showToast("🧲 MAGNET!");
        playSound(550, 0.2);
        continue;
      }

      // shard or golden
      game.combo += 1;
      game.maxCombo = Math.max(game.maxCombo, game.combo);
      const isGold = item.type === "golden";
      const pts = isGold ? 50 + game.combo * 5 : 12 + game.combo * 3;
      game.score += pts;
      game.shardsCollected += 1;
      addBurst(item.x, item.y, item.color, isGold ? 24 : 16);
      addFloatingText(item.x, item.y - 20, "+" + pts, item.color);
      playSound(isGold ? 880 : 520 + game.combo * 40, isGold ? 0.2 : 0.1);

      if (game.shardsCollected === 1) unlockAchievement("firstBlood");
      if (game.combo === 10) unlockAchievement("combo10");
      if (game.combo === 20) unlockAchievement("combo20");
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

    const radiusMap = {
      meteor: rand(18, 31), cell: 16, bomb: 14, boost: 14, magnet: 15,
      golden: rand(13, 18), shard: rand(11, 17)
    };
    const radius = radiusMap[type];
    const d = DIFF[difficulty];
    const speed = (rand(120, 220) + pressure * 130) * d.speedMul;
    const palette = ["#62e3ff", "#55ef9f", "#ffc857", "#b89cff"];
    objects.push({
      type,
      x: rand(radius + 12, view.width - radius - 12),
      y: -radius - 24,
      vx: rand(-42, 42) * (type === "meteor" ? 1.3 : 1),
      vy: speed * (type === "meteor" ? 1.04 : 1),
      radius,
      rotation: rand(0, Math.PI * 2),
      spin: rand(-2.8, 2.8),
      color: palette[Math.floor(Math.random() * palette.length)],
      damage: type === "meteor" ? Math.round(rand(24, 35)) : 0,
      seed: Math.random()
    });
  }

  // ---------- Background / particles / trail ----------
  function updateBackground(dt) {
    for (const star of stars) {
      star.y += star.speed * dt;
      if (star.y > view.height + 8) {
        star.x = Math.random() * view.width;
        star.y = -8;
        star.speed = rand(20, 95);
      }
    }
    for (const nb of nebulae) {
      nb.x -= 15 * dt;
      if (nb.x < -nb.r) nb.x = view.width + nb.r;
    }
  }

  function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i -= 1) {
      const p = particles[i];
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 90 * dt;
      if (p.life <= 0) particles.splice(i, 1);
    }
  }

  function emitTrail() {
    if (!player.thrusting) return;
    trail.push({ x: player.x, y: player.y + 10, life: 0.55 });
    if (trail.length > 40) trail.shift();
  }

  function updateTrail(dt) {
    for (let i = trail.length - 1; i >= 0; i -= 1) {
      trail[i].life -= dt;
      if (trail[i].life <= 0) trail.splice(i, 1);
    }
  }

  function updateShake(dt) {
    if (game.shakeTimer > 0) game.shakeTimer = Math.max(0, game.shakeTimer - dt);
  }

  function updateFlash(dt) {
    if (game.flashTimer > 0) {
      game.flashTimer = Math.max(0, game.flashTimer - dt);
      if (damageFlashEl) damageFlashEl.style.opacity = (game.flashTimer / 0.35).toFixed(3);
    } else if (damageFlashEl) {
      damageFlashEl.style.opacity = 0;
    }
  }

  // ---------- Draw ----------
  function draw() {
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.clearRect(0, 0, view.width, view.height);

    const shaking = !prefersReducedMotion && game.shakeTimer > 0;
    if (shaking) {
      ctx.save();
      const amp = game.shakeIntensity * (game.shakeTimer / 0.3);
      ctx.translate(rand(-amp, amp), rand(-amp, amp));
    }

    drawSpace();
    drawTrail();
    drawObjects();
    drawParticles();
    drawFloatingTexts();
    drawPlayer();

    if (shaking) ctx.restore();

    if (game.state === "paused") {
      drawCenterLabel("PAUSED", "rgba(8, 10, 14, 0.55)");
    } else if (game.slowmoTimer > 0) {
      // subtle vignette during slow-mo
      ctx.save();
      const g = ctx.createRadialGradient(view.width / 2, view.height / 2, 0,
        view.width / 2, view.height / 2, Math.max(view.width, view.height) * 0.7);
      g.addColorStop(0, "rgba(0,0,0,0)");
      g.addColorStop(1, "rgba(255,80,80,0.2)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, view.width, view.height);
      ctx.restore();
    }
  }

  function drawSpace() {
    const bg = ctx.createLinearGradient(0, 0, 0, view.height);
    bg.addColorStop(0, "#08090d");
    bg.addColorStop(0.54, "#111017");
    bg.addColorStop(1, "#07080b");
    ctx.fillStyle = bg;
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

    for (const s of stars) {
      ctx.globalAlpha = s.alpha;
      ctx.fillStyle = s.color;
      ctx.fillRect(s.x, s.y, s.size, s.size);
    }
    ctx.globalAlpha = 1;

    for (const nb of nebulae) {
      ctx.globalAlpha = nb.alpha * 0.12;
      const grd = ctx.createRadialGradient(nb.x, nb.y, 0, nb.x, nb.y, nb.r);
      grd.addColorStop(0, nb.color);
      grd.addColorStop(1, "transparent");
      ctx.fillStyle = grd;
      ctx.fillRect(nb.x - nb.r, nb.y - nb.r, nb.r * 2, nb.r * 2);
    }
    ctx.globalAlpha = 1;
  }

  function drawTrail() {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const t of trail) {
      const a = Math.max(0, t.life / 0.55);
      ctx.globalAlpha = a * 0.55;
      ctx.fillStyle = game.boostTimer > 0 ? "#ffc857" : "#62e3ff";
      ctx.beginPath();
      ctx.arc(t.x, t.y, 6 * a, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
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
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
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

  function drawBomb(item) {
    const r = item.radius;
    ctx.shadowColor = "#b89cff";
    ctx.shadowBlur = 14;
    ctx.fillStyle = "#2a2040";
    ctx.strokeStyle = "#b89cff";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#b89cff";
    ctx.font = `${r}px Inter,sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("💣", 0, 1);
  }

  function drawBoost(item) {
    const r = item.radius;
    ctx.shadowColor = "#ffc857";
    ctx.shadowBlur = 14;
    ctx.fillStyle = "#2a2510";
    ctx.strokeStyle = "#ffc857";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#ffc857";
    ctx.font = `${r}px Inter,sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("⚡", 0, 1);
  }

  function drawMagnet(item) {
    const r = item.radius;
    ctx.shadowColor = "#ff6fff";
    ctx.shadowBlur = 16;
    ctx.fillStyle = "#301030";
    ctx.strokeStyle = "#ff6fff";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#ff6fff";
    ctx.font = `${r}px Inter,sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("🧲", 0, 1);
  }

  function drawGolden(item) {
    const r = item.radius;
    ctx.shadowColor = "#f7c948";
    ctx.shadowBlur = 22;
    ctx.fillStyle = "#f7c948";
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < 5; i += 1) {
      const a = (Math.PI * 2 * i) / 5 - Math.PI / 2;
      const a2 = a + Math.PI / 5;
      const ox = Math.cos(a) * r * 1.2;
      const oy = Math.sin(a) * r * 1.2;
      const ix = Math.cos(a2) * r * 0.5;
      const iy = Math.sin(a2) * r * 0.5;
      if (i === 0) ctx.moveTo(ox, oy);
      else ctx.lineTo(ox, oy);
      ctx.lineTo(ix, iy);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  function drawParticles() {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const p of particles) {
      const alpha = Math.max(0, p.life / p.maxLife);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawPlayer() {
    const flicker = player.invulnerable > 0 && Math.floor(player.invulnerable * 18) % 2 === 0;
    if (flicker) return;

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
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.fillStyle = thrust;
      ctx.beginPath();
      ctx.moveTo(-8, 14);
      ctx.lineTo(0, 18 + flame);
      ctx.lineTo(8, 14);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
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

  // ---------- Particles / effects ----------
  function addEngineParticle() {
    if (!player.thrusting || game.state !== "playing") return;
    particles.push({
      x: player.x + rand(-6, 6),
      y: player.y + 18,
      vx: rand(-28, 28),
      vy: rand(120, 220),
      life: rand(0.18, 0.35),
      maxLife: 0.35,
      color: Math.random() > 0.45 ? "#62e3ff" : "#ffc857",
      size: rand(2, 5)
    });
  }

  function addBurst(x, y, color, amount) {
    for (let i = 0; i < amount; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = rand(90, 310);
      particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: rand(0.28, 0.72),
        maxLife: 0.72,
        color,
        size: rand(2, 5)
      });
    }
  }

  function triggerShake(intensity = 0.26) {
    if (prefersReducedMotion) return;
    game.shakeTimer = Math.max(game.shakeTimer, 0.3);
    game.shakeIntensity = Math.max(game.shakeIntensity, intensity * 14);
    document.body.classList.add("is-shaking");
    window.setTimeout(() => document.body.classList.remove("is-shaking"), 340);
  }

  function triggerFlash(dur) {
    game.flashTimer = dur;
  }

  // ---------- HUD ----------
  function updateHud() {
    scoreValue.textContent = game.score;
    bestValue.textContent = game.best;
    timeValue.textContent = Math.ceil(game.remaining);
    const sp = (player.shield / player.maxShield) * 100;
    shieldBar.style.width = sp + "%";
    shieldBar.classList.toggle("shield-low", sp < 30);

    if (bombBadge) {
      bombBadge.classList.toggle("is-hidden", game.bombs <= 0);
      if (bombCountEl) bombCountEl.textContent = game.bombs;
    }
    if (magnetBadge) {
      magnetBadge.classList.toggle("is-hidden", game.magnetTimer <= 0);
      if (magnetTimerEl) magnetTimerEl.textContent = Math.ceil(game.magnetTimer) + "s";
    }
    if (boostBadge) {
      boostBadge.classList.toggle("is-hidden", game.boostTimer <= 0);
      if (boostTimerBadgeEl) boostTimerBadgeEl.textContent = Math.ceil(game.boostTimer) + "s";
    }
    if (comboBadge) {
      comboBadge.classList.toggle("is-hidden", game.combo < 2);
      if (comboCountEl) comboCountEl.textContent = game.combo;
    }

    if (bombButton) bombButton.classList.toggle("is-disabled", game.bombs <= 0);
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

    if (game.state === "ready") resetPlayer();
    else {
      player.x = clamp(player.x, 28, view.width - 28);
      player.y = clamp(player.y, 110, view.height - 58);
    }
  }

  function buildStars() {
    const count = Math.round(clamp((view.width * view.height) / 8500, 70, 180));
    stars = Array.from({ length: count }, () => ({
      x: Math.random() * view.width,
      y: Math.random() * view.height,
      size: rand(1, 2.2),
      speed: rand(20, 95),
      alpha: rand(0.22, 0.9),
      color: Math.random() > 0.22 ? "#f5f7fb" : "#62e3ff"
    }));
  }

  function buildNebulae() {
    nebulae.length = 0;
    const colors = ["#62e3ff", "#b89cff", "#ff6fff", "#55ef9f"];
    for (let i = 0; i < 4; i += 1) {
      nebulae.push({
        x: Math.random() * 1400,
        y: Math.random() * 900,
        r: rand(150, 350),
        alpha: rand(0.5, 1),
        color: colors[i % colors.length]
      });
    }
  }

  // ---------- Input ----------
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
    if (event.code === "KeyM") toggleSound();
    if (event.code === "KeyP") togglePause();
  }

  function handleKeyUp(event) {
    setKey(event, false);
  }

  function setKey(event, active) {
    const map = {
      ArrowLeft: "left", KeyA: "left",
      ArrowRight: "right", KeyD: "right",
      ArrowUp: "up", KeyW: "up",
      ArrowDown: "down", KeyS: "down"
    };
    const key = map[event.code];
    if (!key) return;
    event.preventDefault();
    input[key] = active;
    if (active) input.pointer = false;
  }

  function bindHoldButton(id, property) {
    const button = document.getElementById(id);
    if (!button) return;
    const setActive = (active) => {
      input[property] = active;
      if (active) input.pointer = false;
    };
    button.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      try { button.setPointerCapture(event.pointerId); } catch { /* noop */ }
      setActive(true);
      if (game.state === "ready" || game.state === "ended") startGame();
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

  // ---------- Actions ----------
  function useBomb() {
    if (game.bombs <= 0) return;
    game.bombs -= 1;
    unlockAchievement("bombMaster");
    playNoise(0.5);
    playSound(150, 0.5, "square");
    for (let i = objects.length - 1; i >= 0; i -= 1) {
      if (objects[i].type === "meteor") {
        addBurst(objects[i].x, objects[i].y, "#b89cff", 12);
        game.score += 5;
        objects.splice(i, 1);
      }
    }
    triggerShake(0.4);
    showToast("💥 BOMB!");
  }

  function toggleSound() {
    soundOn = !soundOn;
    if (soundBtn) soundBtn.textContent = soundOn ? "🔊" : "🔇";
    storage.set(LS.sound, soundOn ? "1" : "0");
  }

  async function shareResult() {
    const grade = calcGrade(game.score);
    const text = `I scored ${game.score} (${grade}) on Orbit Runner! Best: ${game.best}.`;
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: "Orbit Runner", text, url });
        return;
      }
    } catch { /* user cancelled */ }
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(`${text} ${url}`);
        showToast("Copied result to clipboard!");
      } else {
        showToast("Sharing is not supported here.");
      }
    } catch {
      showToast("Sharing failed.");
    }
  }

  // ---------- Overlays ----------
  function showWave(n) {
    if (!waveLabelEl) return;
    waveLabelEl.textContent = "WAVE " + n;
    retriggerAnimation(waveLabelEl);
    window.setTimeout(() => waveLabelEl.classList.add("is-hidden"), 2100);
  }

  function showToast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    retriggerAnimation(toastEl);
    window.setTimeout(() => toastEl.classList.add("is-hidden"), 2600);
  }

  function showCombo(n) {
    if (!comboLabelEl) return;
    comboLabelEl.textContent = n + "x COMBO!";
    retriggerAnimation(comboLabelEl);
    window.setTimeout(() => comboLabelEl.classList.add("is-hidden"), 1100);
  }

  function showAchievement(title, desc) {
    if (!achievementEl) return;
    achievementEl.innerHTML = `<span class="ach-icon">★</span><div><strong>${title}</strong><span>${desc}</span></div>`;
    retriggerAnimation(achievementEl);
    window.setTimeout(() => achievementEl.classList.add("is-hidden"), 3200);
  }

  function retriggerAnimation(el) {
    el.classList.remove("is-hidden");
    el.style.animation = "none";
    // force reflow to restart CSS animation
    void el.offsetHeight;
    el.style.animation = "";
  }

  function addFloatingText(x, y, text, color) {
    floatingTexts.push({ x, y, text, color, life: 1, maxLife: 1 });
  }

  function updateFloatingTexts(dt) {
    for (let i = floatingTexts.length - 1; i >= 0; i -= 1) {
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
      ctx.font = "800 16px Inter,sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(ft.text, ft.x, ft.y);
    }
    ctx.globalAlpha = 1;
  }

  // ---------- Audio ----------
  let audioCtx = null;

  function ensureAudio() {
    if (!soundOn) return null;
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === "suspended") audioCtx.resume();
      return audioCtx;
    } catch {
      return null;
    }
  }

  function playSound(freq, dur, type = "sine") {
    const ac = ensureAudio();
    if (!ac) return;
    try {
      const o = ac.createOscillator();
      const g = ac.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, ac.currentTime);
      if (type === "square") o.frequency.exponentialRampToValueAtTime(10, ac.currentTime + dur);
      g.gain.setValueAtTime(type === "square" ? 0.05 : 0.15, ac.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + dur);
      o.connect(g).connect(ac.destination);
      o.start();
      o.stop(ac.currentTime + dur);
    } catch { /* noop */ }
  }

  function playNoise(dur) {
    const ac = ensureAudio();
    if (!ac) return;
    try {
      const bufferSize = ac.sampleRate * dur;
      const buffer = ac.createBuffer(1, bufferSize, ac.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i += 1) data[i] = Math.random() * 2 - 1;
      const noise = ac.createBufferSource();
      noise.buffer = buffer;
      const f = ac.createBiquadFilter();
      f.type = "lowpass";
      f.frequency.value = 1000;
      const g = ac.createGain();
      g.gain.setValueAtTime(0.3, ac.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + dur);
      noise.connect(f).connect(g).connect(ac.destination);
      noise.start();
    } catch { /* noop */ }
  }

  // ---------- Magnet ----------
  function attractShards(dt) {
    const range = 180;
    for (const item of objects) {
      if (item.type !== "shard" && item.type !== "golden") continue;
      const dx = player.x - item.x;
      const dy = player.y - item.y;
      const dist = Math.hypot(dx, dy);
      if (dist < range && dist > 1) {
        const f = (1 - dist / range) * 600 * dt;
        item.vx += (dx / dist) * f;
        item.vy += (dy / dist) * f;
      }
    }
  }

  // ---------- Leaderboard ----------
  function renderLeaderboard(top) {
    if (!leaderboardList) return;
    leaderboardList.innerHTML = "";
    if (!top || !top.length) {
      leaderboardList.innerHTML = `<li class="lb-empty">No runs yet — break the ice!</li>`;
      return;
    }
    for (const r of top) {
      const li = document.createElement("li");
      li.innerHTML = `<span class="lb-score">${r.score}</span>
        <span class="lb-meta">${(r.diff || "normal").toUpperCase()} · ${r.combo}x · ${r.date || ""}</span>`;
      leaderboardList.appendChild(li);
    }
  }

  function renderLeaderboardPreview() {
    const top = storage.getJSON(LS.board, []) || [];
    renderLeaderboard(top);
  }

  // ---------- Helpers ----------
  function calcGrade(score) {
    if (score >= 800) return "S";
    if (score >= 500) return "A";
    if (score >= 300) return "B";
    if (score >= 150) return "C";
    return "D";
  }
  function rand(min, max) { return min + Math.random() * (max - min); }
  function clamp(v, min, max) { return Math.min(max, Math.max(min, v)); }
})();
