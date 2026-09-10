import { useEffect, useRef, useState, type ReactNode, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/app/auth-context';

const MIN_VISIBLE_MS = 650;
const EXIT_DELAY_MS = 140;
const WAITING_PROGRESS_CEILING = 90;

export function StartupLoader({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const { isLoading: sessionLoading } = useAuth();
  const startedAt = useRef(Date.now());
  const [progress, setProgress] = useState(4);
  const [complete, setComplete] = useState(false);

  useEffect(() => {
    if (!sessionLoading) return;

    const interval = window.setInterval(() => {
      const elapsed = Date.now() - startedAt.current;
      const nextProgress = Math.min(
        WAITING_PROGRESS_CEILING,
        4 + Math.trunc((elapsed / 900) * (WAITING_PROGRESS_CEILING - 4)),
      );
      setProgress(nextProgress);
    }, 30);

    return () => window.clearInterval(interval);
  }, [sessionLoading]);

  useEffect(() => {
    if (sessionLoading) return;

    const remainingMinimum = Math.max(0, MIN_VISIBLE_MS - (Date.now() - startedAt.current));
    let exitTimer: number | undefined;
    const finishTimer = window.setTimeout(() => {
      setProgress(100);
      exitTimer = window.setTimeout(() => setComplete(true), EXIT_DELAY_MS);
    }, remainingMinimum);

    return () => {
      window.clearTimeout(finishTimer);
      if (exitTimer) window.clearTimeout(exitTimer);
    };
  }, [sessionLoading]);

  const ready = complete && !sessionLoading;

  useEffect(() => {
    if (ready) return;
    document.documentElement.classList.add('startup-active');
    return () => document.documentElement.classList.remove('startup-active');
  }, [ready]);

  return (
    <>
      {children}
      {!ready ? (
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
                  <div className="startup-loader__cash-stacks">
                    {Array.from({ length: 6 }, (_, index) => (
                      <span key={index}>
                        <i>₪</i>
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
            <div className="startup-loader__flying-cash">
              {Array.from({ length: 8 }, (_, index) => (
                <span
                  key={index}
                  style={
                    {
                      animationDelay: `${index * -0.38}s`,
                      '--cash-x': `${(index % 2 === 0 ? -1 : 1) * (60 + (index % 4) * 20)}px`,
                      '--cash-turn': `${(index % 2 === 0 ? -1 : 1) * (25 + index * 9)}deg`,
                    } as CSSProperties
                  }
                >
                  <i>₪</i>
                </span>
              ))}
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
            <div
              className="startup-loader__progress"
              aria-label={t('loading.progress', { progress })}
            >
              <span style={{ width: `${progress}%` }} />
            </div>
          </div>
          <span className="sr-only">{t('loading.progress', { progress })}</span>
        </div>
      ) : null}
    </>
  );
}
