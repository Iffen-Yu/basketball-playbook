"""Check rendered court geometry and capture desktop/mobile previews in Chrome."""
import base64
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import time
from urllib.request import urlopen

import websocket
from check_right3 import check as check_right3
from check_coaching import check as check_coaching
from check_layout import check as check_layout
from check_i18n import check as check_i18n

sys.stdout.reconfigure(encoding='utf-8')


root = Path(__file__).resolve().parents[1]
chrome = Path(r"C:\Program Files\Google\Chrome\Application\chrome.exe")
profile = Path(tempfile.mkdtemp(prefix="basketball-court-qa-"))
process = None
connection = None
sequence = 0
browser_errors = []


def command(method, params=None):
    global sequence
    sequence += 1
    identifier = sequence
    connection.send(json.dumps({"id": identifier, "method": method, "params": params or {}}))
    while True:
        message = json.loads(connection.recv())
        if message.get("method") == "Runtime.exceptionThrown":
            browser_errors.append(message["params"]["exceptionDetails"])
        if message.get("id") == identifier:
            if "error" in message:
                raise RuntimeError(message["error"])
            return message.get("result", {})


def evaluate(expression):
    result = command("Runtime.evaluate", {
        "expression": expression, "returnByValue": True, "awaitPromise": True
    })
    if "exceptionDetails" in result:
        raise RuntimeError(result["exceptionDetails"])
    return result.get("result", {}).get("value")


def screenshot(name, clip=None):
    params = {"captureBeyondViewport": True}
    if clip:
        params["clip"] = {**clip, "scale": 1}
    output = command("Page.captureScreenshot", params)
    (root / name).write_bytes(base64.b64decode(output["data"]))


