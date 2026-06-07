/* =========================================
   THE SALON AGENT — app.js
   3D Salon Room Hero + all interactivity
   ========================================= */

// ── THREE.JS SALON ROOM HERO ───────────────────────────────────────

(function initSalonRoom() {
  const canvas = document.getElementById('hero-canvas');
  if (!canvas || typeof THREE === 'undefined') return;

  // ── Renderer ──
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.setClearColor(0x0d0a10, 1);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x0d0a10, 18, 40);

  const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(0, 3.2, 10);
  camera.lookAt(0, 2.5, 0);

  // ── Materials palette ──
  const MAT = {
    floor:    new THREE.MeshStandardMaterial({ color: 0x2a1e14, roughness: 0.3, metalness: 0.1 }),
    floorTile:new THREE.MeshStandardMaterial({ color: 0x1a1210, roughness: 0.4, metalness: 0.05 }),
    wall:     new THREE.MeshStandardMaterial({ color: 0x1a1520, roughness: 0.85, metalness: 0.0 }),
    ceiling:  new THREE.MeshStandardMaterial({ color: 0x111016, roughness: 0.9 }),
    wood:     new THREE.MeshStandardMaterial({ color: 0x6b3a1f, roughness: 0.6, metalness: 0.05 }),
    chair:    new THREE.MeshStandardMaterial({ color: 0x1a1a22, roughness: 0.4, metalness: 0.3 }),
    chairSeat:new THREE.MeshStandardMaterial({ color: 0x2a2030, roughness: 0.5, metalness: 0.2 }),
    chrome:   new THREE.MeshStandardMaterial({ color: 0xccccdd, roughness: 0.05, metalness: 1.0 }),
    gold:     new THREE.MeshStandardMaterial({ color: 0xc9a96e, roughness: 0.15, metalness: 0.9 }),
    mirror:   new THREE.MeshStandardMaterial({ color: 0xaabbcc, roughness: 0.0, metalness: 1.0, envMapIntensity: 2.0 }),
    mirrorFrame:new THREE.MeshStandardMaterial({ color: 0xc9a96e, roughness: 0.2, metalness: 0.8 }),
    glass:    new THREE.MeshStandardMaterial({ color: 0x88aacc, roughness: 0.0, metalness: 0.0, transparent: true, opacity: 0.25 }),
    shelf:    new THREE.MeshStandardMaterial({ color: 0x3a2a1a, roughness: 0.5, metalness: 0.1 }),
    product:  (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.3, metalness: 0.2 }),
    lightGlow:new THREE.MeshStandardMaterial({ color: 0xfff5e0, roughness: 1.0, metalness: 0.0, emissive: 0xfff5e0, emissiveIntensity: 1.8 }),
    rug:      new THREE.MeshStandardMaterial({ color: 0x2a1530, roughness: 0.95, metalness: 0.0 }),
    plant:    new THREE.MeshStandardMaterial({ color: 0x2d4a20, roughness: 0.9 }),
    stem:     new THREE.MeshStandardMaterial({ color: 0x4a2d0a, roughness: 0.8 }),
  };

  // ── Helper: box ──
  function box(w, h, d, mat, x, y, z, rx=0, ry=0, rz=0) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    m.rotation.set(rx, ry, rz);
    m.castShadow = true;
    m.receiveShadow = true;
    scene.add(m);
    return m;
  }

  function cyl(rt, rb, h, seg, mat, x, y, z, rx=0, ry=0) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
    m.position.set(x, y, z);
    m.rotation.set(rx, 0, 0);
    m.castShadow = true;
    m.receiveShadow = true;
    scene.add(m);
    return m;
  }

  // ── Room shell ──
  // Floor
  const floorGeo = new THREE.PlaneGeometry(22, 22, 10, 10);
  const floor = new THREE.Mesh(floorGeo, MAT.floor);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  // Floor wood planks (thin strips)
  for (let i = -5; i <= 5; i++) {
    const plank = new THREE.Mesh(
      new THREE.PlaneGeometry(22, 0.9),
      new THREE.MeshStandardMaterial({ color: i % 2 === 0 ? 0x2a1e14 : 0x231a10, roughness: 0.35, metalness: 0.08 })
    );
    plank.rotation.x = -Math.PI / 2;
    plank.position.set(0, 0.001, i * 0.95);
    plank.receiveShadow = true;
    scene.add(plank);
  }

  // Back wall
  box(22, 12, 0.3, MAT.wall, 0, 6, -8);
  // Side walls
  box(0.3, 12, 22, MAT.wall, -11, 6, 0);
  box(0.3, 12, 22, MAT.wall,  11, 6, 0);
  // Ceiling
  box(22, 0.3, 22, MAT.ceiling, 0, 12, 0);

  // Ceiling wood slats (decorative strips)
  for (let i = -5; i <= 5; i++) {
    box(22, 0.12, 0.6, MAT.wood, 0, 11.8, i * 1.1);
  }

  // ── Rug ──
  const rugMesh = new THREE.Mesh(new THREE.PlaneGeometry(6, 3.5), MAT.rug);
  rugMesh.rotation.x = -Math.PI / 2;
  rugMesh.position.set(0, 0.005, 1);
  rugMesh.receiveShadow = true;
  scene.add(rugMesh);

  // ── Salon Chair builder ──
  function buildChair(x, z, ry=0) {
    const g = new THREE.Group();

    // Base cylinder + hydraulic pole
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.5, 0.1, 24), MAT.chrome);
    base.position.set(0, 0.05, 0); g.add(base);

    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.8, 12), MAT.chrome);
    pole.position.set(0, 0.5, 0); g.add(pole);

    // Seat
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.12, 0.7), MAT.chairSeat);
    seat.position.set(0, 0.95, 0); g.add(seat);

    // Seat cushion
    const cushion = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.1, 0.65), MAT.chair);
    cushion.position.set(0, 1.06, 0); g.add(cushion);

    // Back
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.85, 0.12), MAT.chairSeat);
    back.position.set(0, 1.55, -0.3); g.add(back);

    // Back cushion
    const backCushion = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.78, 0.1), MAT.chair);
    backCushion.position.set(0, 1.55, -0.24); g.add(backCushion);

    // Headrest
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.28, 0.1), MAT.chairSeat);
    head.position.set(0, 2.03, -0.27); g.add(head);

    // Armrests
    [-0.38, 0.38].forEach(ax => {
      const ar = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.08, 0.5), MAT.chrome);
      ar.position.set(ax, 1.3, -0.05); g.add(ar);
    });

    // Footrest bar
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.7, 8), MAT.chrome);
    foot.rotation.z = Math.PI / 2;
    foot.position.set(0, 0.5, 0.3); g.add(foot);

    g.position.set(x, 0, z);
    g.rotation.y = ry;
    g.traverse(c => { c.castShadow = true; c.receiveShadow = true; });
    scene.add(g);
    return g;
  }

  const chair1 = buildChair(-2.8, 0.5, 0);
  const chair2 = buildChair( 0,   0.5, 0);
  const chair3 = buildChair( 2.8, 0.5, 0);

  // ── Styling stations (counter shelves) ──
  function buildStation(x, z) {
    // Counter top
    box(1.4, 0.06, 0.7, MAT.shelf, x, 3.8, z);
    // Counter body
    box(1.4, 3.8, 0.65, MAT.wood, x, 1.9, z + 0.025);
    // Small products on counter
    [[-0.35,0.1], [0,0.13], [0.3, 0.09]].forEach(([ox, h]) => {
      const colors = [0xc9a96e, 0xffffff, 0x8b5cf6];
      const ci = Math.floor(Math.random()*3);
      box(0.08, h*2, 0.08, MAT.product(colors[ci]), x + ox, 3.8 + h, z - 0.15);
    });
  }

  buildStation(-2.8, -7.5);
  buildStation( 0,   -7.5);
  buildStation( 2.8, -7.5);

  // ── Oval Mirror builder ──
  function buildMirror(x, y, z) {
    const g = new THREE.Group();

    // Oval shape via scaled sphere
    const mirrorGeo = new THREE.SphereGeometry(0.7, 32, 20, 0, Math.PI*2, 0, Math.PI);
    const mirrorMesh = new THREE.Mesh(mirrorGeo, MAT.mirror);
    mirrorMesh.scale.set(1, 1.5, 0.05);
    g.add(mirrorMesh);

    // Oval frame (torus scaled)
    const frameGeo = new THREE.TorusGeometry(0.72, 0.07, 12, 60);
    const frameMesh = new THREE.Mesh(frameGeo, MAT.mirrorFrame);
    frameMesh.scale.set(1, 1.5, 1);
    g.add(frameMesh);

    // LED strip glow around mirror
    const glowGeo = new THREE.TorusGeometry(0.8, 0.04, 8, 60);
    const glowMat = new THREE.MeshStandardMaterial({
      color: 0xfff5e0, emissive: 0xfff5e0, emissiveIntensity: 2.5,
      transparent: true, opacity: 0.9
    });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    glow.scale.set(1, 1.5, 1);
    g.add(glow);

    // Mirror glow light
    const light = new THREE.PointLight(0xfff5e0, 0.6, 4);
    light.position.set(0, 0, 0.5);
    g.add(light);

    g.position.set(x, y, z);
    g.traverse(c => { c.castShadow = false; c.receiveShadow = true; });
    scene.add(g);
    return g;
  }

  const mirror1 = buildMirror(-2.8, 5.6, -7.3);
  const mirror2 = buildMirror( 0,   5.6, -7.3);
  const mirror3 = buildMirror( 2.8, 5.6, -7.3);

  // ── Globe pendant lights ──
  function buildPendant(x, z) {
    const g = new THREE.Group();

    // Cord
    const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 2.5, 6), MAT.chrome);
    cord.position.set(0, -1.25, 0);
    g.add(cord);

    // Globe
    const globe = new THREE.Mesh(new THREE.SphereGeometry(0.28, 20, 16), MAT.glass);
    globe.position.set(0, -2.5, 0);
    g.add(globe);

    // Inner bulb glow
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 8), MAT.lightGlow);
    bulb.position.set(0, -2.5, 0);
    g.add(bulb);

    // Point light
    const pl = new THREE.PointLight(0xfff5e0, 1.2, 8);
    pl.position.set(0, -2.5, 0);
    pl.castShadow = true;
    pl.shadow.mapSize.set(256, 256);
    g.add(pl);

    g.position.set(x, 12, z);
    scene.add(g);
    return { group: g, light: pl, bulb };
  }

  const pendants = [
    buildPendant(-2.8, -0.5),
    buildPendant( 0,   -0.5),
    buildPendant( 2.8, -0.5),
    buildPendant(-2.8, -4.5),
    buildPendant( 0,   -4.5),
    buildPendant( 2.8, -4.5),
  ];

  // ── Product shelf (right wall) ──
  function buildShelf() {
    // Wall shelf brackets + board
    [4.5, 5.8, 7.1].forEach(y => {
      box(0.08, 0.5, 0.25, MAT.chrome, 9.5, y - 0.1, -4);
      box(0.08, 0.5, 0.25, MAT.chrome, 9.5, y - 0.1, -5.5);
      box(2.0, 0.06, 0.4, MAT.shelf,  9.2, y, -4.75);
    });

    // Products on shelves
    const productColors = [0xc9a96e, 0xffffff, 0x8b5cf6, 0xe879a0, 0x60a5fa, 0xfbbf24];
    [4.5, 5.8, 7.1].forEach(y => {
      for (let i = 0; i < 4; i++) {
        const h = 0.18 + Math.random() * 0.15;
        const c = productColors[Math.floor(Math.random() * productColors.length)];
        cyl(0.05, 0.06, h, 8, MAT.product(c), 9.0 - i * 0.38, y + h/2 + 0.04, -4.75);
      }
    });
  }
  buildShelf();

  // ── Potted plant (corner) ──
  function buildPlant(x, z) {
    // Pot
    cyl(0.2, 0.15, 0.35, 12, MAT.product(0x4a3020), x, 0.175, z);
    // Soil
    cyl(0.19, 0.19, 0.03, 12, MAT.product(0x2a1a08), x, 0.36, z);
    // Stem
    cyl(0.03, 0.03, 1.0, 6, MAT.stem, x, 0.85, z);
    // Leaves (low-poly cone clusters)
    [[0,1.3,0.1],[0.15,1.1,0.15],[-0.2,1.2,0.05],[0.05,1.5,-0.1],[-0.1,1.4,0.2]].forEach(([lx,ly,lz]) => {
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.5, 5), MAT.plant);
      leaf.position.set(x + lx, ly, z + lz);
      leaf.rotation.set(
        (Math.random()-0.5)*0.8,
        Math.random()*Math.PI*2,
        (Math.random()-0.5)*0.6
      );
      leaf.castShadow = true;
      scene.add(leaf);
    });
  }
  buildPlant(-9.5, -1);
  buildPlant( 9.2, -1);

  // ── Ambient + directional lights ──
  const ambientLight = new THREE.AmbientLight(0x1a1025, 2.5);
  scene.add(ambientLight);

  const warmFill = new THREE.DirectionalLight(0xfff0d0, 0.4);
  warmFill.position.set(2, 8, 5);
  scene.add(warmFill);

  // Rim light from left (cool)
  const rimLight = new THREE.SpotLight(0x8866cc, 1.2, 20, Math.PI/5, 0.5);
  rimLight.position.set(-9, 9, -2);
  rimLight.target.position.set(0, 2, 0);
  scene.add(rimLight);
  scene.add(rimLight.target);

  // Gold accent from right
  const goldLight = new THREE.SpotLight(0xc9a96e, 0.8, 15, Math.PI/6, 0.6);
  goldLight.position.set(9, 7, 2);
  goldLight.target.position.set(0, 1.5, 0);
  scene.add(goldLight);
  scene.add(goldLight.target);

  // Mirror glow contributions (already added per mirror)
  // Extra fill from back wall direction
  const backFill = new THREE.PointLight(0xfff5e0, 0.5, 12);
  backFill.position.set(0, 5, -6);
  scene.add(backFill);

  // ── Floating phone mockup (AI call indicator) ──
  function buildPhone() {
    const g = new THREE.Group();

    // Phone body
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.38, 0.75, 0.04),
      new THREE.MeshStandardMaterial({ color: 0x1a1a2e, roughness: 0.1, metalness: 0.8 })
    );
    g.add(body);

    // Screen glow
    const screen = new THREE.Mesh(
      new THREE.PlaneGeometry(0.32, 0.65),
      new THREE.MeshStandardMaterial({
        color: 0x1a0a30,
        emissive: 0x8844cc,
        emissiveIntensity: 0.8,
        roughness: 0.0
      })
    );
    screen.position.z = 0.025;
    g.add(screen);

    // Screen light
    const sl = new THREE.PointLight(0x8844cc, 0.6, 2.5);
    sl.position.set(0, 0, 0.15);
    g.add(sl);

    g.position.set(5.5, 5, 1);
    g.rotation.y = -0.4;
    scene.add(g);
    return g;
  }

  const phone = buildPhone();

  // ── Mouse parallax ──
  let mouseX = 0, mouseY = 0;
  let targetMX = 0, targetMY = 0;

  document.addEventListener('mousemove', (e) => {
    mouseX = (e.clientX / window.innerWidth  - 0.5) * 2;
    mouseY = (e.clientY / window.innerHeight - 0.5) * 2;
  });

  // ── Camera base ──
  const camBasePos = new THREE.Vector3(0, 3.5, 9.5);
  const camLookAt  = new THREE.Vector3(0, 2.8, 0);

  // ── Clock ──
  const clock = new THREE.Clock();

  // ── Animate ──
  function animate() {
    requestAnimationFrame(animate);
    const t = clock.getElapsedTime();

    // Smooth mouse
    targetMX += (mouseX - targetMX) * 0.04;
    targetMY += (mouseY - targetMY) * 0.04;

    // Gentle camera drift
    camera.position.x = camBasePos.x + targetMX * 0.8 + Math.sin(t * 0.12) * 0.3;
    camera.position.y = camBasePos.y - targetMY * 0.4 + Math.sin(t * 0.08) * 0.15;
    camera.position.z = camBasePos.z;
    camera.lookAt(camLookAt.x + targetMX * 0.3, camLookAt.y, camLookAt.z);

    // Pendant light flicker (subtle)
    pendants.forEach((p, i) => {
      p.light.intensity = 1.1 + Math.sin(t * 0.7 + i) * 0.08;
    });

    // Mirror LED pulse
    [mirror1, mirror2, mirror3].forEach((m, i) => {
      const led = m.children[2];
      if (led && led.material) {
        led.material.emissiveIntensity = 2.2 + Math.sin(t * 0.5 + i * 1.2) * 0.4;
      }
    });

    // Phone float
    phone.position.y = 5.0 + Math.sin(t * 0.9) * 0.12;
    phone.rotation.y = -0.4 + Math.sin(t * 0.4) * 0.08;

    // Slow chair rock (barely perceptible — breathing quality)
    [chair1, chair2, chair3].forEach((c, i) => {
      c.rotation.y = Math.sin(t * 0.15 + i * 1.1) * 0.015;
    });

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

  const btn = document.getElementById('hamburger');
  const links = document.querySelector('.nav-links');
  if (btn && links) {
    btn.addEventListener('click', () => {
      const open = links.getAttribute('data-open') === 'true';
      links.setAttribute('data-open', !open);
      Object.assign(links.style, open ? {
        display: '', position: '', top: '', left: '', right: '',
        background: '', padding: '', flexDirection: '', gap: '',
        borderBottom: '', backdropFilter: ''
      } : {
        display: 'flex', flexDirection: 'column', position: 'fixed',
        top: '64px', left: '0', right: '0',
        background: 'rgba(10,10,15,0.98)', padding: '24px 32px',
        gap: '20px', borderBottom: '1px solid rgba(255,255,255,0.08)',
        backdropFilter: 'blur(20px)', zIndex: '999'
      });
    });
  }
})();


