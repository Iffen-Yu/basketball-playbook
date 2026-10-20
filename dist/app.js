(() => {
  const i18n = window.PlaybookI18n;
  const t = i18n.t;
  let plays = i18n.getPlays();
  const $ = (selector) => document.querySelector(selector);
  const state = {
    playIndex: 0, stepIndex: 0, active: null, playing: false, running: false,
    frameId: null, lastTimestamp: null, pieceNodes: new Map(), ballNode: null,
    pathNodes: [], cueNodes: new Map(), choices: {}, confirmed: new Set(),
    pendingDecision: null, resolvedPlay: null, openFamilies: new Set(),
    focusedPlayer: null, studyTab: 'coaching'
  };
  const els = {
    playList: $("#play-list"), playCount: $("#play-count"), playTitle: $("#play-title"),
    playFamily: $("#play-family"), playSummary: $("#play-summary"),
    stepReadout: $("#step-readout"), stepTitle: $("#step-title"),
    stepDescription: $("#step-description"), timeline: $("#timeline"), duration: $("#duration"),
    coachingPoints: $("#coaching-points"), emptyBoard: $("#empty-board"),
    offenseLayer: $("#offense-layer"), defenseLayer: $("#defense-layer"), pathsLayer: $("#paths-layer"),
    ballLayer: $("#ball-layer"), annotations: $("#annotation-layer"), court: $("#court"),
    screenLayer: $("#screen-layer"),
    playBtn: $("#play-btn"), prevBtn: $("#prev-btn"), nextBtn: $("#next-btn"),
    resetBtn: $("#reset-btn"), speed: $("#speed"), progress: $("#step-progress"),
    stepTime: $("#step-time"), phaseNote: $("#phase-note"),
    decisionPanel: $("#decision-panel"), decisionOptions: $("#decision-options"),
    decisionNote: $("#decision-note"), decisionStage: $("#decision-stage"),
    detailPanel: $(".detail-panel"), studyTabs: $(".study-tabs"),
    focusReadout: $("#focus-readout"), clearFocus: $("#clear-focus")
  };
  const currentPlay = () => state.resolvedPlay || plays[state.playIndex];
  const currentIndex = () => state.active?.index ?? state.stepIndex;

  function svgEl(tag, attrs = {}) {
    const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
    Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, value));
    return node;
  }

  function updatePlayButton() {
    els.playBtn.innerHTML = `${state.running ? 'Ⅱ' : '▶'} <span>${t(state.running ? 'pause' : 'play')}</span>`;
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
      group.open = state.openFamilies.has(number);
      const heading = document.createElement("summary");
      heading.innerHTML = `<span class="play-number">${number}</span><strong>${t('family',{number})}</strong><span class="family-chevron" aria-hidden="true"></span>`;
      group.appendChild(heading);
      const children = document.createElement("div");
      children.className = "play-children";
      children.setAttribute("role", "group");
      children.setAttribute("aria-label", t('familySides',{number}));
      members.forEach(({ play, index }) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = `play-item${index === state.playIndex ? " active" : ""}`;
        button.dataset.playId = play.id;
        button.setAttribute("aria-current", index === state.playIndex ? "page" : "false");
        button.innerHTML = `<strong>${play.name}</strong>`;
        button.addEventListener("click", () => selectPlay(index));
        children.appendChild(button);
      });
      group.appendChild(children);
      group.addEventListener("toggle", () => {
        if (group.open) state.openFamilies.add(number);
        else state.openFamilies.delete(number);
      });
      els.playList.appendChild(group);
    });
    els.playCount.textContent = t('count',{count:families.length});
    els.playCount.title = t('countTitle');
  }

  function selectPlay(index) {
    stopPlayback();
    state.playIndex = index;
    state.openFamilies.add(plays[index].name.replace(/[^0-9]/g,''));
    state.stepIndex = 0;
    state.choices = {};
    state.confirmed.clear();
    state.pendingDecision = null;
    state.focusedPlayer = null;
    els.detailPanel.scrollTop = 0;
    state.resolvedPlay = window.PlayMotion.resolvePlay(plays[index], state.choices);
    const play = currentPlay();
    history.replaceState(null, "", `#${encodeURIComponent(play.id)}`);
    renderPlayList();
    els.playTitle.textContent = play.name;
    els.playFamily.textContent = t('playFamily',{family:play.family,side:play.side});
    els.playSummary.textContent = play.summary;
    els.emptyBoard.classList.toggle("hidden", play.steps.length > 0);
    els.duration.textContent = play.duration || "—";
    renderCoachingPoints();
    selectStudyTab(state.studyTab);
    renderDecision();
    clearCourt();
    if (!play.steps.length) {
      els.stepReadout.textContent = "0 / 0";
      els.stepTitle.textContent = t('emptyStep');
      els.stepDescription.textContent = t('emptyDescription');
      els.timeline.innerHTML = `<li class="timeline-empty">${t('emptyTimeline')}</li>`;
      [els.prevBtn, els.nextBtn, els.resetBtn, els.playBtn, els.progress].forEach((node) => node.disabled = true);
      els.progress.value = "0";
      els.stepTime.textContent = t('time',{elapsed:'0.0',duration:'0.0'});
      els.phaseNote.textContent = t('emptyNote');
      return;
    }
    buildCourt(play);
    installStep(0);
    updatePlayButton();
  }

  function renderCoachingPoints() {
    els.coachingPoints.replaceChildren();
    const points = currentPlay().coachingPoints.length
      ? currentPlay().coachingPoints : [t('emptyPoints')];
    points.forEach((point) => {
      const item = document.createElement("li");
      const separator = point.search(/[：:]/);
      const body = separator >= 0 ? point.slice(separator + 1) : point;
      if (separator >= 0) {
        const title = document.createElement('strong');
        title.className = 'point-title';
        title.textContent = point.slice(0, separator + 1);
        item.appendChild(title);
      }
      // Preserve the original text while turning player references into locators.
      const pattern = /X[1-5]|[1-5](?:号)?/g;
      let previous = 0;
      for (const match of body.matchAll(pattern)) {
        item.appendChild(document.createTextNode(body.slice(previous, match.index)));
        const button = document.createElement('button');
        const label = match[0].replace('号', '');
        button.type = 'button';
        button.className = `player-reference${label.startsWith('X') ? ' defense' : ''}`;
        button.dataset.locatePlayer = label;
        button.textContent = match[0];
        button.setAttribute('aria-label',t(label.startsWith('X') ? 'locateDefense' : 'locate',{label}));
        item.appendChild(button);
        previous = match.index + match[0].length;
      }
      item.appendChild(document.createTextNode(body.slice(previous)));
      els.coachingPoints.appendChild(item);
    });
    renderPlayerFocus();
  }

  function renderPlayerFocus() {
    state.pieceNodes.forEach((node, label) => {
      node.classList.toggle('is-highlighted', label === state.focusedPlayer);
      node.classList.toggle('is-dimmed', !!state.focusedPlayer && label !== state.focusedPlayer);
    });
    document.querySelectorAll('[data-locate-player]').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.locatePlayer === state.focusedPlayer));
    });
    els.focusReadout.textContent = state.focusedPlayer ? t('focused',{label:state.focusedPlayer}) : t('focus');
    els.clearFocus.hidden = !state.focusedPlayer;
  }

  function selectStudyTab(name, focus = false) {
    state.studyTab = name;
    els.studyTabs.querySelectorAll('[role=tab]').forEach(button => {
      const active = button.id === `${name}-tab`;
      button.setAttribute('aria-selected', String(active));
      button.tabIndex = active ? 0 : -1;
      if (active && focus) button.focus();
    });
    $('#coaching-view').hidden = name !== 'coaching';
    $('#steps-view').hidden = name !== 'steps';
  }

  function changeLanguage(language) {
    if (language === i18n.language) return;
    plays = i18n.setLanguage(language);
    state.resolvedPlay = window.PlayMotion.resolvePlay(plays[state.playIndex], state.choices);
    const play = currentPlay();
    els.playTitle.textContent = play.name;
    els.playFamily.textContent = t('playFamily',{family:play.family,side:play.side});
    els.playSummary.textContent = play.summary;
    els.duration.textContent = play.duration || '—';
    renderPlayList();
    renderCoachingPoints();
    // Replace text/graphics in place. Keep time, play state, branch confirmations,
    // selected tab and player focus, including when paused at a decision.
    const index = currentIndex(), elapsed = state.active?.elapsed || 0;
    clearCourt();
    buildCourt(play);
    if (play.steps.length) {
      const motion = window.PlayMotion.compileStep(play,index);
      state.active = {index,motion,elapsed};
      drawPaths(play.steps[index],motion);
      refreshStepDetails(index);
      renderDecision();
      renderMotion();
    }
    updatePlayButton();
  }

  function renderDecision() {
    const decisions = currentPlay().decisions || [];
    // Reveal only a node that has actually been reached, never a future choice.
    // Keep the latest reached node available for replay until the next one arrives.
    const decision = decisions.find((item) => item.id === state.pendingDecision)
      || decisions.filter((item) => item.atStep <= currentIndex()).at(-1);
    els.decisionPanel.hidden = !decision;
    els.decisionPanel.classList.toggle("needs-choice", state.pendingDecision !== null && !!decision);
    if (!decision) {
      els.decisionOptions.replaceChildren();
      els.decisionNote.textContent = "";
      els.decisionStage.textContent = "";
      return;
    }
    const selected = state.choices[decision.id] || decision.defaultOption;
    els.decisionPanel.querySelector('.eyebrow').textContent = decision.title || t('screenDirection');
    els.decisionOptions.setAttribute("aria-label", decision.title || t('screenDirection'));
    els.decisionStage.textContent = state.pendingDecision ? t('pending') : t('branchStep',{step:decision.atStep+1});
    els.decisionOptions.replaceChildren();
    decision.options.forEach((option) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "decision-option";
      button.dataset.choice = option.id;
      button.dataset.decision = decision.id;
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
      ? decision.prompt || t('screenPrompt')
      : decision.note ? `${activeOption?.label || ""}${i18n.language === 'en' ? '. ' : '。'}${decision.note}`
        : t('screenNote',{label:activeOption?.label || ''});
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
    // Bring the newly reached choice into the reading area, not over the court.
    els.detailPanel.scrollTop = 0;
    if (window.matchMedia('(max-width: 700px)').matches) {
      els.decisionPanel.scrollIntoView({ block: 'nearest' });
    }
  }

  function chooseBranch(decision, option) {
    const replay = state.pendingDecision !== null || currentIndex() >= decision.atStep;
    if (replay) pausePlayback();
    state.choices[decision.id] = option.id;
    state.confirmed.add(decision.id);
    state.pendingDecision = null;
    // Choices at later nodes depend on the chosen earlier route.
    (plays[state.playIndex].decisions || []).forEach((later) => {
      if (later.atStep > decision.atStep) {
        state.confirmed.delete(later.id);
        delete state.choices[later.id];
      }
    });
    state.resolvedPlay = window.PlayMotion.resolvePlay(plays[state.playIndex], state.choices);
    renderCoachingPoints();
    if (replay) {
      state.stepIndex = Math.max(0, decision.atStep - 1);
      installStep(decision.atStep);
      state.playing = true;
      run();
    } else refreshStepDetails(currentIndex());
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
      node.tabIndex = 0;
      node.setAttribute('role', 'button');
      node.setAttribute('aria-label',t('stepLabel',{step:itemIndex+1,title:item.title}));
      node.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); jumpToStep(itemIndex); }
      });
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
        ? (play.defense === "man-to-man" ? t('playerMan',{label,number:label.replace(/^X/,'')}) : t('playerZone',{label}))
        : t('playerOffense',{label});
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
    renderPlayerFocus();
  }

  function drawPaths(step, motion) {
    els.pathsLayer.replaceChildren();
    els.screenLayer.replaceChildren();
    state.pathNodes = (step.paths || []).map((definition) => {
      const node = svgEl("path", {
        d: definition.type === 'screen' ? '' : motion.pathFor(definition.actor) || definition.d || '',
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
    renderDecision();
    renderMotion();
  }

  function renderCues(sample) {
    const wanted = new Set(sample.cues.map((cue) => cue.id));
    state.cueNodes.forEach((node, id) => {
      if (!wanted.has(id)) { node.remove(); state.cueNodes.delete(id); }
    });
    const placedLabels = [];
    sample.cues.forEach((cue) => {
      const position = sample.positions.get(cue.actor);
      if (!position) return;
      let group = state.cueNodes.get(cue.id);
      if (!group) {
        group = svgEl("g", { class: `court-cue ${cue.tone || "help"}` });
        const width = Math.max(90, cue.text.length * (i18n.language === 'en' ? 9 : 20) + 18);
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
        [-110, -28], [110, -28], [-110, 30], [110, 30],
        [-150, -54], [150, -54], [-150, 54], [150, 54]
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
        placedLabels.forEach((other) => {
          if (Math.abs(x - other.x) < (width + other.width) / 2 + 8 && Math.abs(y - other.y) < 38) penalty += 80;
        });
        return { x, y, penalty };
      });
      const placement = candidates.reduce((a, b) => a.penalty <= b.penalty ? a : b);
      placedLabels.push({ ...placement, width });
      group.setAttribute("transform", `translate(${placement.x} ${placement.y})`);
    });
    const note = sample.cues.map((cue) => cue.note || cue.text).join(" → ")
      || currentPlay().steps[currentIndex()].phaseNote || t('observation');
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
    els.stepTime.textContent = t('time',{elapsed:(active.elapsed/1000).toFixed(1),duration:(active.motion.duration/1000).toFixed(1)});
    els.court.dataset.step = String(active.index);
    els.court.dataset.elapsed = String(active.elapsed);
    els.court.dataset.branch = JSON.stringify(state.choices);
    renderCues(sample);
    if (state.pendingDecision) els.phaseNote.textContent = currentPlay().decisions.find(d => d.id === state.pendingDecision)?.prompt
      || t('pendingHint');
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
  document.addEventListener('click', event => {
    const languageButton = event.target.closest('[data-language]');
    if (languageButton) { changeLanguage(languageButton.dataset.language); return; }
    const button = event.target.closest('[data-locate-player]');
    if (!button) return;
    const label = button.dataset.locatePlayer;
    state.focusedPlayer = state.focusedPlayer === label ? null : label;
    renderPlayerFocus();
  });
  els.clearFocus.addEventListener('click', () => { state.focusedPlayer = null; renderPlayerFocus(); });
  els.studyTabs.addEventListener('click', event => {
    const button = event.target.closest('[role=tab]');
    if (button) selectStudyTab(button.id.replace('-tab', ''));
  });
  els.studyTabs.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    selectStudyTab(event.key === 'Home' ? 'coaching' : event.key === 'End' ? 'steps' : state.studyTab === 'coaching' ? 'steps' : 'coaching', true);
  });
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
  i18n.applyStatic();
  selectFromHash();
  window.addEventListener("hashchange", selectFromHash);
  if (new URLSearchParams(location.search).get("autoplay") === "1") window.setTimeout(startPlayback, 450);
})();
