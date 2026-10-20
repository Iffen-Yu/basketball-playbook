// Shape-preserving cubic trajectories share continuous velocity at timed knots.
(() => {
  const cache = new WeakMap();
  const clamp = (n) => Math.max(0, Math.min(1, n));
  const ease = (name, t) => {
    if (name === "accelerate") return t * t;
    if (name === "decelerate") return 1 - (1 - t) ** 2;
    return t;
  };
  const mix = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  const samePoint = (a, b) => Math.hypot(a.x - b.x, a.y - b.y) < 1e-7;
  const bezier = (a, c1, c2, b, t) => {
    const u = 1 - t;
    return {
      x: u ** 3 * a.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t ** 3 * b.x,
      y: u ** 3 * a.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t ** 3 * b.y
    };
  };

  // PCHIP tangents stay within adjacent coordinate ranges. Shared derivatives
  // round corners without coordinate overshoot; tactical spacing is checked separately.
  function tangents(keys, axis) {
    const n = keys.length, result = new Array(n).fill(0);
    if (n < 3) return result;
    const h = [], slope = [];
    for (let i = 0; i < n - 1; i++) {
      h[i] = keys[i + 1].time - keys[i].time;
      slope[i] = (keys[i + 1][axis] - keys[i][axis]) / h[i];
    }
    for (let i = 1; i < n - 1; i++) {
      if (slope[i - 1] * slope[i] <= 0) continue;
      const w1 = 2 * h[i] + h[i - 1], w2 = h[i] + 2 * h[i - 1];
      result[i] = (w1 + w2) / (w1 / slope[i - 1] + w2 / slope[i]);
    }
    return result;
  }

  function compileTrack(keys) {
    const dx = tangents(keys, "x"), dy = tangents(keys, "y");
    const segments = keys.slice(0, -1).map((a, i) => {
      const b = keys[i + 1], span = b.time - a.time;
      return {
        a, b, span,
        c1: { x: a.x + dx[i] * span / 3, y: a.y + dy[i] * span / 3 },
        c2: { x: b.x - dx[i + 1] * span / 3, y: b.y - dy[i + 1] * span / 3 }
      };
    });
    return {
      sample(time) {
        if (time <= keys[0].time || !segments.length) return { x: keys[0].x, y: keys[0].y };
        if (time >= keys.at(-1).time) return { x: keys.at(-1).x, y: keys.at(-1).y };
        let low = 0, high = segments.length - 1;
        while (low < high) {
          const middle = Math.floor((low + high) / 2);
          if (segments[middle].b.time < time) low = middle + 1;
          else high = middle;
        }
        const s = segments[low];
        return bezier(s.a, s.c1, s.c2, s.b, clamp((time - s.a.time) / s.span));
      },
      pathBetween(start, end) {
        const startPoint = this.sample(start);
        let path = `M${startPoint.x} ${startPoint.y}`;
        segments.forEach((s) => {
          if (s.a.time < start - 1e-6 || s.b.time > end + 1e-6 || samePoint(s.a, s.b)) return;
          path += ` C${s.c1.x} ${s.c1.y} ${s.c2.x} ${s.c2.y} ${s.b.x} ${s.b.y}`;
        });
        return path;
      }
    };
  }

  // Authored routes separate court geometry from pace. Arc-length playback
  // doesn't brake at a bend or restart when the UI advances to the next step.
  function compileRoute(spec, starts, durations) {
    let previous = spec.start, total = 0;
    const nodes = [0];
    const segments = spec.curves.map(({ c1, c2, to }) => {
      const segment = { a: previous, c1, c2, b: to, offset: total, table: [0] };
      let last = previous, length = 0;
      for (let i = 1; i <= 240; i++) {
        const p = bezier(previous, c1, c2, to, i / 240);
        length += Math.hypot(p.x - last.x, p.y - last.y);
        segment.table.push(length);
        last = p;
      }
      segment.length = length;
      total += length;
      nodes.push(total);
      previous = to;
      return segment;
    });
    const pace = compileTrack(spec.timing.filter(key => key.step < starts.length).map(key => ({
      time: starts[key.step] + durations[key.step] * key.t,
      x: key.node === undefined ? key.progress : nodes[key.node] / total, y: 0
    })));
    const distanceAt = time => clamp(pace.sample(time).x) * total;
    const parameterAt = (segment, distance) => {
      const local = Math.max(0, Math.min(segment.length, distance - segment.offset));
      let low = 0, high = segment.table.length - 1;
      while (low < high) {
        const middle = Math.floor((low + high) / 2);
        if (segment.table[middle] < local) low = middle + 1;
        else high = middle;
      }
      if (!low) return 0;
      const before = segment.table[low - 1], span = segment.table[low] - before;
      return (low - 1 + (span ? (local - before) / span : 0)) / 240;
    };
    const split = (s, t) => {
      const a = mix(s.a, s.c1, t), b = mix(s.c1, s.c2, t), c = mix(s.c2, s.b, t);
      const d = mix(a, b, t), e = mix(b, c, t), p = mix(d, e, t);
      return [{ a: s.a, c1: a, c2: d, b: p }, { a: p, c1: e, c2: c, b: s.b }];
    };
    const track = {
      sample(time) {
        const distance = distanceAt(time);
        const s = segments.find(s => distance <= s.offset + s.length) || segments.at(-1);
        return bezier(s.a, s.c1, s.c2, s.b, parameterAt(s, distance));
      },
      pathBetween(start, end) {
        const from = distanceAt(start), to = distanceAt(end), p = this.sample(start);
        let path = `M${p.x} ${p.y}`;
        segments.forEach(s => {
          if (to <= s.offset || from >= s.offset + s.length || to - from < 1e-7) return;
          const a = parameterAt(s, from), b = parameterAt(s, to);
          let clipped = b < 1 ? split(s, b)[0] : s;
          if (a > 0) clipped = split(clipped, a / b)[1];
          path += ` C${clipped.c1.x} ${clipped.c1.y} ${clipped.c2.x} ${clipped.c2.y} ${clipped.b.x} ${clipped.b.y}`;
        });
        return path;
      }
    };
    return track;
  }

  function appendStepKeys(keys, start, duration, from, to, frames, route) {
    let timeline = frames?.length
      ? frames.map((key) => ({ ...key }))
      : [{ t: 0, ...from }, { t: 1, ...to }];
    if (timeline[0].t > 0) timeline.unshift({ t: 0, ...from });
    if (timeline.at(-1).t < 1) timeline.push({ t: 1, ...to });
    let routeNode, length;
    if (!frames?.length && route) {
      routeNode = document.createElementNS("http://www.w3.org/2000/svg", "path");
      routeNode.setAttribute("d", route.d);
      length = routeNode.getTotalLength();
    }
    const push = (t, p) => {
      const key = { time: start + duration * t, x: p.x, y: p.y };
      if (keys.length && Math.abs(key.time - keys.at(-1).time) < 1e-7) return;
      keys.push(key);
    };
    push(timeline[0].t, timeline[0]);
    for (let i = 1; i < timeline.length; i++) {
      const a = timeline[i - 1], b = timeline[i];
      const shaped = b.via || routeNode || b.easing === "accelerate" || b.easing === "decelerate";
      // Extra knots retain an author's bowed route / speed intent. The final
      // interpolation still has shared tangents, rather than restarting easing.
      if (shaped && !samePoint(a, b)) {
        for (const u of [.25, .5, .75]) {
          const t = a.t + (b.t - a.t) * u;
          const progress = ease(b.easing, u);
          let p;
          if (routeNode) {
            const sample = routeNode.getPointAtLength(length * t);
            p = { x: sample.x, y: sample.y };
          } else if (b.via) {
            p = mix(mix(a, b.via, progress), mix(b.via, b, progress), progress);
          } else p = mix(a, b, progress);
          push(t, p);
        }
      }
      push(b.t, b);
    }
  }

  function compilePlay(play) {
    if (cache.has(play)) return cache.get(play);
    const durations = play.steps.map((step, i) => i === 0 ? 0 : (step.duration || 1800));
    const starts = [];
    let total = 0;
    durations.forEach((duration, i) => { starts[i] = total; total += duration; });
    const labels = new Set(play.steps.flatMap((step) => step.positions.map((p) => p.label)));
    labels.add("ball");
    const tracks = new Map();
    labels.forEach((label) => {
      if (play.routes?.[label]) {
        tracks.set(label, compileRoute(play.routes[label], starts, durations));
        return;
      }
      const keys = [];
      for (let index = 1; index < play.steps.length; index++) {
        const step = play.steps[index], previous = play.steps[index - 1];
        const to = label === "ball" ? step.ball : step.positions.find((p) => p.label === label);
        const from = label === "ball" ? previous.ball : previous.positions.find((p) => p.label === label);
        if (!to || !from) continue;
        const route = step.paths?.find((p) => p.actor === label && p.type !== "screen" && p.d);
        appendStepKeys(keys, starts[index], durations[index], from, to, step.motions?.[label], route);
      }
      if (!keys.length) {
        const first = label === "ball" ? play.steps[0].ball : play.steps[0].positions.find((p) => p.label === label);
        if (first) keys.push({ time: 0, x: first.x, y: first.y });
      }
      if (keys.length) tracks.set(label, compileTrack(keys));
    });
    const result = { starts, durations, tracks };
    cache.set(play, result);
    return result;
  }

  function compileStep(play, index) {
    const target = play.steps[index];
    const compiled = compilePlay(play);
    const duration = compiled.durations[index], start = compiled.starts[index];
    return {
      duration,
      pathFor(actor) {
        return actor ? compiled.tracks.get(actor)?.pathBetween(start, start + duration) : null;
      },
      sample(elapsed) {
        const progress = duration ? clamp(elapsed / duration) : 1;
        const time = start + (duration ? progress * duration : 0);
        const positions = new Map(target.positions.map((p) => [p.label, compiled.tracks.get(p.label).sample(time)]));
        let ball = compiled.tracks.get("ball")?.sample(time) || null;
        if (target.ballOwner && positions.has(target.ballOwner)) {
          const owner = positions.get(target.ballOwner), offset = target.ballOffset || { x: -27, y: 0 };
          ball = { x: owner.x + offset.x, y: owner.y + offset.y };
        }
        return {
          positions, ball, progress,
          cues: (target.cues || []).filter((c) => progress >= c.from && progress <= c.to)
        };
      }
    };
  }

  function resolvePlay(base, choices = {}) {
    const steps = [...base.steps];
    const routes = { ...base.routes };
    let coachingPoints = base.coachingPoints;
    let endStep = steps.length - 1;
    const selected = [];
    const decisions = [];
    (base.decisions || []).forEach((decision) => {
      if (decision.when && !selected.some(({ decision: prior, option }) =>
        prior.id === decision.when.decision && option.id === decision.when.option)) return;
      decisions.push(decision);
      const option = decision.options.find((item) => item.id === choices[decision.id])
        || decision.options.find((item) => item.id === decision.defaultOption)
        || decision.options[0];
      selected.push({ decision, option });
      Object.entries(option.stepOverrides || {}).forEach(([index, step]) => { steps[Number(index)] = step; });
      Object.assign(routes, option.routeOverrides || {});
      if (option.endStep !== undefined) endStep = Math.min(endStep, option.endStep);
      if (option.coachingPoints) coachingPoints = option.coachingPoints;
    });
    return { ...base, steps: steps.slice(0, endStep + 1), routes, coachingPoints, selected,
      decisions: decisions.filter(decision => decision.atStep <= endStep) };
  }

  window.PlayMotion = Object.freeze({ compileStep, resolvePlay });
})();
