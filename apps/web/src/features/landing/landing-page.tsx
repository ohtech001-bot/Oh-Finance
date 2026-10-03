import { copy, useCopy } from '@/lib/copy';
import { useRef, useState, type KeyboardEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowDown,
  ArrowUpLeft,
  Check,
  ChevronLeft,
  Globe,
  LockKeyhole,
  Mail,
  Maximize2,
  Menu,
  MessageCircle,
  ShieldCheck,
} from 'lucide-react';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@oh/ui';
import { FEATURES, SCREENS, SECTIONS, STEPS, SUBSCRIPTION_MESSAGE } from './landing-content';
import { changeLocale, currentLocale } from '@/lib/i18n';
import { useLandingMotion } from './use-landing-motion';
import './landing.css';

function Subscribe({
  children = copy('اشترك الآن'),
  className = '',
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  useCopy();

  return (
    <a
      className={`oh-button oh-button--primary ${className}`}
      href={`https://wa.me/972552616622?text=${encodeURIComponent(copy(SUBSCRIPTION_MESSAGE))}`}
      target="_blank"
      rel="noopener noreferrer"
    >
      <MessageCircle size={18} aria-hidden="true" />
      <span>{children}</span>
      <ArrowUpLeft size={17} aria-hidden="true" />
    </a>
  );
}

function Brand() {
  useCopy();

  return (
    <a className="oh-brand" href="#home" aria-label={copy('OH Finance، الرئيسية')}>
      <img
        src="/landing/brand-mark.webp"
        alt={copy('شعار OH Finance الحالي')}
        width="46"
        height="46"
      />
      <span dir="ltr">
        OH <strong>Finance</strong>
        <small>By O&H Tech</small>
      </span>
    </a>
  );
}

function Header() {
  useCopy();

  const [open, setOpen] = useState(false);
  return (
    <header className="oh-header">
      <div className="oh-container oh-header__inner">
        <Brand />
        <nav className="oh-desktop-nav" aria-label={copy('أقسام الصفحة')}>
          {SECTIONS.map((section) => (
            <a key={section.id} href={`#${section.id}`}>
              {copy(section.label)}
            </a>
          ))}
        </nav>
        <div className="oh-header__actions">
          <button
            type="button"
            className="oh-language-button"
            onClick={() => changeLocale(currentLocale() === 'ar' ? 'he' : 'ar')}
            aria-label={currentLocale() === 'ar' ? 'עברית' : 'العربية'}
            title={currentLocale() === 'ar' ? 'עברית' : 'العربية'}
          >
            <Globe size={18} aria-hidden="true" />
            <span lang={currentLocale() === 'ar' ? 'he' : 'ar'}>
              {currentLocale() === 'ar' ? 'עברית' : 'العربية'}
            </span>
          </button>
          <Link className="oh-login-link" to="/login">
            {copy('تسجيل الدخول')}
            <ChevronLeft size={15} aria-hidden="true" />
          </Link>
          <Subscribe />
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <button
              className="oh-menu-trigger"
              type="button"
              aria-label={copy('فتح القائمة')}
              aria-expanded={open}
            >
              <Menu size={23} />
            </button>
          </DialogTrigger>
          <DialogContent className="oh-landing-menu" dir="rtl" size="sm">
            <DialogHeader>
              <DialogTitle>OH Finance</DialogTitle>
              <DialogDescription>{copy('أقسام الموقع')}</DialogDescription>
            </DialogHeader>
            <nav aria-label={copy('أقسام الصفحة على الهاتف')}>
              {SECTIONS.map((section) => (
                <DialogClose asChild key={section.id}>
                  <a href={`#${section.id}`}>
                    {copy(section.label)}
                    <ChevronLeft size={16} aria-hidden="true" />
                  </a>
                </DialogClose>
              ))}
            </nav>
            <div className="oh-landing-menu__actions">
              <DialogClose asChild>
                <Link className="oh-button oh-button--outline" to="/login">
                  {copy('تسجيل الدخول')}
                </Link>
              </DialogClose>
              <Subscribe />
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </header>
  );
}

function ScreenGallery() {
  useCopy();

  const [active, setActive] = useState(0);
  const screen = SCREENS[active]!;
  const desktop = `/landing/${screen.id}-desktop.webp`;
  const mobile = `/landing/${screen.id}-mobile.webp`;
  const onTabKey = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let next: number;
    if (event.key === 'ArrowLeft') next = (index + 1) % SCREENS.length;
    else if (event.key === 'ArrowRight') next = (index - 1 + SCREENS.length) % SCREENS.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = SCREENS.length - 1;
    else return;
    event.preventDefault();
    setActive(next);
    document.getElementById(`oh-screen-tab-${next}`)?.focus();
  };
  return (
    <section className="oh-section oh-showcase" id="system" aria-labelledby="oh-showcase-title">
      <div className="oh-container">
        <div className="oh-section-heading" data-reveal>
          <span className="oh-eyebrow">{copy('نظرة أقرب')}</span>
          <h2 id="oh-showcase-title">
            {copy('كل ما يحتاجه عملك،')}
            <br />
            {copy('في مكان واحد.')}
          </h2>
          <p>{copy('من متابعة الزبون إلى مراجعة الحسابات، واجهات مترابطة تجمع تفاصيل العمل.')}</p>
        </div>
        <div className="oh-screen-tabs" role="tablist" aria-label={copy('نماذج واجهات المنظومة')}>
          {SCREENS.map((item, index) => (
            <button
              type="button"
              role="tab"
              id={`oh-screen-tab-${index}`}
              aria-selected={index === active}
              aria-controls="oh-screen-panel"
              tabIndex={index === active ? 0 : -1}
              onKeyDown={(event) => onTabKey(event, index)}
              onClick={() => setActive(index)}
              key={item.id}
            >
              <item.icon size={17} aria-hidden="true" />
              {copy(item.label)}
            </button>
          ))}
        </div>
        <div
          role="tabpanel"
          id="oh-screen-panel"
          aria-labelledby={`oh-screen-tab-${active}`}
          tabIndex={0}
          className="oh-device-stage"
          data-reveal
        >
          <figure className="oh-laptop">
            <div className="oh-laptop__screen">
              <div className="oh-window-bar" aria-hidden="true">
                <span />
                <span />
                <span />
                <small>OH Finance</small>
                <LockKeyhole size={11} />
              </div>
              <img
                key={desktop}
                src={desktop}
                alt={copy('نموذج واجهة {{value0}} على الحاسوب من صور المشروع', {
                  value0: copy(screen.label),
                })}
                width="1536"
                height="1024"
                loading="lazy"
                decoding="async"
              />
            </div>
            <div className="oh-laptop__base" aria-hidden="true" />
            <figcaption>{copy('مساحة أوسع لمتابعة التفاصيل')}</figcaption>
          </figure>
          <figure className="oh-phone">
            <img
              key={mobile}
              src={mobile}
              alt={copy('نموذج واجهة {{value0}} على الهاتف من صور المشروع', {
                value0: copy(screen.label),
              })}
              width="854"
              height="1842"
              loading="lazy"
              decoding="async"
            />
            <figcaption>{copy('معك على هاتفك')}</figcaption>
          </figure>
        </div>
        <div className="oh-gallery-note">
          <p>
            {copy(
              'نماذج الواجهات من صور المشروع؛ الأرقام المعروضة توضيحية وليست بيانات حساب فعلي.',
            )}
          </p>
          <Dialog>
            <DialogTrigger asChild>
              <button type="button" className="oh-text-button">
                <Maximize2 size={16} aria-hidden="true" />
                {copy('عرض الصورة')}
              </button>
            </DialogTrigger>
            <DialogContent className="oh-screen-dialog" dir="rtl" size="xl">
              <DialogHeader>
                <DialogTitle>{copy(screen.label)}</DialogTitle>
                <DialogDescription>{copy('نموذج توضيحي من صور واجهات المشروع')}</DialogDescription>
              </DialogHeader>
              <picture>
                <source media="(min-width: 768px)" srcSet={desktop} />
                <img src={mobile} alt={copy('واجهة {{value0}}', { value0: copy(screen.label) })} />
              </picture>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </section>
  );
}

