import { useEffect, type RefObject } from 'react';

export function useLandingMotion(root: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    const frames = new Set<number>();
    let scrollFrame = 0;
    const items = element.querySelectorAll<HTMLElement>('[data-reveal], [data-counter]');
    const finish = () =>
      items.forEach((item) => {
        item.dataset.visible = 'true';
        if (item.dataset.counter) item.textContent = item.dataset.counter;
      });
    const animateCounter = (item: HTMLElement) => {
      const target = Number(item.dataset.counter);
      if (reduce.matches) {
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
                if (item.dataset.counter) animateCounter(item);
                observer?.unobserve(item);
              });
            },
            { threshold: 0.12 },
          )
        : null;
    if (reduce.matches || !observer) finish();
    else {
      element.dataset.motion = 'true';
      items.forEach((item) => observer.observe(item));
    }
    const updateScroll = () => {
      scrollFrame = 0;
      element.dataset.scrolled = String(window.scrollY > 24);
      const shift = reduce.matches ? 0 : Math.min(window.scrollY * 0.045, 32);
      element.style.setProperty('--hero-shift', `${shift}px`);
    };
    const onScroll = () => {
      if (!scrollFrame) scrollFrame = requestAnimationFrame(updateScroll);
    };
    const onReducedMotion = () => {
      if (reduce.matches) {
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
  }, [root]);
}
