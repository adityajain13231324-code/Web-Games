'use strict';
(() => {
  const $ = s => document.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const normalize = s => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase();
  const categories = ['For Us','Gaming','Movies','Series','Anime','Memes & Relatable','Music & Other Interests'];
  let rows = [], filtered = [], shown = 48, category = '', active = null;
  let favorites;
  try { favorites = new Set(JSON.parse(localStorage.getItem('pp-library-favorites') || '[]')); } catch { favorites = new Set(); }
  const persist = () => { try { localStorage.setItem('pp-library-favorites',JSON.stringify([...favorites])); } catch {} };
  const typeLabel = row => ({'fan cosplay photograph':'Fan cosplay photo','portrait':'Licensed portrait','photograph':'Licensed photo','open game screenshot':'Open game screenshot'}[row.assetType] || row.assetType);
  const favoriteButton = row => `<button type="button" class="fav" data-favorite="${esc(row.id)}" aria-label="${favorites.has(row.id)?'Remove '+esc(row.title)+' from':'Add '+esc(row.title)+' to'} favorites" aria-pressed="${favorites.has(row.id)}">${favorites.has(row.id)?'♥':'♡'}</button>`;
  function toggleFavorite(id) {
    favorites.has(id) ? favorites.delete(id) : favorites.add(id); persist();
    if (active?.id === id) updateDetailFavorite();
    apply(false);
  }
  function updateDetailFavorite() { const on = favorites.has(active.id); $('#detail-favorite').textContent = on ? '♥ In your favorites' : '♡ Add to favorites'; $('#detail-favorite').setAttribute('aria-pressed',String(on)); }
  function optionList(id,values,first) { $(id).innerHTML = `<option value="">${first}</option>` + [...new Set(values)].sort((a,b)=>a.localeCompare(b)).map(s=>`<option value="${esc(s)}">${esc(s)}</option>`).join(''); }
  function apply(resetPage = true) {
    if (resetPage) shown = 48;
    const terms = normalize($('#search').value.trim()).split(/\s+/).filter(Boolean);
    const franchise = $('#franchise').value, mood = $('#mood').value, orientation = $('#orientation').value;
    const favOnly = $('#favorites').getAttribute('aria-pressed') === 'true';
    filtered = rows.filter(row => (!category || row.category===category) && (!franchise || row.franchise===franchise) && (!mood || row.mood.includes(mood)) && (!orientation || row.orientation===orientation) && (!favOnly || favorites.has(row.id)) && terms.every(term=>row._search.includes(term)));
    const titleCompare = (a,b) => a.title.localeCompare(b.title,'en',{sensitivity:'base'}) || a.id.localeCompare(b.id);
    const recommendation = (a,b) => a.recommendedRank-b.recommendedRank || titleCompare(a,b);
    const sort = $('#sort').value;
    filtered.sort(sort==='title' ? titleCompare : sort==='newest' ? (a,b)=>b.dateAdded.localeCompare(a.dateAdded)||titleCompare(a,b) : sort==='favorites' ? (a,b)=>Number(favorites.has(b.id))-Number(favorites.has(a.id))||recommendation(a,b) : recommendation);
    $('#fav-count').textContent = rows.filter(row=>favorites.has(row.id)).length.toLocaleString();
    $('#summary').textContent = `${filtered.length.toLocaleString()} of ${rows.length.toLocaleString()} pictures${category?' · '+category:''}${favOnly?' · favorites':''}`;
    for (const btn of $('#categories').querySelectorAll('button')) btn.setAttribute('aria-pressed',String(btn.dataset.category===category));
    render();
  }
  function render() {
    $('#grid').innerHTML = filtered.slice(0,shown).map(row=>`<article class="card"><button type="button" class="image-button" data-open="${esc(row.id)}" aria-label="View ${esc(row.title)}"><img src="${esc(row.src)}" alt="${esc(row.alt || row.title)}" width="${row.width}" height="${row.height}" loading="lazy" decoding="async"></button>${favoriteButton(row)}<div class="card-copy"><p class="card-category">${esc(row.category)}</p><button class="card-title" type="button" data-open="${esc(row.id)}">${esc(row.title)}</button><p class="card-topic">${esc(row.topic)}</p><span class="type">${esc(typeLabel(row))}</span></div></article>`).join('');
    $('#empty').hidden = filtered.length>0; $('#more').hidden = filtered.length<=shown;
    $('#page-count').textContent = filtered.length ? `Showing ${Math.min(shown,filtered.length).toLocaleString()} of ${filtered.length.toLocaleString()}` : '';
  }
  function openDetail(id) {
    const row = rows.find(r=>r.id===id); if (!row) return; active = row;
    $('#detail-img').src = row.src; $('#detail-img').alt = row.alt || row.title;
    $('#detail-title').textContent = row.title; $('#detail-category').textContent = row.category;
    $('#detail-topic').textContent = row.topic; $('#detail-relevance').textContent = row.personalRelevance;
    $('#detail-tags').innerHTML = [...new Set([...row.mood,...row.style])].map(s=>`<span>${esc(s)}</span>`).join('');
    $('#detail-answers').hidden = !row.roleAliases?.length;
    $('#detail-answers-text').textContent = (row.roleAliases || []).join(', ');
    const facts = [['Type',typeLabel(row)],['Dimensions',`${row.width} × ${row.height} · ${row.orientation}`],['Original',`${row.originalWidth} × ${row.originalHeight}`],['People',row.people.length?row.people.join(', '):row.assetType==='fan cosplay photograph'?'Cosplayer identity not established':'Not identified'],['Added',row.dateAdded],['Framing','Full image, no crop'],['License',row.source.license]];
    if (row.depictedCharacters?.length) facts.push(['Character',row.depictedCharacters.join(', ')]);
    if (row.source.restrictions) facts.push(['Source notes',row.source.restrictions]);
    $('#detail-facts').innerHTML = facts.map(([a,b])=>`<dt>${esc(a)}</dt><dd>${esc(b)}</dd>`).join('');
    $('#detail-credit').textContent = `Image: ${row.source.author || 'See the source for author details'}. ${row.source.credit || ''} Resized and converted to WebP; original composition preserved.`;
    $('#detail-source').href = row.source.page;
    $('#detail-license').href = row.source.licenseUrl || row.source.page;
    updateDetailFavorite(); $('#detail').showModal();
  }
  function reset() { $('#filters').reset(); category=''; $('#favorites').setAttribute('aria-pressed','false'); apply(); }
  $('#filters').addEventListener('submit',event=>event.preventDefault());
  $('#search').addEventListener('input',()=>apply());
  for (const id of ['#franchise','#mood','#orientation','#sort']) $(id).addEventListener('change',()=>apply());
  $('#favorites').onclick=()=>{ $('#favorites').setAttribute('aria-pressed',String($('#favorites').getAttribute('aria-pressed')!=='true')); apply(); };
  $('#categories').onclick=event=>{ const btn=event.target.closest('[data-category]'); if(btn){category=btn.dataset.category; apply();} };
  $('#grid').onclick=event=>{ const favorite=event.target.closest('[data-favorite]'); if(favorite){toggleFavorite(favorite.dataset.favorite);return;} const open=event.target.closest('[data-open]'); if(open)openDetail(open.dataset.open); };
  $('#grid').addEventListener('error',event=>{ if(event.target.tagName==='IMG'){event.target.classList.add('broken');event.target.alt='Image unavailable: '+event.target.alt;} },true);
  $('#more').onclick=()=>{const before=shown;shown+=48;render();$('#grid').children[before]?.querySelector('button')?.focus({preventScroll:true});};
  $('#clear-filters').onclick=reset; $('#empty-reset').onclick=reset;
  $('#close').onclick=()=>$('#detail').close();
  $('#detail-favorite').onclick=()=>active&&toggleFavorite(active.id);
  $('#detail').onclick=event=>{if(event.target===$('#detail')){const r=$('#detail').getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)$('#detail').close();}};
  (async()=>{
    try {
      const response=await fetch('collection/catalog.json');if(!response.ok)throw new Error('Catalog could not be loaded.');
      const data=await response.json(); rows=data.images;
      for(const row of rows) row._search=normalize([row.title,row.topic,row.franchise,row.category,...row.people,...row.tags,...(row.aliases||[])].join(' '));
      $('#total').textContent=rows.length.toLocaleString();
      $('#categories').innerHTML=['',...categories].map(c=>`<button type="button" data-category="${esc(c)}" aria-pressed="${!c}">${esc(c||'Everything')}</button>`).join('');
      optionList('#franchise',rows.map(r=>r.franchise),'Every franchise & topic');
      optionList('#mood',rows.flatMap(r=>r.mood),'Every mood');
      apply();
    } catch(error) { $('#summary').textContent='The library could not be loaded.';$('#notice').hidden=false;$('#notice').textContent=`${error.message} Open Pixel Peek through its local server, then refresh.`; }
  })();
})();