export function LandingPage() {
  useCopy();

  const root = useRef<HTMLDivElement>(null);
  useLandingMotion(root);
  return (
    <div className="oh-landing" dir="rtl" lang={currentLocale()} ref={root}>
      <Header />
      <main id="main-content">
        <section className="oh-hero" id="home" aria-labelledby="oh-hero-title">
          <img
            className="oh-hero__image"
            src="/landing/brand-hero.webp"
            alt=""
            aria-hidden="true"
            width="960"
            height="960"
            fetchPriority="high"
          />
          <div className="oh-hero__symbols" aria-hidden="true">
            <span>₪</span>
            <span>%</span>
            <span>+</span>
            <span className="oh-number-reel">
              <i>
                01
                <br />
                02
                <br />
                03
                <br />
                01
              </i>
            </span>
          </div>
          <div className="oh-container oh-hero__content">
            <div className="oh-hero__copy">
              <div className="oh-hero__eyebrow">
                <span />
                {copy('منظومة أعمالك من O&H Tech')}
              </div>
              <h1 id="oh-hero-title" dir="ltr">
                OH <span>Finance</span>
              </h1>
              <p className="oh-hero__headline">
                {copy('إدارة مالك. محلك. حساباتك.')}
                <br />
                <strong>{copy('في مكان واحد.')}</strong>
              </p>
              <p className="oh-hero__description">
                {copy(
                  'منظومة متكاملة تساعد أصحاب المحلات والأعمال على إدارة الزبائن، الطلبات، الدفعات، الحسابات والتقارير بسهولة وأمان.',
                )}
              </p>
              <div className="oh-hero__actions">
                <Subscribe />
                <Link className="oh-button oh-button--light" to="/login">
                  {copy('تسجيل الدخول')}
                  <ChevronLeft size={18} aria-hidden="true" />
                </Link>
              </div>
              <a className="oh-hero__explore" href="#about">
                {copy('تعرّف على المنظومة')}
                <ArrowDown size={15} aria-hidden="true" />
              </a>
            </div>
          </div>
        </section>

        <section className="oh-about oh-section" id="about" aria-labelledby="oh-about-title">
          <div className="oh-container oh-about__layout">
            <div data-reveal>
              <span className="oh-eyebrow">{copy('عمل منظّم. صورة أوضح.')}</span>
              <h2 id="oh-about-title">
                {copy('ودّع الدفاتر')}
                <br />
                {copy('والحسابات المبعثرة.')}
              </h2>
            </div>
            <div className="oh-about__text" data-reveal>
              <p>
                {copy(
                  'طلبات في دفتر، دفعات في رسائل، وحسابات تحتاج مراجعة كل يوم. يجمع OH Finance هذه التفاصيل في منظومة واحدة، لتعرف ما لك وما عليك وتتابع عملك بثقة.',
                )}
              </p>
              <a href="#system" className="oh-text-button">
                {copy('شاهد واجهات المنظومة')}
                <ArrowUpLeft size={18} aria-hidden="true" />
              </a>
            </div>
          </div>
        </section>

        <ScreenGallery />

        <section
          className="oh-section oh-features"
          id="features"
          aria-labelledby="oh-features-title"
        >
          <div className="oh-container">
            <div className="oh-section-heading" data-reveal>
              <span className="oh-eyebrow">{copy('لماذا OH Finance؟')}</span>
              <h2 id="oh-features-title">
                {copy('تفاصيل أقل تشتّتًا.')}
                <br />
                {copy('إدارة أكثر وضوحًا.')}
              </h2>
              <p>{copy('أدوات مترابطة للعمليات التي تحتاجها في يوم عملك.')}</p>
            </div>
            <div className="oh-feature-grid">
              {FEATURES.map((feature, index) => (
                <article
                  className={`oh-feature oh-feature--${feature.tone}`}
                  key={feature.title}
                  data-reveal
                  style={{ '--reveal-delay': `${(index % 3) * 65}ms` } as React.CSSProperties}
                >
                  <feature.icon className="oh-feature__icon" size={26} aria-hidden="true" />
                  <h3>{copy(feature.title)}</h3>
                  <p>{copy(feature.text)}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="oh-facts" aria-label={copy('المنظومة في أرقام')}>
          <div className="oh-container">
            <dl>
              {[
                { value: 1, label: copy('منصة تجمع أعمالك') },
                { value: 6, label: copy('واجهات أساسية للعمل') },
                { value: 2, label: copy('لغتان: العربية والعبرية') },
                { value: 4, label: copy('خطوات للبدء') },
              ].map((fact) => (
                <div key={fact.label} data-reveal>
                  <dt>
                    <span data-counter={fact.value} aria-hidden="true">
                      {fact.value}
                    </span>
                    <span className="sr-only">{fact.value}</span>
                  </dt>
                  <dd>{copy(fact.label)}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section
          className="oh-section oh-workflow"
          id="how-it-works"
          aria-labelledby="oh-workflow-title"
        >
          <div className="oh-container">
            <div className="oh-section-heading" data-reveal>
              <span className="oh-eyebrow">{copy('بداية بسيطة')}</span>
              <h2 id="oh-workflow-title">
                {copy('من أول زبون،')}
                <br />
                {copy('إلى صورة كاملة لعملك.')}
              </h2>
            </div>
            <ol className="oh-steps">
              {STEPS.map((step, index) => (
                <li
                  key={step.title}
                  data-reveal
                  style={{ '--reveal-delay': `${index * 70}ms` } as React.CSSProperties}
                >
                  <span className="oh-step-number" dir="ltr">
                    0{index + 1}
                  </span>
                  <h3>{copy(step.title)}</h3>
                  <p>{copy(step.text)}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="oh-section oh-security" aria-labelledby="oh-security-title">
          <div className="oh-container oh-security__layout">
            <div data-reveal>
              <span className="oh-eyebrow">{copy('بيانات عملك لها خصوصيتها')}</span>
              <h2 id="oh-security-title">
                {copy('الحماية جزء')}
                <br />
                {copy('من طريقة العمل.')}
              </h2>
              <p>
                {copy(
                  'تحقق من الصلاحيات في الخادم، وعزل بين المحلات، وجلسات محمية؛ مع أدوات للنسخ الاحتياطي المستقل عند تفعيلها.',
                )}
              </p>
            </div>
            <div className="oh-security__details" data-reveal>
              <ShieldCheck size={44} aria-hidden="true" />
              <ul>
                <li>
                  <Check aria-hidden="true" />
                  {copy('اتصال HTTPS في بيئة الإنتاج')}
                </li>
                <li>
                  <Check aria-hidden="true" />
                  {copy('صلاحيات حسب دور المستخدم')}
                </li>
                <li>
                  <Check aria-hidden="true" />
                  {copy('حماية الجلسات وطلبات التعديل')}
                </li>
                <li>
                  <Check aria-hidden="true" />
                  {copy('عزل بيانات المحلات')}
                </li>
              </ul>
              <p>{copy('تفعيل النسخ الاحتياطي المستقل مرتبط بإعداد مخزن النسخ وجدول التشغيل.')}</p>
            </div>
          </div>
        </section>

        <section className="oh-contact oh-section" id="contact" aria-labelledby="oh-contact-title">
          <div className="oh-container" data-reveal>
            <span className="oh-eyebrow">{copy('لنبدأ معًا')}</span>
            <h2 id="oh-contact-title">
              {copy('جاهز لتنظيم عملك')}
              <br />
              {copy('بشكل أفضل؟')}
            </h2>
            <p>{copy('تواصل معنا وسنساعدك في إعداد حساب OH Finance الخاص بعملك.')}</p>
            <div className="oh-contact__actions">
              <Subscribe>{copy('اشترك عبر WhatsApp')}</Subscribe>
              <Link className="oh-button oh-button--outline" to="/login">
                {copy('تسجيل الدخول')}
                <ChevronLeft size={18} aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>
      </main>
      <footer className="oh-footer">
        <div className="oh-container">
          <div className="oh-footer__main">
            <Brand />
            <p>{copy('منظومة واحدة. تفاصيل عملك أقرب.')}</p>
            <div className="oh-footer__contact">
              <a href="https://oh-tech.co" target="_blank" rel="noopener noreferrer">
                <Globe size={16} aria-hidden="true" />
                <span dir="ltr">oh-tech.co</span>
              </a>
              <a href="mailto:info@oh-tech.co">
                <Mail size={16} aria-hidden="true" />
                <span dir="ltr">info@oh-tech.co</span>
              </a>
              <a href="tel:+972552616622">
                <MessageCircle size={16} aria-hidden="true" />
                <span dir="ltr">0552616622</span>
              </a>
            </div>
          </div>
          <div className="oh-footer__bottom">
            <p>© {new Date().getFullYear()} OH Finance · By O&H Tech</p>
            <div>
              <Link to="/privacy">{copy('سياسة الخصوصية')}</Link>
              <Link to="/site-policy">{copy('سياسة الموقع')}</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
