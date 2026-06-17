/* ============================================================
   THE SALON AGENT — app.js
   ============================================================ */

/* ── Navbar scroll ────────────────────────────────────────── */
const navbar = document.getElementById('navbar');
window.addEventListener('scroll', () => {
  navbar.classList.toggle('scrolled', window.scrollY > 20);
}, { passive: true });

/* ── Mobile menu ──────────────────────────────────────────── */
const hamburger = document.getElementById('hamburger');
const mobileMenu = document.getElementById('mobile-menu');
hamburger.addEventListener('click', () => {
  mobileMenu.classList.toggle('open');
});
mobileMenu.querySelectorAll('a').forEach(a => {
  a.addEventListener('click', () => mobileMenu.classList.remove('open'));
});

/* ── Hero canvas (lightweight particle field — no Three.js, no O(n²) lines) ── */
(function initCanvas() {
  const canvas = document.getElementById('hero-canvas');
  if (!canvas) return;

  // Skip on low-end / mobile to save battery
  const isMobile = window.matchMedia('(max-width: 768px)').matches;
  if (isMobile) { canvas.style.display = 'none'; return; }

  const ctx = canvas.getContext('2d', { alpha: true });
  let W, H, particles = [], rafId = null, visible = true;

  const COUNT = 45; // was 80 — fewer particles, much lighter

  function resize() {
    W = canvas.width  = canvas.offsetWidth;
    H = canvas.height = canvas.offsetHeight;
  }

  function create() {
    particles = Array.from({ length: COUNT }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      r: Math.random() * 1.2 + 0.3,
      vx: (Math.random() - 0.5) * 0.2,
      vy: (Math.random() - 0.5) * 0.2,
      a: Math.random() * 0.35 + 0.08,
    }));
  }

  function tick() {
    if (!visible) { rafId = null; return; }
    ctx.clearRect(0, 0, W, H);

    for (const p of particles) {
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0) p.x = W; else if (p.x > W) p.x = 0;
      if (p.y < 0) p.y = H; else if (p.y > H) p.y = 0;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, 6.2832);
      ctx.fillStyle = `rgba(201,168,76,${p.a})`;
      ctx.fill();
    }

    rafId = requestAnimationFrame(tick);
  }

  // Pause animation when hero is off-screen
  const observer = new IntersectionObserver(entries => {
    visible = entries[0].isIntersecting;
    if (visible && !rafId) rafId = requestAnimationFrame(tick);
  }, { threshold: 0 });
  observer.observe(canvas);

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { resize(); create(); }, 200);
  }, { passive: true });

  resize(); create();
  rafId = requestAnimationFrame(tick);
})();

/* ── ROI Calculator ───────────────────────────────────────── */
(function initROI() {
  const sliderCalls   = document.getElementById('slider-calls');
  const sliderBooking = document.getElementById('slider-booking');
  const sliderPct     = document.getElementById('slider-pct');
  if (!sliderCalls) return;

  const valCalls   = document.getElementById('val-calls');
  const valBooking = document.getElementById('val-booking');
  const valPct     = document.getElementById('val-pct');
  const roiLost    = document.getElementById('roi-lost');
  const roiDetail  = document.getElementById('roi-detail');
  const roiMult    = document.getElementById('roi-multiplier');

  function update() {
    const calls   = parseInt(sliderCalls.value, 10);
    const booking = parseInt(sliderBooking.value, 10);
    const pct     = parseInt(sliderPct.value, 10);

    valCalls.textContent   = calls;
    valBooking.textContent = booking;
    valPct.textContent     = pct;

    const missedPerMonth = calls * 4.3;
    const lostPerMonth = Math.round(missedPerMonth * (pct / 100) * booking);
    const multiplier = (lostPerMonth / 599).toFixed(1);

    roiLost.textContent = '$' + lostPerMonth.toLocaleString();
    roiMult.textContent = multiplier + '×';
  }

  sliderCalls.addEventListener('input', update);
  sliderBooking.addEventListener('input', update);
  sliderPct.addEventListener('input', update);
  update();
})();

/* ── FAQ Accordion ────────────────────────────────────────── */
document.querySelectorAll('.faq-q').forEach(btn => {
  btn.addEventListener('click', () => {
    const item = btn.closest('.faq-item');
    const ans  = item.querySelector('.faq-a');
    const isOpen = item.classList.contains('open');

    // Close all
    document.querySelectorAll('.faq-item.open').forEach(el => {
      el.classList.remove('open');
      el.querySelector('.faq-a').classList.remove('open');
    });

    if (!isOpen) {
      item.classList.add('open');
      ans.classList.add('open');
    }
  });
});

