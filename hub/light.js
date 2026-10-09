// Native-scrolling alternative: no WebGL, video decoding or animation libraries.
const cards = [...document.querySelectorAll('.ch')];
const names = ['Pixel Peek', "Liar's Call", 'Apartment 07', 'Blackjack 21'];
const posters = ['pp','lc','a7','bj'];
const frame = document.querySelector('.fallback');
const screen = document.createElement('img');
screen.src = 'media/pp.jpg'; screen.alt = 'Pixel Peek gameplay'; screen.width = 1280; screen.height = 720;
frame.replaceChildren(screen); frame.removeAttribute('aria-hidden');
let current = 0;
function tune(i) {
  current = i; screen.src = `media/${posters[i]}.jpg`; screen.alt = `${names[i]} gameplay`;
  cards.forEach((card,k) => card.classList.toggle('on', k === i));
  document.querySelector('#watchName').textContent = names[i];
  document.querySelector('#watch').href = cards[i].href;
}
cards.forEach((card,i) => {
  card.addEventListener('focus', () => tune(i));
  card.addEventListener('pointerenter', e => { if (e.pointerType !== 'touch') tune(i); });
});
document.querySelector('#surprise').addEventListener('click', () => {
  tune((current + 1 + Math.floor(Math.random()*(names.length - 1))) % names.length);
  document.querySelector('#watch').focus({preventScroll:true});
});
document.querySelectorAll('.panel video').forEach(video => {
  const image = document.createElement('img'); image.src = video.poster; image.alt = '';
  image.className = video.className; image.loading = 'lazy'; image.decoding = 'async'; video.replaceWith(image);
});
