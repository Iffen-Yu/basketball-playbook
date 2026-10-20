// 球队右3：手递手后的区域防守接管，不是X1追防1号的盯人配合。
// 资料仅核对动作原理，不套用网上战术的固定跑位：
// https://www.coachesclipboard.net/modern-offensive-basketball-toolkit.html
(() => {
  const point = COURT.point;
  const layout = {
    "1": [7.5, 9.3], "2": [13.5, 6.9], "3": [1.5, 6.9],
    "4": [11.8, 1.8], "5": [3.2, 1.8],
    "X1": [10, 6.4], "X2": [4.8, 6.4], "X3": [10.5, 3.25],
    "X4": [7.5, 2.35], "X5": [4.5, 3.1]
  };
  const meeting = { ...layout, "1": [12.8, 7.8], "2": [11.75, 7.8],
    "4": [9.75, 2.35], "X1": [10.65, 7] };
  const cutting = { ...meeting, "1": [11.5, .96], "5": [7.5, 5.8],
    "X1": [10.7, 6.8], "X3": [10.55, 3], "X5": [5.2, 3.7] };
  const highLow = { ...cutting, "1": [7.5, 1.2], "X1": [10, 6.5],
    "X2": [4.4, 6], "X4": [7.5, 3.1], "X5": [6.2, 4.25] };
  const covered = { ...highLow, "X4": [7.8, 2.4], "X5": [6.4, 5.1] };
  const continueRead = { ...covered, "X5": [6.5, 5.25] };
  const corner = { ...continueRead, "1": [.55, 1.2], "X2": [3.2, 5.6], "X4": [8.4, 3.5] };
  const cornerPass = { ...corner, "X2": [3.1, 5.4] };
  const cornerClose = { ...cornerPass, "X2": [2.4, 4.2] };
  const pos = s => Object.entries(s).map(([label, xy]) => ({ label, ...point(...xy), team: label.startsWith('X') ? 'defense' : 'offense' }));
  const route = (start, curves, timing) => ({ start: point(...start),
    curves: curves.map(([a, b, to]) => ({ c1: point(...a), c2: point(...b), to: point(...to) })), timing });
  const beat = (step, t, node) => ({ step, t, node });
  const xy = a => { const p = point(...a); return `${p.x} ${p.y}`; };
  const line = (a,b) => `M${xy(a)} L${xy(b)}`;
  const path = (actor,type='run',from=0,to=1) => ({ actor,type,from,to });
  const cap = (from=0,to=1) => ({ type:'screen',screenActor:'4',screenNormal:{x:.78,y:.63},from,to });
  const cue = (id, actor, text, note, from=0, to=1, tone='threat') => ({ id,actor,text,note,from,to,tone });
  const held5 = { ballOwner:'5', ballOffset:{x:-27,y:0}, ball:point(7.05,5.8) };
  const make = (title,description,duration,s,extras={}) => ({ title,description,duration,positions:pos(s),...extras });
  const lowDefence = { ...highLow, "X4": [8.7,4.9] };
  const selfDefence = { ...highLow, "X4": [7.8,2.4] };
  const ballRoute = (finish='corner') => {
    const end = finish==='rim' ? [7.05,1.2] : finish==='wing' ? [1.05,6.9] : [1,1.2];
    return route([7,9.3],[
      [[9,9.9],[12.3,9.4],[12.3,7.8]],
      [[12.27,7.8],[12.23,7.8],[12.2,7.8]],
      [[11.5,8.4],[8.7,7.2],[7.05,5.8]],
      finish==='rim' ? [[7.7,4.4],[7.7,2.6],end]
        : finish==='wing' ? [[5.2,6.6],[2.9,6.6],end]
        : [[5.9,6.9],[1.2,3.4],end]
    ],[beat(0,0,0),beat(1,1,1),beat(2,1,2),
      beat(4,.12,2),beat(4,.84,3),beat(finish==='rim'?6:8,.1,3),beat(finish==='rim'?6:8,.92,4)]);
  };
  const x5Route = close => route([4.5,3.1],[
    [[4.6,3.2],[4.9,3.5],[5.2,3.7]],
    [[5.5,3.9],[5.9,4.15],[6.2,4.25]],
    [[6.5,4.35],[6.4,4.8],[6.4,5.1]],
    [[6.4,5.16],[6.45,5.22],[6.5,5.25]]
  ],[beat(3,.25,0),beat(3,1,1),beat(4,1,2),...(close?[beat(5,.9,3),beat(6,1,4)]:[])]);
  const x4Route = (end, exit=false) => route([7.5,2.35],[
    [[7.5,2.6],[7.5,2.85],[7.5,3.1]],
    [[7.5,end[1]>3.1?3.65:2.85],[end[0],end[1]],end],
    [[8,2.6],[8.4,3.1],[8.4,3.5]]
  ],[beat(3,.65,0),beat(4,1,1),beat(5,.08,1),beat(5,.9,2),...(exit?[beat(7,.3,2),beat(7,1,3)]:[])]);
  const play = {
    id:'right-3',name:'右3',family:'战术 3',side:'右侧',status:'ready',
    defense:'2-3-zone',duration:'约 7–11 秒',
    summary:'破2-3联防：1号右侧手递手给2号后溜底，4号卡住X3；5号快速提到罚球线接2号传球，与篮下1号形成高低位威胁。篮下没机会，1号继续穿到左底角，再选择1号或3号外线。',
    players:pos(layout).filter(p=>p.team==='offense'),
    routes:{
      '1':route([7.5,9.3],[
        [[9.4,9.9],[12.8,9.4],[12.8,7.8]],
        [[13.2,6.7],[13.3,5.2],[13.3,3.6]],
        [[13.3,1.35],[11.8,.9],[10,.9]],
        [[8.7,.9],[7.5,.9],[7.5,1.2]],
        [[5.5,.8],[2.1,1.2],[.55,1.2]]
      ],[beat(1,0,0),beat(1,1,1),beat(3,.04,1),beat(3,.64,2),beat(4,.24,3),beat(4,.95,4),beat(7,.05,4),beat(7,.97,5)]),
      '2':route([13.5,6.9],[ [[13.4,7.5],[12.4,7.8],[11.75,7.8]] ],[beat(1,0,0),beat(1,.65,1)]),
      '4':route([11.8,1.8],[ [[11.2,1.5],[10.25,1.65],[9.75,2.35]] ],[beat(1,.15,0),beat(1,.78,1)]),
      '5':route([3.2,1.8],[ [[2.6,4.5],[5.4,5.8],[7.5,5.8]] ],[beat(3,.06,0),beat(3,.72,1)]),
      'X1':route([10,6.4],[
        [[10.15,6.65],[10.4,7],[10.65,7]],
        [[10.7,7],[10.7,6.9],[10.7,6.8]],
        [[10.7,6.5],[10.3,6.5],[10,6.5]]
      ],[beat(1,.2,0),beat(1,1,1),beat(3,1,2),beat(4,1,3)]),
      'X3':route([10.5,3.25],[ [[10.5,3.15],[10.55,3.08],[10.55,3]] ],[beat(3,.15,0),beat(3,.45,1)]),
      'X4':x4Route([7.8,2.4],true),'X5':x5Route(true),'ball':ballRoute()
    },
    steps:[
      {title:'三外两内，对阵2-3联防',description:'X1守右侧上线，X2守左侧上线；X3、X4、X5分守右侧下线、中间与左侧下线。编号表示区域角色，不是同号码盯人。',positions:pos(layout),ball:point(7,9.3),paths:[],phaseNote:'球权主线：1手递手给2 → 2传5 → 5根据防守选择。'},
      make('1号向右交接，4号提前卡位','1号持球向右侧移动，2号迎接手递手。4号提前挪到X3内侧站稳，准备卡住他的收缩路线。',1800,meeting,{
        ballOwner:'1',ballOffset:{x:-30,y:0},ball:point(12.3,7.8),paths:[path('1','dribble'),path('2'),path('4'),cap(.78)],
        cues:[cue('r3-set','4','提前卡住X3','4号先站稳，不追着防守人移动。',.78,1,'blocked')]}),
      make('手递手：球交到2号','两人接近后短距离交球，球权从1号变为2号。X1继续在右侧上线跟球防2号，不跟1号溜底。',350,meeting,{
        ball:point(12.2,7.8),paths:[path('ball','handoff'),cap()],
        cues:[cue('r3-dho','2','手递手接球','这是近距离交接，不是跨场传球。'),cue('r3-ball-def','X1','跟球防2号','X1留在上线限制持球2号，不追无球1号。',0,1,'help')]}),
      make('1号溜底，5号快速上提','1号从4号身后沿底线切入；4号卡住X3，限制他收缩内线。同时弱侧5号快速提到中路罚球线，2号仍持球。',2400,cutting,{
        ballOwner:'2',ballOffset:{x:27,y:0},ball:point(12.2,7.8),paths:[path('1'),path('5'),cap()],
        cues:[cue('r3-cut','1','无球溜底','1号与球分开，利用4号卡位进入篮下。',.08),cue('r3-flash','5','快速提到罚球线','5号先加速上提，抢在下线补防到位前提供高位接球点。',.1,.9),cue('r3-seal','X3','收缩被4号挡住','X3想向篮下收缩，但不能直接穿过4号。',.45,1,'blocked'),cue('r3-no-chase','X1','继续防2号','X1守持球侧上线，不做追1号的动画。',.2,.65,'help')]}),
      make('2传5：篮下与高位双重威胁','5号已到罚球线，2号迅速把球传给5号；1号同时进入篮下。中央X4必须在篮下1号与高位5号之间作选择。',1100,highLow,{
        ball:point(7.05,5.8),paths:[path('ball','pass'),path('1'),cap(0,.8),{type:'option',d:line([7.05,5.8],[7.05,1.2]),from:.84}],
        cues:[cue('r3-high','5','罚球线接球','球从2号传给5号，1号仍是无球接应。',.75),cue('r3-low','1','篮下接应点','1号到篮下，形成高低位两个威胁。',.8),cue('r3-read','X4','兼顾高低位','X4不能同时贴住罚球线5号与篮下1号。',.4,1,'help')]}),
      make('观察X4，先读篮下机会','当前演示篮下被X4照顾，X5也向5号回补。5号不强行传进人群，1号准备继续溜底拉开空间。',900,covered,{
        ...held5,paths:[],cues:[cue('r3-cover-rim','X4','先护篮下1号','X4留在低位，先堵住传给1号的直接窗口。',0,1,'help'),cue('r3-x5','X5','回补高位','X5向5号回补，5号继续阅读外线机会。',.35,1,'help')]}),
      make('篮下没有机会，不在内线停住','5号继续持球，1号确认篮下没有机会后，准备继续穿过底线，去3号同侧的左底角。',900,continueRead,{
        ...held5,paths:[],phaseNote:'这不是一次固定传球：先读防守，篮下没有机会才继续穿底。'}),
      make('1号继续穿到左底角','1号沿底线跑到3号同侧的左底角三分线外，3号保留左侧侧翼三分点。5号持球观察两位射手，选择更有把握的一点。',2300,corner,{
        ...held5,paths:[path('1')],cues:[cue('r3-corner','1','穿到左底角','1号不停在篮下拥挤区，继续拉开到底角。',.15),cue('r3-wing','3','保留侧翼三分','3号不向篮下扎堆，与1号形成同侧不同高度的外线点。',.55)]}),
      make('5传1：选择底角射手','示范选择底角1号更有把握的情况，5号把球传到底角。选择依据是投射能力与当前接球空间，而不是默认1号一定更准。',850,cornerPass,{
        ball:point(1,1.2),paths:[path('ball','pass')],cues:[cue('r3-pass-corner','1','底角接球','传给1号的分支；并不预设投篮命中。',.75)]}),
      make('1号底角接球，及时处理','1号在左底角三分线外接球，趁补防到位前处理。箭头表示可选择投篮，不预设命中。',650,cornerClose,{
        ballOwner:'1',ballOffset:{x:27,y:0},ball:point(1,1.2),paths:[{type:'option',d:line([.55,1.2],[7.5,1.575])}],cues:[cue('r3-corner-shot','1','底角三分选择','1号读取扑防，不能把接球窗口当作必然得分。')]} )
    ],
    decisions:[{
      id:'high-low-read',title:'读取X4与篮下空间',atStep:5,defaultOption:'continue',
      prompt:'5号已在罚球线接球。选择一种防守反应，观察对应的进攻选择。',
      note:'先看X4守哪一处，再决定高位进攻、传篮下，还是继续穿底。切换会重播本节点。',
      options:[
        {id:'self',label:'X4守篮下 · 5号进攻',description:'X4照顾1号，X5尚未补到，5号利用罚球线窗口。',endStep:6,
          routeOverrides:{'X4':x4Route([7.8,2.4]),'X5':x5Route(false)},stepOverrides:{
            5:make('X4留篮下，5号高位有窗口','X4留在篮下堵1号，X5还在回补路上；5号得到罚球线处理球的时间。',900,selfDefence,{...held5,paths:[],cues:[cue('r3-self-space','5','高位进攻窗口','5号观察距离，及时投篮或攻击空间。'),cue('r3-stay-low','X4','留在篮下','X4没有同时扑到5号面前。',0,1,'help')]}),
            6:make('5号自行进攻','演示5号在罚球线利用空档的进攻选择。箭头表示中距离或进一步攻击，并不预设投篮命中。',900,selfDefence,{...held5,paths:[{type:'option',d:line([7.5,5.8],[7.5,1.575])}],cues:[cue('r3-self-finish','5','可投可攻','5号自己处理，不强行把球塞给篮下被照顾的1号。')]})}},
        {id:'inside',label:'X4扑高位 · 传篮下1号',description:'X4离开篮下，5号迅速找到1号。',endStep:6,
          routeOverrides:{'X4':x4Route([8.7,4.9]),'X5':x5Route(false),'ball':ballRoute('rim')},stepOverrides:{
            5:make('X4扑向5号，篮下让出空间','X4向罚球线补防5号，篮下1号的直接接球窗口打开。5号抬头观察，不等X4站稳后才处理。',900,lowDefence,{...held5,paths:[{type:'option',d:line([7.05,5.8],[7.05,1.2])}],cues:[cue('r3-step-up','X4','扑向高位5号','X4的选择让篮下身后出现空间。',.15,1,'help'),cue('r3-rim-open','1','篮下接球窗口','1号准备接5号传球。',.5)]}),
            6:make('5传1，找到篮下接应','5号利用X4扑高位后让出的空间传给篮下1号；这是阅读防守后的选择，不是每次都固定传篮下。',900,lowDefence,{ball:point(7.05,1.2),paths:[path('ball','pass')],cues:[cue('r3-low-pass','1','篮下接球','球权5→1，1号根据护筐情况选择终结。',.75)]})}},
        {id:'continue',label:'篮下没机会 · 继续穿底',description:'X4护筐、X5回补高位，1号继续去左底角，随后选择1号或3号。',stepOverrides:{}}
      ]
    },{
      id:'shooter-read',title:'选择更有把握的外线点',atStep:8,defaultOption:'corner',
      when:{decision:'high-low-read',option:'continue'},
      prompt:'1号已到左底角，3号留在左侧侧翼。选择更有投射把握、且有传球窗口的一点。',
      note:'不预设1号或3号更准；根据队员能力与防守位置选择。',
      options:[
        {id:'corner',label:'传1号 · 底角三分',description:'1号的底角投射更有把握，选择5→1。',stepOverrides:{}},
        {id:'wing',label:'传3号 · 侧翼三分',description:'3号的侧翼投射更有把握，选择5→3。',routeOverrides:{'ball':ballRoute('wing')},stepOverrides:{
          8:make('5传3：选择侧翼射手','1号已经在左底角拉开，5号选择把球传给更有投射把握的侧翼3号。',850,{...corner,'X2':[3,5.6]},{ball:point(1.05,6.9),paths:[path('ball','pass')],cues:[cue('r3-pass-wing','3','侧翼接球','这是5→3的分支，不是同时把球传给两个人。',.75)]}),
          9:make('3号侧翼接球，及时处理','3号在左侧三分线外接球。1号仍在同侧底角提供空间，3号根据扑防选择投篮或继续处理。',650,{...corner,'X2':[2.6,5.9]},{ballOwner:'3',ballOffset:{x:-27,y:0},ball:point(1.05,6.9),paths:[{type:'option',d:line([1.5,6.9],[7.5,1.575])}],cues:[cue('r3-wing-shot','3','侧翼三分选择','依据队员能力和当下空档选择，不预设命中。')]})}}
      ]
    }],
    coachingPoints:[
      '交接与空切：1号向右与2号手递手，交球后立即从4号身后溜底，准备在篮下接应。',
      '掩护到位：4号提前站稳，卡住X3向篮下收缩的路线，为1号留出切入空间。',
      '快速上提：5号从弱侧迅速提到罚球线，2号及时传给5号，与篮下1号形成高低位双点。',
      '高低位选择：5号先看X4的位置；X4守篮下就自己攻，X4扑高位就找篮下1号，不强行传进人群。',
      '后续拉开：1号篮下无机会就继续穿到左底角，与3号同侧拉开；5号根据空档和投射能力选择传1号或3号。'
    ]
  };
  const index = PLAYBOOK_DATA.findIndex(p=>p.id===play.id);
  if(index>=0) PLAYBOOK_DATA[index]=play;
})();
