// Fade sections in as they scroll into view. Content stays visible if JS or IntersectionObserver is unavailable.
(() => {
  if (!('IntersectionObserver' in window)) return;
  const items = document.querySelectorAll('.game, .steps li, .about, .soon');
  items.forEach((el) => el.classList.add('reveal'));
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
    });
  }, { threshold: 0.12 });
  items.forEach((el) => io.observe(el));
})();