try:
    process = subprocess.Popen([
        str(chrome), "--headless=new", "--disable-gpu", "--no-first-run",
        "--no-default-browser-check", "--hide-scrollbars", "--remote-allow-origins=*",
        "--remote-debugging-port=0", f"--user-data-dir={profile}", "about:blank"
    ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
        creationflags=subprocess.CREATE_NO_WINDOW)
    deadline = time.monotonic() + 20
    while not (profile / "DevToolsActivePort").exists():
        if process.poll() is not None:
            raise RuntimeError("Chrome exited before its debugging endpoint became available")
        if time.monotonic() > deadline:
            raise TimeoutError("Chrome debugging endpoint unavailable")
        time.sleep(0.1)
    port = (profile / "DevToolsActivePort").read_text().splitlines()[0]
    with urlopen(f"http://127.0.0.1:{port}/json/list", timeout=10) as response:
        targets = json.load(response)
    target = next(item for item in targets if item["type"] == "page")
    connection = websocket.create_connection(target["webSocketDebuggerUrl"], timeout=15)
    command("Page.enable")
    command("Runtime.enable")
    command("Emulation.setDeviceMetricsOverride", {
        "width": 1440, "height": 1280, "deviceScaleFactor": 1, "mobile": False
    })
    command("Page.navigate", {"url": (root / "dist" / "index.html").as_uri()})
    deadline = time.monotonic() + 10
    while not evaluate("!!document.querySelector('#offense-layer .player-piece')?.transform.baseVal.consolidate()"):
        if browser_errors:
            raise RuntimeError(browser_errors)
        if time.monotonic() > deadline:
            raise TimeoutError("Court or play failed to initialize")
        time.sleep(0.1)

    if '--i18n-only' in sys.argv:
        result = check_i18n(evaluate, command, screenshot)
        assert not browser_errors, browser_errors
        print(json.dumps(result, ensure_ascii=False, indent=2))
        raise SystemExit(0)

    if '--export-text' in sys.argv:
        result = evaluate(r"""(()=>{const output={};for(const id of ['left-2','right-3','left-4']){const values=new Set();const visit=v=>{if(typeof v==='string'&&/[\u3400-\u9fff]/.test(v))values.add(v);else if(Array.isArray(v))v.forEach(visit);else if(v&&typeof v==='object')Object.values(v).forEach(visit);};visit(PLAYBOOK_DATA.find(p=>p.id===id));output[id]=[...values];}return output;})()""")
        print(json.dumps(result, ensure_ascii=False, indent=2))
        raise SystemExit(0)

    if '--layout-only' in sys.argv:
        result = check_layout(evaluate, command, screenshot)
        assert not browser_errors, browser_errors
        print(json.dumps(result, ensure_ascii=False, indent=2))
        raise SystemExit(0)

    if '--coaching-only' in sys.argv:
        result = check_coaching(evaluate)
        assert not browser_errors, browser_errors
        evaluate("document.querySelector('[data-play-id=left-4]').click()")
        screenshot('preview-coaching-left4.png')
        print(json.dumps(result, ensure_ascii=False, indent=2))
        raise SystemExit(0)

    if '--right3-only' in sys.argv:
        def seek_step(index, progress):
            return evaluate(f"""(() => {{
              document.querySelectorAll('#timeline li')[{index}].click();
              const slider=document.querySelector('#step-progress');
              slider.value='{round(progress*1000)}';slider.dispatchEvent(new Event('input',{{bubbles:true}}));
            }})()""")
        result = check_right3(evaluate, seek_step, screenshot, command)
        assert not browser_errors, browser_errors
        print(json.dumps(result, ensure_ascii=False, indent=2))
        raise SystemExit(0)

    geometry = evaluate("""(() => {
      const boundary = document.querySelector('#court-boundary').getBBox();
      const arc = document.querySelector('#three-point-line');
      const free = document.querySelector('#free-throw-outer-arc');
      const rim = document.querySelector('#basket-rim');
      const cx = rim.cx.baseVal.value, cy = rim.cy.baseVal.value;
      const sample = path => Array.from({length: 1201}, (_, i) =>
        path.getPointAtLength(path.getTotalLength() * i / 1200));
      const threePoints = sample(arc), freePoints = sample(free);
      const maximumY = points => Math.max(...points.map(p => p.y));
      const scale = boundary.width / 15;
      const gap = (maximumY(threePoints) - maximumY(freePoints)) / scale;
      let minimumGap = Infinity;
      for (const a of threePoints) for (const b of freePoints) {
        minimumGap = Math.min(minimumGap, Math.hypot(a.x - b.x, a.y - b.y));
      }
      const playerPositions = [...document.querySelectorAll('#offense-layer .player-piece')]
        .slice(0, 3).map(player => {
          const position = player.transform.baseVal.consolidate().matrix;
          return {label: player.querySelector('text').textContent, radius: Math.hypot(position.e - cx, position.f - cy) / scale};
        });
      const screenScale = document.querySelector('#court').getScreenCTM();
      const players = Object.fromEntries([...document.querySelectorAll('.player-piece')].map(node => {
        const m = node.transform.baseVal.consolidate().matrix;
        return [node.querySelector('text').textContent, {x:m.e, y:m.f}];
      }));
      return {
        halfCourtRatio: boundary.width / boundary.height,
        renderedThreePointRadius: (maximumY(threePoints) - cy) / scale,
        renderedFreeThrowRadius: (maximumY(freePoints) - free.getPointAtLength(0).y) / scale,
        centreGapMetres: gap, minimumArcGapMetres: minimumGap / scale,
        uniformScreenScale: Math.abs(screenScale.a - screenScale.d) < 0.00001,
        perimeterPlayers: playerPositions,
        shortCornersOutsideDefence: players['4'].x < players['X4'].x && players['5'].x > players['X5'].x
          && players['4'].y < players['X4'].y && players['5'].y < players['X5'].y,
        initialMatchupDistances: [1,2,3,4,5].map(number => Math.hypot(
          players[String(number)].x - players['X'+number].x,
          players[String(number)].y - players['X'+number].y) / scale),
        horizontalOverflow: document.documentElement.scrollWidth > innerWidth,
        lineCount: document.querySelectorAll('#court-lines > *').length
      };
    })()""")
    assert abs(geometry["halfCourtRatio"] - 15 / 14) < 0.00001, geometry
    assert abs(geometry["renderedThreePointRadius"] - 6.75) < 0.01, geometry
    assert abs(geometry["renderedFreeThrowRadius"] - 1.8) < 0.01, geometry
    assert abs(geometry["centreGapMetres"] - 0.725) < 0.01, geometry
    assert geometry["minimumArcGapMetres"] > 0.7, geometry
    assert geometry["uniformScreenScale"], geometry
    assert all(player["radius"] > 6.75 for player in geometry["perimeterPlayers"]), geometry
    assert geometry["shortCornersOutsideDefence"], geometry
    assert all(0.5 < distance < 1.5 for distance in geometry["initialMatchupDistances"]), geometry
    assert not geometry["horizontalOverflow"], geometry
    screenshot("preview-left2.png")
    clip = evaluate("""(() => {const b=document.querySelector('#court').getBoundingClientRect();
      return {x:b.x + scrollX, y:b.y + scrollY, width:b.width, height:b.height};})()""")
    evaluate("document.querySelectorAll('#paths-layer, #offense-layer, #defense-layer, #ball-layer').forEach(n => n.style.visibility='hidden')")
    screenshot("preview-court.png", clip)
    evaluate("document.querySelectorAll('#paths-layer, #offense-layer, #defense-layer, #ball-layer').forEach(n => n.style.visibility='')")

    # Sample independently timed actors, then verify real UI pause/speed/seek behavior.
    timing = evaluate("""(() => {
      const play = PLAYBOOK_DATA[0], unit = COURT.scale;
      const at = (index, t, label) => {
        const motion = PlayMotion.compileStep(play,index);
        return motion.sample(motion.duration*t).positions.get(label);
      };
      const dist = (a,b) => Math.hypot(a.x-b.x,a.y-b.y)/unit;
      let minimumScreenClearance = Infinity, maximumBoundaryJump = 0, maximumBallOffsetError = 0;
      for (let index=1;index<play.steps.length;index++) {
        const motion=PlayMotion.compileStep(play,index);
        const before=PlayMotion.compileStep(play,index-1).sample(1e9), after=motion.sample(0);
        before.positions.forEach((p,label)=>maximumBoundaryJump=Math.max(maximumBoundaryJump,dist(p,after.positions.get(label))));
        maximumBoundaryJump=Math.max(maximumBoundaryJump,dist(before.ball,after.ball));
        for (let i=0;i<=300;i++) {
          const sample=motion.sample(motion.duration*i/300);
          if (index>=2) minimumScreenClearance=Math.min(minimumScreenClearance,
            dist(sample.positions.get('X2'),sample.positions.get('4')));
          if (play.steps[index].ballOwner) maximumBallOffsetError=Math.max(maximumBallOffsetError,
            Math.abs(dist(sample.ball,sample.positions.get('2'))-.45));
        }
      }
      const p0=at(3,0,'X2'), p20=at(3,.2,'X2');
      const s4=at(4,.5,'4'), initial4=at(4,0,'4');
      const accel1=dist(at(4,.6,'4'),at(4,.5,'4'));
      const accel2=dist(at(4,.7,'4'),at(4,.6,'4'));
      return {
        x2HeldMetres:dist(p0,p20),
        ballhandlerAdvanceMetres:dist(at(3,0,'2'),at(3,.2,'2')),
        minimumScreenClearanceMetres:minimumScreenClearance,
        screenerHoldDuringHelpMetres:dist(s4,initial4),
        helpAdvanceMetres:dist(at(4,0,'X4'),at(4,.5,'X4')),
        rollAccelerationRatio:accel2/accel1,
        finalRollSeparationMetres:dist(at(5,.6,'4'),at(5,.6,'X4')),
        maximumBoundaryJumpMetres:maximumBoundaryJump,
        maximumBallOffsetErrorMetres:maximumBallOffsetError
      };
    })()""")
    assert timing["x2HeldMetres"] < 0.001, timing
    assert timing["ballhandlerAdvanceMetres"] > 0.5, timing
    assert timing["minimumScreenClearanceMetres"] > 0.97, timing
    assert timing["screenerHoldDuringHelpMetres"] < 0.001, timing
    assert timing["helpAdvanceMetres"] > 0.8, timing
    assert timing["rollAccelerationRatio"] > 1.5, timing
    assert timing["finalRollSeparationMetres"] > 2, timing
    assert timing["maximumBoundaryJumpMetres"] < 0.001, timing
    assert timing["maximumBallOffsetErrorMetres"] < 0.001, timing

    branches = evaluate("""(() => {
      const base=PLAYBOOK_DATA[0], left=PlayMotion.resolvePlay(base,{'screen-direction':'left'});
      const right=PlayMotion.resolvePlay(base,{'screen-direction':'right'}), unit=COURT.scale;
      const rim=COURT.point(7.5,1.575), dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y)/unit;
      const results={};
      for (const [id,play] of Object.entries({left,right})) {
        let clearance=Infinity, continuity=0, ballError=0;
        for(let index=1;index<play.steps.length;index++) {
          const motion=PlayMotion.compileStep(play,index), start=motion.sample(0);
          const previous=PlayMotion.compileStep(play,index-1).sample(1e9);
          previous.positions.forEach((p,label)=>continuity=Math.max(continuity,dist(p,start.positions.get(label))));
          continuity=Math.max(continuity,dist(previous.ball,start.ball));
          for(let n=0;n<=300;n++) {
            const sample=motion.sample(motion.duration*n/300);
            if(index>=2) clearance=Math.min(clearance,dist(sample.positions.get('4'),sample.positions.get('X2')));
            if(play.steps[index].ballOwner) ballError=Math.max(ballError,Math.abs(dist(sample.ball,sample.positions.get('2'))-.45));
          }
        }
        const at=(index,t,label)=>{const m=PlayMotion.compileStep(play,index);return m.sample(t*m.duration).positions.get(label);};
        results[id]={clearance,continuity,ballError, drive:at(3,1,'2'), help:at(4,1,'X4'),
          roll:at(5,.6,'4'), recover:at(5,.6,'X4'),
          rollRimDistance:dist(at(5,.6,'4'),rim), defenderRimDistance:dist(at(5,.6,'X4'),rim)};
      }
      return results;
    })()""")
    for name, route in branches.items():
        assert route["clearance"] > 0.97, {name:route}
        assert route["continuity"] < 0.001 and route["ballError"] < 0.001, {name:route}
    assert branches["right"]["drive"]["x"] < branches["left"]["drive"]["x"] - 120, branches
    assert branches["right"]["drive"]["y"] < branches["left"]["drive"]["y"] - 120, branches
    assert branches["right"]["help"]["x"] < branches["left"]["help"]["x"] - 120, branches
    assert branches["right"]["rollRimDistance"] < branches["right"]["defenderRimDistance"] - 1.5, branches
    smoothness = evaluate("""(() => {
      const unit=COURT.scale, results={};
      for (const choice of ['left','right']) {
        const play=PlayMotion.resolvePlay(PLAYBOOK_DATA[0],{'screen-direction':choice});
        const motions=play.steps.map((_,i)=>PlayMotion.compileStep(play,i));
        const starts=[]; let total=0;
        motions.forEach((m,i)=>{starts[i]=total;total+=m.duration;});
        const times=new Set(starts.slice(1));
        play.steps.forEach((step,index)=>{
          for (const keys of Object.values(step.motions||{})) {
            keys.forEach((key,i)=>{
              times.add(starts[index]+key.t*motions[index].duration);
              if (i && (key.via || key.easing==='accelerate' || key.easing==='decelerate')) {
                for (const fraction of [.25,.5,.75]) times.add(starts[index]+
                  (keys[i-1].t+(key.t-keys[i-1].t)*fraction)*motions[index].duration);
              }
            });
          }
        });
        const sample=time=>{
          const index=motions.findIndex((m,i)=>i>0 && time<=starts[i]+m.duration);
          return motions[index<0?motions.length-1:index].sample(
            index<0?motions.at(-1).duration:time-starts[index]);
        };
        let maxVelocityJump=0, maxTurnAngle=0, maximumArrowError=0, minimumHandlerClearance=Infinity, handlerAt=null;
        const epsilon=.05, factor=1000/(epsilon*unit);
        for (const time of times) {
          if(time<=epsilon || time>=total-epsilon) continue;
          const before=sample(time-epsilon), centre=sample(time), after=sample(time+epsilon);
          for (const [label,p] of centre.positions) {
            const a=before.positions.get(label),b=after.positions.get(label);
            const va={x:(p.x-a.x)*factor,y:(p.y-a.y)*factor};
            const vb={x:(b.x-p.x)*factor,y:(b.y-p.y)*factor};
            const sa=Math.hypot(va.x,va.y), sb=Math.hypot(vb.x,vb.y);
            maxVelocityJump=Math.max(maxVelocityJump,Math.hypot(va.x-vb.x,va.y-vb.y));
            if(sa>.1 && sb>.1) maxTurnAngle=Math.max(maxTurnAngle,
              Math.acos(Math.max(-1,Math.min(1,(va.x*vb.x+va.y*vb.y)/(sa*sb))))*180/Math.PI);
          }
        }
        for(let index=2;index<motions.length;index++) {
          const motion=motions[index];
          for(let n=0;n<=400;n++){
            const positions=motion.sample(motion.duration*n/400).positions;
            const a=positions.get('2'),b=positions.get('4');
            const gap=Math.hypot(a.x-b.x,a.y-b.y)/unit;
            if(gap<minimumHandlerClearance) {minimumHandlerClearance=gap;handlerAt={step:index,t:n/400,handler:a,screener:b};}
          }
          for(const definition of play.steps[index].paths||[]) {
            if(!definition.actor || definition.type==='screen') continue;
            const path=document.createElementNS('http://www.w3.org/2000/svg','path');
            const d=motion.pathFor(definition.actor);
            path.setAttribute('d',d);
            const length=path.getTotalLength();
            const points=Array.from({length:2001},(_,i)=>path.getPointAtLength(length*i/2000));
            for(const t of [.08,.25,.44,.73,.96]){
              const frame=motion.sample(motion.duration*t);
              const p=definition.actor==='ball'?frame.ball:frame.positions.get(definition.actor);
              maximumArrowError=Math.max(maximumArrowError,
                Math.min(...points.map(q=>Math.hypot(p.x-q.x,p.y-q.y)))/unit);
            }
          }
        }
        results[choice]={maxVelocityJumpMetresPerSecond:maxVelocityJump,
          maxTurnAngleDegrees:maxTurnAngle, maximumArrowErrorMetres:maximumArrowError,
          minimumHandlerClearanceMetres:minimumHandlerClearance,handlerAt};
      }
      return results;
    })()""")
    for name, measured in smoothness.items():
        assert measured["maxVelocityJumpMetresPerSecond"] < .03, {name:measured}
        assert measured["maxTurnAngleDegrees"] < 2, {name:measured}
        assert measured["maximumArrowErrorMetres"] < .01, {name:measured}
        assert measured["minimumHandlerClearanceMetres"] > .97, {name:measured}
    evaluate("document.querySelectorAll('#timeline li')[2].click();document.querySelector('[data-choice=left]').click();document.querySelectorAll('#timeline li')[0].click()")

    controls = evaluate("""(async () => {
      const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
      const ball=()=>{const m=document.querySelector('#ball-layer g').transform.baseVal.consolidate().matrix;
        return [m.e,m.f];};
      const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
      const time=()=>Number(document.querySelector('#court').dataset.elapsed);
      document.querySelector('#next-btn').click();
      await wait(750);
      document.querySelector('#play-btn').click();
      const paused=ball(), pausedTime=time();
      await wait(220);
      const held=ball(), heldTime=time();
      document.querySelector('#play-btn').click();
      await new Promise(resolve=>requestAnimationFrame(resolve));
      const resumed=ball();
      await wait(220);
      const moved=ball();
      document.querySelector('#play-btn').click();

      document.querySelectorAll('#timeline li')[3].click();
      const slider=document.querySelector('#step-progress');
      slider.value='200'; slider.dispatchEvent(new Event('input',{bubbles:true}));
      const speed=document.querySelector('#speed');
      speed.value='1.5';
      const fastStart=time(), fastWall=performance.now();
      document.querySelector('#play-btn').click();
      await wait(320);
      const fastRate=(time()-fastStart)/(performance.now()-fastWall);
      const slowStart=time(), slowWall=performance.now();
      speed.value='0.6'; speed.dispatchEvent(new Event('change',{bubbles:true}));
      await wait(320);
      const slowRate=(time()-slowStart)/(performance.now()-slowWall);
      document.querySelector('#play-btn').click();
      speed.value='1';
      return {pausedDistance:distance(paused,held), pausedElapsed:heldTime-pausedTime,
        resumeJump:distance(paused,resumed), resumeAdvance:distance(resumed,moved), fastRate,slowRate};
    })()""")
    assert controls["pausedDistance"] < 0.001 and controls["pausedElapsed"] == 0, controls
    assert controls["resumeJump"] < 0.01 and controls["resumeAdvance"] > 1, controls
    assert 1.2 < controls["fastRate"] < 1.8, controls
    assert 0.4 < controls["slowRate"] < 0.85, controls

    playback = evaluate("""(async () => {
      document.querySelector('#reset-btn').click();
      document.querySelector('#speed').value='1.5';
      document.querySelector('#play-btn').click();
      const deadline=performance.now()+13000;
      let gated=false;
      while(performance.now()<deadline) {
        await new Promise(resolve=>setTimeout(resolve,100));
        if(document.querySelector('#decision-panel').classList.contains('needs-choice')) {
          gated=true;
          document.querySelector('[data-choice=left]').click();
        }
        if(document.querySelector('#court').dataset.step==='5'
          && Number(document.querySelector('#court').dataset.elapsed)>=2200
          && document.querySelector('#play-btn span').textContent==='播放') {
          document.querySelector('#speed').value='1';
          return {completed:true, gated, finalStep:document.querySelector('#step-readout').textContent};
        }
      }
      return {completed:false};
    })()""")
    assert playback["completed"] and playback["gated"], playback

    def seek_step(index, progress):
        return evaluate(f"""(() => {{
          document.querySelectorAll('#timeline li')[{index}].click();
          const slider=document.querySelector('#step-progress');
          slider.value='{round(progress*1000)}';
          slider.dispatchEvent(new Event('input',{{bubbles:true}}));
          return {{elapsed:Number(document.querySelector('#court').dataset.elapsed),
            note:document.querySelector('#phase-note').textContent,
            cues:[...document.querySelectorAll('#annotation-layer text')].map(n=>n.textContent)}};
        }})()""")

    blocked = seek_step(3, .25)
    assert "受阻减速" in blocked["cues"], blocked
    actual_arrows = evaluate("""[...document.querySelectorAll('#paths-layer path[data-actor]')]
      .filter(path=>path.dataset.actor).every(path=>path.getAttribute('d').includes('C') && !path.getAttribute('d').includes('L'))""")
    assert actual_arrows, "Actual on-screen actor arrows must be smooth cubic paths"
    screenshot("preview-left2-blocked.png")
    screenshot("preview-left2-motion.png")
    help_phase = seek_step(4, .5)
    assert "补防持球" in help_phase["cues"], help_phase
    screenshot("preview-left2-help.png")
    roll_phase = seek_step(5, .6)
    assert "顺下空当" in roll_phase["cues"], roll_phase
    screenshot("preview-left2-roll.png")
    # Switch during an unfinished middle route; a different branch must restart at the shared node.
    seek_step(3, .25)
    switch_right = evaluate("""(() => {
      document.querySelector('[data-choice=right]').click();
      const slider=document.querySelector('#step-progress'); slider.value='0';
      slider.dispatchEvent(new Event('input',{bubbles:true}));
      return {step:Number(document.querySelector('#court').dataset.step),
        time:Number(document.querySelector('#court').dataset.elapsed),
        selected:document.querySelector('[data-choice=right]').getAttribute('aria-pressed'),
        title:document.querySelector('#step-title').textContent};
    })()""")
    assert switch_right["step"] == 2 and switch_right["time"] == 0 and switch_right["selected"] == "true", switch_right
    seek_step(3, .75)
    screenshot("preview-left2-right-drive.png")
    seek_step(4, .65)
    screenshot("preview-left2-right-help.png")
    seek_step(5, .6)
    screenshot("preview-left2-right-roll.png")
    switch_left = evaluate("""(() => {
      document.querySelector('[data-choice=left]').click();
      const slider=document.querySelector('#step-progress'); slider.value='0';
      slider.dispatchEvent(new Event('input',{bubbles:true}));
      return {step:Number(document.querySelector('#court').dataset.step),
        selected:document.querySelector('[data-choice=left]').getAttribute('aria-pressed'),
        title:document.querySelector('#step-title').textContent};
    })()""")
    assert switch_left["step"] == 2 and switch_left["selected"] == "true", switch_left
    evaluate("document.querySelector('#reset-btn').click()")
    command("Emulation.setDeviceMetricsOverride", {
        "width": 390, "height": 1100, "deviceScaleFactor": 1, "mobile": False
    })
    phone = evaluate("""(() => {const m=document.querySelector('#court').getScreenCTM();
      return {uniformScale: Math.abs(m.a-m.d)<0.00001,
      overflow:document.documentElement.scrollWidth>innerWidth};})()""")
    assert phone["uniformScale"] and not phone["overflow"], phone
    screenshot("preview-left2-mobile.png")
    evaluate("document.querySelector('[data-play-id=left-3]').click()")
    assert evaluate("!document.querySelector('#play-btn').disabled && document.querySelector('#empty-board').classList.contains('hidden')"), "Left3 must be playable"
    # New play: simultaneous off-ball actions against a 2-3 zone.
    command("Emulation.setDeviceMetricsOverride", {
        "width":1440, "height":1440, "deviceScaleFactor":1, "mobile":False
    })
    evaluate("document.querySelectorAll('.play-item')[4].click()")
    left4 = evaluate("""(() => {
      const play=PLAYBOOK_DATA.find(p=>p.id==='left-4'), unit=COURT.scale;
      const motions=play.steps.map((_,i)=>PlayMotion.compileStep(play,i));
      const at=(i,t,label)=>motions[i].sample(motions[i].duration*t).positions.get(label);
      const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y)/unit;
      const rim=COURT.point(7.5,1.575);
      let continuity=0, ballContinuity=0, minimumScreenGap=Infinity, minimumRunnerGap=Infinity;
      let screenAt=null, runnerAt=null, withinCourt=true;
      for(let i=1;i<motions.length;i++) {
        const before=motions[i-1].sample(1e9), after=motions[i].sample(0);
        before.positions.forEach((p,label)=>continuity=Math.max(continuity,dist(p,after.positions.get(label))));
        ballContinuity=Math.max(ballContinuity,dist(before.ball,after.ball));
        for(let n=0;n<=500;n++) {
          const t=n/500, sample=motions[i].sample(motions[i].duration*t), p=sample.positions;
          for(const [a,b] of [['4','X1'],['5','X2'],['3','5']]) {
            const gap=dist(p.get(a),p.get(b));
            if(gap<minimumScreenGap){minimumScreenGap=gap;screenAt={step:i,t,pair:[a,b]};}
          }
          for(const label of ['X3','X4','X5']) {
            const gap=dist(p.get('2'),p.get(label));
            if(gap<minimumRunnerGap){minimumRunnerGap=gap;runnerAt={step:i,t,defender:label};}
          }
          p.forEach(position=>{
            if(position.x<59 || position.x>901 || position.y<59 || position.y>841) withinCourt=false;
          });
        }
      }
      const pop=at(2,1,'4');
      const end3=motions[3].sample(1e9), end4=motions[4].sample(1e9);
      const ball4=dist(end3.ball,end3.positions.get('4'));
      const ball3=dist(end4.ball,end4.positions.get('3'));
      const centerStart=at(5,0,'X4'), centerHeld=at(5,.25,'X4'), centerEnd=at(5,1,'X4');
      return {
        visibleTitle:document.querySelector('#play-title').textContent,
        hash:location.hash, defence:play.defense,
        decisionHidden:document.querySelector('#decision-panel').hidden,
        continuity,ballContinuity,minimumScreenGap,screenAt,minimumRunnerGap,runnerAt,withinCourt,
        bothScreensMove:dist(at(1,0,'4'),at(1,.5,'4'))>1 && dist(at(1,0,'5'),at(1,.5,'5'))>1,
        simultaneousCuts:dist(at(2,0,'2'),at(2,.3,'2'))>.5 && dist(at(2,0,'3'),at(2,.3,'3'))>.5,
        screenerWait:dist(at(2,0,'4'),at(2,.25,'4')),
        popBeyondArc:dist(pop,rim)>6.75,
        rightCornerBeyondLine:at(3,1,'2').x>COURT.point(14.1,1.2).x,
        rightCorner:at(3,1,'2'), freeThrowCatch:at(3,1,'3'), ball4,ball3,
        centreDelay:dist(centerStart,centerHeld),
        initialCatchSpace:Math.min(dist(at(4,1,'3'),at(4,1,'X2')),dist(at(4,1,'3'),at(4,1,'X4'))),
        centerCloses:dist(centerStart,at(5,0,'3'))-dist(centerEnd,at(5,1,'3'))
      };
    })()""")
    assert left4["visibleTitle"] == "左4" and left4["hash"] == "#left-4", left4
    assert left4["defence"] == "2-3-zone" and left4["decisionHidden"], left4
    assert left4["continuity"] < .001 and left4["ballContinuity"] < .001, left4
    assert left4["minimumScreenGap"] > .97 and left4["minimumRunnerGap"] > .97, left4
    assert left4["withinCourt"] and left4["bothScreensMove"] and left4["simultaneousCuts"], left4
    assert left4["screenerWait"] < .001 and left4["popBeyondArc"] and left4["rightCornerBeyondLine"], left4
    assert abs(left4["ball4"]-.45) < .001 and abs(left4["ball3"]-.45) < .001, left4
    assert left4["centreDelay"] < .001 and left4["initialCatchSpace"] > 1.5 and left4["centerCloses"] > 1, left4
    flow = evaluate("""(() => {
      const play=PLAYBOOK_DATA.find(p=>p.id==='left-4'), unit=COURT.scale;
      const motions=play.steps.map((_,i)=>PlayMotion.compileStep(play,i));
      const starts=[0];let total=0;
      motions.forEach((m,i)=>{starts[i]=total;total+=m.duration;});
      const sample=(time,label)=>{
        let i=motions.length-1;
        while(i>1 && time<starts[i]) i--;
        const s=motions[i].sample(time-starts[i]);
        return label==='ball'?s.ball:s.positions.get(label);
      };
      const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y)/unit;
      const metrics={};
      for(const label of ['2','3','4','5','X2']) {
        let maxTurn=0,peakSpeed=0,peakAcceleration=0,previousVelocity=null;
        let minimumSpeed=Infinity, pathLengthError=0;
        for(let time=0;time<total-10;time+=5) {
          const a=sample(time,label),b=sample(time+5,label);
          const velocity={x:(b.x-a.x)/unit/.005,y:(b.y-a.y)/unit/.005};
          const speed=Math.hypot(velocity.x,velocity.y);
          peakSpeed=Math.max(peakSpeed,speed);
          if(time>starts[2]+800 && time<starts[3]+500 && ['2','3'].includes(label)) minimumSpeed=Math.min(minimumSpeed,speed);
          if(previousVelocity) {
            const previousSpeed=Math.hypot(previousVelocity.x,previousVelocity.y);
            peakAcceleration=Math.max(peakAcceleration,Math.hypot(velocity.x-previousVelocity.x,velocity.y-previousVelocity.y)/.005);
            if(speed>.6 && previousSpeed>.6) {
              const dot=(velocity.x*previousVelocity.x+velocity.y*previousVelocity.y)/(speed*previousSpeed);
              maxTurn=Math.max(maxTurn,Math.acos(Math.max(-1,Math.min(1,dot)))*180/Math.PI);
            }
          }
          previousVelocity=velocity;
        }
        for(let i=1;i<motions.length;i++) {
          const m=motions[i],node=document.createElementNS('http://www.w3.org/2000/svg','path');
          node.setAttribute('d',m.pathFor(label));
          let actualLength=0,last=m.sample(0).positions.get(label);
          for(let n=1;n<=1200;n++) {
            const p=m.sample(m.duration*n/1200).positions.get(label);
            actualLength+=distance(last,p);last=p;
          }
          pathLengthError=Math.max(pathLengthError,Math.abs(node.getTotalLength()/unit-actualLength));
        }
        metrics[label]={maxTurn,peakSpeed,peakAcceleration,minimumSpeed:Number.isFinite(minimumSpeed)?minimumSpeed:null,pathLengthError};
      }
      let minimumApproachGap=Infinity;
      for(let n=0;n<=1000;n++) {
        const p=motions[1].sample(motions[1].duration*n/1000).positions;
        for(const [a,b] of [['4','X3'],['5','X5']]) minimumApproachGap=Math.min(minimumApproachGap,distance(p.get(a),p.get(b)));
      }
      const speedAt=(label,time)=>distance(sample(time-1,label),sample(time+1,label))/.002;
      const pairs={};
      for(let i=1;i<motions.length;i++) for(let n=0;n<=300;n++) {
        const p=[...motions[i].sample(motions[i].duration*n/300).positions];
        for(let a=0;a<p.length;a++) for(let b=a+1;b<p.length;b++) {
          const key=`${p[a][0]}-${p[b][0]}`,gap=distance(p[a][1],p[b][1]);
          if(!pairs[key] || gap<pairs[key].gap) pairs[key]={gap,step:i,t:n/300};
        }
      }
      return {metrics,minimumApproachGap,closestPairs:Object.entries(pairs).sort((a,b)=>a[1].gap-b[1].gap).slice(0,5),
        screenSetBeforeCuts:distance(sample(starts[2]-200,'4'),sample(starts[2],'4'))<.001 && distance(sample(starts[2]-200,'5'),sample(starts[2],'5'))<.001,
        ballWaitsForPop:distance(sample(starts[3],'ball'),sample(starts[3]+200,'ball'))<.001,
        boundarySpeed2:speedAt('2',starts[3]),boundarySpeed3:speedAt('3',starts[3]),totalSeconds:total/1000};
    })()""")
    assert all(m["maxTurn"] < 5 and m["peakSpeed"] < 7 and m["pathLengthError"] < .015 for m in flow["metrics"].values()), flow
    assert all(flow["metrics"][label]["minimumSpeed"] > .6 for label in ["2","3"]), flow
    assert flow["screenSetBeforeCuts"] and flow["ballWaitsForPop"] and flow["minimumApproachGap"] > .97, flow
    assert flow["boundarySpeed2"] > 2 and flow["boundarySpeed3"] > 1, flow
    x2_screen = evaluate("""(() => {
      const play=PLAYBOOK_DATA.find(p=>p.id==='left-4'), unit=COURT.scale;
      const motions=play.steps.map((_,i)=>PlayMotion.compileStep(play,i));
      const at=(i,t,label)=>motions[i].sample(motions[i].duration*t).positions.get(label);
      const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y)/unit;
      const lineGap=(p,a,b)=>{
        const dx=b.x-a.x,dy=b.y-a.y;
        const t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy)));
        return dist(p,{x:a.x+t*dx,y:a.y+t*dy});
      };
      const before=at(2,.3,'X2'), following=at(2,.6,'X2');
      const blocked=at(2,.8,'X2'), stillBlocked=at(3,.08,'X2');
      const chaseStart=at(3,.2,'X2'),chasing=at(3,.7,'X2'),target=at(3,.7,'3');
      const alignment=((chasing.x-chaseStart.x)*(target.x-chaseStart.x)+(chasing.y-chaseStart.y)*(target.y-chaseStart.y))/(unit*unit);
      let minimumSpacing=Infinity,neverRetreatsUnderScreen=true;
      for(let i=2;i<motions.length;i++) for(let n=0;n<=600;n++) {
        const t=n/600,p=motions[i].sample(motions[i].duration*t).positions;
        minimumSpacing=Math.min(minimumSpacing,dist(p.get('X2'),p.get('5')),dist(p.get('X2'),p.get('3')));
        if((i>2 || t>=.65) && p.get('X2').y<p.get('5').y) neverRetreatsUnderScreen=false;
      }
      return {
        followsCut:following.x<before.x && following.y>before.y,
        blockedDisplacement:dist(blocked,stillBlocked),
        cutterContinues:dist(at(2,.8,'3'),at(3,.08,'3')),
        directChaseScreenGap:lineGap(at(3,.08,'5'),stillBlocked,at(3,.08,'3')),
        screenIsStationary:dist(at(2,.8,'5'),at(3,.7,'5')),
        chasingDistance:dist(chaseStart,chasing),chasingAlignment:alignment,
        gapWhenBallArrives:dist(at(4,.9,'X2'),at(4,.9,'3')),
        finalGap:dist(at(5,1,'X2'),at(5,1,'3')),
        neverRetreatsUnderScreen,minimumSpacing,
        blockedCue:motions[2].sample(motions[2].duration*.8).cues.some(c=>c.actor==='X2' && c.tone==='blocked'),
        chaseCue:motions[3].sample(motions[3].duration*.7).cues.some(c=>c.actor==='X2' && c.text==='绕掩护追3号')
      };
    })()""")
    assert x2_screen["followsCut"] and x2_screen["blockedDisplacement"] < .001, x2_screen
    assert x2_screen["cutterContinues"] > .5 and x2_screen["directChaseScreenGap"] < .97, x2_screen
    assert x2_screen["screenIsStationary"] < .001 and x2_screen["minimumSpacing"] > .97, x2_screen
    assert x2_screen["chasingDistance"] > .5 and x2_screen["chasingAlignment"] > 0, x2_screen
    assert x2_screen["gapWhenBallArrives"] > 1.5 and x2_screen["finalGap"] < 1.2, x2_screen
    assert x2_screen["neverRetreatsUnderScreen"] and x2_screen["blockedCue"] and x2_screen["chaseCue"], x2_screen
    screenshot("preview-left4.png")
    seek_step(2,.68)
    screenshot("preview-left4-simultaneous.png")
    seek_step(2,.95)
    screenshot("preview-left4-x2-blocked.png")
    seek_step(3,.68)
    assert evaluate("getComputedStyle(document.querySelector('.motion-path.chase')).stroke === 'rgb(117, 186, 255)'"), "Missing defensive route styling"
    screenshot("preview-left4-x2-chase.png")
    seek_step(3,.97)
    screenshot("preview-left4-pop.png")
    seek_step(5,.2)
    screenshot("preview-left4-highpost.png")
    full_left4 = evaluate("""(async () => {
      document.querySelector('#reset-btn').click();
      document.querySelector('#speed').value='1.5';
      document.querySelector('#play-btn').click();
      const end=performance.now()+11000;
      while(performance.now()<end){
        await new Promise(resolve=>setTimeout(resolve,100));
        if(document.querySelector('#court').dataset.step==='5'
          && Number(document.querySelector('#court').dataset.elapsed)>=PLAYBOOK_DATA.find(p=>p.id==='left-4').steps.at(-1).duration
          && document.querySelector('#play-btn span').textContent==='播放') {
          document.querySelector('#speed').value='1';
          return {completed:true, step:document.querySelector('#step-readout').textContent};
        }
      }
      return {completed:false};
    })()""")
    assert full_left4["completed"], full_left4
    command("Emulation.setDeviceMetricsOverride", {
        "width":390, "height":1100, "deviceScaleFactor":1, "mobile":False
    })
    seek_step(5,.2)
    left4_phone = evaluate("document.documentElement.scrollWidth<=innerWidth && document.querySelector('#decision-panel').hidden")
    assert left4_phone, "Left4 mobile layout overflow"
    screenshot("preview-left4-mobile.png")
    # Direct links must open the selected tactic instead of always reverting to left2.
    evaluate("location.reload()")
    deadline=time.monotonic()+10
    while not evaluate("document.querySelector('#play-title')?.textContent==='左4' && !!document.querySelector('#offense-layer .player-piece')"):
        if time.monotonic()>deadline:
            raise TimeoutError("Left4 direct link failed")
        time.sleep(.1)

    variants = evaluate("""(() => {
      const axis=2*COURT.padding+COURT.dimensions.width*COURT.scale,unit=COURT.scale;
      const results={};
      const pointError=(a,b)=>Math.hypot(a.x+b.x-axis,a.y-b.y)/unit;
      for(const [number,branch] of [[2,'left'],[2,'right'],[4,null]]) {
        const left=PlayMotion.resolvePlay(PLAYBOOK_DATA.find(p=>p.id===`left-${number}`),branch?{'screen-direction':branch}:{});
        const other=branch==='left'?'right':'left';
        const right=PlayMotion.resolvePlay(PLAYBOOK_DATA.find(p=>p.id===`right-${number}`),branch?{'screen-direction':other}:{});
        let actorError=0,ballError=0,pathError=0,normalError=0;
        for(let i=0;i<left.steps.length;i++) {
          const lm=PlayMotion.compileStep(left,i),rm=PlayMotion.compileStep(right,i);
          if(lm.duration!==rm.duration) throw Error('Mirrored durations differ');
          for(let n=0;n<=300;n++) {
            const a=lm.sample(lm.duration*n/300),b=rm.sample(rm.duration*n/300);
            a.positions.forEach((p,label)=>actorError=Math.max(actorError,pointError(p,b.positions.get(label))));
            ballError=Math.max(ballError,pointError(a.ball,b.ball));
          }
          for(const label of Object.keys(left.routes)) {
            const a=document.createElementNS('http://www.w3.org/2000/svg','path'),b=a.cloneNode();
            a.setAttribute('d',lm.pathFor(label));b.setAttribute('d',rm.pathFor(label));
            if(!a.getTotalLength()) continue;
            for(let n=0;n<=50;n++) pathError=Math.max(pathError,pointError(a.getPointAtLength(a.getTotalLength()*n/50),b.getPointAtLength(b.getTotalLength()*n/50)));
          }
          const a=(left.steps[i].paths||[]).filter(p=>p.type==='screen');
          const b=(right.steps[i].paths||[]).filter(p=>p.type==='screen');
          a.forEach((p,n)=>normalError=Math.max(normalError,Math.abs(p.screenNormal.x+b[n].screenNormal.x),Math.abs(p.screenNormal.y-b[n].screenNormal.y)));
        }
        results[`${number}-${branch||'zone'}`]={actorError,ballError,pathError,normalError,status:right.status,branchLabel:branch?right.selected[0].option.label:null};
      }
      const pace={};
      for(const choice of ['left','right']) {
        const p=PlayMotion.resolvePlay(PLAYBOOK_DATA[0],{'screen-direction':choice});
        const motions=p.steps.map((_,i)=>PlayMotion.compileStep(p,i));
        const starts=[];let total=0;
        motions.forEach((m,i)=>{starts[i]=total;total+=m.duration;});
        const sample=(time,label)=>{
          let i=motions.length-1;while(i>1 && time<starts[i])i--;
          return motions[i].sample(time-starts[i]).positions.get(label);
        };
        for(const label of ['2','4','X2','X4']) {
          let peakSpeed=0,maxTurn=0,previous=null;
          for(let t=0;t<total-10;t+=5) {
            const a=sample(t,label),b=sample(t+5,label),v={x:(b.x-a.x)/unit/.005,y:(b.y-a.y)/unit/.005};
            const speed=Math.hypot(v.x,v.y);peakSpeed=Math.max(peakSpeed,speed);
            if(previous && speed>.6 && previous.speed>.6) {
              const dot=(v.x*previous.x+v.y*previous.y)/(speed*previous.speed);
              maxTurn=Math.max(maxTurn,Math.acos(Math.max(-1,Math.min(1,dot)))*180/Math.PI);
            }
            previous={...v,speed};
          }
          pace[`${choice}-${label}`]={peakSpeed,maxTurn};
        }
      }
      return {mirrors:results,pace,ready:PLAYBOOK_DATA.filter(p=>p.status==='ready').map(p=>p.id)};
    })()""")
    assert set(variants["ready"]) == {"left-2","right-2","left-3","right-3","left-4","right-4"}, variants
    for name, result in variants["mirrors"].items():
        assert result["actorError"] < .001 and result["ballError"] < .001 and result["pathError"] < .003 and result["normalError"] < .001, {name:result}
    assert variants["mirrors"]["2-left"]["branchLabel"] == "右挡 · 走中路", variants
    assert variants["mirrors"]["2-right"]["branchLabel"] == "左挡 · 走底线", variants
    assert all(p["peakSpeed"] < 7 and p["maxTurn"] < 5 for p in variants["pace"].values()), variants
    command("Emulation.setDeviceMetricsOverride", {"width":1440,"height":1440,"deviceScaleFactor":1,"mobile":False})
    screen_markers = []
    for play_id, choice in [("left-2","left"),("left-2","right"),("right-2","right"),("right-2","left"),("left-4",None),("right-4",None)]:
        evaluate(f"document.querySelector('[data-play-id={play_id}]').click()")
        if choice:
            seek_step(2,0)
            evaluate(f"document.querySelector('[data-choice={choice}]').click()")
        seek_step(2 if choice else 1,.9)
        caps = evaluate("""[...document.querySelectorAll('.motion-path.screen')].filter(n=>getComputedStyle(n).display!=='none').map(n=>{
          const m=document.querySelector(`[data-player='${n.dataset.screener}']`).transform.baseVal.consolidate().matrix;
          const a=n.getAttribute('d').match(/-?\\d+(?:\\.\\d+)?(?:e[-+]?\\d+)?/gi).map(Number);
          return {actor:n.dataset.screener,layer:n.parentElement.id,gap:Math.hypot((a[0]+a[2])/2-m.e,(a[1]+a[3])/2-m.f),length:Math.hypot(a[0]-a[2],a[1]-a[3])};
        })""")
        assert len(caps) == (1 if choice else 2), (play_id,choice,caps)
        assert all(abs(c["gap"]-34)<.001 and abs(c["length"]-48)<.001 and c["layer"] == "screen-layer" for c in caps), caps
        screen_markers.append({"play":play_id,"choice":choice,"caps":caps})
        if play_id == "left-4": screenshot("preview-left4-screens.png")
        if play_id == "right-2" and choice == "right": screenshot("preview-right2-screen.png")
    right_playback = {}
    for play_id in ["right-2","right-4"]:
        evaluate(f"document.querySelector('[data-play-id={play_id}]').click()")
        result = evaluate("""(async()=>{
          const play=PLAYBOOK_DATA.find(p=>p.id===location.hash.slice(1));
          document.querySelector('#speed').value='1.5';document.querySelector('#play-btn').click();
          let gated=false;const end=performance.now()+13000;
          while(performance.now()<end) {
            await new Promise(resolve=>setTimeout(resolve,100));
            if(document.querySelector('#decision-panel').classList.contains('needs-choice') && !document.querySelector('#decision-panel').hidden) {
              gated=true;document.querySelector(`[data-choice='${play.decisions[0].defaultOption}']`).click();
            }
            if(document.querySelector('#court').dataset.step===String(play.steps.length-1)
              && Number(document.querySelector('#court').dataset.elapsed)>=play.steps.at(-1).duration
              && document.querySelector('#play-btn span').textContent==='播放') {
              document.querySelector('#speed').value='1';return {completed:true,gated};
            }
          }
          return {completed:false,gated};
        })()""")
        assert result["completed"] and result["gated"] == (play_id=="right-2"), (play_id,result)
        right_playback[play_id] = result
        screenshot("preview-" + play_id.replace("-","") + ".png")
    nav = evaluate("""({groups:[...document.querySelectorAll('#play-list > details')].map(n=>({title:n.querySelector('summary strong').textContent,children:[...n.querySelectorAll('.play-item')].map(b=>b.dataset.playId)})),count:document.querySelector('#play-count').textContent})""")
    assert [g["title"] for g in nav["groups"]] == ["2号战术","3号战术","4号战术"] and nav["count"] == "3 套", nav
    assert all(len(g["children"]) == 2 for g in nav["groups"]), nav
    # Mobile grouping stays within the viewport and selecting a child retains its parent.
    command("Emulation.setDeviceMetricsOverride", {"width":390,"height":1100,"deviceScaleFactor":1,"mobile":False})
    evaluate("document.querySelector('[data-play-id=right-2]').click()")
    assert evaluate("document.documentElement.scrollWidth<=innerWidth && document.querySelector('[data-play-id=right-2]').closest('details').open"), "Grouped mobile navigation overflow"
    screenshot("preview-navigation-mobile.png")
    evaluate("document.querySelector('[data-play-id=left-4]').click()")
    right3 = check_right3(evaluate, seek_step, screenshot, command)
    coaching = check_coaching(evaluate)
    layout = check_layout(evaluate, command, screenshot)
    bilingual = check_i18n(evaluate, command, screenshot)
    assert not browser_errors, browser_errors
    print(json.dumps({"geometry":geometry, "timing":timing, "controls":controls, "playback":playback, "branches":branches, "smoothness":smoothness,
      "left4":left4,"left4Flow":flow,"left4X2Screen":x2_screen,"left4Playback":full_left4,
      "switches":{"right":switch_right,"left":switch_left},
      "phases":{"blocked":blocked, "help":help_phase, "roll":roll_phase}, "mobile":phone,
      "variants":variants,"screenMarkers":screen_markers,"rightPlayback":right_playback,"navigation":nav,"right3":right3,"coaching":coaching,"layout":layout,"bilingual":bilingual},
      ensure_ascii=False, indent=2))

finally:
    if connection:
        try:
            command("Browser.close")
        except Exception:
            pass
        connection.close()
    if process:
        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            process.terminate()
    # Chrome may retain short-lived child processes; let the OS clear temp data if locked.
    shutil.rmtree(profile, ignore_errors=True)
