// One motion dataset, two maintained text editions. No runtime translation service.
(() => {
  const source = window.PLAYBOOK_DATA;
  const missing = new Set();
  const dictionary = window.PLAYBOOK_EN;
  const han = /[\u3400-\u9fff]/;
  const swapChinese = text => text.replace(/左右|左|右/g, word => word === '左右' ? word : word === '左' ? '右' : '左');
  const swapEnglish = text => text.replace(/\b(left|right)\b/gi, word => {
    const other = word.toLowerCase() === 'left' ? 'right' : 'left';
    return word[0] === word[0].toUpperCase() ? other[0].toUpperCase() + other.slice(1) : other;
  });
  function localize(value, mirrored) {
    if (Array.isArray(value)) return value.map(item => localize(item, mirrored));
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, localize(item, mirrored)]));
    if (typeof value !== 'string' || !han.test(value)) return value;
    const key = mirrored ? swapChinese(value) : value;
    if (dictionary[key] !== undefined) return mirrored ? swapEnglish(dictionary[key]) : dictionary[key];
    missing.add(key);
    console.warn('Missing English playbook copy:', key);
    return value;
  }
  const editions = { zh: source, en: source.map(play => localize(play, !!play.mirroredFrom)) };
  const ui = {
    siteTitle:['系篮球队战术库','Team Playbook'],
    documentTitle:['系篮球队战术库','Team Basketball Playbook'],
    metaDescription:['用于演示、学习和持续维护球队五人制进攻战术的动画战术库。','An animated team playbook for learning and maintaining five-on-five offensive sets.'],
    offense:['进攻战术','Offensive sets'],
    directory:['战术列表','Play directory'],
    count:['{count} 套','{count} plays'],
    countTitle:['战术数量','Number of plays'],
    family:['{number}号战术','Play {number}'],
    familySides:['{number}号战术的左右侧版本','Left and right versions of Play {number}'],
    playFamily:['{family} · {side}发起','{family} · {side}-side entry'],
    overview:['查看配合说明','About this play'],
    caption:['看站位，读配合。','See the spacing. Read the play.'],
    captionHint:['点击要点中的号码定位球员','Select a player number to locate them'],
    step:['步骤','Step'], speed:['速度','Speed'],
    focus:['定位球员','Find player'],
    focused:['定位：{label}号','Player {label}'],
    focusRoster:['定位进攻球员','Locate an offensive player'],
    locate:['定位{label}号进攻球员','Locate offensive player {label}'],
    locateDefense:['定位{label}号防守球员','Locate defender {label}'],
    clearFocus:['取消定位','Clear'],
    legend:['球场图例','Court legend'],
    attacker:['进攻','Offense'], defender:['防守','Defense'],
    cut:['跑位','Cut'], pass:['传球','Pass'], screen:['掩护','Screen'], trail:['追防','Trail'],
    controls:['动画播放控制','Animation controls'],
    reset:['回到开始','Restart'], previous:['上一步','Previous step'], next:['下一步','Next step'],
    play:['播放','Play'], pause:['暂停','Pause'],
    progress:['本步进度','Progress'], scrub:['拖动查看本步动作时序','Drag to inspect timing within this step'],
    time:['{elapsed} / {duration} 秒','{elapsed} / {duration} s'],
    branch:['战术分支选择','Play decisions'], branchOptions:['战术分支','Play options'],
    screenDirection:['选择掩护方向','Choose the screen angle'],
    pending:['已暂停 · 请选择后续动作','Paused · Choose the next action'],
    branchStep:['第{step}步分支','Decision at step {step}'],
    screenPrompt:['球已传到2号。选择掩护方向后，播放对应的补防与顺下。','2 has the ball. Choose the screen angle to see the help rotation and roll.'],
    screenNote:['{label}。左右沿用球队叫法，以“中路／底线”辨认路线；切换方向会从上提掩护重播。','{label}. Left/right are the team’s relative screen calls; use middle/baseline to identify the drive. Changing the call replays the screen setup.'],
    pendingHint:['请在上方选择左挡或右挡，继续对应的后续动作。','Choose a screen option in the reading panel to continue.'],
    study:['学习内容','Study content'], coaching:['执行要点','Coaching points'], steps:['分步动作','Step by step'],
    readingHint:['点击文中号码，对照球场站位；再次点击取消。','Select a number to locate that player on court. Select again to clear.'],
    current:['当前动作','Current action'], timeline:['战术步骤','Play sequence'],
    stepLabel:['第{step}步：{title}','Step {step}: {title}'],
    observation:['拖动进度，观察每名球员的动作与时机。','Drag the progress slider to inspect each player’s movement and timing.'],
    playerOffense:['{label}号进攻球员','Offensive player {label}'],
    playerZone:['{label}号防守球员','Defender {label}'],
    playerMan:['{label}：盯防{number}号','{label}: guards player {number}'],
    emptyTitle:['等待录入战术','Play not added yet'],
    emptyHint:['补充文字描述后，这里会显示逐步跑位动画。','The animated sequence will appear here once the play is added.'],
    emptyStep:['尚未录入','Not added yet'],
    emptyDescription:['文字描述确认后生成动画步骤。','Animation steps will be added after the play description is confirmed.'],
    emptyTimeline:['文字描述确认后生成动画步骤','Steps will appear after the play is confirmed'],
    emptyPoints:['录入战术后显示关键站位、时机与选择。','Key spacing, timing and reads will appear once the play is added.'],
    emptyNote:['等待录入战术。','Waiting for the play to be added.'],
    courtLabel:['按FIBA比例绘制的篮球半场战术动画','Basketball half-court animation with FIBA court proportions'],
    courtTitle:['15米宽、14米长的标准篮球半场','Regulation half court: 15 m wide and 14 m long'],
    courtDescription:['篮筐在上方底线一侧；三分线半径6.75米，罚球半圆半径1.80米。','The basket is at the top baseline. Three-point radius: 6.75 m; free-throw circle radius: 1.80 m.'],
    screenCaps:['掩护短线','Screen markers'], language:['语言切换','Language']
  };
  let language = 'zh';
  const requested = new URLSearchParams(location.search).get('lang');
  try {
    const saved = localStorage.getItem('playbook-language');
    language = saved === 'en' ? 'en' : 'zh';
  } catch (_) { /* localStorage may be unavailable for a local file. */ }
  if (requested === 'en' || requested === 'zh') language = requested;
  function t(key, parameters = {}) {
    if (!ui[key]) throw new Error(`Unknown UI translation: ${key}`);
    return ui[key][language === 'en' ? 1 : 0].replace(/\{(\w+)\}/g, (_, name) => parameters[name] ?? '');
  }
  function applyStatic() {
    document.documentElement.lang = language === 'en' ? 'en' : 'zh-CN';
    document.title = t('documentTitle');
    document.querySelector('meta[name=description]').content = t('metaDescription');
    const texts = {
      '.brand h1':'siteTitle','.sidebar h2':'offense','.play-overview summary':'overview',
      '.study-caption span':'captionHint','.step-readout > span':'step','.speed-control label':'speed',
      '#clear-focus':'clearFocus','.progress-heading label':'progress','#coaching-tab':'coaching',
      '#steps-tab':'steps','.reading-hint':'readingHint','.current-step .eyebrow':'current',
      '.section-title h3':'timeline','#empty-board strong':'emptyTitle','#empty-board p':'emptyHint',
      '#court > title':'courtTitle','#court > desc':'courtDescription'
    };
    Object.entries(texts).forEach(([selector, key]) => { const node = document.querySelector(selector); if (node) node.textContent = t(key); });
    document.querySelector('.study-caption').firstChild.nodeValue = t('caption');
    ['attacker','defender','cut','pass','screen','trail'].forEach((key, index) => {
      document.querySelectorAll('.court-legend span')[index].lastChild.nodeValue = t(key);
    });
    const labels = { '.sidebar':'directory','.court-roster':'focusRoster','.court-legend':'legend',
      '.transport':'controls','#step-progress':'scrub','#decision-panel':'branch','#decision-options':'branchOptions',
      '.study-tabs':'study','#court':'courtLabel','#screen-layer':'screenCaps','.language-switch':'language' };
    Object.entries(labels).forEach(([selector,key]) => document.querySelector(selector)?.setAttribute('aria-label',t(key)));
    ['reset','previous','next'].forEach((key, index) => {
      const button = document.querySelector(['#reset-btn','#prev-btn','#next-btn'][index]);
      button.title = t(key); button.setAttribute('aria-label',t(key));
    });
    document.querySelectorAll('[data-language]').forEach(button => button.setAttribute('aria-pressed',String(button.dataset.language === language)));
    document.querySelectorAll('.roster-player').forEach(button => button.setAttribute('aria-label',t('locate',{label:button.dataset.locatePlayer})));
  }
  function setLanguage(next) {
    if (!['zh','en'].includes(next)) return;
    language = next;
    try { localStorage.setItem('playbook-language', language); } catch (_) {}
    const url = new URL(location.href); url.searchParams.set('lang',language);
    history.replaceState(null,'',url);
    applyStatic();
    return editions[language];
  }
  window.PlaybookI18n = Object.freeze({ t, applyStatic, setLanguage,
    get language() { return language; }, getPlays: () => editions[language],
    missingEnglish: () => [...missing] });
})();