/* ── Multi-step form ──────────────────────────────────────── */
(function initForm() {
  const form    = document.getElementById('intake-form');
  if (!form) return;

  const panels  = form.querySelectorAll('.form-panel');
  const steps   = document.querySelectorAll('.form-step');
  const success = document.getElementById('form-success');

  function goToPanel(n) {
    panels.forEach(p => p.classList.remove('active'));
    const next = document.getElementById('panel-' + n);
    if (next) next.classList.add('active');

    steps.forEach((s, i) => {
      s.classList.remove('active', 'done');
      if (i + 1 < n)  s.classList.add('done');
      if (i + 1 === n) s.classList.add('active');
    });

    // Update "done" bubbles to show checkmarks
    steps.forEach((s, i) => {
      const bubble = s.querySelector('.step-bubble');
      if (i + 1 < n) bubble.textContent = '✓';
      else bubble.textContent = i + 1;
    });
  }

  // Next buttons
  form.querySelectorAll('.btn-next').forEach(btn => {
    btn.addEventListener('click', () => {
      const nextPanel = parseInt(btn.dataset.next, 10);
      const currentPanel = document.getElementById('panel-' + btn.closest('.form-panel').id.split('-')[1]);

      // Basic validation for step 1
      if (nextPanel === 2) {
        const name  = document.getElementById('f-name');
        const salon = document.getElementById('f-salon');
        const email = document.getElementById('f-email');
        if (!name.value.trim() || !salon.value.trim() || !email.value.trim()) {
          highlightEmpty([name, salon, email]);
          return;
        }
        if (!isValidEmail(email.value)) {
          email.style.borderColor = 'rgba(248,113,113,0.5)';
          email.focus();
          return;
        }
      }

      // Validation for step 2
      if (nextPanel === 3) {
        const services = document.getElementById('f-services');
        if (!services.value.trim()) {
          services.style.borderColor = 'rgba(248,113,113,0.5)';
          services.focus();
          return;
        }
      }

      goToPanel(nextPanel);
      // Scroll the form into view
      document.getElementById('intake-right') && document.getElementById('intake-right').scrollIntoView({ behavior:'smooth', block:'nearest' });
    });
  });

  // Back buttons
  form.querySelectorAll('.btn-back').forEach(btn => {
    btn.addEventListener('click', () => {
      goToPanel(parseInt(btn.dataset.back, 10));
    });
  });

  // Submit
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn  = form.querySelector('.btn-submit');
    const submitText = form.querySelector('.submit-text');
    const submitLoad = form.querySelector('.submit-loading');

    submitBtn.disabled = true;
    submitText.style.display = 'none';
    submitLoad.style.display = 'inline';

    // Gather data
    const data = {
      name:          document.getElementById('f-name')?.value || '',
      salon:         document.getElementById('f-salon')?.value || '',
      email:         document.getElementById('f-email')?.value || '',
      phone:         document.getElementById('f-phone')?.value || '',
      size:          document.getElementById('f-size')?.value || '',
      callsPerWeek:  document.getElementById('f-calls')?.value || '',
      bookingSystem: document.getElementById('f-booking')?.value || '',
      services:      document.getElementById('f-services')?.value || '',
      painPoints:    [...form.querySelectorAll('input[name="pain"]:checked')].map(c => c.value).join(', '),
      decisionMaker: document.getElementById('f-decision')?.value || '',
      submittedAt:   new Date().toISOString(),
    };

    try {
      // Replace with your actual submission endpoint
      const endpoint = form.dataset.endpoint || '/api/intake';
      await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
    } catch (_err) {
      // Still show success even if endpoint isn't wired yet
    }

    // Show success
    panels.forEach(p => p.classList.remove('active'));
    document.querySelector('.form-steps').style.display = 'none';
    success.style.display = 'block';
  });

  function highlightEmpty(fields) {
    fields.forEach(f => {
      if (!f.value.trim()) {
        f.style.borderColor = 'rgba(248,113,113,0.5)';
        f.addEventListener('input', () => f.style.borderColor = '', { once: true });
      }
    });
    const first = fields.find(f => !f.value.trim());
    if (first) first.focus();
  }

  function isValidEmail(v) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  }

  // Reset border on input
  form.querySelectorAll('input, select, textarea').forEach(el => {
    el.addEventListener('input', () => { el.style.borderColor = ''; });
  });
})();

/* ── Demo transcript animation ────────────────────────────── */
(function initDemo() {
  const lines = [
    { id: 'tr-client',  delay: 3000 },
    { id: 'tr-ai2',     delay: 5500 },
    { id: 'tr-client2', delay: 8000 },
    { id: 'tr-ai3',     delay: 10500 },
  ];

  const observed = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        lines.forEach(({ id, delay }) => {
          setTimeout(() => {
            const el = document.getElementById(id);
            if (el) {
              el.style.transition = 'opacity 0.5s, transform 0.5s';
              el.style.opacity = '1';
              el.style.transform = 'translateY(0)';
            }
          }, delay);
        });
        observed.disconnect();
      }
    });
  }, { threshold: 0.3 });

  const demo = document.querySelector('.phone-shell');
  if (demo) observed.observe(demo);
})();

/* ── Scroll reveal ────────────────────────────────────────── */
(function initReveal() {
  const targets = document.querySelectorAll(
    '.feature-card, .step-item, .cost-card, .plan-card, .testi-card, .setup-col, .setup-timeline, .faq-item, .tl-step'
  );

  targets.forEach(el => el.classList.add('reveal'));

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry, i) => {
      if (entry.isIntersecting) {
        const delay = parseInt(entry.target.dataset.delay || '0', 10);
        setTimeout(() => entry.target.classList.add('visible'), delay);
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

  targets.forEach(el => observer.observe(el));
})();

/* ── Smooth anchor scroll (offset for fixed nav) ─────────── */
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    const target = document.querySelector(a.getAttribute('href'));
    if (target) {
      e.preventDefault();
      const offset = 80;
      const top = target.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top, behavior: 'smooth' });
    }
  });
});
