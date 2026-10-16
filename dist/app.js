(() => {
  const plays = window.PLAYBOOK_DATA || [];
  const $ = (selector) => document.querySelector(selector);
  const state = {
    playIndex: 0, stepIndex: 0, active: null, playing: false, running: false,
    frameId: null, lastTimestamp: null, pieceNodes: new Map(), ballNode: null,
    pathNodes: [], cueNodes: new Map(), choices: {}, confirmed: new Set(),
    pendingDecision: null, resolvedPlay: null, openFamilies: new Set()
  };
  const els = {
    playList: $("#play-list"), playCount: $("#play-count"), playTitle: $("#play-title"),
    playFamily: $("#play-family"), playSummary: $("#play-summary"), sideBadge: $("#side-badge"),
    statusBadge: $("#status-badge"), stepReadout: $("#step-readout"), stepTitle: $("#step-title"),
    stepDescription: $("#step-description"), timeline: $("#timeline"), duration: $("#duration"),
    coachingPoints: $("#coaching-points"), emptyBoard: $("#empty-board"),
    offenseLayer: $("#offense-layer"), defenseLayer: $("#defense-layer"), pathsLayer: $("#paths-layer"),
    ballLayer: $("#ball-layer"), annotations: $("#annotation-layer"), court: $("#court"),
    screenLayer: $("#screen-layer"),
    playBtn: $("#play-btn"), prevBtn: $("#prev-btn"), nextBtn: $("#next-btn"),
    resetBtn: $("#reset-btn"), speed: $("#speed"), progress: $("#step-progress"),
    stepTime: $("#step-time"), phaseNote: $("#phase-note"),
    decisionPanel: $("#decision-panel"), decisionOptions: $("#decision-options"),
    decisionNote: $("#decision-note"), decisionStage: $("#decision-stage")
  };
  const currentPlay = () => state.resolvedPlay || plays[state.playIndex];
  const currentIndex = () => state.active?.index ?? state.stepIndex;

  function svgEl(tag, attrs = {}) {
    const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
    Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, value));
    return node;
  }

  function updatePlayButton() {
    els.playBtn.innerHTML = state.running ? "Ⅱ <span>暂停</span>" : "▶ <span>播放</span>";
  }

  function pausePlayback() {
    state.playing = false;
    state.running = false;
    if (state.frameId !== null) cancelAnimationFrame(state.frameId);
    state.frameId = null;
    state.lastTimestamp = null;
    updatePlayButton();
  }

  function stopPlayback() {
    pausePlayback();
    state.active = null;
  }

  function renderPlayList() {
    els.playList.replaceChildren();
    const families = [...new Set(plays.map(play => play.family))];
    families.forEach(family => {
      const members = plays.map((play, index) => ({ play, index })).filter(item => item.play.family === family);
      const number = members[0].play.name.replace(/[^0-9]/g, "");
      const active = members.some(item => item.index === state.playIndex);
      const group = document.createElement("details");
      group.className = `play-group${active ? " active-family" : ""}`;
      group.open = state.openFamilies.has(family);
      const heading = document.createElement("summary");
      const ready = members.filter(item => item.play.status === "ready").length;
      heading.innerHTML = `<span class="play-number">${number}</span><strong>${number}号战术</strong><span class="family-status">${ready ? `${ready}/2` : "待录入"}</span>`;
      group.appendChild(heading);
      const children = document.createElement("div");
      children.className = "play-children";
      children.setAttribute("role", "group");
      children.setAttribute("aria-label", `${number}号战术的左右侧版本`);
      members.forEach(({ play, index }) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = `play-item${index === state.playIndex ? " active" : ""}`;
        button.dataset.playId = play.id;
        button.setAttribute("aria-current", index === state.playIndex ? "page" : "false");
        button.innerHTML = `
          <span class="play-side-icon">${play.side[0]}</span>
          <span><strong>${play.name}</strong><small>${play.side}发起</small></span>
          <i class="status-dot ${play.status === "ready" ? "ready" : ""}"></i>`;
        button.addEventListener("click", () => selectPlay(index));
        children.appendChild(button);
      });
      group.appendChild(children);
      group.addEventListener("toggle", () => {
        if (group.open) state.openFamilies.add(family);
        else state.openFamilies.delete(family);
      });
      els.playList.appendChild(group);
    });
    els.playCount.textContent = `${families.filter(f => plays.some(p => p.family === f && p.status === "ready")).length} / ${families.length}`;
    els.playCount.title = "已录入的战术组数";
  }

  function selectPlay(index) {
    stopPlayback();
    state.playIndex = index;
    state.openFamilies.add(plays[index].family);
    state.stepIndex = 0;
    state.choices = {};
    state.confirmed.clear();
    state.pendingDecision = null;
    state.resolvedPlay = window.PlayMotion.resolvePlay(plays[index], state.choices);
    const play = currentPlay();
    history.replaceState(null, "", `#${encodeURIComponent(play.id)}`);
    renderPlayList();
    els.playTitle.textContent = play.name;
    els.playFamily.textContent = `${play.family} · ${play.side}发起`;
    els.playSummary.textContent = play.summary;
    els.sideBadge.textContent = play.side;
    els.statusBadge.textContent = play.status === "ready" ? "已完成" : "待录入";
    els.statusBadge.classList.toggle("muted", play.status !== "ready");
    els.emptyBoard.classList.toggle("hidden", play.steps.length > 0);
    els.duration.textContent = play.duration || "—";
    renderCoachingPoints();
    renderDecision();
    clearCourt();
    if (!play.steps.length) {
      els.stepReadout.textContent = "0 / 0";
      els.stepTitle.textContent = "尚未录入";
      els.stepDescription.textContent = "文字描述确认后生成动画步骤。";
      els.timeline.innerHTML = '<li class="timeline-empty">文字描述确认后生成动画步骤</li>';
      [els.prevBtn, els.nextBtn, els.resetBtn, els.playBtn, els.progress].forEach((node) => node.disabled = true);
      els.progress.value = "0";
      els.stepTime.textContent = "0.0 / 0.0 秒";
      els.phaseNote.textContent = "等待录入战术。";
      return;
    }
    buildCourt(play);
    installStep(0);
    updatePlayButton();
  }

  function renderCoachingPoints() {
    els.coachingPoints.replaceChildren();
    const points = currentPlay().coachingPoints.length
      ? currentPlay().coachingPoints : ["录入战术后显示关键站位、时机与选择。"];
    points.forEach((point) => {
      const item = document.createElement("li");
      item.textContent = point;
      els.coachingPoints.appendChild(item);
    });
  }

  function renderDecision() {
    const decisions = currentPlay().decisions || [];
    els.decisionPanel.hidden = decisions.length === 0;
    if (!decisions.length) return;
    const decision = decisions.find((item) => item.id === state.pendingDecision)
      || decisions.find((item) => item.atStep >= currentIndex()) || decisions.at(-1);
    const selected = state.choices[decision.id] || decision.defaultOption;
    els.decisionPanel.classList.toggle("needs-choice", state.pendingDecision !== null);
    els.decisionStage.textContent = state.pendingDecision ? "已暂停 · 请选择后续动作" : `第${decision.atStep + 1}步分支`;
    els.decisionOptions.replaceChildren();
    decision.options.forEach((option) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "decision-option";
      button.dataset.choice = option.id;
      button.setAttribute("aria-pressed", String(selected === option.id));
      const title = document.createElement("strong");
      title.textContent = option.label;
      const description = document.createElement("small");
      description.textContent = option.description;
      button.append(title, description);
      button.addEventListener("click", () => chooseBranch(decision, option));
      els.decisionOptions.appendChild(button);
    });
    const activeOption = decision.options.find((option) => option.id === selected);
    els.decisionNote.textContent = state.pendingDecision
      ? "球已传到2号。选择掩护方向后，播放对应的补防与顺下。"
      : `${activeOption?.label || ""}。左右沿用球队叫法，以“中路／底线”辨认路线；切换方向会从上提掩护重播。`;
  }

  function needsDecision(index) {
    return (currentPlay().decisions || []).find((decision) =>
      decision.atStep <= index && !state.confirmed.has(decision.id));
  }

  function waitAtDecision(decision) {
    pausePlayback();
    state.pendingDecision = decision.id;
    state.stepIndex = Math.max(0, decision.atStep - 1);
    installStep(decision.atStep);
    renderDecision();
  }

  function chooseBranch(decision, option) {
    const replay = state.pendingDecision !== null || currentIndex() >= decision.atStep;
    if (replay) pausePlayback();
    state.choices[decision.id] = option.id;
    state.confirmed.add(decision.id);
    state.pendingDecision = null;
    // Choices at later nodes depend on the chosen earlier route.
    (currentPlay().decisions || []).forEach((later) => {
      if (later.atStep > decision.atStep) state.confirmed.delete(later.id);
    });
    state.resolvedPlay = window.PlayMotion.resolvePlay(plays[state.playIndex], state.choices);
    renderCoachingPoints();
    if (replay) {
      state.stepIndex = Math.max(0, decision.atStep - 1);
      installStep(decision.atStep);
      state.playing = true;
      run();
    }
    renderDecision();
  }

  function refreshStepDetails(index) {
    const play = currentPlay(), step = play.steps[index];
    els.stepReadout.textContent = `${index + 1} / ${play.steps.length}`;
    els.stepTitle.textContent = step.title;
    els.stepDescription.textContent = step.description || "";
    els.prevBtn.disabled = index === 0;
    els.nextBtn.disabled = index === play.steps.length - 1;
    els.resetBtn.disabled = false;
    els.playBtn.disabled = false;
    els.progress.disabled = index === 0;
    els.timeline.replaceChildren();
    play.steps.forEach((item, itemIndex) => {
      const node = document.createElement("li");
      node.className = itemIndex === index ? "active" : "";
      node.textContent = item.title;
      node.addEventListener("click", () => jumpToStep(itemIndex));
      els.timeline.appendChild(node);
    });
  }

  function clearCourt() {
    [els.offenseLayer, els.defenseLayer, els.pathsLayer, els.screenLayer, els.ballLayer, els.annotations]
      .forEach((layer) => layer.replaceChildren());
    state.pieceNodes.clear();
    state.cueNodes.clear();
    state.pathNodes = [];
    state.ballNode = null;
  }

  function buildCourt(play) {
    const players = new Map();
    play.steps.forEach((step) => step.positions.forEach((player) => players.set(player.label, player)));
    players.forEach((player, label) => {
      const group = svgEl("g", { class: `player-piece ${player.team || "offense"}`, "data-player": label });
      const title = svgEl("title");
      title.textContent = player.team === "defense"
        ? (play.defense === "man-to-man" ? `${label}：盯防${label.replace(/^X/, "")}号` : `${label}号防守球员`)
        : `${label}号进攻球员`;
      group.setAttribute("aria-label", title.textContent);
      group.append(title, svgEl("circle", { cx: 0, cy: 0, r: 29 }));
      const text = svgEl("text", { x: 0, y: 1 });
      text.textContent = label;
      group.appendChild(text);
      state.pieceNodes.set(label, group);
      (player.team === "defense" ? els.defenseLayer : els.offenseLayer).appendChild(group);
    });
    state.ballNode = svgEl("g", { class: "ball-piece" });
    state.ballNode.append(
      svgEl("circle", { cx: 0, cy: 0, r: 12, fill: "#e96e27", stroke: "#432616", "stroke-width": 3 }),
      svgEl("path", { d: "M-11 0H11M0-11V11M-8-8Q0 0 8 8M8-8Q0 0-8 8", fill: "none", stroke: "#432616", "stroke-width": 1.5 })
    );
    els.ballLayer.appendChild(state.ballNode);
  }

  function drawPaths(step, motion) {
    els.pathsLayer.replaceChildren();
    els.screenLayer.replaceChildren();
    state.pathNodes = (step.paths || []).map((definition) => {
      const node = svgEl("path", {
        d: motion.pathFor(definition.actor) || definition.d,
        class: `motion-path ${definition.type || "run"}`
      });
      node.dataset.actor = definition.actor || "";
      if (definition.screenActor) node.dataset.screener = definition.screenActor;
      (definition.type === "screen" ? els.screenLayer : els.pathsLayer).appendChild(node);
      return { definition, node };
    });
    els.annotations.replaceChildren();
    state.cueNodes.clear();
  }

  function installStep(index) {
    const motion = window.PlayMotion.compileStep(currentPlay(), index);
    state.active = { index, motion, elapsed: 0 };
    state.lastTimestamp = null;
    drawPaths(currentPlay().steps[index], motion);
    refreshStepDetails(index);
    renderMotion();
  }

  function renderCues(sample) {
    const wanted = new Set(sample.cues.map((cue) => cue.id));
    state.cueNodes.forEach((node, id) => {
      if (!wanted.has(id)) { node.remove(); state.cueNodes.delete(id); }
    });
    sample.cues.forEach((cue) => {
      const position = sample.positions.get(cue.actor);
      if (!position) return;
      let group = state.cueNodes.get(cue.id);
      if (!group) {
        group = svgEl("g", { class: `court-cue ${cue.tone || "help"}` });
        const width = Math.max(90, cue.text.length * 20 + 18);
        group.dataset.width = String(width);
        group.appendChild(svgEl("rect", { x: -width / 2, y: -15, width, height: 30, rx: 8 }));
        const text = svgEl("text", { x: 0, y: 0 });
        text.textContent = cue.text;
        group.appendChild(text);
        els.annotations.appendChild(group);
        state.cueNodes.set(cue.id, group);
      }
      // Keep instructional labels out of player markers as the action develops.
      const width = Number(group.dataset.width);
      const offsets = [
        [cue.dx || 0, cue.dy ?? 54], [0, -54], [0, 54],
        [-110, -28], [110, -28], [-110, 30], [110, 30]
      ];
      const candidates = offsets.map(([dx, dy], index) => {
        const x = Math.max(32 + width / 2, Math.min(928 - width / 2, position.x + dx));
        const y = Math.max(48, Math.min(850, position.y + dy));
        let penalty = index;
        sample.positions.forEach((p) => {
          const nearestX = Math.max(x - width / 2, Math.min(x + width / 2, p.x));
          const nearestY = Math.max(y - 15, Math.min(y + 15, p.y));
          if (Math.hypot(p.x - nearestX, p.y - nearestY) < 34) penalty += 100;
        });
        return { x, y, penalty };
      });
      const placement = candidates.reduce((a, b) => a.penalty <= b.penalty ? a : b);
      group.setAttribute("transform", `translate(${placement.x} ${placement.y})`);
    });
    const note = sample.cues.map((cue) => cue.note || cue.text).join(" → ")
      || currentPlay().steps[currentIndex()].phaseNote || "拖动进度，观察每名球员的动作与时机。";
    if (els.phaseNote.textContent !== note) els.phaseNote.textContent = note;
  }

  function renderMotion() {
    const active = state.active;
    if (!active) return;
    const sample = active.motion.sample(active.elapsed);
    sample.positions.forEach((position, label) => {
      state.pieceNodes.get(label)?.setAttribute("transform", `translate(${position.x} ${position.y})`);
    });
    state.ballNode.style.display = sample.ball ? "" : "none";
    if (sample.ball) state.ballNode.setAttribute("transform", `translate(${sample.ball.x} ${sample.ball.y})`);
    state.pathNodes.forEach(({ definition, node }) => {
      if (definition.type === "screen" && definition.screenActor) {
        const actor = sample.positions.get(definition.screenActor);
        const normal = definition.screenNormal || { x: 1, y: 0 };
        const length = Math.hypot(normal.x, normal.y) || 1;
        const nx = normal.x / length, ny = normal.y / length;
        const x = actor.x + nx * 34, y = actor.y + ny * 34;
        // Keep the cap outside the player marker; old 21px offsets were hidden.
        node.setAttribute("d", `M${x - ny * 24} ${y + nx * 24} L${x + ny * 24} ${y - nx * 24} M${x} ${y} L${x - nx * 12} ${y - ny * 12}`);
      }
      node.style.display = sample.progress >= (definition.from ?? 0) && sample.progress <= (definition.to ?? 1) ? "" : "none";
    });
    els.progress.value = active.motion.duration ? String(Math.round(sample.progress * 1000)) : "0";
    els.stepTime.textContent = `${(active.elapsed / 1000).toFixed(1)} / ${(active.motion.duration / 1000).toFixed(1)} 秒`;
    els.court.dataset.step = String(active.index);
    els.court.dataset.elapsed = String(active.elapsed);
    els.court.dataset.branch = JSON.stringify(state.choices);
    renderCues(sample);
    if (state.pendingDecision) els.phaseNote.textContent = "请在上方选择左挡或右挡，继续对应的后续动作。";
  }

  function tick(timestamp) {
    state.frameId = null;
    if (!state.running || !state.active) return;
    if (state.lastTimestamp === null) state.lastTimestamp = timestamp;
    const delta = Math.max(0, timestamp - state.lastTimestamp);
    state.lastTimestamp = timestamp;
    const active = state.active;
    active.elapsed = Math.min(active.motion.duration, active.elapsed + delta * Number(els.speed.value || 1));
    renderMotion();
    if (active.elapsed >= active.motion.duration) {
      state.stepIndex = active.index;
      if (state.playing && active.index < currentPlay().steps.length - 1) {
        const decision = needsDecision(active.index + 1);
        if (decision) { waitAtDecision(decision); return; }
        installStep(active.index + 1);
      } else {
        state.running = false;
        state.playing = false;
        state.lastTimestamp = null;
        updatePlayButton();
        return;
      }
    }
    state.frameId = requestAnimationFrame(tick);
  }

  function run() {
    state.running = true;
    state.lastTimestamp = null;
    updatePlayButton();
    state.frameId = requestAnimationFrame(tick);
  }

  function jumpToStep(index) {
    stopPlayback();
    const decision = needsDecision(index);
    if (decision) { waitAtDecision(decision); return; }
    state.pendingDecision = null;
    installStep(index);
    renderDecision();
    state.stepIndex = Math.max(0, index - 1);
    if (index > 0) run();
    else state.stepIndex = 0;
  }

  function startPlayback() {
    if (!currentPlay().steps.length) return;
    if (state.pendingDecision) { renderDecision(); return; }
    state.playing = true;
    if (!state.active || state.active.elapsed >= state.active.motion.duration) {
      let next = currentIndex() + 1;
      if (next >= currentPlay().steps.length) next = 1;
      const decision = needsDecision(next);
      if (decision) { waitAtDecision(decision); return; }
      installStep(next);
    }
    run();
  }

  els.playBtn.addEventListener("click", () => state.running ? pausePlayback() : startPlayback());
  els.prevBtn.addEventListener("click", () => jumpToStep(Math.max(0, currentIndex() - 1)));
  els.nextBtn.addEventListener("click", () => jumpToStep(Math.min(currentPlay().steps.length - 1, currentIndex() + 1)));
  els.resetBtn.addEventListener("click", () => {
    stopPlayback(); state.stepIndex = 0; state.pendingDecision = null;
    state.confirmed.clear(); installStep(0); renderDecision();
  });
  els.progress.addEventListener("input", () => {
    pausePlayback();
    if (!state.active) return;
    if (state.pendingDecision) { els.progress.value = "0"; return; }
    state.active.elapsed = Number(els.progress.value) / 1000 * state.active.motion.duration;
    state.stepIndex = state.active.elapsed === state.active.motion.duration
      ? state.active.index : Math.max(0, state.active.index - 1);
    renderMotion();
  });

  const selectFromHash = () => {
    const id = decodeURIComponent(location.hash.slice(1));
    const index = plays.findIndex(play => play.id === id);
    selectPlay(index >= 0 ? index : 0);
  };
  selectFromHash();
  window.addEventListener("hashchange", selectFromHash);
  if (new URLSearchParams(location.search).get("autoplay") === "1") window.setTimeout(startPlayback, 450);
})();
