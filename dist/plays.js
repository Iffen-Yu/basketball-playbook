// 坐标以米编写；motions 为每名球员独立的本步时间轴（t=0..1）。
(() => {
  const point = window.COURT.point;
  const initial = {
    "1": [7.5, 9.3], "2": [1.5, 6.9], "3": [13.5, 6.9],
    "4": [3.2, 1.8], "5": [11.8, 1.8],
    "X1": [7.5, 8.35], "X2": [2.15, 6.3], "X3": [12.6, 6.2],
    "X4": [4.2, 2.35], "X5": [10.8, 2.35]
  };
  const shifted = {
    ...initial, "X1": [7, 7.8], "X2": [2.4, 6.35], "X3": [11.4, 5.7],
    "X4": [4.1, 2.6], "X5": [10.5, 2.6]
  };
  const screenSet = { ...shifted, "4": [3.4, 6.35], "X4": [6, 4.25] };
  const turned = {
    ...screenSet, "1": [7.9, 9.3], "2": [4.85, 6.25], "X1": [7.9, 8.25],
    "X2": [3.6, 7.55], "X3": [11.6, 5.8], "X5": [10.4, 2.5]
  };
  const helped = {
    ...turned, "2": [4.65, 5.65], "4": [4.6, 4.5],
    "X2": [4.55, 7.15], "X4": [5.7, 5.7], "X5": [9.8, 2.5]
  };
  const rolled = {
    ...helped, "4": [6, 2.5], "X2": [4.65, 6.65], "X4": [6.9, 4], "X5": [9, 2.5]
  };
  const positions = (layout) => Object.entries(layout).map(([label, [x, y]]) => ({
    label, ...point(x, y), team: label.startsWith("X") ? "defense" : "offense"
  }));
  const xy = ([x, y]) => { const p = point(x, y); return `${p.x} ${p.y}`; };
  const curve = (from, control, to) => `M${xy(from)} Q${xy(control)} ${xy(to)}`;
  const frame = (t, x, y, easing = "smooth", via) => ({
    t, ...point(x, y), easing, ...(via ? { via: point(...via) } : {})
  });

  const left2 = {
    id: "left-2", name: "左2", family: "战术 2", side: "左侧",
    summary: "对盯人侧翼挡拆：4号上提前可选左挡走中路，或右挡走底线。比较X4补防的位置，以及4号顺下进入篮下的不同机会。",
    defense: "man-to-man", coverage: "show-and-recover", status: "ready",
    duration: "约 10 秒",
    players: positions(initial).filter(p => p.team === "offense"),
    steps: [
      {
        title: "三外两内，对位盯人",
        description: "1号弧顶持球，2、3号在两侧三分线外，4、5号在两侧短角。X1—X5分别盯防同号码进攻人。",
        positions: positions(initial), ball: point(7, 9.3), paths: [],
        phaseNote: "先看清对位：X2防2号，X4防4号。"
      },
      {
        title: "传左侧，等待掩护",
        description: "1号传给左侧2号，X2上前对球施压。2号保留运球，4号准备从短角上提。",
        duration: 1800, positions: positions(shifted), ball: point(1.05, 6.9),
        paths: [{ type: "pass", actor: "ball", d: curve([7, 9.3], [4, 8.2], [1.05, 6.9]) }],
        phaseNote: "球先到2号手中，持球人保留运球。"
      },
      {
        title: "4号上提，站稳掩护",
        description: "4号从短角上提，先减速站稳，再让2号使用掩护。X4跟随到篮筐一侧；此时仍未扑向2号。",
        duration: 2200, positions: positions(screenSet),
        ball: point(1.05, 6.9), ballOwner: "2",
        motions: {
          "4": [frame(0, 3.2, 1.8), frame(.82, 3.4, 6.35, "decelerate", [3.8, 4.2]), frame(1, 3.4, 6.35)],
          "X4": [frame(0, 4.1, 2.6), frame(.12, 4.1, 2.6), frame(.85, 6, 4.25), frame(1, 6, 4.25)]
        },
        paths: [
          { type: "run", actor: "4", d: curve([3.2, 1.8], [3.8, 4.2], [3.4, 6.35]) },
          { type: "screen", from: .82, d: `M${xy([3.05, 5.95])} L${xy([3.05, 6.75])}` }
        ],
        cues: [{ id: "set", actor: "4", tone: "blocked", text: "站稳掩护", from: .82, to: 1,
          note: "4号已经站稳，2号随后启动。" }]
      },
      {
        title: "X2受阻，2号借掩护",
        description: "2号先加速绕过掩护，X2在掩护前受阻减速，再绕外侧追赶。4号始终站住，不移动去撞人；X4暂留篮筐一侧观察。",
        duration: 2200, positions: positions(turned),
        ball: point(4.4, 6.25), ballOwner: "2",
        motions: {
          "2": [frame(0, 1.5, 6.9), frame(.05, 1.5, 6.9),
            frame(.24, 2.55, 7.3, "accelerate"), frame(.55, 3.8, 7.35, "linear"),
            frame(.8, 4.55, 6.9, "linear"), frame(1, 4.85, 6.25, "decelerate")],
          "X2": [frame(0, 2.4, 6.35), frame(.35, 2.4, 6.35),
            frame(.48, 2.22, 6.95, "accelerate"), frame(.68, 2.65, 7.48, "linear"),
            frame(.86, 3.1, 7.55, "linear"), frame(1, 3.6, 7.55, "linear")]
        },
        paths: [
          { type: "dribble", actor: "2", d: `M${xy([1.5, 6.9])} L${xy([2.55, 7.3])} L${xy([3.8, 7.35])} L${xy([4.55, 6.9])} L${xy([4.85, 6.25])}` },
          { type: "screen", d: `M${xy([3.05, 5.95])} L${xy([3.05, 6.75])}` }
        ],
        cues: [
          { id: "blocked", actor: "X2", tone: "blocked", text: "受阻减速", from: .05, to: .5,
            note: "X2被掩护延误，2号先获得启动优势。" },
          { id: "chase", actor: "X2", tone: "blocked", text: "绕掩护追防", from: .5, to: 1,
            note: "X2必须绕过4号，不能穿过掩护。" },
          { id: "advantage", actor: "2", tone: "threat", text: "抢到身位", from: .65, to: 1, dy: -52,
            note: "2号摆脱X2的正面防守，开始威胁中路。" }
        ]
      },
      {
        title: "X4补防，4号启动顺下",
        description: "看到X2落后，X4上前阻挡2号；4号先等X4离开原位，再转身加速顺下。2号控制球吸引补防，X2仍在身后追赶。",
        duration: 1800, positions: positions(helped),
        ball: point(4.2, 5.65), ballOwner: "2",
        motions: {
          "2": [frame(0, 4.85, 6.25), frame(.55, 4.65, 5.65, "decelerate"), frame(1, 4.65, 5.65)],
          "X4": [frame(0, 6, 4.25), frame(.1, 6, 4.25), frame(.55, 5.7, 5.7, "accelerate"), frame(1, 5.7, 5.7)],
          "4": [frame(0, 3.4, 6.35), frame(.5, 3.4, 6.35),
            frame(.8, 3.7, 5.05, "accelerate", [3, 5.6]), frame(1, 4.6, 4.5, "linear")],
          "X2": [frame(0, 3.6, 7.55), frame(.1, 3.6, 7.55),
            frame(.7, 4.2, 7.35, "accelerate"), frame(1, 4.55, 7.15, "linear")]
        },
        paths: [
          { type: "run", actor: "4", from: .5,
            d: `${curve([3.4, 6.35], [3, 5.6], [3.7, 5.05])} L${xy([4.6, 4.5])}` }
        ],
        cues: [
          { id: "help", actor: "X4", tone: "help", text: "补防持球", from: .12, to: 1,
            note: "X4上前封住持球人，原来的护筐位置出现空当。" },
          { id: "roll-start", actor: "4", tone: "threat", text: "启动顺下", from: .52, to: 1, dy: -50,
            note: "4号看到X4离开后再启动。" }
        ]
      },
      {
        title: "加速顺下，出现传球窗口",
        description: "4号继续加速进入篮下，X4慢半拍转身回追，X2才逐渐补回持球人。橙色虚线表示可选择的顺下传球；当前保留2号持球，不预设传球或得分。",
        duration: 2200, positions: positions(rolled),
        ball: point(4.2, 5.65), ballOwner: "2",
        motions: {
          "4": [frame(0, 4.6, 4.5), frame(.3, 5.1, 3.3, "linear"),
            frame(.72, 6, 2.5, "decelerate"), frame(1, 6, 2.5)],
          "X4": [frame(0, 5.7, 5.7), frame(.23, 5.7, 5.7),
            frame(.6, 6.55, 5, "accelerate"), frame(1, 6.9, 4, "linear")],
          "X2": [frame(0, 4.55, 7.15), frame(.15, 4.55, 7.15),
            frame(.75, 4.65, 6.65, "accelerate"), frame(1, 4.65, 6.65)]
        },
        paths: [
          { type: "run", actor: "4", d: `M${xy([4.6, 4.5])} L${xy([5.1, 3.3])} L${xy([6, 2.5])}` },
          { type: "option", from: .55, d: curve([4.2, 5.65], [5.2, 4.3], [6, 2.5]) }
        ],
        cues: [
          { id: "turn", actor: "X4", tone: "help", text: "转身慢半拍", from: 0, to: .23,
            note: "X4需要从补防持球重新转身，不能与4号同步回到篮下。" },
          { id: "recover", actor: "X4", tone: "help", text: "回追顺下", from: .23, to: 1,
            note: "X4开始回追，但已失去4号的身位。" },
          { id: "window", actor: "4", tone: "threat", text: "顺下空当", from: .25, to: 1, dy: -50,
            note: "4号进入X4身后的空间，2号可以寻找顺下传球。" }
        ]
      }
    ],
    coachingPoints: [
      "X1—X5分别盯防同号码进攻人；本段示范X2受阻后，X4上前延误并回追的一种反应。",
      "4号先站稳掩护，等2号利用掩护、X4补防后再转身，避免移动掩护。",
      "X2先减速，再沿掩护外侧绕行；掩护真正制造的是时间差与身位差。",
      "2号先借掩护摆脱X2，再吸引X4，观察自己攻击与4号顺下的选择。",
      "5号保持右侧短角的接球威胁；如果X5收缩护筐，2号再阅读弱侧传球。",
      "这是教学用的一种防守反应；换防、夹击或深度回撤会产生不同选择。"
    ]
  };

  // 分支从第3步开始；前两步的初始站位与传球完全共用。
  const baselineScreen = { ...shifted, "4": [1.65, 5.65], "X4": [4.5, 4.25] };
  const baselineTurn = {
    ...baselineScreen, "1": [7.9, 9.3], "2": [2.15, 3.9],
    "X1": [7.9, 8.25], "X2": [.5, 5.9], "X3": [11.6, 5.8], "X5": [10.4, 2.5]
  };
  const baselineHelp = {
    ...baselineTurn, "2": [1.8, 2.7], "4": [4.4, 4],
    "X2": [.9, 4.45], "X4": [2.9, 2.5], "X5": [9.8, 2.5]
  };
  const baselineRoll = {
    ...baselineHelp, "4": [6.9, 1.9], "X2": [1.5, 3.65], "X4": [4.95, 2.8], "X5": [9, 2.5]
  };
  const baselineSteps = {
    2: {
      title: "右挡：4号调整掩护侧",
      description: "4号从短角上提到另一侧，为2号走底线设置掩护。这里的“右挡”沿用球队相对叫法；X4留在篮筐一侧观察，不提前扑向持球人。",
      duration: 2200, positions: positions(baselineScreen),
      ball: point(1.05, 6.9), ballOwner: "2",
      motions: {
        "4": [frame(0, 3.2, 1.8), frame(.82, 1.65, 5.65, "decelerate", [1.3, 3.7]), frame(1, 1.65, 5.65)],
        "X4": [frame(0, 4.1, 2.6), frame(.12, 4.1, 2.6), frame(.85, 4.5, 4.25), frame(1, 4.5, 4.25)]
      },
      paths: [
        { type: "run", actor: "4", d: curve([3.2, 1.8], [1.3, 3.7], [1.65, 5.65]) },
        { type: "screen", from: .82, d: `M${xy([1.95, 5.85])} L${xy([2.35, 6.3])}` }
      ],
      cues: [{ id: "baseline-set", actor: "4", tone: "blocked", text: "底线侧掩护", from: .82, to: 1,
        note: "4号站稳在另一侧，2号准备沿底线方向绕过。" }]
    },
    3: {
      title: "2号走底线，X2受阻",
      description: "2号沿左侧边线向底线突破。X2先受阻，再绕掩护追赶；4号保持掩护位置，让X4面对持球人从另一侧逼近的威胁。",
      duration: 2200, positions: positions(baselineTurn),
      ball: point(1.7, 3.9), ballOwner: "2",
      motions: {
        "2": [frame(0, 1.5, 6.9), frame(.05, 1.5, 6.9),
          frame(.24, .75, 6.35, "accelerate"), frame(.55, .58, 5.25, "linear"),
          frame(.8, 1.25, 4.5, "linear"), frame(1, 2.15, 3.9, "decelerate")],
        "X2": [frame(0, 2.4, 6.35), frame(.35, 2.4, 6.35),
          frame(.48, 2.45, 6.8, "accelerate"), frame(.68, 1.75, 6.95, "linear"),
          frame(.86, .85, 6.6, "linear"), frame(1, .5, 5.9, "linear")]
      },
      paths: [
        { type: "dribble", actor: "2", d: `M${xy([1.5, 6.9])} L${xy([.75, 6.35])} L${xy([.58, 5.25])} L${xy([1.25, 4.5])} L${xy([2.15, 3.9])}` },
        { type: "screen", d: `M${xy([1.95, 5.85])} L${xy([2.35, 6.3])}` }
      ],
      cues: [
        { id: "baseline-blocked", actor: "X2", tone: "blocked", text: "受阻减速", from: .05, to: .5,
          note: "X2被掩护延误，2号先沿底线方向获得身位。" },
        { id: "baseline-chase", actor: "X2", tone: "blocked", text: "绕掩护追防", from: .5, to: 1,
          note: "X2绕行后追赶，不能直接穿过4号。" },
        { id: "baseline-drive", actor: "2", tone: "threat", text: "底线突破", from: .65, to: 1, dy: -52,
          note: "2号从底线侧逼近篮下，X4需要改变补防方向。" }
      ]
    },
    4: {
      title: "X4向边线补防，4号内切",
      description: "X4向左侧底线持球人移动。4号等X4离开原位后，从另一侧转身内切，进入X4身后的篮下通道；2号在底线侧保留传球。",
      duration: 1800, positions: positions(baselineHelp),
      ball: point(1.35, 2.7), ballOwner: "2",
      motions: {
        "2": [frame(0, 2.15, 3.9), frame(.55, 1.8, 2.7, "decelerate"), frame(1, 1.8, 2.7)],
        "X4": [frame(0, 4.5, 4.25), frame(.1, 4.5, 4.25),
          frame(.55, 2.9, 2.5, "accelerate", [4, 2.25]), frame(1, 2.9, 2.5)],
        "4": [frame(0, 1.65, 5.65), frame(.5, 1.65, 5.65),
          frame(.8, 3.1, 4.9, "accelerate", [2.5, 5.7]), frame(1, 4.4, 4, "linear")],
        "X2": [frame(0, .5, 5.9), frame(.1, .5, 5.9),
          frame(.7, .6, 5.1, "accelerate"), frame(1, .9, 4.45, "linear")]
      },
      paths: [{ type: "run", actor: "4", from: .5,
        d: `${curve([1.65, 5.65], [2.5, 5.7], [3.1, 4.9])} L${xy([4.4, 4])}` }],
      cues: [
        { id: "baseline-help", actor: "X4", tone: "help", text: "向边线补防", from: .12, to: 1,
          note: "X4被2号吸引到边线、底线一侧，篮下通道随之打开。" },
        { id: "baseline-cut", actor: "4", tone: "threat", text: "从身后内切", from: .52, to: 1, dy: -50,
          note: "4号从X4另一侧转身，抢占更靠篮筐的空间。" }
      ]
    },
    5: {
      title: "4号越过X4，进入篮下",
      description: "4号继续顺下进入X4的篮筐侧，2号可从底线侧向内传球。X4需要转身并横向回追；X5仍可能协防，顺下并不等于必然得分。",
      duration: 2200, positions: positions(baselineRoll),
      ball: point(1.35, 2.7), ballOwner: "2",
      motions: {
        "4": [frame(0, 4.4, 4), frame(.3, 5.6, 2.85, "linear"),
          frame(.72, 6.9, 1.9, "decelerate"), frame(1, 6.9, 1.9)],
        "X4": [frame(0, 2.9, 2.5), frame(.23, 2.9, 2.5),
          frame(.6, 3.8, 2.7, "accelerate"), frame(1, 4.95, 2.8, "linear")],
        "X2": [frame(0, .9, 4.45), frame(.15, .9, 4.45),
          frame(.75, 1.5, 3.65, "accelerate"), frame(1, 1.5, 3.65)]
      },
      paths: [
        { type: "run", actor: "4", d: `M${xy([4.4, 4])} L${xy([5.6, 2.85])} L${xy([6.9, 1.9])}` },
        { type: "option", from: .55, d: curve([1.35, 2.7], [4.8, 1.5], [6.9, 1.9]) }
      ],
      cues: [
        { id: "baseline-turn", actor: "X4", tone: "help", text: "转身回追", from: 0, to: .6,
          note: "X4刚在边线侧补防，需要重新转向篮筐。" },
        { id: "baseline-recover", actor: "X4", tone: "help", text: "横向回追", from: .6, to: 1,
          note: "X4与篮筐之间已被4号抢先占位，回追路线更横向。" },
        { id: "baseline-window", actor: "4", tone: "threat", text: "抢到篮筐侧", from: .25, to: 1, dy: -50,
          note: "4号进入更深位置，2号可以寻找底线向内的传球窗口。" }
      ]
    }
  };
  left2.decisions = [{
    id: "screen-direction", atStep: 2, defaultOption: "left",
    options: [
      { id: "left", label: "左挡 · 走中路", description: "当前线路：2号走中路，X4上前补防后回追。", stepOverrides: {} },
      { id: "right", label: "右挡 · 走底线", description: "2号走底线，拉X4向边线，4号从身后内切。", stepOverrides: baselineSteps,
        coachingPoints: [
          "右挡沿用球队相对叫法；本分支明确对应2号从左侧底线突破。",
          "X1—X5分别盯防同号码进攻人，4、5号仍从两侧短角起步。",
          "4号先站稳，2号借另一侧掩护走底线；X2受阻后必须绕行。",
          "看到X4向底线持球人补防后，4号再从另一侧内切，争取先占篮筐侧。",
          "X4需要转身横向回追；2号仍要观察X5的弱侧协防和5号接球机会。",
          "这是同一战术的一种分支示范，实际补防方式与传球窗口取决于防守选择。"
        ] }
    ]
  }];

  const draft = (number, side) => ({
    id: `${side === "左" ? "left" : "right"}-${number}`,
    name: `${side}${number}`, family: `战术 ${number}`, side: `${side}侧`,
    summary: side === "右"
      ? `等待录入右${number}战术；若与左${number}完全镜像，可由左${number}自动生成。`
      : `等待录入左${number}战术的起始站位、跑位顺序和终结选择。`,
    status: "draft", players: [], steps: [], coachingPoints: []
  });
  window.PLAYBOOK_DATA = [
    left2, draft(2, "右"), draft(3, "左"), draft(3, "右"), draft(4, "左"), draft(4, "右")
  ];
})();
