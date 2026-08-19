'use client';

import React, { useCallback, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

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
  const [isScrolled, setIsScrolled] = useState(false);

  const panelRef = useRef<HTMLElement>(null);
  const toggleBtnRef = useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 20) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const toggleMenu = useCallback(() => {
    setOpen((prev) => {
      const next = !prev;
      if (next) {
        onMenuOpen?.();
      } else {
        onMenuClose?.();
      }
      return next;
    });
  }, [onMenuOpen, onMenuClose]);

  const closeMenu = useCallback(() => {
    setOpen(false);
    onMenuClose?.();
  }, [onMenuClose]);

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

  const offscreenX = position === 'left' ? '-100%' : '100%';
  const buttonColor = (changeMenuColorOnOpen && open) ? openMenuButtonColor : menuButtonColor;

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
        {/* Header — Headless at top, transforms to Floating Navbar on scroll */}
        <header
          className={`staggered-menu-header transition-all duration-300 pointer-events-auto z-50 ${
            isScrolled 
              ? 'fixed top-3 left-4 right-4 md:left-8 md:right-8 max-w-[1550px] mx-auto bg-white/92 backdrop-blur-md border-2 border-black rounded-2xl px-4 py-2.5 shadow-[4px_4px_0px_#000]' 
              : 'absolute top-0 left-0 w-full flex items-center justify-between px-5 py-4 bg-transparent border-none shadow-none'
          }`}
          aria-label="Main navigation header"
        >
          {position === 'left' ? (
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
                  style={{ color: buttonColor }}
                >
                  <span className="sm-toggle-textWrap relative inline-block h-[1em] overflow-hidden whitespace-nowrap mr-1" aria-hidden="true">
                    <span className="sm-toggle-textInner flex flex-col leading-none">
                      <span className="sm-toggle-line block h-[1em] leading-none">{open ? 'Close' : 'Menu'}</span>
                    </span>
                  </span>
                  <motion.span
                    className="sm-icon relative w-[14px] h-[14px] shrink-0 inline-flex items-center justify-center"
                    aria-hidden="true"
                    animate={{ rotate: open ? 45 : 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <span className="sm-icon-line absolute left-1/2 top-1/2 w-full h-[2px] bg-current rounded-[2px] -translate-x-1/2 -translate-y-1/2" />
                    <span className="sm-icon-line sm-icon-line-v absolute left-1/2 top-1/2 w-full h-[2px] bg-current rounded-[2px] -translate-x-1/2 -translate-y-1/2" style={{ transform: 'translate(-50%, -50%) rotate(90deg)' }} />
                  </motion.span>
                </button>

                <span className="h-5 w-[1.5px] bg-black/15 shrink-0" />

                <div>
                  {headerLeft ?? (
                    <div className="sm-logo flex items-center select-none gap-2" aria-label="Logo">
                      {logoUrl ? (
                        <img src={logoUrl} alt="Logo" className="block h-8 w-auto object-contain" draggable={false} />
                      ) : null}
                      {logoText ? (
                        <span className="font-black text-xl tracking-tight" style={{ color: buttonColor }}>{logoText}</span>
                      ) : null}
                    </div>
                  )}
                </div>
              </div>
              <div className="pointer-events-auto" />
            </>
          ) : (
            <>
              <div className="pointer-events-auto">
                {headerLeft ?? (
                  <div className="sm-logo flex items-center select-none gap-2" aria-label="Logo">
                    {logoUrl ? (
                      <img src={logoUrl} alt="Logo" className="block h-8 w-auto object-contain" draggable={false} />
                    ) : null}
                    {logoText ? (
                      <span className="font-black text-xl tracking-tight" style={{ color: buttonColor }}>{logoText}</span>
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
                style={{ color: buttonColor }}
              >
                <span className="sm-toggle-textWrap relative inline-block h-[1em] overflow-hidden whitespace-nowrap mr-1" aria-hidden="true">
                  <span className="sm-toggle-textInner flex flex-col leading-none">
                    <span className="sm-toggle-line block h-[1em] leading-none">{open ? 'Close' : 'Menu'}</span>
                  </span>
                </span>
                <motion.span
                  className="sm-icon relative w-[14px] h-[14px] shrink-0 inline-flex items-center justify-center"
                  aria-hidden="true"
                  animate={{ rotate: open ? 45 : 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <span className="sm-icon-line absolute left-1/2 top-1/2 w-full h-[2px] bg-current rounded-[2px] -translate-x-1/2 -translate-y-1/2" />
                  <span className="sm-icon-line sm-icon-line-v absolute left-1/2 top-1/2 w-full h-[2px] bg-current rounded-[2px] -translate-x-1/2 -translate-y-1/2" style={{ transform: 'translate(-50%, -50%) rotate(90deg)' }} />
                </motion.span>
              </button>
            </>
          )}
        </header>

        {/* Slide-in Panel with Framer Motion */}
        <AnimatePresence>
          {open && (
            <motion.aside
              id="staggered-menu-panel"
              ref={panelRef}
              initial={{ x: offscreenX }}
              animate={{ x: 0 }}
              exit={{ x: offscreenX }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="staggered-menu-panel absolute top-0 h-full flex flex-col overflow-y-auto z-10 pointer-events-auto"
              style={{ [position === 'left' ? 'left' : 'right']: 0 }}
              aria-hidden={!open}
            >
              <div className="sm-panel-inner flex-1 flex flex-col gap-5 pt-[5.5rem] pb-8 px-8">
                <motion.ul
                  className="sm-panel-list list-none m-0 p-0 flex flex-col gap-1"
                  role="list"
                  data-numbering={displayItemNumbering || undefined}
                  initial="closed"
                  animate="open"
                  exit="closed"
                  variants={{
                    open: { transition: { staggerChildren: 0.035, delayChildren: 0.05 } },
                    closed: { transition: { staggerChildren: 0.025, staggerDirection: -1 } }
                  }}
                >
                  {items && items.length ? items.map((it, idx) => {
                    const hoverColor = colorsPalette[idx % colorsPalette.length];
                    return (
                      <motion.li
                        key={it.label + idx}
                        className="sm-panel-itemWrap relative overflow-hidden leading-none"
                        variants={{
                          open: { opacity: 1, y: 0, rotate: 0, transition: { duration: 0.2, ease: [0.23, 1, 0.32, 1] } },
                          closed: { opacity: 0, y: 12, rotate: 2, transition: { duration: 0.12, ease: "easeIn" } }
                        }}
                      >
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
                              <span className="sm-panel-number" style={{ opacity: 1 }}>
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
                              <span className="sm-panel-number" style={{ opacity: 1 }}>
                                {idx + 1 < 10 ? `0${idx + 1}` : idx + 1}
                              </span>
                            )}
                          </a>
                        )}
                      </motion.li>
                    );
                  }) : (
                    <li className="sm-panel-itemWrap relative overflow-hidden leading-none" aria-hidden="true">
                      <span className="sm-panel-item inline-block text-black/30 tracking-[-2px] uppercase text-4xl">No items</span>
                    </li>
                  )}
                </motion.ul>

                {/* Socials */}
                {displaySocials && socialItems && socialItems.length > 0 && (
                  <motion.div
                    className="sm-socials mt-auto pt-8 flex flex-col gap-3"
                    aria-label="Social links"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                  >
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
                  </motion.div>
                )}
              </div>
            </motion.aside>
          )}
        </AnimatePresence>
      </div>

      {/* Scoped styles */}
      <style>{`
        .sm-scope .staggered-menu-wrapper { position: relative; width: 100%; height: 100%; z-index: 40; pointer-events: none; }
        .sm-scope .staggered-menu-header { pointer-events: auto; }
        
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
          .sm-scope .staggered-menu-panel { width: 100%; }
        }
      `}</style>
    </div>
  );
};

export default StaggeredMenu;
