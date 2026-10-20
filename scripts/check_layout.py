"""Real-browser checks for side-by-side / sticky study layout and player locators."""


def check(evaluate, command, screenshot):
    results = []
    for width, height in [(1440,900),(1280,720),(1024,768),(820,1180),(820,768),(701,768),(700,900),(390,844),(360,740),(320,640)]:
        command('Emulation.setDeviceMetricsOverride', {'width':width,'height':height,'deviceScaleFactor':1,'mobile':False})
        evaluate("document.querySelector('[data-play-id=left-4]').click();window.scrollTo(0,0)")
        result = evaluate("""(async()=>{
          await new Promise(resolve=>requestAnimationFrame(resolve));
          const rect=n=>{const r=n.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom,right:r.right};};
          const panel=document.querySelector('.detail-panel'),board=document.querySelector('.board-panel');
          const initial={board:rect(board),notes:rect(panel)};
          if(document.querySelector('#status-badge,.status-dot,.family-status'))throw Error('Completion decorations remain');
          if(document.querySelector('#coaching-view').hidden||!document.querySelector('#steps-view').hidden)throw Error('Coaching must be the default view');
          const reference=document.querySelector('#coaching-points [data-locate-player="4"]');reference.click();
          if(!document.querySelector('[data-player="4"]').classList.contains('is-highlighted')||document.querySelectorAll('.is-dimmed').length!==9)throw Error('Player locator failed');
          if(reference.getAttribute('aria-pressed')!=='true'||document.querySelector('.roster-player[data-locate-player="4"]').getAttribute('aria-pressed')!=='true')throw Error('Locator state not synchronized');
          document.querySelector('.roster-player[data-locate-player="4"]').click();
          if(document.querySelector('.is-highlighted,.is-dimmed'))throw Error('Locator did not toggle off');
          document.querySelector('#steps-tab').click();
          if(!document.querySelector('#coaching-view').hidden||document.querySelector('#steps-view').hidden)throw Error('Steps tab failed');
          document.querySelector('#steps-tab').dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowLeft',bubbles:true}));
          if(document.querySelector('#coaching-view').hidden||document.activeElement.id!=='coaching-tab')throw Error('Keyboard tabs failed');
          document.activeElement.blur();
          const last=document.querySelector('#coaching-points li:last-child');
          if(innerWidth<=700){
            const desired=last.getBoundingClientRect().top+scrollY-board.offsetHeight-90;
            window.scrollTo(0,Math.max(0,desired));
          }else panel.scrollTop=panel.scrollHeight;
          await new Promise(resolve=>requestAnimationFrame(resolve));
          const b=rect(board),lastRect=rect(last);
          const visiblePlayers=[...document.querySelectorAll('.player-piece')].every(n=>{const r=n.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight&&r.left>=0&&r.right<=innerWidth;});
          const result={width:innerWidth,height:innerHeight,overflow:document.documentElement.scrollWidth>innerWidth,initial,board:b,last:lastRect,visiblePlayers};
          if(result.overflow)throw Error('Horizontal overflow '+JSON.stringify(result));
          if(b.y<0||b.bottom>innerHeight+1||!visiblePlayers)throw Error('Court not visible while reading '+JSON.stringify(result));
          if(innerWidth<=700&&(lastRect.y<b.bottom||lastRect.bottom>innerHeight+1))throw Error('Last point not visible below sticky court '+JSON.stringify(result));
          if(innerWidth>700&&initial.notes.x<=initial.board.right)throw Error('Desktop notes not alongside court');
          return result;
        })()""")
        results.append(result)
        if width == 1440:
            screenshot('preview-study-desktop.png', {'x':0,'y':0,'width':width,'height':height})
        if width == 390:
            screenshot('preview-study-mobile.png', {'x':0,'y':evaluate('scrollY'),'width':width,'height':height})
            target = evaluate("""(()=>{const n=document.querySelector('#coaching-points li:last-child [data-locate-player="4"]'),r=n.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()""")
            command('Input.dispatchMouseEvent', {'type':'mousePressed','x':target['x'],'y':target['y'],'button':'left','clickCount':1})
            command('Input.dispatchMouseEvent', {'type':'mouseReleased','x':target['x'],'y':target['y'],'button':'left','clickCount':1})
            assert evaluate("document.querySelector('[data-player=\"4\"]').classList.contains('is-highlighted')"), 'Visible mobile locator cannot be clicked'
            screenshot('preview-study-player-focus.png', {'x':0,'y':evaluate('scrollY'),'width':width,'height':height})
    # A decision lives in the reading column and never resizes the court.
    command('Emulation.setDeviceMetricsOverride', {'width':1440,'height':900,'deviceScaleFactor':1,'mobile':False})
    evaluate("document.querySelector('[data-play-id=right-3]').click();window.scrollTo(0,0)")
    decision = evaluate("""(()=>{
      const board=document.querySelector('.board-panel'),before=board.getBoundingClientRect().height;
      document.querySelectorAll('#timeline li')[5].click();
      const after=board.getBoundingClientRect().height;
      if(before!==after||document.querySelector('#decision-panel').hidden)throw Error('Decision should not resize the court');
      return {before,after};
    })()""")
    screenshot('preview-study-decision.png', {'x':0,'y':0,'width':1440,'height':900})
    return {'sizes':results,'decision':decision}
