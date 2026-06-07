/* =========================================
   SALONAI — app.js
   Three.js hero + all interactivity
   ========================================= */

// ── THREE.JS HERO ──────────────────────────────────────────────────

(function initHero() {
  const canvas = document.getElementById('hero-canvas');
  if (!canvas || typeof THREE === 'undefined') return;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0x0a0a0f, 1);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 200);
  camera.position.set(0, 0, 30);

  // ── Particle field ──
  const PARTICLE_COUNT = 2800;
  const positions = new Float32Array(PARTICLE_COUNT * 3);
  const colors = new Float32Array(PARTICLE_COUNT * 3);
  const sizes = new Float32Array(PARTICLE_COUNT);

  const gold = new THREE.Color(0xc9a96e);
  const dim  = new THREE.Color(0x333344);

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const i3 = i * 3;
    // Spread in a large sphere
    const radius = 20 + Math.random() * 40;
    const theta  = Math.random() * Math.PI * 2;
    const phi    = Math.acos(2 * Math.random() - 1);

    positions[i3]     = radius * Math.sin(phi) * Math.cos(theta);
    positions[i3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
    positions[i3 + 2] = radius * Math.cos(phi);

    // Blend gold ↔ dim based on proximity to origin
    const t = Math.pow(Math.random(), 2.5);
    const c = dim.clone().lerp(gold, t * 0.5);
    colors[i3]     = c.r;
    colors[i3 + 1] = c.g;
    colors[i3 + 2] = c.b;

    sizes[i] = 0.5 + Math.random() * 2.5;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color',    new THREE.BufferAttribute(colors, 3));
  geo.setAttribute('size',     new THREE.BufferAttribute(sizes, 1));

  // Round sprite texture
  const spriteTex = (function () {
    const size = 64;
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d');
    const grad = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2);
    grad.addColorStop(0,   'rgba(255,255,255,1)');
    grad.addColorStop(0.4, 'rgba(255,255,255,0.6)');
    grad.addColorStop(1,   'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    return new THREE.CanvasTexture(c);
  })();

  const mat = new THREE.PointsMaterial({
    size: 0.12,
    sizeAttenuation: true,
    vertexColors: true,
    map: spriteTex,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const particles = new THREE.Points(geo, mat);
  scene.add(particles);

  // ── Floating rings ──
  function addRing(radius, tube, color, opacity, y, rotX) {
    const geo = new THREE.TorusGeometry(radius, tube, 16, 120);
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity, wireframe: false });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = rotX;
    mesh.position.y = y;
    scene.add(mesh);
    return mesh;
  }

  const ring1 = addRing(14, 0.04, 0xc9a96e, 0.18, 0,    1.3);
  const ring2 = addRing(10, 0.025, 0xc9a96e, 0.10, -2,  1.1);
  const ring3 = addRing(18, 0.03, 0x888899, 0.07, 3,    1.5);

  // ── Ambient glow planes ──
  function addGlow(color, x, y, z) {
    const geo = new THREE.PlaneGeometry(40, 40);
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.03, depthWrite: false, blending: THREE.AdditiveBlending });
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    scene.add(m);
  }
  addGlow(0xc9a96e,  12,  8, -10);
  addGlow(0x6644cc, -14, -6, -15);

  // ── Mouse parallax ──
  let mouseX = 0, mouseY = 0;
  let targetX = 0, targetY = 0;

  document.addEventListener('mousemove', (e) => {
    mouseX = (e.clientX / window.innerWidth  - 0.5) * 2;
    mouseY = (e.clientY / window.innerHeight - 0.5) * 2;
  });

  // ── Animation ──
  let clock = new THREE.Clock();

  function animate() {
    requestAnimationFrame(animate);
    const t = clock.getElapsedTime();

    // Smooth mouse follow
    targetX += (mouseX - targetX) * 0.03;
    targetY += (mouseY - targetY) * 0.03;

    particles.rotation.y = t * 0.03 + targetX * 0.15;
    particles.rotation.x = t * 0.01 + targetY * 0.08;

    ring1.rotation.z = t * 0.08;
    ring1.rotation.y = targetX * 0.2;
    ring2.rotation.z = -t * 0.05;
    ring3.rotation.z = t * 0.04;

    camera.position.x = targetX * 1.5;
    camera.position.y = -targetY * 1.0;
    camera.lookAt(scene.position);

    renderer.render(scene, camera);
  }

  animate();

  // ── Resize ──
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
})();


