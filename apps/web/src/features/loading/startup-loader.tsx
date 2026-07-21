import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/app/auth-context';

const LOAD_DURATION_MS = 3800;
const EXIT_DELAY_MS = 420;

export function StartupLoader({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const { isLoading: sessionLoading } = useAuth();
  const [progress, setProgress] = useState(0);
  const [complete, setComplete] = useState(false);

  useEffect(() => {
    const startedAt = Date.now();
    let exitTimer: ReturnType<typeof setTimeout> | undefined;

    const interval = window.setInterval(() => {
      const nextProgress = Math.min(
        100,
        Math.trunc(((Date.now() - startedAt) / LOAD_DURATION_MS) * 100),
      );
      setProgress(nextProgress);

      if (nextProgress === 100) {
        window.clearInterval(interval);
        exitTimer = setTimeout(() => setComplete(true), EXIT_DELAY_MS);
      }
    }, 40);

    return () => {
      window.clearInterval(interval);
      if (exitTimer) clearTimeout(exitTimer);
    };
  }, []);

  if (complete && !sessionLoading) return children;

  return (
    <div
      className="startup-loader"
      role="status"
      aria-live="polite"
      data-complete={progress === 100 && !sessionLoading}
    >
      <div className="startup-loader__identity">
        <img src="/logo.png" alt="" className="startup-loader__logo" />
        <div className="startup-loader__brand">
          <span>OH</span> Finance
        </div>
        <div className="startup-loader__brand-rule">
          <span />
        </div>
      </div>

      <div className="startup-loader__scene startup-loader__vault-scene" aria-hidden>
        <div className="startup-loader__aura" />
        <div className="startup-loader__vault">
          <div className="startup-loader__vault-frame">
            <div className="startup-loader__vault-bolts">
              {Array.from({ length: 8 }, (_, index) => (
                <span key={index} />
              ))}
            </div>
            <div className="startup-loader__vault-interior">
              <div className="startup-loader__vault-plaque">OH RESERVE</div>
              <div className="startup-loader__vault-shelf startup-loader__vault-shelf--1" />
              <div className="startup-loader__vault-shelf startup-loader__vault-shelf--2" />
              <div className="startup-loader__gold-stack">
                {Array.from({ length: 30 }, (_, index) => (
                  <span
                    key={index}
                    className="startup-loader__gold-bar"
                    data-loaded={progress >= Math.ceil(((30 - index) / 30) * 92)}
                    style={{ transitionDelay: `${(index % 5) * 35}ms` }}
                  >
                    <i>OH</i>
                  </span>
                ))}
              </div>
              <div className="startup-loader__vault-scan" />
            </div>
          </div>
          <div className="startup-loader__vault-hinges">
            <span />
            <span />
          </div>
          <div className="startup-loader__vault-door">
            <div className="startup-loader__vault-door-rim" />
            <div className="startup-loader__vault-wheel">
              {Array.from({ length: 6 }, (_, index) => (
                <span key={index} />
              ))}
              <i />
            </div>
          </div>
        </div>
        <div className="startup-loader__vault-floor" />
      </div>

      <div className="startup-loader__status">
        <div className="startup-loader__status-line">
          <p className="startup-loader__label">{t('loading.counting')}</p>
          <strong className="startup-loader__percentage" dir="ltr">
            {progress}%
          </strong>
        </div>
        <div className="startup-loader__progress" aria-label={t('loading.progress', { progress })}>
          <span style={{ width: `${progress}%` }} />
        </div>
      </div>
      <span className="sr-only">{t('loading.progress', { progress })}</span>
    </div>
  );
}
