// Pick the rendering path before loading any animation or 3D dependencies.
const compact = matchMedia('(max-width: 860px), (pointer: coarse), (prefers-reduced-motion: reduce)');
const light = compact.matches || navigator.connection?.saveData || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4);
document.documentElement.classList.toggle('light-mode', Boolean(light));
if (light) await import('./light.js');
else {
  for (const name of ['gsap','ScrollTrigger','SplitText','lenis']) {
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = `vendor/${name}.min.js`; script.onload = resolve; script.onerror = reject;
      document.head.append(script);
    });
  }
  await import('./main.js');
}
