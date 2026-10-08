const hint=document.querySelector('.cue');
function dismiss(){if(scrollY>32){hint.hidden=true;removeEventListener('scroll',dismiss);}}
addEventListener('scroll',dismiss,{passive:true});dismiss();
