// 左4：球队文字描述为动作依据。以下资料仅用于核对破联防原理：
// https://www.coachesclipboard.net/ScreeningZones.html
// https://www.coachesclipboard.net/23zoneattack.html
(() => {
  const point = window.COURT.point;
  const initial = {
    "1": [7.5, 9.3], "2": [1.5, 6.9], "3": [13.5, 6.9],
    "4": [3.2, 1.8], "5": [11.8, 1.8],
    "X1": [4.8, 6.4], "X2": [10.65, 6.25],
    "X3": [4.6, 3.4], "X4": [7.5, 2.3], "X5": [10.4, 3.4]
  };
  const screened = { ...initial, "4": [3.8, 5.85], "5": [9.15, 6.4] };
  const moving = {
    ...screened, "2": [7.7, .9], "3": [9, 7.4], "4": [1.5, 6.9],
    "X1": [5.3, 7.5], "X2": [10.15, 6.5], "X3": [4.4, 2.65],
    "X4": [8.2, 2.15], "X5": [10.9, 3.1]
  };
  const perimeterCatch = {
    ...moving, "2": [14.45, 1.2], "3": [7.5, 5.8],
    "X1": [3, 7.9], "X2": [9.15, 7.5], "X3": [4.8, 2.65],
    "X4": [8.8, 2.1], "X5": [11.7, 2.65]
  };
  const highPostCatch = {
    ...perimeterCatch, "X1": [2.4, 7.7], "X2": [8.3, 7.2], "X5": [12, 2.3]
  };
  const lateCloseout = {
    ...highPostCatch, "X2": [8, 6.7], "X4": [8, 4.2]
  };
  const positions = (layout) => Object.entries(layout).map(([label, [x, y]]) => ({
    label, ...point(x, y), team: label.startsWith("X") ? "defense" : "offense"
  }));
  const frame = (t, x, y, easing = "smooth", via) => ({
    t, ...point(x, y), easing, ...(via ? { via: point(...via) } : {})
  });
  const xy = ([x, y]) => { const p = point(x, y); return `${p.x} ${p.y}`; };
  const curve = (a, c, b) => `M${xy(a)} Q${xy(c)} ${xy(b)}`;
  const run = (actor, from, via, to, start = 0) => ({
    actor, type: "run", from: start, d: curve(from, via, to)
  });
  const chase = (...args) => ({ ...run(...args), type: "chase" });
  const route = (start, curves, timing) => ({
    start: point(...start),
    curves: curves.map(([c1, c2, to]) => ({ c1: point(...c1), c2: point(...c2), to: point(...to) })),
    timing
  });
  const ball1 = { ball: point(7, 9.3), ballOwner: "1", ballOffset: { x: -30, y: 0 } };
  const left4 = {
    id: "left-4", name: "左4", family: "战术 4", side: "左侧",
    defense: "2-3-zone", status: "ready", duration: "约 8 秒",
    summary: "破2-3联防：两侧同时无球掩护，2号抄底到右底角，4号外弹接1号传球；3号借5号掩护切到罚球线，再接4号传球攻击空当。",
    players: positions(initial).filter(p => p.team === "offense"),
    // Curves describe the route; timing describes distance travelled along it.
    // The same run continues across step 2→3, without braking at the UI boundary.
    routes: {
      "2": route([1.5, 6.9], [
        [[2.9, 6.4], [2.6, 3.5], [3.4, 2]],
        [[4.2, .5], [6, .9], [7.7, .9]],
        [[10.5, .9], [13.2, 1.2], [14.45, 1.2]]
      ], [
        { step: 2, t: .04, node: 0 },
        { step: 2, t: 1, node: 2 },
        { step: 3, t: .93, node: 3 }
      ]),
      "3": route([13.5, 6.9], [
        [[12.3, 7.1], [10.4, 7.7], [9, 7.4]],
        [[7.6, 7.1], [7.5, 6.65], [7.5, 5.8]]
      ], [
        { step: 2, t: .06, node: 0 },
        { step: 2, t: .32, progress: .15 },
        { step: 2, t: 1, node: 1 },
        { step: 3, t: .84, node: 2 }
      ]),
      "4": route([3.2, 1.8], [
        [[3.25, 3.15], [3.55, 4.8], [3.8, 5.85]],
        [[3.55, 6.65], [2.45, 7.05], [1.5, 6.9]]
      ], [
        { step: 1, t: 0, node: 0 },
        { step: 1, t: .8, node: 1 },
        { step: 2, t: .34, node: 1 },
        { step: 2, t: .94, node: 2 }
      ]),
      "5": route([11.8, 1.8], [
        [[8.6, 1.8], [8.65, 4.5], [9.15, 6.4]]
      ], [
        { step: 1, t: 0, node: 0 },
        { step: 1, t: .8, node: 1 }
      ]),
      // X2 follows the cut, meets 5's screen, then trails OVER the screen.
      // The repeated node is a real obstruction, not a retreat toward the rim.
      "X2": route([10.65, 6.25], [
        [[10.5, 6.3], [10.3, 6.5], [10.15, 6.5]],
        [[10.25, 7.2], [9.75, 7.5], [9.15, 7.5]],
        [[8.8, 7.5], [8.5, 7.4], [8.3, 7.2]],
        [[8.1, 7], [8, 6.85], [8, 6.7]]
      ], [
        { step: 2, t: .25, node: 0 },
        { step: 2, t: .65, node: 1 },
        { step: 3, t: .12, node: 1 },
        { step: 3, t: 1, node: 2 },
        { step: 4, t: 1, node: 3 },
        { step: 5, t: 1, node: 4 }
      ]),
      "ball": route([7, 9.3], [
        [[5.02, 8.5], [3.03, 7.7], [1.05, 6.9]],
        [[3.05, 6.5333], [5.05, 6.1667], [7.05, 5.8]]
      ], [
        { step: 3, t: .2, node: 0 },
        { step: 3, t: .9, node: 1 },
        { step: 4, t: .12, node: 1 },
        { step: 4, t: .9, node: 2 }
      ])
    },
    steps: [
      {
        title: "三外两内，对阵2-3联防",
        description: "1号弧顶持球，2、3号在两侧三分线外，4、5号站两侧短角。X1、X2守上线，X3、X4、X5守下线；防守按区域轮转。",
        positions: positions(initial), ball: point(7, 9.3), paths: [],
        phaseNote: "传球顺序：1号 → 左侧外弹4号 → 罚球线3号。2号全程无球抄底。"
      },
      {
        title: "4、5号同步上提掩护",
        description: "两侧下线同时上提。4号摆底线侧掩护，为2号抄底创造通道；5号掩护另一名上线防守人，为3号走中路切入创造时间差。掩护侧按最终跑位方向确定。",
        duration: 2500, positions: positions(screened), ...ball1,
        paths: [
          run("4", [3.2, 1.8], [3, 4], [3.8, 5.85]),
          run("5", [11.8, 1.8], [8.6, 4.4], [9.15, 6.4]),
          { type: "screen", from: .8, d: `M${xy([4.05, 6.05])} L${xy([4.5, 6.45])}` },
          { type: "screen", from: .8, d: `M${xy([9.5, 6.05])} L${xy([9.5, 6.75])}` }
        ],
        cues: [
          { id: "l4-screen-left", actor: "4", tone: "blocked", text: "底线侧掩护", from: .8, to: 1,
            note: "4号先站稳，左侧2号准备无球抄底。" },
          { id: "l4-screen-right", actor: "5", tone: "blocked", text: "中路侧掩护", from: .8, to: 1,
            note: "5号同时站稳，右侧3号准备向中路切入。" }
        ]
      },
      {
        title: "2号抄底，4号外弹，3号同步内切",
        description: "2号借掩护沿底线穿过篮下；4号等2号通过后外弹。右侧3号同时向中路切入，X2想跟上，但5号卡住他的横移路线，迫使X2减速停顿；球仍由1号控制。",
        duration: 2500, positions: positions(moving), ...ball1,
        motions: {
          "X1": [frame(0, 4.8, 6.4), frame(.35, 4.8, 6.4), frame(1, 5.3, 7.5)],
          "X4": [frame(0, 7.5, 2.3), frame(.45, 7.5, 2.3), frame(1, 8.2, 2.15)]
        },
        paths: [
          run("2", [1.5, 6.9], [2.6, 1.1], [7.7, .9]),
          run("4", [3.8, 5.85], [3, 7], [1.5, 6.9], .34),
          run("3", [13.5, 6.9], [12, 7.6], [9, 7.4]),
          { type: "screen", to: .34, d: `M${xy([4.05, 6.05])} L${xy([4.5, 6.45])}` },
          { type: "screen", d: `M${xy([9.5, 6.05])} L${xy([9.5, 6.75])}` }
        ],
        cues: [
          { id: "l4-runner", actor: "2", tone: "threat", text: "无球抄底", from: .15, to: 1,
            note: "2号从联防身后穿过，吸引下线防守人的注意。" },
          { id: "l4-pop", actor: "4", tone: "threat", text: "掩护后外弹", from: .4, to: 1,
            note: "4号外弹提供接球点。" },
          { id: "l4-cut", actor: "3", tone: "threat", text: "同步向中路", from: .25, to: 1,
            note: "3号同步借5号掩护切入，不等待左侧动作全部结束。" },
          { id: "l4-x2-follow", actor: "X2", tone: "help", text: "试图跟住3号", from: .25, to: .64,
            note: "X2朝3号的切入路线移动，而不是退向篮下。" },
          { id: "l4-x2-blocked", actor: "X2", tone: "blocked", text: "被5号卡住", from: .65, to: 1,
            note: "5号保持掩护位置，X2无法直接横移跟住3号，3号继续切入拉开距离。" }
        ]
      },
      {
        title: "1传4，2到底角，3到罚球线",
        description: "1号传给外弹的4号。2号继续跑到右底角，3号进入罚球线；X2从5号外线侧绕过掩护，沿3号身后追防，已落后一个身位。X4、X5的注意力仍偏向底线。",
        duration: 1700, positions: positions(perimeterCatch), ball: point(1.05, 6.9),
        motions: {
          "X1": [frame(0, 5.3, 7.5), frame(.45, 5.3, 7.5), frame(1, 3, 7.9, "decelerate", [4, 8])]
        },
        paths: [
          { type: "pass", actor: "ball", d: curve([7, 9.3], [4, 8.2], [1.05, 6.9]) },
          run("2", [7.7, .9], [11, .9], [14.45, 1.2]),
          run("3", [9, 7.4], [7.5, 7.1], [7.5, 5.8]),
          chase("X2", [10.15, 6.5], [10.25, 7.5], [9.15, 7.5], .12),
          { type: "screen", to: .12, d: `M${xy([9.5, 6.05])} L${xy([9.5, 6.75])}` }
        ],
        cues: [
          { id: "l4-baseline-focus", actor: "X4", tone: "help", text: "注意底线穿插", from: .2, to: 1,
            note: "中间下线防守人被抄底动作牵动，尚未扑向罚球线。" },
          { id: "l4-arrive", actor: "3", tone: "threat", text: "切到罚球线", from: .75, to: 1, dy: -52,
            note: "3号赶在球转移进高位之前到达接球点。" },
          { id: "l4-x2-still-blocked", actor: "X2", tone: "blocked", text: "仍受掩护阻挡", from: 0, to: .12,
            note: "X2先处理5号掩护，不能直接穿过5号贴住3号。" },
          { id: "l4-x2-trail", actor: "X2", tone: "help", text: "绕掩护追3号", from: .13, to: 1,
            note: "X2从外线侧绕开5号再向中路追赶，目标始终是3号。" }
        ]
      },
      {
        title: "4传3，打进高位空当",
        description: "4号接球后迅速传给罚球线的3号。2号已经占据右底角，牵制下线轮转；X2在5号掩护后回补，X4尚未及时上扑，出现短暂接球窗口。",
        duration: 650, positions: positions(highPostCatch), ball: point(7.05, 5.8),
        paths: [
          { type: "pass", actor: "ball", d: curve([1.05, 6.9], [4.6, 5], [7.05, 5.8]) },
          chase("X2", [9.15, 7.5], [8.5, 7.5], [8.3, 7.2])
        ],
        cues: [
          { id: "l4-entry", actor: "3", tone: "threat", text: "高位接球窗口", from: .15, to: 1, dy: -52,
            note: "4号快传给3号，利用下线尚未回到高位的时间差。" },
          { id: "l4-corner", actor: "2", tone: "threat", text: "右底角牵制", from: 0, to: 1,
            note: "2号到右底角后仍是接球威胁，防守不能只顾罚球线。" },
          { id: "l4-x2-recover", actor: "X2", tone: "help", text: "追防仍慢一拍", from: 0, to: 1,
            note: "X2绕过5号后正追向3号，但传球已经到达高位窗口。" }
        ]
      },
      {
        title: "3号接球，趁补防前进攻",
        description: "3号在罚球线接球后面向篮筐，可以选择中距离投篮或攻击扑防。X4晚半拍上扑，X2也在回补；这是短暂窗口，不代表联防一定漏人。",
        duration: 900, positions: positions(lateCloseout), ball: point(7.05, 5.8), ballOwner: "3",
        motions: {
          "X4": [frame(0, 8.8, 2.1), frame(.3, 8.8, 2.1), frame(1, 8, 4.2, "accelerate")]
        },
        paths: [
          { type: "option", d: curve([7.5, 5.8], [7.5, 3.4], [7.5, 1.575]) },
          chase("X2", [8.3, 7.2], [8, 6.85], [8, 6.7])
        ],
        cues: [
          { id: "l4-attack", actor: "3", tone: "threat", text: "接球即读防守", from: 0, to: 1, dy: -52,
            note: "3号利用接球窗口及时处理球；箭头为进攻选择，不预设投篮命中。" },
          { id: "l4-closeout", actor: "X4", tone: "help", text: "延迟上扑", from: .3, to: 1,
            note: "X4从底线注意力转回高位，补防已经晚了一拍。" },
          { id: "l4-x2-catch-up", actor: "X2", tone: "help", text: "身后追近", from: .2, to: 1,
            note: "X2继续追近3号，3号必须在追防和补防到位之前处理球。" }
        ]
      }
    ],
    coachingPoints: [
      "本战术针对2-3联防：X1、X2守上线，X3、X4、X5守下线，按区域轮转而非固定盯人。",
      "球权明确为1→4→3：2号抄底、3号中路切入，均为无球移动。",
      "两侧同步上提掩护；左右为队内相对叫法，以2号走底线、3号走中路确认掩护角度。",
      "4号先完成掩护再外弹到三分线外接球；5号掩护3号绕入罚球线附近。",
      "X2的目标是跟住3号：先跟随切入，被5号卡住后减速，再从外线侧绕掩护追防；不是主动退往篮下。",
      "2号穿过底线并到右底角，牵动下线防守；4号接球后迅速找3号，不让高位窗口消失。",
      "动画示范下线被抄底牵制、延迟上扑的一种轮转；如果高位被及时补到，3号需继续阅读防守。"
    ]
  };
  const index = window.PLAYBOOK_DATA.findIndex(play => play.id === left4.id);
  if (index >= 0) window.PLAYBOOK_DATA[index] = left4;
})();
