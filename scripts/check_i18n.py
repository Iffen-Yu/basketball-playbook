"""Check English coverage, identical motion, live language switching and mobile layout."""


def check(evaluate, command, screenshot):
    coverage = evaluate(r"""(()=>{
      if(PlaybookI18n.missingEnglish().length)throw Error(JSON.stringify(PlaybookI18n.missingEnglish()));
      const zh=PlaybookI18n.getPlays();PlaybookI18n.setLanguage('en');const en=PlaybookI18n.getPlays();
      const untranslated=[];let maxError=0,cases=0;
      const checkText=(value,path)=>{if(typeof value==='string'&&/[\u3400-\u9fff]/.test(value))untranslated.push(path+': '+value);else if(Array.isArray(value))value.forEach((v,i)=>checkText(v,path+'.'+i));else if(value&&typeof value==='object')Object.entries(value).forEach(([k,v])=>checkText(v,path+'.'+k));};
      en.forEach((p,index)=>{
        checkText(p,p.id);
        const choices=p.id.endsWith('-2')?p.decisions[0].options.map(o=>({'screen-direction':o.id})):p.id.endsWith('-3')?[
          {'high-low-read':'self'},{'high-low-read':'inside'},{'high-low-read':'continue','shooter-read':'corner'},{'high-low-read':'continue','shooter-read':'wing'}]:[{}];
        for(const choice of choices){
          const a=PlayMotion.resolvePlay(zh[index],choice),b=PlayMotion.resolvePlay(p,choice);cases++;
          if(a.steps.length!==b.steps.length||JSON.stringify(a.decisions.map(d=>[d.id,d.atStep,d.defaultOption]))!==JSON.stringify(b.decisions.map(d=>[d.id,d.atStep,d.defaultOption])))throw Error('Decision structure changed');
          for(let i=0;i<a.steps.length;i++){
            const x=PlayMotion.compileStep(a,i),y=PlayMotion.compileStep(b,i);
            if(x.duration!==y.duration)throw Error('Timing changed');
            for(const t of [0,.17,.5,.83,1]){
              const s=x.sample(x.duration*t),v=y.sample(y.duration*t);
              for(const [label,q] of s.positions){const r=v.positions.get(label);maxError=Math.max(maxError,Math.hypot(q.x-r.x,q.y-r.y));}
              maxError=Math.max(maxError,Math.hypot(s.ball.x-v.ball.x,s.ball.y-v.ball.y));
            }
          }
        }
      });
      if(untranslated.length||maxError>.000001)throw Error(JSON.stringify({untranslated,maxError}));
      PlaybookI18n.setLanguage('zh');
      return {plays:en.length,cases,maxError,missing:untranslated};
    })()""")
    state = evaluate(r"""(()=>{
      document.querySelector('[data-play-id=right-3]').click();
      document.querySelector('#steps-tab').click();document.querySelector('[data-locate-player="4"]').click();
      document.querySelectorAll('#timeline li')[3].click();
      const slider=document.querySelector('#step-progress');slider.value='720';slider.dispatchEvent(new Event('input',{bubbles:true}));
      const snapshot=()=>({step:document.querySelector('#court').dataset.step,time:document.querySelector('#court').dataset.elapsed,
        positions:[...document.querySelectorAll('.player-piece,#ball-layer g')].map(n=>n.getAttribute('transform')),
        branch:document.querySelector('#court').dataset.branch,focus:document.querySelector('.is-highlighted')?.dataset.player,
        tab:document.querySelector('[role=tab][aria-selected=true]').id,speed:document.querySelector('#speed').value});
      const before=snapshot();document.querySelector('[data-language=en]').click();const after=snapshot();
      if(JSON.stringify(before)!==JSON.stringify(after))throw Error('Language switch changed playback state '+JSON.stringify({before,after}));
      if(document.documentElement.lang!=='en'||document.querySelector('#play-title').textContent!=='Right 3')throw Error('English did not render');
      if(document.querySelector('#play-btn span').textContent!=='Play'||document.querySelector('#decision-panel').hidden!==true)throw Error('Paused state or early decision changed');
      if([...document.querySelectorAll('.court-cue text')].some(n=>/[\u3400-\u9fff]/.test(n.textContent)))throw Error('Chinese court annotations remain');
      document.querySelectorAll('#timeline li')[5].click();
      document.querySelector('[data-language=zh]').click();document.querySelector('[data-language=en]').click();
      if(!document.querySelector('#decision-panel').classList.contains('needs-choice')||document.querySelector('#play-btn span').textContent!=='Play')throw Error('Pending choice was lost on language switch');
      document.querySelector('[data-choice=inside]').click();
      slider.value='500';slider.dispatchEvent(new Event('input',{bubbles:true}));
      const chosen=snapshot();document.querySelector('[data-language=zh]').click();const restored=snapshot();
      if(JSON.stringify(chosen)!==JSON.stringify(restored)||document.querySelectorAll('#timeline li').length!==7)throw Error('Chosen branch changed on language switch');
      document.querySelector('[data-language=en]').click();
      if(localStorage.getItem('playbook-language')!=='en'||new URLSearchParams(location.search).get('lang')!=='en')throw Error('Language preference not saved');
      document.querySelector('#coaching-tab').click();
      return {preserved:true,pendingPreserved:true,branchPreserved:true,preferenceSaved:true};
    })()""")
    sizes = []
    for width, height in [(1440,900),(1024,768),(390,844),(360,740),(320,640)]:
        command('Emulation.setDeviceMetricsOverride', {'width':width,'height':height,'deviceScaleFactor':1,'mobile':False})
        for play in ['left-2','right-2','left-3','right-3','left-4','right-4']:
            evaluate(f"document.querySelector('[data-play-id={play}]').click();window.scrollTo(0,0)")
            result = evaluate(r"""(async()=>{
              await new Promise(resolve=>requestAnimationFrame(resolve));
              if(document.documentElement.scrollWidth>innerWidth)throw Error('English page overflows '+innerWidth);
              const root=document.querySelector('main');
              if(/[\u3400-\u9fff]/.test(root.innerText))throw Error('Untranslated visible English UI: '+root.innerText);
              const last=document.querySelector('#coaching-points li:last-child'),board=document.querySelector('.board-panel');
              if(innerWidth<=700)window.scrollTo(0,Math.max(0,last.getBoundingClientRect().top+scrollY-board.offsetHeight-85));
              else document.querySelector('.detail-panel').scrollTop=10000;
              await new Promise(resolve=>requestAnimationFrame(resolve));
              const b=board.getBoundingClientRect(),p=last.getBoundingClientRect();
              if(b.top<0||b.bottom>innerHeight+1)throw Error('English notes obscure court');
              if(innerWidth<=700&&(p.top<b.bottom||p.bottom>innerHeight+1))throw Error('English final point not readable with court '+JSON.stringify({width:innerWidth,bottom:b.bottom,pointTop:p.top,pointBottom:p.bottom,height:innerHeight}));
              return {width:innerWidth,play:location.hash.slice(1),courtVisible:true,notesReadable:true};
            })()""")
            sizes.append(result)
            if play == 'left-4' and width in [1440,390]:
                screenshot('preview-english-'+('desktop' if width==1440 else 'mobile')+'.png',{'x':0,'y':evaluate('scrollY'),'width':width,'height':height})
    # Switch while actually running; time must continue rather than restart.
    running = evaluate(r"""(async()=>{
      document.querySelector('[data-play-id=left-4]').click();document.querySelector('#play-btn').click();
      await new Promise(resolve=>setTimeout(resolve,220));
      const before=Number(document.querySelector('#court').dataset.elapsed);
      document.querySelector('[data-language=zh]').click();
      const immediate=Number(document.querySelector('#court').dataset.elapsed);
      await new Promise(resolve=>setTimeout(resolve,140));
      const after=Number(document.querySelector('#court').dataset.elapsed);
      if(before!==immediate||after<=before||document.querySelector('#play-btn span').textContent!=='暂停')throw Error('Live language switch reset or stopped playback');
      document.querySelector('#play-btn').click();
      return {before,immediate,after};
    })()""")
    return {'coverage':coverage,'state':state,'sizes':sizes,'running':running}