// ── SCROLL REVEAL ─────────────────────────────────────────────────

(function initReveal() {
  const selectors = [
    '.step-card', '.feature-card', '.custom-item',
    '.pricing-card', '.demo-card', '.testimonial-card',
    '.contact-split', '.section-title', '.section-sub', '.section-label'
  ];
  const all = document.querySelectorAll(selectors.join(','));
  all.forEach((el, i) => {
    el.classList.add('reveal');
    const delay = ['', 'reveal-delay-1', 'reveal-delay-2', 'reveal-delay-3'][i % 4];
    if (delay) el.classList.add(delay);
  });

  const obs = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('visible'); obs.unobserve(e.target); }
    });
  }, { threshold: 0.1 });

  all.forEach(el => obs.observe(el));
})();


// ── DEMO TRANSCRIPT ANIMATION ─────────────────────────────────────

(function initDemo() {
  const clientLine = document.getElementById('client-line');
  const aiReply    = document.getElementById('ai-reply');
  if (!clientLine || !aiReply) return;

  const demoSection = document.getElementById('demo');
  if (!demoSection) return;

  const obs = new IntersectionObserver((entries) => {
    if (!entries[0].isIntersecting) return;
    setTimeout(() => {
      clientLine.style.transition = 'opacity 0.6s ease';
      clientLine.style.opacity = '1';
    }, 1200);
    setTimeout(() => {
      aiReply.style.transition = 'opacity 0.6s ease';
      aiReply.style.opacity = '1';
    }, 2800);
    obs.disconnect();
  }, { threshold: 0.4 });

  obs.observe(demoSection);
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
      btn.style.cssText = '';
      btn.disabled = false;
      form.reset();
    }, 4000);
  });
})();


// ── SMOOTH ANCHORS ────────────────────────────────────────────────

document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    const id = a.getAttribute('href');
    if (id === '#') return;
    const el = document.querySelector(id);
    if (el) { e.preventDefault(); el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  });
});
