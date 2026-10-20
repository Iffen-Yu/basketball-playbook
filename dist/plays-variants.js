// Screen metadata and opposite-side plays are derived from one authored version.
(() => {
  const plays = window.PLAYBOOK_DATA;
  const axisSum = 2 * COURT.padding + COURT.dimensions.width * COURT.scale;
  const swapText = text => text.replace(/左右|左|右/g, word => word === "左右" ? word : word === "左" ? "右" : "左");
  function mirrorPath(d) {
    // Authored paths use absolute M/L/Q/C commands only. Reflect each x, not y.
    return d.replace(/([MLQC])([^MLQC]*)/gi, (_, command, values) => {
      if (command !== command.toUpperCase()) throw new Error("Mirror paths must use absolute SVG coordinates");
      const numbers = values.match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi) || [];
      return command + numbers.map((n, i) => i % 2 ? Number(n) : axisSum - Number(n)).join(" ");
    });
  }
  function mirror(value, key = "") {
    if (Array.isArray(value)) return value.map(item => mirror(item, key));
    if (value && typeof value === "object") {
      const vector = key === "ballOffset" || key === "screenNormal";
      return Object.fromEntries(Object.entries(value).map(([name, item]) => {
        if (name === "x" && typeof item === "number") return [name, vector ? -item : axisSum - item];
        if (name === "dx" && typeof item === "number") return [name, -item];
        return [name, mirror(item, name)];
      }));
    }
    if (typeof value !== "string") return value;
    if (key === "d") return mirrorPath(value);
    if ((key === "id" || key === "defaultOption") && ["left", "right"].includes(value)) return value === "left" ? "right" : "left";
    if (key === "id" && /^(left|right)-\d+$/.test(value)) return value.startsWith('left-')
      ? value.replace("left-", "right-") : value.replace("right-", "left-");
    return swapText(value);
  }
  for (const id of ["left-2", "right-3", "left-4"]) {
    const play = plays.find(p => p.id === id);
    const steps = [...play.steps, ...(play.decisions || []).flatMap(d => d.options.flatMap(o => Object.values(o.stepOverrides || {})))];
    steps.forEach(step => (step.paths || []).forEach(path => {
      if (path.type !== "screen") return;
      if (path.screenActor) return;
      if (id === "left-2") {
        const baseline = path.d.includes(String(COURT.point(1.95, 0).x));
        path.screenActor = "4";
        path.screenNormal = baseline ? { x: .72, y: .69 } : { x: -1, y: 0 };
      } else {
        const firstX = Number(path.d.match(/M\s*(-?[\d.]+)/)[1]);
        path.screenActor = firstX < axisSum / 2 ? "4" : "5";
        path.screenNormal = path.screenActor === "4" ? { x: .76, y: .65 } : { x: 1, y: 0 };
      }
    }));
    const opposite = mirror(play);
    opposite.mirroredFrom = play.id;
    // Ball offsets are vectors, including the implicit default in the motion engine.
    const fixOffsets = steps => Object.values(steps).forEach(step => {
      if (step.ballOwner && !step.ballOffset) step.ballOffset = { x: 27, y: 0 };
    });
    fixOffsets(opposite.steps);
    (opposite.decisions || []).forEach(d => d.options.forEach(o => fixOffsets(o.stepOverrides || {})));
    const index = plays.findIndex(p => p.id === opposite.id);
    if (index >= 0) plays[index] = opposite;
  }
})();
