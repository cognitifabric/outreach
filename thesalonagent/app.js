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

/* Contribution illustration: completed incremental appointments, not speculative lost revenue. */
(function initROI() {
  const calls=document.getElementById('slider-calls'),booking=document.getElementById('slider-booking'),pct=document.getElementById('slider-pct'),fee=document.getElementById('roi-fee');
  function update(){
    const a=Number(calls.value),t=Number(booking.value),m=Number(pct.value),f=fee.value===''?NaN:Number(fee.value);
    document.getElementById('val-calls').textContent=a;document.getElementById('val-booking').textContent=t;document.getElementById('val-pct').textContent=m;
    if(!Number.isFinite(f)||f<0){document.getElementById('roi-lost').textContent='Enter a fee';document.getElementById('roi-detail').textContent='Enter a nonnegative monthly fee.';return}
    const per=t*m/100;
    document.getElementById('roi-lost').textContent=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(a*per-f);
    document.getElementById('roi-detail').textContent=per>0 ? Math.ceil(f/per)+' additional completed appointments would cover the fee.' : f===0?'No monthly fee to cover.':'Positive contribution per appointment is needed to cover the fee.';
  }
  [calls,booking,pct,fee].forEach(el=>el.addEventListener('input',update));update();
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
      el.querySelector('.faq-q').setAttribute('aria-expanded','false');
    });

    if (!isOpen) {
      item.classList.add('open');
      ans.classList.add('open');
      btn.setAttribute('aria-expanded','true');
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
    const errorBox = document.getElementById('form-error');
    errorBox.hidden = true;

    // Gather data
    const data = {
      name:          document.getElementById('f-name')?.value || '',
      salon:         document.getElementById('f-salon')?.value || '',
      email:         document.getElementById('f-email')?.value || '',
      phone:         document.getElementById('f-phone')?.value || '',
      size:          document.getElementById('f-size')?.value || '',
      calls:         document.getElementById('f-calls')?.value || '',
      bookingSystem: document.getElementById('f-booking')?.value || '',
      services:      document.getElementById('f-services')?.value || '',
      painPoints:    [...form.querySelectorAll('input[name="pain"]:checked')].map(c => c.value).join(', '),
      decision:      document.getElementById('f-decision')?.value || '',
      submittedAt:   new Date().toISOString(),
    };

    try {
      const endpoint = form.dataset.endpoint || '/api/intake';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        signal: AbortSignal.timeout(15000),
      });
      const result = await response.json();
      if (!response.ok || result.ok !== true) throw new Error(result.error || 'We could not save your enquiry. Please try again.');
      document.getElementById('submission-reference').textContent = 'Enquiry reference: ' + result.id;
    } catch (err) {
      errorBox.querySelector('.error-text').textContent = ['TimeoutError', 'TypeError'].includes(err.name)
        ? 'We could not confirm that your enquiry was saved. Your details are still here; try again or message us on Instagram.'
        : err.message || 'We could not save your enquiry. Please try again or contact us on Instagram.';
      errorBox.hidden = false;
      errorBox.focus();
      submitBtn.disabled = false;
      submitText.style.display = '';
      submitLoad.style.display = 'none';
      return;
    }

    // Show success
    panels.forEach(p => p.classList.remove('active'));
    document.querySelector('.form-steps').style.display = 'none';
    success.style.display = 'block';
    success.setAttribute('tabindex', '-1');
    success.focus();
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

/* Keep a usable contact path when durable storage has not been configured. */
fetch('/api/public-config').then(r => {
  if (!r.ok) throw new Error('Configuration unavailable');
  return r.json();
}).then(config => {
  if (!config.intakeEnabled) {
    document.getElementById('intake-unavailable').hidden = false;
    document.getElementById('intake-form').hidden = true;
    document.querySelector('.form-steps').hidden = true;
  }
}).catch(() => {});

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
    const href = a.getAttribute('href');
    if (href === '#') return;
    const target = document.querySelector(href);
    if (target) {
      e.preventDefault();
      const offset = 80;
      const top = target.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top, behavior: 'smooth' });
    }
  });
});
