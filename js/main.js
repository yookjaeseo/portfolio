/* =========================
   Convicts-inspired interactions (v2)
   Adds:
   - Intro black-screen type burst (3–5s)
   - Cursor: hover enlargement + mode states (hover/play/drag)
   - Multi-page navigation + shared overlay menu
   - Slider + fullscreen player
   ========================= */

(() => {
  const $ = (s, el=document) => el.querySelector(s);
  const $$ = (s, el=document) => Array.from(el.querySelectorAll(s));

  const isTouch = matchMedia('(hover: none)').matches;
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;


  /* ---------- Cursor ---------- */
  const cursor = $('.cursor');
  const label = $('.cursor__label');

  let cx = 0, cy = 0, tx = 0, ty = 0;
  // Cursor follow tuning
  // - Higher LERP => less delay / faster follow
  // - SNAP_DIST prevents visible lag when the pointer moves large distances quickly
  const CURSOR_LERP = 0.30;
  const SNAP_DIST = 140;

const clearModes = () => {
    document.body.classList.remove('cursor--hover','cursor--play','cursor--drag');
  };

  if (!isTouch && cursor) {
    document.body.classList.remove('cursor--hide');

    window.addEventListener('mousemove', (e) => {
      tx = e.clientX; ty = e.clientY;
    }, { passive: true });

    window.addEventListener('mousedown', () => document.body.classList.add('cursor--down'));
    window.addEventListener('mouseup', () => document.body.classList.remove('cursor--down'));

    const tick = () => {
      const dx = tx - cx;
      const dy = ty - cy;
      const dist = Math.hypot(dx, dy);
      if (dist > SNAP_DIST) {
        cx = tx;
        cy = ty;
      } else {
        cx += dx * CURSOR_LERP;
        cy += dy * CURSOR_LERP;
      }
      cursor.style.transform = `translate(${cx}px, ${cy}px)`;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);

    const setLabel = (t) => { if (label) label.textContent = (t || 'VIEW'); };

    document.addEventListener('mouseover', (e) => {
      const t = e.target.closest('[data-cursor], a, button');
      if (!t) return;

      document.body.classList.add('cursor--hover');

      const txt = t.getAttribute('data-cursor') || (t.tagName === 'A' ? 'OPEN' : 'VIEW');
      setLabel(txt);

      // Mode states
      if (txt === 'PLAY' || t.hasAttribute('data-open-player')) {
        document.body.classList.add('cursor--play');
      }
      if (t.hasAttribute('data-prev') || t.hasAttribute('data-next') || t.classList.contains('slides')) {
        // slider-related
        document.body.classList.add('cursor--drag');
        setLabel(t.getAttribute('data-cursor') || 'DRAG');
      }
    });

    document.addEventListener('mouseout', (e) => {
      const t = e.target.closest('[data-cursor], a, button');
      if (!t) return;
      clearModes();
      setLabel('VIEW');
    });
  } else {
    document.body.classList.add('cursor--hide');
  }

  /* ---------- Overlay menu ---------- */
  const menu = $('#menu');
  const menuBtn = $('.menuBtn');
  const menuClose = $('.menu__close');

  const openMenu = () => {
    menu?.classList.add('is-open');
    menu?.setAttribute('aria-hidden', 'false');
    menuBtn?.setAttribute('aria-expanded', 'true');
    document.documentElement.style.overflow = 'hidden';
  };
  const closeMenu = () => {
    menu?.classList.remove('is-open');
    menu?.setAttribute('aria-hidden', 'true');
    menuBtn?.setAttribute('aria-expanded', 'false');
    document.documentElement.style.overflow = '';
  };

  menuBtn?.addEventListener('click', () => {
    const isOpen = menu?.classList.contains('is-open');
    isOpen ? closeMenu() : openMenu();
  });
  menuClose?.addEventListener('click', closeMenu);
  menu?.addEventListener('click', (e) => {
    if (e.target.classList.contains('menu__bg')) closeMenu();
  });

  /* ---------- Reveal on scroll ---------- */
  const reveals = $$('.reveal');
  if (!reduceMotion) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(ent => {
        if (ent.isIntersecting) ent.target.classList.add('is-in');
      });
    }, { threshold: 0.18 });
    reveals.forEach(el => io.observe(el));
  } else {
    reveals.forEach(el => el.classList.add('is-in'));
  }

  /* ---------- Slider ---------- */
  const slidesWrap = $('[data-slides]');
  const slides = slidesWrap ? $$('.slide', slidesWrap) : [];
  const dotsWrap = $('[data-dots]');
  const prevBtn = $('[data-prev]');
  const nextBtn = $('[data-next]');
  let sIdx = 0;
  let sTimer = null;

  const ensureVideoLoops = (slide) => {
    const v = $('video', slide);
    if (v) {
      v.muted = true;
      v.loop = true;
      v.playsInline = true;
      v.play().catch(()=>{});
    }
  };

  const setSlide = (i) => {
    if (!slides.length) return;
    sIdx = (i + slides.length) % slides.length;

    slides.forEach((s, k) => s.classList.toggle('is-active', k === sIdx));
    if (dotsWrap) $$('.dot', dotsWrap).forEach((d, k) => d.classList.toggle('is-active', k === sIdx));
    ensureVideoLoops(slides[sIdx]);
  };

  const buildDots = () => {
    if (!dotsWrap || !slides.length) return;
    dotsWrap.innerHTML = '';
    slides.forEach((_, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'dot' + (i === 0 ? ' is-active' : '');
      b.setAttribute('aria-label', `Go to slide ${i+1}`);
      b.addEventListener('click', () => {
        setSlide(i);
        resetAuto();
      });
      dotsWrap.appendChild(b);
    });
  };

  const resetAuto = () => {
    if (!slides.length) return;
    if (sTimer) clearInterval(sTimer);
    sTimer = setInterval(() => setSlide(sIdx + 1), 5200);
  };

  if (slides.length) {
    buildDots();
    setSlide(0);
    resetAuto();
    prevBtn?.addEventListener('click', () => { setSlide(sIdx - 1); resetAuto(); });
    nextBtn?.addEventListener('click', () => { setSlide(sIdx + 1); resetAuto(); });
  }

  /* ---------- Fullscreen player ---------- */
  const player = $('.player');
  const playerTitle = $('[data-player-title]');
  const playerVideo = $('.player__video');
  const playerFrame = $('.player__frame');
  const closeBtns = $$('[data-close-player]');
  const muteBtn = $('[data-toggle-mute]');
  let lastFocus = null;

  const stopAll = () => {
    if (playerVideo) {
      playerVideo.pause();
      playerVideo.removeAttribute('src');
      playerVideo.load();
    }
    if (playerFrame) {
      playerFrame.setAttribute('src', 'about:blank');
    }
  };

  const openPlayer = ({ title, src, poster, embed }) => {
    if (!player) return;

    lastFocus = document.activeElement;

    player.classList.add('is-open');
    player.setAttribute('aria-hidden', 'false');
    document.documentElement.style.overflow = 'hidden';

    if (playerTitle) playerTitle.textContent = title || 'Now Playing';

    // switch mode
    if (embed) {
      playerVideo.style.display = 'none';
      playerFrame.style.display = 'block';
      playerFrame.src = embed;
    } else {
      playerFrame.style.display = 'none';
      playerVideo.style.display = 'block';
      playerVideo.src = src || '';
      if (poster) playerVideo.poster = poster;
      playerVideo.muted = false;
      playerVideo.play().catch(()=>{});
    }

    closeBtns[0]?.focus();
  };

  const closePlayer = () => {
    if (!player) return;

    player.classList.remove('is-open');
    player.setAttribute('aria-hidden', 'true');
    document.documentElement.style.overflow = '';

    stopAll();

    if (lastFocus && typeof lastFocus.focus === 'function') lastFocus.focus();
  };

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-open-player]');
    if (!btn) return;
    e.preventDefault();

    const title = btn.getAttribute('data-title') || btn.textContent.trim();
    const src = btn.getAttribute('data-src');
    const poster = btn.getAttribute('data-poster');
    const embed = btn.getAttribute('data-embed');

    openPlayer({ title, src, poster, embed });
  });

  closeBtns.forEach(b => b.addEventListener('click', closePlayer));

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (menu?.classList.contains('is-open')) closeMenu();
      if (player?.classList.contains('is-open')) closePlayer();
    }
  });

  muteBtn?.addEventListener('click', () => {
    if (!playerVideo || playerVideo.style.display === 'none') return;
    playerVideo.muted = !playerVideo.muted;
    muteBtn.textContent = playerVideo.muted ? 'Unmute' : 'Mute';
  });
})();
