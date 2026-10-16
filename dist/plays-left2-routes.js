// Left2 uses the same arc-length routes and independent pace as left4.
(() => {
  const play = window.PLAYBOOK_DATA.find(p => p.id === "left-2");
  const p = window.COURT.point;
  const route = (start, curves, timing) => ({
    start: p(...start),
    curves: curves.map(([a, b, end]) => ({ c1: p(...a), c2: p(...b), to: p(...end) })), timing
  });
  const driveTiming = [
    { step: 3, t: .05, node: 0 }, { step: 3, t: .24, progress: .2 },
    { step: 3, t: 1, node: 2 }, { step: 4, t: .55, node: 3 }
  ];
  const rollTiming = [
    { step: 2, t: 0, node: 0 }, { step: 2, t: .82, node: 1 },
    { step: 4, t: .5, node: 1 }, { step: 4, t: 1, node: 2 }, { step: 5, t: .72, node: 3 }
  ];
  const chaseTiming = [
    { step: 1, t: 0, node: 0 }, { step: 1, t: 1, node: 1 },
    { step: 3, t: .35, node: 1 }, { step: 3, t: 1, node: 3 },
    { step: 4, t: 1, node: 4 }, { step: 5, t: .75, node: 5 }
  ];
  const helpTiming = [
    { step: 1, t: 0, node: 0 }, { step: 1, t: 1, node: 1 },
    { step: 2, t: .12, node: 1 }, { step: 2, t: .85, node: 2 },
    { step: 4, t: .1, node: 2 }, { step: 4, t: .55, node: 3 },
    { step: 5, t: .23, node: 3 }, { step: 5, t: 1, node: 4 }
  ];
  play.routes = {
    "2": route([1.5, 6.9], [
      [[2.1, 7.2], [2.85, 7.55], [3.5, 7.5]],
      [[4.15, 7.45], [4.85, 6.7], [4.85, 6.25]],
      [[4.85, 5.95], [4.85, 5.65], [4.65, 5.65]]
    ], driveTiming),
    "4": route([3.2, 1.8], [
      [[3.7, 3], [3.5, 5], [3.4, 6.35]],
      [[3.05, 5.7], [3.6, 4.75], [4.6, 4.5]],
      [[5.6, 4.25], [5.3, 2.9], [6, 2.5]]
    ], rollTiming),
    "X2": route([2.15, 6.3], [
      [[2.23, 6.32], [2.32, 6.35], [2.4, 6.35]],
      [[2.25, 6.5], [2.15, 6.9], [2.3, 7.15]],
      [[2.45, 7.4], [3.05, 7.6], [3.6, 7.55]],
      [[4.15, 7.5], [4.5, 7.45], [4.55, 7.15]],
      [[4.6, 6.85], [4.65, 6.8], [4.65, 6.65]]
    ], chaseTiming),
    "X4": route([4.2, 2.35], [
      [[4.17, 2.43], [4.13, 2.52], [4.1, 2.6]],
      [[4.6, 3.3], [5.4, 4.1], [6, 4.25]],
      [[6.05, 4.7], [5.95, 5.6], [5.7, 5.7]],
      [[6.35, 5.6], [6.9, 4.65], [6.9, 4]]
    ], helpTiming),
    "ball": route([7, 9.3], [
      [[5.02, 8.5], [3.03, 7.7], [1.05, 6.9]]
    ], [{ step: 1, t: .08, node: 0 }, { step: 1, t: .7, node: 1 }])
  };
  const baseline = play.decisions[0].options.find(o => o.id === "right");
  baseline.routeOverrides = {
    "2": route([1.5, 6.9], [
      [[.65, 6.8], [.55, 6.25], [.55, 5.6]],
      [[.55, 4.5], [2.15, 4.4], [2.15, 3.9]],
      [[2.15, 3.4], [1.9, 3.1], [1.8, 2.7]]
    ], driveTiming),
    "4": route([3.2, 1.8], [
      [[1.7, 2.7], [1.65, 4.2], [1.65, 5.65]],
      [[2.3, 5.6], [3.5, 4.7], [4.4, 4]],
      [[5.3, 3.3], [6.2, 2.15], [6.9, 1.9]]
    ], rollTiming),
    "X2": route([2.15, 6.3], [
      [[2.23, 6.32], [2.32, 6.35], [2.4, 6.35]],
      [[2.55, 6.8], [2.15, 6.95], [1.65, 6.95]],
      [[1.15, 6.95], [.5, 6.5], [.5, 5.9]],
      [[.5, 5.3], [.65, 4.9], [.9, 4.45]],
      [[1.15, 4], [1.5, 3.9], [1.5, 3.65]]
    ], chaseTiming),
    "X4": route([4.2, 2.35], [
      [[4.17, 2.43], [4.13, 2.52], [4.1, 2.6]],
      [[4.2, 3.2], [4.5, 3.7], [4.5, 4.25]],
      [[4.5, 3.4], [3.8, 2.5], [2.9, 2.5]],
      [[3.55, 2.5], [4.3, 2.8], [4.95, 2.8]]
    ], helpTiming)
  };
  const cleanSteps = steps => Object.values(steps).forEach(step => {
    for (const label of ["2", "4", "X2", "X4"]) if (step.motions) delete step.motions[label];
    // Show the pursuit direction without changing the underlying trajectory.
    if (step.ballOwner && step.paths && !step.paths.some(path => path.actor === "X2")) {
      const index = play.steps.indexOf(step);
      if (index >= 3 || Object.values(baseline.stepOverrides).includes(step) && step !== baseline.stepOverrides[2]) {
        step.paths.push({ type: "chase", actor: "X2" });
      }
    }
  });
  cleanSteps(play.steps);
  cleanSteps(baseline.stepOverrides);
  for (const steps of [play.steps, baseline.stepOverrides]) {
    const cap = steps[3].paths.find(path => path.type === "screen");
    steps[4].paths.push({ ...cap, from: 0, to: .5 });
  }
})();
