'use client';

import React, { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface StaggeredMenuItem {
  label: string;
  ariaLabel?: string;
  link?: string;
  onClick?: () => void;
}

export interface StaggeredMenuSocialItem {
  label: string;
  link: string;
}

interface StaggeredMenuProps {
  position?: 'left' | 'right';
  colors?: string[];
  items?: StaggeredMenuItem[];
  socialItems?: StaggeredMenuSocialItem[];
  displaySocials?: boolean;
  displayItemNumbering?: boolean;
  className?: string;
  logoUrl?: string;
  logoText?: string;
  menuButtonColor?: string;
  openMenuButtonColor?: string;
  accentColor?: string;
  changeMenuColorOnOpen?: boolean;
  isFixed?: boolean;
  closeOnClickAway?: boolean;
  onMenuOpen?: () => void;
  onMenuClose?: () => void;
  /** Custom header content (rendered to the LEFT of the toggle button) */
  headerLeft?: React.ReactNode;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const StaggeredMenu: React.FC<StaggeredMenuProps> = ({
  position = 'right',
  colors = ['#B497CF', '#5227FF'],
  items = [],
  socialItems = [],
  displaySocials = true,
  displayItemNumbering = true,
  className,
  logoUrl,
  logoText,
  menuButtonColor = '#fff',
  openMenuButtonColor = '#fff',
  changeMenuColorOnOpen = true,
  isFixed = false,
  accentColor = '#5227FF',
  closeOnClickAway = true,
  onMenuOpen,
  onMenuClose,
  headerLeft,
}) => {
  const colorsPalette = ['#FBBF24', '#7C3AED', '#30E3CA', '#EC4899', '#FF7A00', '#38A1F3', '#10B981', '#EF4444', '#14B8A6'];
  const [open, setOpen] = useState(false);
  const openRef = useRef(false);

  const panelRef = useRef<HTMLElement>(null);
  const preLayersRef = useRef<HTMLDivElement>(null);
  const preLayerElsRef = useRef<HTMLElement[]>([]);

  const plusHRef = useRef<HTMLSpanElement>(null);
  const plusVRef = useRef<HTMLSpanElement>(null);
  const iconRef = useRef<HTMLSpanElement>(null);

  const textInnerRef = useRef<HTMLSpanElement>(null);
  const textWrapRef = useRef<HTMLSpanElement>(null);
  const [textLines, setTextLines] = useState(['Menu', 'Close']);

  const openTlRef = useRef<gsap.core.Timeline | null>(null);
  const closeTweenRef = useRef<gsap.core.Tween | null>(null);
  const spinTweenRef = useRef<gsap.core.Timeline | null>(null);
  const textCycleAnimRef = useRef<gsap.core.Tween | null>(null);
  const colorTweenRef = useRef<gsap.core.Tween | null>(null);

  const toggleBtnRef = useRef<HTMLButtonElement>(null);
  const busyRef = useRef(false);

  const itemEntranceTweenRef = useRef<gsap.core.Tween | null>(null);

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      const panel = panelRef.current;
      const preContainer = preLayersRef.current;
      const plusH = plusHRef.current;
      const plusV = plusVRef.current;
      const icon = iconRef.current;
      const textInner = textInnerRef.current;

      if (!panel || !plusH || !plusV || !icon || !textInner) return;

      let preLayers: HTMLElement[] = [];
      if (preContainer) {
        preLayers = Array.from(preContainer.querySelectorAll<HTMLElement>('.sm-prelayer'));
      }
      preLayerElsRef.current = preLayers;

      const offscreen = position === 'left' ? -100 : 100;
      gsap.set([panel, ...preLayers], { xPercent: offscreen, opacity: 1 });
      if (preContainer) gsap.set(preContainer, { xPercent: 0, opacity: 1 });

      gsap.set(plusH, { transformOrigin: '50% 50%', rotate: 0 });
      gsap.set(plusV, { transformOrigin: '50% 50%', rotate: 90 });
      gsap.set(icon, { rotate: 0, transformOrigin: '50% 50%' });
      gsap.set(textInner, { yPercent: 0 });

      if (toggleBtnRef.current) gsap.set(toggleBtnRef.current, { color: menuButtonColor });
    });
    return () => ctx.revert();
  }, [menuButtonColor, position]);

  const buildOpenTimeline = useCallback(() => {
    const panel = panelRef.current;
    const layers = preLayerElsRef.current;
    if (!panel) return null;

    openTlRef.current?.kill();
    if (closeTweenRef.current) { closeTweenRef.current.kill(); closeTweenRef.current = null; }
    itemEntranceTweenRef.current?.kill();

    const itemEls = Array.from(panel.querySelectorAll<HTMLElement>('.sm-panel-itemLabel'));
    const numberEls = Array.from(panel.querySelectorAll<HTMLElement>('.sm-panel-number'));
    const socialTitle = panel.querySelector<HTMLElement>('.sm-socials-title');
    const socialLinks = Array.from(panel.querySelectorAll<HTMLElement>('.sm-socials-link'));

    const offscreen = position === 'left' ? -100 : 100;
    const layerStates = layers.map(el => ({ el, start: offscreen }));

    if (itemEls.length) gsap.set(itemEls, { yPercent: 140, rotate: 10 });
    if (numberEls.length) gsap.set(numberEls, { ['--sm-num-opacity']: 0 });
    if (socialTitle) gsap.set(socialTitle, { opacity: 0 });
    if (socialLinks.length) gsap.set(socialLinks, { y: 25, opacity: 0 });

    const tl = gsap.timeline({ paused: true });

    layerStates.forEach((ls, i) => {
      tl.fromTo(ls.el, { xPercent: ls.start }, { xPercent: 0, duration: 0.5, ease: 'power4.out' }, i * 0.07);
    });

    const lastTime = layerStates.length ? (layerStates.length - 1) * 0.07 : 0;
    const panelInsertTime = lastTime + (layerStates.length ? 0.08 : 0);
    const panelDuration = 0.65;

    tl.fromTo(panel, { xPercent: offscreen }, { xPercent: 0, duration: panelDuration, ease: 'power4.out' }, panelInsertTime);

    if (itemEls.length) {
      const itemsStart = panelInsertTime + panelDuration * 0.15;
      tl.to(itemEls, { yPercent: 0, rotate: 0, duration: 1, ease: 'power4.out', stagger: { each: 0.1, from: 'start' } }, itemsStart);
      if (numberEls.length) {
        tl.to(numberEls, { duration: 0.6, ease: 'power2.out', ['--sm-num-opacity']: 1, stagger: { each: 0.08, from: 'start' } }, itemsStart + 0.1);
      }
    }

    if (socialTitle || socialLinks.length) {
      const socialsStart = panelInsertTime + panelDuration * 0.4;
      if (socialTitle) tl.to(socialTitle, { opacity: 1, duration: 0.5, ease: 'power2.out' }, socialsStart);
      if (socialLinks.length) {
        tl.to(socialLinks, { y: 0, opacity: 1, duration: 0.55, ease: 'power3.out', stagger: { each: 0.08, from: 'start' }, onComplete: () => gsap.set(socialLinks, { clearProps: 'opacity' }) }, socialsStart + 0.04);
      }
    }

    openTlRef.current = tl;
    return tl;
  }, [position]);

  const playOpen = useCallback(() => {
    if (busyRef.current) return;
    busyRef.current = true;
    const tl = buildOpenTimeline();
    if (tl) {
      tl.eventCallback('onComplete', () => { busyRef.current = false; });
      tl.play(0);
    } else {
      busyRef.current = false;
    }
  }, [buildOpenTimeline]);

  const playClose = useCallback(() => {
    openTlRef.current?.kill();
    openTlRef.current = null;
    itemEntranceTweenRef.current?.kill();

    const panel = panelRef.current;
    const layers = preLayerElsRef.current;
    if (!panel) return;

    closeTweenRef.current?.kill();
    const offscreen = position === 'left' ? -100 : 100;

    closeTweenRef.current = gsap.to([...layers, panel], {
      xPercent: offscreen,
      duration: 0.32,
      ease: 'power3.in',
      overwrite: 'auto',
      onComplete: () => {
        const itemEls = Array.from(panel.querySelectorAll<HTMLElement>('.sm-panel-itemLabel'));
        if (itemEls.length) gsap.set(itemEls, { yPercent: 140, rotate: 10 });
        const numberEls = Array.from(panel.querySelectorAll<HTMLElement>('.sm-panel-number'));
        if (numberEls.length) gsap.set(numberEls, { ['--sm-num-opacity']: 0 });
        const socialTitle = panel.querySelector<HTMLElement>('.sm-socials-title');
        const socialLinks = Array.from(panel.querySelectorAll<HTMLElement>('.sm-socials-link'));
        if (socialTitle) gsap.set(socialTitle, { opacity: 0 });
        if (socialLinks.length) gsap.set(socialLinks, { y: 25, opacity: 0 });
        busyRef.current = false;
      }
    });
  }, [position]);

  const animateIcon = useCallback((opening: boolean) => {
    const icon = iconRef.current;
    const h = plusHRef.current;
    const v = plusVRef.current;
    if (!icon || !h || !v) return;

    spinTweenRef.current?.kill();
    if (opening) {
      gsap.set(icon, { rotate: 0, transformOrigin: '50% 50%' });
      spinTweenRef.current = gsap.timeline({ defaults: { ease: 'power4.out' } })
        .to(h, { rotate: 45, duration: 0.5 }, 0)
        .to(v, { rotate: -45, duration: 0.5 }, 0);
    } else {
      spinTweenRef.current = gsap.timeline({ defaults: { ease: 'power3.inOut' } })
        .to(h, { rotate: 0, duration: 0.35 }, 0)
        .to(v, { rotate: 90, duration: 0.35 }, 0)
        .to(icon, { rotate: 0, duration: 0.001 }, 0);
    }
  }, []);

  const animateColor = useCallback((opening: boolean) => {
    const btn = toggleBtnRef.current;
    if (!btn) return;
    colorTweenRef.current?.kill();
    if (changeMenuColorOnOpen) {
      const targetColor = opening ? openMenuButtonColor : menuButtonColor;
      colorTweenRef.current = gsap.to(btn, { color: targetColor, delay: 0.18, duration: 0.3, ease: 'power2.out' });
    } else {
      gsap.set(btn, { color: menuButtonColor });
    }
  }, [openMenuButtonColor, menuButtonColor, changeMenuColorOnOpen]);

  React.useEffect(() => {
    if (toggleBtnRef.current) {
      if (changeMenuColorOnOpen) {
        const targetColor = openRef.current ? openMenuButtonColor : menuButtonColor;
        gsap.set(toggleBtnRef.current, { color: targetColor });
      } else {
        gsap.set(toggleBtnRef.current, { color: menuButtonColor });
      }
    }
  }, [changeMenuColorOnOpen, menuButtonColor, openMenuButtonColor]);

  const animateText = useCallback((opening: boolean) => {
    const inner = textInnerRef.current;
    if (!inner) return;
    textCycleAnimRef.current?.kill();

    const currentLabel = opening ? 'Menu' : 'Close';
    const targetLabel = opening ? 'Close' : 'Menu';
    const cycles = 3;

    const seq = [currentLabel];
    let last = currentLabel;
    for (let i = 0; i < cycles; i++) {
      last = last === 'Menu' ? 'Close' : 'Menu';
      seq.push(last);
    }
    if (last !== targetLabel) seq.push(targetLabel);
    seq.push(targetLabel);

    setTextLines(seq);
    gsap.set(inner, { yPercent: 0 });

    const lineCount = seq.length;
    const finalShift = ((lineCount - 1) / lineCount) * 100;
    textCycleAnimRef.current = gsap.to(inner, { yPercent: -finalShift, duration: 0.5 + lineCount * 0.07, ease: 'power4.out' });
  }, []);

  const toggleMenu = useCallback(() => {
    const target = !openRef.current;
    openRef.current = target;
    setOpen(target);

    if (target) {
      onMenuOpen?.();
      playOpen();
    } else {
      onMenuClose?.();
      playClose();
    }
    animateIcon(target);
    animateColor(target);
    animateText(target);
  }, [playOpen, playClose, animateIcon, animateColor, animateText, onMenuOpen, onMenuClose]);

  const closeMenu = useCallback(() => {
    if (openRef.current) {
      openRef.current = false;
      setOpen(false);
      onMenuClose?.();
      playClose();
      animateIcon(false);
      animateColor(false);
      animateText(false);
    }
  }, [playClose, animateIcon, animateColor, animateText, onMenuClose]);

  React.useEffect(() => {
    if (!closeOnClickAway || !open) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (
        panelRef.current && !panelRef.current.contains(event.target as Node) &&
        toggleBtnRef.current && !toggleBtnRef.current.contains(event.target as Node)
      ) {
        closeMenu();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [closeOnClickAway, open, closeMenu]);

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div
      className={`sm-scope z-40 ${isFixed ? 'fixed top-0 left-0 w-screen h-screen overflow-hidden pointer-events-none' : 'w-full h-full'}`}
    >
      <div
        className={(className ? className + ' ' : '') + 'staggered-menu-wrapper pointer-events-none relative w-full h-full'}
        style={accentColor ? { ['--sm-accent' as string]: accentColor } : undefined}
        data-position={position}
        data-open={open || undefined}
      >
        {/* Pre-layers (staggered underlay) */}
        <div
          ref={preLayersRef}
          className="sm-prelayers absolute top-0 bottom-0 pointer-events-none z-[5]"
          style={{ [position === 'left' ? 'left' : 'right']: 0 }}
          aria-hidden="true"
        >
          {(() => {
            const raw = colors && colors.length ? colors.slice(0, 4) : ['#1e1e22', '#35353c'];
            let arr = [...raw];
            if (arr.length >= 3) { const mid = Math.floor(arr.length / 2); arr.splice(mid, 1); }
            return arr.map((c, i) => (
              <div key={i} className="sm-prelayer absolute top-0 h-full w-full translate-x-0" style={{ background: c, [position === 'left' ? 'left' : 'right']: 0, [position === 'left' ? 'right' : 'left']: 'auto' }} />
            ));
          })()}
        </div>

        {/* Header */}
        <header
          className="staggered-menu-header absolute top-0 left-0 w-full flex items-center justify-between px-5 py-4 bg-transparent pointer-events-none z-20"
          aria-label="Main navigation header"
        >
          {position === 'left' ? (
            /* Left-aligned: Toggle Button and Logo side-by-side */
            <>
              <div className="flex items-center gap-3.5 pointer-events-auto">
                <button
                  ref={toggleBtnRef}
                  className="sm-toggle relative inline-flex items-center gap-[0.3rem] bg-transparent border-0 cursor-pointer font-medium leading-none overflow-visible select-none"
                  aria-label={open ? 'Close menu' : 'Open menu'}
                  aria-expanded={open}
                  aria-controls="staggered-menu-panel"
                  onClick={toggleMenu}
                  type="button"
                >
                  <span
                    ref={textWrapRef}
                    className="sm-toggle-textWrap relative inline-block h-[1em] overflow-hidden whitespace-nowrap mr-1"
                    aria-hidden="true"
                  >
                    <span ref={textInnerRef} className="sm-toggle-textInner flex flex-col leading-none">
                      {textLines.map((l, i) => (
                        <span className="sm-toggle-line block h-[1em] leading-none" key={i}>{l}</span>
                      ))}
                    </span>
                  </span>
                  <span
                    ref={iconRef}
                    className="sm-icon relative w-[14px] h-[14px] shrink-0 inline-flex items-center justify-center"
                    aria-hidden="true"
                  >
                    <span ref={plusHRef} className="sm-icon-line absolute left-1/2 top-1/2 w-full h-[2px] bg-current rounded-[2px] -translate-x-1/2 -translate-y-1/2" />
                    <span ref={plusVRef} className="sm-icon-line sm-icon-line-v absolute left-1/2 top-1/2 w-full h-[2px] bg-current rounded-[2px] -translate-x-1/2 -translate-y-1/2" />
                  </span>
                </button>

                {/* Subtle vertical separator */}
                <span className="h-5 w-[1.5px] bg-black/10 shrink-0" />

                <div>
                  {headerLeft ?? (
                    <div className="sm-logo flex items-center select-none gap-2" aria-label="Logo">
                      {logoUrl ? (
                        <img src={logoUrl} alt="Logo" className="block h-8 w-auto object-contain" draggable={false} />
                      ) : null}
                      {logoText ? (
                        <span className="font-black text-xl tracking-tight" style={{ color: menuButtonColor }}>{logoText}</span>
                      ) : null}
                    </div>
                  )}
                </div>
              </div>
              <div className="pointer-events-auto" />
            </>
          ) : (
            /* Right-aligned: Logo on Left, Toggle Button on Right */
            <>
              <div className="pointer-events-auto">
                {headerLeft ?? (
                  <div className="sm-logo flex items-center select-none gap-2" aria-label="Logo">
                    {logoUrl ? (
                      <img src={logoUrl} alt="Logo" className="block h-8 w-auto object-contain" draggable={false} />
                    ) : null}
                    {logoText ? (
                      <span className="font-black text-xl tracking-tight" style={{ color: menuButtonColor }}>{logoText}</span>
                    ) : null}
                  </div>
                )}
              </div>
              
              <button
                ref={toggleBtnRef}
                className="sm-toggle relative inline-flex items-center gap-[0.3rem] bg-transparent border-0 cursor-pointer font-medium leading-none overflow-visible pointer-events-auto select-none"
                aria-label={open ? 'Close menu' : 'Open menu'}
                aria-expanded={open}
                aria-controls="staggered-menu-panel"
                onClick={toggleMenu}
                type="button"
              >
                <span
                  ref={textWrapRef}
                  className="sm-toggle-textWrap relative inline-block h-[1em] overflow-hidden whitespace-nowrap mr-1"
                  aria-hidden="true"
                >
                  <span ref={textInnerRef} className="sm-toggle-textInner flex flex-col leading-none">
                    {textLines.map((l, i) => (
                      <span className="sm-toggle-line block h-[1em] leading-none" key={i}>{l}</span>
                    ))}
                  </span>
                </span>
                <span
                  ref={iconRef}
                  className="sm-icon relative w-[14px] h-[14px] shrink-0 inline-flex items-center justify-center"
                  aria-hidden="true"
                >
                  <span ref={plusHRef} className="sm-icon-line absolute left-1/2 top-1/2 w-full h-[2px] bg-current rounded-[2px] -translate-x-1/2 -translate-y-1/2" />
                  <span ref={plusVRef} className="sm-icon-line sm-icon-line-v absolute left-1/2 top-1/2 w-full h-[2px] bg-current rounded-[2px] -translate-x-1/2 -translate-y-1/2" />
                </span>
              </button>
            </>
          )}
        </header>

        {/* Slide-in Panel */}
        <aside
          id="staggered-menu-panel"
          ref={panelRef}
          className="staggered-menu-panel absolute top-0 h-full flex flex-col overflow-y-auto z-10 pointer-events-auto"
          style={{ [position === 'left' ? 'left' : 'right']: 0 }}
          aria-hidden={!open}
        >
          <div className="sm-panel-inner flex-1 flex flex-col gap-5 pt-[5.5rem] pb-8 px-8">
            {/* Menu items */}
            <ul
              className="sm-panel-list list-none m-0 p-0 flex flex-col gap-1"
              role="list"
              data-numbering={displayItemNumbering || undefined}
            >
              {items && items.length ? items.map((it, idx) => {
                const hoverColor = colorsPalette[idx % colorsPalette.length];
                return (
                  <li className="sm-panel-itemWrap relative overflow-hidden leading-none" key={it.label + idx}>
                    {it.onClick ? (
                      <button
                        type="button"
                        className="sm-panel-item relative text-black font-semibold cursor-pointer leading-none tracking-[-2px] uppercase transition-colors duration-150 inline-block bg-transparent border-0 text-left"
                        aria-label={it.ariaLabel}
                        data-index={idx + 1}
                        onClick={() => { it.onClick?.(); closeMenu(); }}
                        style={{ '--hover-color': hoverColor } as React.CSSProperties}
                      >
                        <span className="sm-panel-itemLabel inline-block [transform-origin:50%_100%] will-change-transform">
                          {it.label}
                        </span>
                        {displayItemNumbering && (
                          <span className="sm-panel-number">
                            {idx + 1 < 10 ? `0${idx + 1}` : idx + 1}
                          </span>
                        )}
                      </button>
                    ) : (
                      <a
                        className="sm-panel-item relative text-black font-semibold cursor-pointer leading-none tracking-[-2px] uppercase transition-colors duration-150 inline-block no-underline"
                        href={it.link}
                        aria-label={it.ariaLabel}
                        data-index={idx + 1}
                        style={{ '--hover-color': hoverColor } as React.CSSProperties}
                      >
                        <span className="sm-panel-itemLabel inline-block [transform-origin:50%_100%] will-change-transform">
                          {it.label}
                        </span>
                        {displayItemNumbering && (
                          <span className="sm-panel-number">
                            {idx + 1 < 10 ? `0${idx + 1}` : idx + 1}
                          </span>
                        )}
                      </a>
                    )}
                  </li>
                );
              }) : (
                <li className="sm-panel-itemWrap relative overflow-hidden leading-none" aria-hidden="true">
                  <span className="sm-panel-item inline-block text-black/30 tracking-[-2px] uppercase text-4xl">No items</span>
                </li>
              )}
            </ul>

            {/* Socials */}
            {displaySocials && socialItems && socialItems.length > 0 && (
              <div className="sm-socials mt-auto pt-8 flex flex-col gap-3" aria-label="Social links">
                <h3 className="sm-socials-title m-0 text-base font-medium" style={{ color: accentColor }}>Socials</h3>
                <ul className="sm-socials-list list-none m-0 p-0 flex flex-row items-center gap-4 flex-wrap" role="list">
                  {socialItems.map((s, i) => (
                    <li key={s.label + i} className="sm-socials-item">
                      <a href={s.link} target="_blank" rel="noopener noreferrer" className="sm-socials-link text-[1.2rem] font-medium text-[#111] no-underline inline-block py-[2px]">
                        {s.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* Scoped styles */}
      <style>{`
        .sm-scope .staggered-menu-wrapper { position: relative; width: 100%; height: 100%; z-index: 40; pointer-events: none; }
        .sm-scope .staggered-menu-header { position: absolute; top: 0; left: 0; width: 100%; display: flex; align-items: center; justify-content: space-between; padding: 1.25rem 2rem; background: transparent; border-bottom: none; box-shadow: none; pointer-events: auto; z-index: 20; }
        
        .sm-scope .sm-toggle { 
          position: relative; 
          display: inline-flex; 
          align-items: center; 
          gap: 0.4rem; 
          background: transparent; 
          border: none; 
          box-shadow: none;
          border-radius: 0;
          padding: 6px 12px;
          cursor: pointer; 
          font-family: var(--font-heading), 'Plus Jakarta Sans', sans-serif;
          font-weight: 800; 
          font-size: 0.9rem;
          color: #000;
          text-transform: uppercase;
          line-height: 1; 
          overflow: visible; 
          transition: all 0.2s ease;
        }
        .sm-scope .sm-toggle:hover {
          transform: scale(1.06) rotate(-1.5deg);
          color: var(--sm-accent, #5227FF);
        }
        .sm-scope .sm-toggle:active {
          transform: scale(0.96) rotate(0deg);
        }
        .sm-scope .sm-toggle:focus-visible { outline: 2px solid #000; outline-offset: 2px; }
        .sm-scope .sm-toggle-textWrap { position: relative; display: inline-block; height: 1em; overflow: hidden; white-space: nowrap; }
        .sm-scope .sm-toggle-textInner { display: flex; flex-direction: column; line-height: 1; }
        .sm-scope .sm-toggle-line { display: block; height: 1em; line-height: 1; }
        .sm-scope .sm-icon { position: relative; width: 12px; height: 12px; flex: 0 0 12px; display: inline-flex; align-items: center; justify-content: center; will-change: transform; }
        .sm-scope .sm-icon-line { position: absolute; left: 50%; top: 50%; width: 100%; height: 2.5px; background: #000; border-radius: 2px; transform: translate(-50%, -50%); will-change: transform; }
        
        .sm-scope .staggered-menu-panel { 
          width: clamp(320px, 35vw, 420px); 
          background: #fff; 
          border-left: none;
          border-right: none;
        }
        .sm-scope .staggered-menu-wrapper[data-position="left"] .staggered-menu-panel {
          border-right: 3px solid #000;
        }
        .sm-scope .staggered-menu-wrapper[data-position="right"] .staggered-menu-panel {
          border-left: 3px solid #000;
        }
        .sm-scope .sm-prelayers { width: clamp(320px, 35vw, 420px); }
        .sm-scope .sm-prelayer { position: absolute; top: 0; height: 100%; width: 100%; border: none; }
        
        .sm-scope .sm-panel-inner { flex: 1; display: flex; flex-direction: column; gap: 1.5rem; pt-[5.5rem] pb-8 px-8; }
        
        .sm-scope .sm-panel-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.25rem; }
        .sm-scope .sm-panel-itemWrap { position: relative; overflow: visible; line-height: 1; }
        
        .sm-scope .sm-panel-item { 
          position: relative; 
          display: inline-flex;
          align-items: flex-start;
          justify-content: flex-start;
          width: auto;
          max-width: max-content;
          padding: 8px 16px;
          background: transparent;
          border: 3px solid transparent;
          border-radius: 12px;
          font-family: var(--font-heading), 'Plus Jakarta Sans', sans-serif;
          font-weight: 800;
          font-size: clamp(1.8rem, 4vw, 2.5rem);
          color: #000;
          text-transform: uppercase;
          box-shadow: none;
          transition: all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
          text-decoration: none;
          cursor: pointer;
          letter-spacing: -2px;
          line-height: 1;
        }
        
        .sm-scope .sm-panel-itemWrap:nth-child(odd) .sm-panel-item:hover { 
          transform: translate(-4px, -4px) rotate(-1.5deg) scale(1.02);
          box-shadow: 7px 7px 0px 0px #000;
          background: var(--hover-color, #FBBF24);
          border-color: #000;
        }
        .sm-scope .sm-panel-itemWrap:nth-child(even) .sm-panel-item:hover { 
          transform: translate(-4px, -4px) rotate(1.5deg) scale(1.02);
          box-shadow: 7px 7px 0px 0px #000;
          background: var(--hover-color, #FBBF24);
          border-color: #000;
        }
        
        .sm-scope .sm-panel-item:active {
          transform: translate(1px, 1px) rotate(0deg) scale(1);
          box-shadow: 2px 2px 0px 0px #000;
        }
        
        .sm-scope .sm-panel-number {
          font-family: var(--font-mono), 'Space Mono', monospace;
          font-size: 0.32em;
          font-weight: 800;
          color: var(--sm-accent, #5227FF);
          margin-left: 6px;
          line-height: 1;
          align-self: flex-start;
          margin-top: -0.15em;
          opacity: var(--sm-num-opacity, 0);
          transition: all 0.2s ease;
        }
        .sm-scope .sm-panel-item:hover .sm-panel-number {
          color: #000;
          transform: scale(1.1) rotate(-5deg);
        }
        
        .sm-scope .sm-panel-itemLabel { 
          display: inline-block; 
          will-change: transform; 
          transform-origin: 50% 100%; 
          line-height: 1;
        }
        
        .sm-scope .sm-socials { margin-top: auto; padding-top: 1.5rem; display: flex; flex-direction: column; gap: 0.5rem; border-top: 1.5px dashed #e2e8f0; }
        .sm-scope .sm-socials-title { font-weight: 800; font-size: 0.85rem; text-transform: uppercase; color: var(--sm-accent, #5227FF); margin: 0; font-family: var(--font-heading), 'Plus Jakarta Sans', sans-serif; }
        .sm-scope .sm-socials-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: row; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
        .sm-scope .sm-socials-link { 
          font-size: 0.85rem; 
          font-weight: 800; 
          color: #555; 
          text-decoration: none; 
          background: transparent;
          border: 2px solid transparent;
          border-radius: 8px;
          padding: 4px 8px;
          transition: all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
          display: inline-block;
          font-family: var(--font-heading), 'Plus Jakarta Sans', sans-serif;
        }
        .sm-scope .sm-socials-link:hover { 
          transform: translate(-3px, -3px) rotate(-2deg);
          box-shadow: 4px 4px 0px 0px #000;
          background: #EC4899; 
          border-color: #000;
          color: #fff;
        }
        
        @media (max-width: 768px) {
          .sm-scope .staggered-menu-panel, .sm-scope .sm-prelayers { width: 100%; }
        }
      `}</style>
    </div>
  );
};

export default StaggeredMenu;
