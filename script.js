/* ═══════════════════════════════════════════
   ELENA & LUIS — WEDDING INVITATION
   Script
   ═══════════════════════════════════════════ */

(function () {
  'use strict';

  /* ── Hero Load Effects ──────────────── */
  window.addEventListener('load', () => {
    const hero = document.querySelector('.hero');
    if (hero) hero.classList.add('hero--loaded');
  });

  /* ── Cinematic Scroll Parallax ───────── */
  window.addEventListener('scroll', () => {
    const scrolled = window.scrollY;
    const heroBg = document.querySelector('.hero__bg');
    if (heroBg) {
      heroBg.style.transform = `scale(${1 + scrolled * 0.0003}) translateY(${scrolled * 0.1}px)`;
    }
  }, { passive: true });


  /* ── Countdown Timer ────────────────── */
  const WEDDING_DATE = new Date('2026-10-17T13:00:00+02:00');

  function updateCountdown() {
    const now = new Date();
    const diff = WEDDING_DATE - now;

    if (diff <= 0) {
      const cd = document.getElementById('countdown');
      if (cd) cd.innerHTML = '<p style="font-family:var(--ff-heading);font-size:1.8rem;">¡Hoy es el gran día!</p>';
      return;
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const mins = Math.floor((diff / (1000 * 60)) % 60);
    const secs = Math.floor((diff / 1000) % 60);

    const dEl = document.getElementById('cd-days');
    const hEl = document.getElementById('cd-hours');
    const mEl = document.getElementById('cd-mins');
    const sEl = document.getElementById('cd-secs');

    if (dEl) dEl.textContent = String(days).padStart(3, '0');
    if (hEl) hEl.textContent = String(hours).padStart(2, '0');
    if (mEl) mEl.textContent = String(mins).padStart(2, '0');
    if (sEl) sEl.textContent = String(secs).padStart(2, '0');
  }

  updateCountdown();
  setInterval(updateCountdown, 1000);


  /* ── Navigation ─────────────────────── */
  const nav = document.getElementById('main-nav');
  const toggle = document.getElementById('nav-toggle');
  const navLinks = document.getElementById('nav-links');
  const overlay = document.getElementById('nav-overlay');

  function handleNavScroll() {
    if (nav) nav.classList.toggle('nav--scrolled', window.scrollY > 60);
  }
  window.addEventListener('scroll', handleNavScroll, { passive: true });
  handleNavScroll();

  function closeMenu() {
    if (navLinks) navLinks.classList.remove('open');
    if (overlay) overlay.classList.remove('active');
    if (toggle) toggle.setAttribute('aria-expanded', 'false');
  }

  if (toggle) {
    toggle.addEventListener('click', () => {
      const isOpen = navLinks.classList.toggle('open');
      toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      if (overlay) overlay.classList.toggle('active');
    });
  }

  if (overlay) {
    overlay.addEventListener('click', closeMenu);
  }

  if (navLinks) {
    navLinks.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', closeMenu);
    });
  }


  /* ── Smooth Scroll & Active State ───── */
  const sections = document.querySelectorAll('section[id]');

  window.addEventListener('scroll', () => {
    let current = '';
    sections.forEach(section => {
      const sectionTop = section.offsetTop;
      if (window.scrollY >= sectionTop - 100) {
        current = section.getAttribute('id');
      }
    });

    if (navLinks) {
      navLinks.querySelectorAll('a').forEach(a => {
        a.classList.remove('active');
        if (a.getAttribute('href').includes(current)) {
          a.classList.add('active');
        }
      });
    }
  }, { passive: true });

  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      const target = document.querySelector(this.getAttribute('href'));
      if (target) {
        e.preventDefault();
        window.scrollTo({
          top: target.offsetTop - 70,
          behavior: 'smooth'
        });
      }
    });
  });


  /* ── Calendar Button ────────────────── */
  const calendarBtn = document.getElementById('calendar-btn');

  if (calendarBtn) {
    calendarBtn.addEventListener('click', (e) => {
      e.preventDefault();

      const event = {
        title: 'Boda Elena y Luis',
        location: 'Bodega Laus, Barbastro, Somontano',
        description: '¡Nos casamos! Acompáñanos en este día tan especial.',
        startDate: '20261017T100000Z',
        endDate: '20261018T040000Z'
      };

      const googleUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(event.title)}&dates=${event.startDate}/${event.endDate}&details=${encodeURIComponent(event.description)}&location=${encodeURIComponent(event.location)}`;

      window.open(googleUrl, '_blank');
    });
  }


  /* ── Scroll Reveal (IntersectionObserver) ── */
  const revealElements = document.querySelectorAll('.reveal');

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            // Staggered reveal for children
            const children = entry.target.querySelectorAll('.reveal-child');
            children.forEach((child, i) => {
              setTimeout(() => child.classList.add('visible'), i * 150);
            });
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -50px 0px' }
    );

    revealElements.forEach(el => observer.observe(el));
  } else {
    revealElements.forEach(el => el.classList.add('visible'));
  }

})();
