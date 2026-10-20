"""Tactic 3 assertions, shared by the real-browser regression harness."""


def check(evaluate, seek_step, screenshot, command):
    visibility = evaluate(r"""(() => {
      const results=[];
      for(const id of ['left-2','right-2','left-3','right-3','left-4','right-4']) {
        document.querySelector(`[data-play-id=${id}]`).click();
        const panel=document.querySelector('#decision-panel'),options=document.querySelector('#decision-options');
        if(!panel.hidden||options.children.length||panel.classList.contains('needs-choice'))throw Error(id+' reveals choices at step 1');
        const base=PLAYBOOK_DATA.find(p=>p.id===id),node=base.decisions?.[0];
        if(node){
          document.querySelectorAll('#timeline li')[node.atStep-1].click();
          if(!panel.hidden)throw Error(id+' reveals choices before its node');
          document.querySelectorAll('#timeline li')[base.steps.length-1].click();
          if(panel.hidden||!panel.classList.contains('needs-choice')||Number(document.querySelector('#court').dataset.step)!==node.atStep)throw Error(id+' failed to gate at its first node');
          if([...options.children].some(n=>n.dataset.decision!==node.id))throw Error(id+' reveals a future node');
          document.querySelectorAll('#timeline li')[0].click();
          if(!panel.hidden||options.children.length||panel.classList.contains('needs-choice'))throw Error(id+' failed to hide choices on rewind');
          document.querySelectorAll('#timeline li')[node.atStep].click();
          document.querySelector(`[data-choice=${node.defaultOption}]`).click();
          document.querySelector('#reset-btn').click();
          if(!panel.hidden||options.children.length)throw Error(id+' failed to hide choices on reset');
        }
        results.push({id,startHidden:true,rewindHidden:true,resetHidden:true});
      }
      return results;
    })()""")
    metrics = evaluate(r"""(() => {
      const base=PLAYBOOK_DATA.find(p=>p.id==='right-3'), left=PLAYBOOK_DATA.find(p=>p.id==='left-3');
      const unit=60, distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y)/unit, results={};
      for(const first of ['self','inside','continue']) for(const second of first==='continue'?['corner','wing']:['corner']) {
        const choices={'high-low-read':first,'shooter-read':second};
        const p=PlayMotion.resolvePlay(base,choices), q=PlayMotion.resolvePlay(left,choices);
        const motions=p.steps.map((_,i)=>PlayMotion.compileStep(p,i)), mirror=q.steps.map((_,i)=>PlayMotion.compileStep(q,i));
        let continuity=0,ballContinuity=0,mirrorError=0,minGap=Infinity,gapAt=null,ownerError=0,passDefenderGap=Infinity,passAt=null;
        for(let i=1;i<motions.length;i++) {
          const m=motions[i],before=motions[i-1].sample(motions[i-1].duration),start=m.sample(0);
          for(const [label,a] of before.positions) continuity=Math.max(continuity,distance(a,start.positions.get(label)));
          ballContinuity=Math.max(ballContinuity,distance(before.ball,start.ball));
          for(let t=0;t<=1.00001;t+=.005) {
            const a=m.sample(m.duration*t),b=mirror[i].sample(m.duration*t),entries=[...a.positions];
            for(const [label,v] of entries) {
              const w=b.positions.get(label);mirrorError=Math.max(mirrorError,Math.hypot(v.x+w.x-960,v.y-w.y)/unit);
              if(v.x<59||v.x>901||v.y<59||v.y>841)throw Error('Out of bounds '+label);
              if(label.startsWith('X')&&p.steps[i].paths.some(path=>path.type==='pass')){const gap=distance(a.ball,v);if(gap<passDefenderGap){passDefenderGap=gap;passAt={label,step:i,t};}}
            }
            mirrorError=Math.max(mirrorError,Math.hypot(a.ball.x+b.ball.x-960,a.ball.y-b.ball.y)/unit);
            for(let j=0;j<entries.length;j++) for(let k=j+1;k<entries.length;k++) {
              const gap=distance(entries[j][1],entries[k][1]);
              if(gap<minGap){minGap=gap;gapAt={step:i,t,pair:[entries[j][0],entries[k][0]]};}
            }
            if(p.steps[i].ballOwner) {
              const owner=a.positions.get(p.steps[i].ballOwner),offset=p.steps[i].ballOffset||{x:-27,y:0};
              ownerError=Math.max(ownerError,distance(a.ball,{x:owner.x+offset.x,y:owner.y+offset.y}));
            }
          }
        }
        const starts=[];let total=0;motions.forEach((m,i)=>{starts[i]=total;total+=m.duration;});
        const sample=(time,label)=>{let i=motions.length-1;while(i>1&&time<starts[i])i--;return motions[i].sample(time-starts[i]).positions.get(label);};
        let peakSpeed=0,maxTurn=0,turnAt=null;
        for(const label of ['1','2','3','4','5','X1','X2','X3','X4','X5']) {
          let prior=null;
          for(let t=0;t<total-10;t+=5){
            const a=sample(t,label),b=sample(t+5,label),v={x:(b.x-a.x)/unit/.005,y:(b.y-a.y)/unit/.005};
            const speed=Math.hypot(v.x,v.y);peakSpeed=Math.max(peakSpeed,speed);
            if(prior&&speed>.6&&prior.speed>.6){const angle=Math.acos(Math.max(-1,Math.min(1,(v.x*prior.x+v.y*prior.y)/(speed*prior.speed))))*180/Math.PI;if(angle>maxTurn){maxTurn=angle;turnAt={label,t,speed};}}
            prior={...v,speed};
          }
        }
        const flash=motions[3].sample(motions[3].duration*.72),end=motions.at(-1).sample(motions.at(-1).duration);
        const seal=motions[3].sample(motions[3].duration*.7),set=motions[2].sample(0);
        results[first+'-'+second]={steps:p.steps.length,decisions:p.decisions.length,continuity,ballContinuity,mirrorError,minGap,gapAt,ownerError,peakSpeed,maxTurn,turnAt,passDefenderGap,passAt,
          flashError:distance(flash.positions.get('5'),COURT.point(7.5,5.8)),
          cutterDistanceAtFlash:distance(flash.positions.get('1'),COURT.point(7.5,1.2)),
          screenHold:distance(set.positions.get('4'),seal.positions.get('4')),
          x3Delay:distance(set.positions.get('X3'),seal.positions.get('X3')),
          x1Above:Math.min(...motions.slice(2).map(m=>m.sample(m.duration).positions.get('X1').y))>=COURT.point(0,6.4).y,
          finalBallOwnerDistance:distance(end.ball,end.positions.get(first==='inside'?'1':first==='self'?'5':second==='corner'?'1':'3'))};
      }
      return results;
    })()""")
    for name, item in metrics.items():
        assert item['steps'] == (10 if name.startswith('continue') else 7), (name, item)
        assert item['decisions'] == (2 if name.startswith('continue') else 1), (name, item)
        assert item['continuity'] < .001 and item['ballContinuity'] < .001, (name, item)
        assert item['mirrorError'] < .001 and item['ownerError'] < .001, (name, item)
        assert item['flashError'] < .001 and item['cutterDistanceAtFlash'] > 2, (name, item)
        assert item['screenHold'] < .001 and item['x3Delay'] < .3 and item['x1Above'], (name, item)
        assert item['finalBallOwnerDistance'] < .46, (name, item)
        assert item['peakSpeed'] < 8 and item['maxTurn'] < 6, (name, item)
        assert item['minGap'] >= .96, (name, item)
        assert item['passDefenderGap'] > .65, (name, item)

    command('Emulation.setDeviceMetricsOverride', {'width':1440,'height':1440,'deviceScaleFactor':1,'mobile':False})
    evaluate("document.querySelector('[data-play-id=right-3]').click()")
    screenshot('preview-right3-start.png')
    for choice in ['self','inside','continue']:
        seek_step(5,0)
        evaluate(f"document.querySelector('[data-choice={choice}]').click()")
        assert evaluate("document.querySelectorAll('#timeline li').length") == (10 if choice == 'continue' else 7)
    seek_step(2,.6)
    screenshot('preview-right3-handoff.png')
    seek_step(3,.72)
    screenshot('preview-right3-flash.png')
    seek_step(4,1)
    assert evaluate("""(()=>{const boxes=[...document.querySelectorAll('.court-cue')].map(n=>n.getBoundingClientRect());return boxes.every((a,i)=>boxes.every((b,j)=>i===j||a.right<=b.left||b.right<=a.left||a.bottom<=b.top||b.bottom<=a.top));})()"""), 'High/low labels overlap'
    screenshot('preview-right3-highlow.png')
    for choice in ['self','inside']:
        evaluate("document.querySelector('#reset-btn').click()")
        seek_step(5,0)
        evaluate(f"document.querySelector('[data-choice={choice}]').click()")
        seek_step(6,1)
        assert evaluate("document.querySelectorAll('#timeline li').length") == 7
        assert not evaluate("!!document.querySelector('[data-decision=shooter-read]')")
        screenshot('preview-right3-'+choice+'.png')
    evaluate("document.querySelector('#reset-btn').click()")
    seek_step(5,0)
    evaluate("document.querySelector('[data-choice=continue]').click()")
    seek_step(7,1)
    assert evaluate("!document.querySelector('[data-decision=shooter-read]') && !!document.querySelector('[data-decision=high-low-read]')"), 'Second decision revealed too early'
    seek_step(8,0)
    assert evaluate("!document.querySelector('#decision-panel').hidden && document.querySelector('#decision-panel').classList.contains('needs-choice') && !!document.querySelector('[data-decision=shooter-read]')"), 'Second decision missing at its node'
    for choice in ['corner','wing']:
        evaluate(f"document.querySelector('[data-choice={choice}]').click()")
        seek_step(9,1)
        screenshot('preview-right3-'+choice+'.png')
    # Reset keeps previews but must require confirmation at BOTH decision nodes.
    playback = evaluate(r"""(async()=>{
      document.querySelector('#reset-btn').click();document.querySelector('#speed').value='1.5';document.querySelector('#play-btn').click();
      const gates=[];const deadline=performance.now()+12000;
      while(performance.now()<deadline){
        await new Promise(resolve=>setTimeout(resolve,80));
        const step=Number(document.querySelector('#court').dataset.step),panel=document.querySelector('#decision-panel');
        if(step<5&&!panel.hidden)throw Error('Autoplay reveals first decision early');
        if(step<8&&document.querySelector('[data-decision=shooter-read]'))throw Error('Autoplay reveals second decision early');
        if(document.querySelector('#decision-panel').classList.contains('needs-choice')){
          const first=document.querySelector('.decision-option'),id=first.dataset.decision;gates.push(id);
          document.querySelector(`[data-choice=${id==='high-low-read'?'continue':'wing'}]`).click();
        }
        if(document.querySelector('#court').dataset.step==='9'&&Number(document.querySelector('#court').dataset.elapsed)>=650){
          document.querySelector('#speed').value='1';return {completed:true,gates};
        }
      }
      return {completed:false,gates};
    })()""")
    assert playback == {'completed':True,'gates':['high-low-read','shooter-read']}, playback
    # Mirrored version is navigable on a narrow screen without horizontal overflow.
    command('Emulation.setDeviceMetricsOverride', {'width':390,'height':1250,'deviceScaleFactor':1,'mobile':False})
    evaluate("document.querySelector('[data-play-id=left-3]').click()")
    seek_step(4,1)
    assert evaluate("document.documentElement.scrollWidth<=innerWidth && document.querySelector('#decision-panel').hidden")
    screenshot('preview-left3-mobile.png')
    seek_step(5,0)
    assert evaluate("document.documentElement.scrollWidth<=innerWidth && !document.querySelector('#decision-panel').hidden")
    screenshot('preview-left3-mobile-decision.png')
    return {'metrics':metrics,'playback':playback,'visibility':visibility}
