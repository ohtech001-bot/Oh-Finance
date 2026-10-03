import { useEffect, type RefObject } from 'react';

export function useLandingMotion(root: RefObject<HTMLElement | null>, paused = false) {
  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    const frames = new Set<number>();
    let scrollFrame = 0;
    let smoothScroll = window.scrollY;
    const disabled = () => paused || reduce.matches;
    const items = element.querySelectorAll<HTMLElement>('[data-reveal], [data-counter]');
    const finish = () =>
      items.forEach((item) => {
        item.dataset.visible = 'true';
        if (item.dataset.counter) item.textContent = item.dataset.counter;
      });
    const animateCounter = (item: HTMLElement) => {
      const target = Number(item.dataset.counter);
      if (disabled()) {
        item.textContent = String(target);
        return;
      }
      const start = performance.now();
      const tick = (now: number) => {
        const progress = Math.min(1, (now - start) / 900);
        item.textContent = String(Math.trunc(target * (1 - (1 - progress) ** 3)));
        if (progress < 1) {
          const id = requestAnimationFrame((time) => {
            frames.delete(id);
            tick(time);
          });
          frames.add(id);
        } else item.textContent = String(target);
      };
      tick(start);
    };
    const observer =
      'IntersectionObserver' in window
        ? new IntersectionObserver(
            (entries) => {
              entries.forEach((entry) => {
                if (!entry.isIntersecting) return;
                const item = entry.target as HTMLElement;
                item.dataset.visible = 'true';
                if (item.dataset.counter && item.dataset.counted !== 'true') {
                  item.dataset.counted = 'true';
                  animateCounter(item);
                }
                observer?.unobserve(item);
              });
            },
            { threshold: 0.12 },
          )
        : null;
    if (disabled() || !observer) {
      delete element.dataset.motion;
      finish();
    } else {
      element.dataset.motion = 'true';
      items.forEach((item) => {
        if (item.dataset.counter && item.dataset.counted !== 'true') item.textContent = '0';
        observer.observe(item);
      });
    }
    const updateScroll = () => {
      scrollFrame = 0;
      element.dataset.scrolled = String(window.scrollY > 24);
      smoothScroll = disabled()
        ? window.scrollY
        : smoothScroll + (window.scrollY - smoothScroll) * 0.14;
      const shift = disabled() ? 0 : Math.min(smoothScroll * 0.045, 32);
      element.style.setProperty('--hero-shift', `${shift}px`);
      const scrollable = Math.max(1, element.scrollHeight - window.innerHeight);
      element.style.setProperty(
        '--money-progress',
        String(disabled() ? 0 : smoothScroll / scrollable),
      );
      if (!disabled() && Math.abs(window.scrollY - smoothScroll) > 0.5)
        scrollFrame = requestAnimationFrame(updateScroll);
    };
    const onScroll = () => {
      if (!scrollFrame) scrollFrame = requestAnimationFrame(updateScroll);
    };
    const onReducedMotion = () => {
      cancelAnimationFrame(scrollFrame);
      if (disabled()) {
        frames.forEach(cancelAnimationFrame);
        frames.clear();
        observer?.disconnect();
        finish();
        delete element.dataset.motion;
      }
      updateScroll();
    };
    updateScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    reduce.addEventListener('change', onReducedMotion);
    return () => {
      observer?.disconnect();
      frames.forEach(cancelAnimationFrame);
      cancelAnimationFrame(scrollFrame);
      window.removeEventListener('scroll', onScroll);
      reduce.removeEventListener('change', onReducedMotion);
    };
  }, [root, paused]);
}