// ── NAVBAR SCROLL ─────────────────────────────────────────────────

(function initNav() {
  const navbar = document.getElementById('navbar');
  window.addEventListener('scroll', () => {
    navbar.classList.toggle('scrolled', window.scrollY > 40);
  });

  // Hamburger (mobile)
  const btn = document.getElementById('hamburger');
  const links = document.querySelector('.nav-links');
  if (btn && links) {
    btn.addEventListener('click', () => {
      links.style.display = links.style.display === 'flex' ? 'none' : 'flex';
      links.style.flexDirection = 'column';
      links.style.position = 'absolute';
      links.style.top = '70px';
      links.style.left = '0';
      links.style.right = '0';
      links.style.background = 'rgba(10,10,15,0.98)';
      links.style.padding = '24px';
      links.style.gap = '20px';
      links.style.borderBottom = '1px solid rgba(255,255,255,0.08)';
      links.style.backdropFilter = 'blur(20px)';
    });
  }
})();


// ── SCROLL REVEAL ─────────────────────────────────────────────────

(function initReveal() {
  const targets = [
    '.step-card', '.feature-card', '.custom-item',
    '.pricing-card', '.demo-card', '.testimonial-card',
    '.contact-split', '.section-title', '.section-sub',
    '.section-label'
  ];

  const all = document.querySelectorAll(targets.join(','));
  all.forEach((el, i) => {
    el.classList.add('reveal');
    if (i % 4 === 1) el.classList.add('reveal-delay-1');
    if (i % 4 === 2) el.classList.add('reveal-delay-2');
    if (i % 4 === 3) el.classList.add('reveal-delay-3');
  });

  const obs = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('visible');
        obs.unobserve(e.target);
      }
    });
  }, { threshold: 0.12 });

  all.forEach(el => obs.observe(el));
})();


// ── DEMO TRANSCRIPT ANIMATION ─────────────────────────────────────

(function initDemo() {
  const clientLine = document.getElementById('client-line');
  const aiReply    = document.getElementById('ai-reply');

  if (!clientLine || !aiReply) return;

  const obs = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting) {
      setTimeout(() => {
        clientLine.style.transition = 'opacity 0.6s ease';
        clientLine.style.opacity = '1';
      }, 1200);
      setTimeout(() => {
        aiReply.style.transition = 'opacity 0.6s ease';
        aiReply.style.opacity = '1';
      }, 2800);
      obs.disconnect();
    }
  }, { threshold: 0.5 });

  obs.observe(document.getElementById('demo'));
})();


// ── CONTACT FORM ──────────────────────────────────────────────────

(function initForm() {
  const form = document.getElementById('contact-form');
  if (!form) return;

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const btn = form.querySelector('button[type=submit]');
    btn.textContent = '✓ Request Received!';
    btn.style.background = '#4ade80';
    btn.style.color = '#000';
    btn.disabled = true;
    setTimeout(() => {
      btn.textContent = 'Book My Free Demo';
      btn.style.background = '';
      btn.style.color = '';
      btn.disabled = false;
      form.reset();
    }, 4000);
  });
})();


// ── SMOOTH ANCHOR SCROLL ──────────────────────────────────────────

document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', (e) => {
    const id = a.getAttribute('href');
    if (id === '#') return;
    const el = document.querySelector(id);
    if (el) {
      e.preventDefault();
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
});


// ── COUNTER ANIMATION (stats) ─────────────────────────────────────

(function initCounters() {
  const counters = document.querySelectorAll('.stat-num');

  const obs = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      // Already plain text, just animate opacity
      entry.target.style.transition = 'opacity 1s ease';
      entry.target.style.opacity = '0';
      requestAnimationFrame(() => {
        entry.target.style.opacity = '1';
      });
      obs.unobserve(entry.target);
    });
  }, { threshold: 1 });

  counters.forEach(c => obs.observe(c));
})();
