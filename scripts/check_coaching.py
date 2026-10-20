"""Check concise offensive coaching notes in all rendered tactic branches."""


def check(evaluate):
    return evaluate(r"""(() => {
      const results=[];
      const pause=()=>{const slider=document.querySelector('#step-progress');slider.value='0';slider.dispatchEvent(new Event('input',{bubbles:true}));};
      for(const base of PLAYBOOK_DATA.filter(p=>p.status==='ready')) {
        const variants=base.id.endsWith('-2')?base.decisions[0].options.map(o=>({'screen-direction':o.id}))
          :base.id.endsWith('-3')?[
            {'high-low-read':'self'},{'high-low-read':'inside'},
            {'high-low-read':'continue','shooter-read':'corner'},
            {'high-low-read':'continue','shooter-read':'wing'}]:[{}];
        for(const choices of variants){
          document.querySelector(`[data-play-id=${base.id}]`).click();
          for(const decision of base.decisions||[]){
            if(!choices[decision.id])continue;
            document.querySelectorAll('#timeline li')[decision.atStep].click();
            document.querySelector(`[data-choice=${choices[decision.id]}]`).click();pause();
          }
          const expected=PlayMotion.resolvePlay(base,choices).coachingPoints;
          const actual=[...document.querySelectorAll('#coaching-points li')].map(n=>n.textContent);
          if(JSON.stringify(actual)!==JSON.stringify(expected))throw Error(base.id+' stale coaching notes');
          if(actual.length!==5)throw Error(base.id+' should have five focused points');
          const labels=actual.map(s=>s.split('：')[0]);
          if(new Set(labels).size!==5||labels.some(s=>s.length<2||s.length>6))throw Error(base.id+' missing concise labels');
          if(actual.some(s=>s.length>80||/^[^：]*：X\d|X\d的目标|动画示范|不能画成|教学用|X\d先减速|X\d需要转身/.test(s)))throw Error(base.id+' includes defensive or implementation advice');
          results.push({play:base.id,choices,points:actual});
        }
      }
      document.querySelector('#reset-btn').click();
      return results;
    })()""")
