import * as THREE from 'three';

// Decorative only: the accessible walkthrough remains ordinary HTML.
export function createWorkflowScene(host) {
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const world = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, .1, 50);
  camera.position.set(0, 1, 11.5);
  camera.lookAt(0, 0, 0);
  world.add(new THREE.HemisphereLight(0xffffff, 0x6a806d, 2.7));
  const key = new THREE.DirectionalLight(0xfff3df, 3);
  key.position.set(-3, 6, 8); world.add(key);
  const rig = new THREE.Group(); world.add(rig);
  const textures = [], materials = [], geometries = [];
  function plate(width, height, depth, color) {
    const radius = .14, x = -width / 2, y = -height / 2;
    const shape = new THREE.Shape();
    shape.moveTo(x + radius, y);
    shape.lineTo(x + width - radius, y); shape.quadraticCurveTo(x + width, y, x + width, y + radius);
    shape.lineTo(x + width, y + height - radius); shape.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    shape.lineTo(x + radius, y + height); shape.quadraticCurveTo(x, y + height, x, y + height - radius);
    shape.lineTo(x, y + radius); shape.quadraticCurveTo(x, y, x + radius, y);
    const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelSegments: 3, steps: 1, bevelSize: .025, bevelThickness: .025, curveSegments: 12 });
    const material = new THREE.MeshStandardMaterial({ color, roughness: .48, metalness: .12 });
    geometries.push(geometry); materials.push(material);
    return new THREE.Mesh(geometry, material);
  }
  function artwork(kind) {
    const canvas = document.createElement('canvas'); canvas.width = 640; canvas.height = 800;
    const c = canvas.getContext('2d');
    c.fillStyle = '#fffdf5'; c.fillRect(0, 0, 640, 800);
    c.fillStyle = '#68786d'; c.font = '600 21px Arial'; c.fillText('DEMO STUDIO', 48, 65);
    c.fillStyle = '#172a24'; c.font = '40px Georgia';
    const titles = ['A warm hello.', 'A time that fits.', 'The next step.', 'Team visibility.', 'A person to help.'];
    c.fillText(titles[kind], 48, 158);
    c.fillStyle = '#325d4c';
    if (kind === 0) {
      for (let i = 0; i < 32; i++) { const h = 25 + Math.abs(Math.sin(i * 1.5)) * 120; c.fillRect(52 + i * 16, 320 - h / 2, 6, h); }
    } else if (kind === 1) {
      c.fillStyle = '#e3eada'; c.fillRect(48, 240, 540, 180);
      c.fillStyle = '#325d4c'; c.fillRect(48, 240, 8, 180);
      c.font = '600 30px Arial'; c.fillText('Tuesday · 2:00 PM', 78, 303);
      c.font = '25px Arial'; c.fillText('Classic full set · Jordan', 78, 362);
    } else if (kind === 2) {
      c.fillStyle = '#e3eada'; c.fillRect(48, 240, 540, 180);
      c.fillStyle = '#325d4c'; c.font = '28px Arial'; c.fillText('Your appointment is saved.', 74, 298); c.fillText('Deposit pending · next step', 74, 356);
    } else {
      c.font = '27px Arial';
      ['Alex Rivera', kind === 3 ? 'Classic full set · Jordan' : 'Callback requested', kind === 3 ? '$40 deposit · pending' : 'Awaiting team follow-up'].forEach((line, i) => { c.fillStyle = '#172a24'; c.fillText(line, 48, 265 + i * 83); c.fillStyle = '#d6d9cc'; c.fillRect(48, 294 + i * 83, 540, 2); });
    }
    c.fillStyle = '#172a24'; c.font = '26px Arial'; c.fillText('One connected workflow.', 48, 562);
    c.fillStyle = '#68786d'; c.font = '21px Arial'; c.fillText('VOICE  /  CALENDAR  /  SMS', 48, 622); c.fillText('Fictional booking illustration', 48, 728);
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
    textures.push(texture); return texture;
  }
  const screens = Array.from({ length: 5 }, (_, i) => artwork(i));
  const phone = new THREE.Group(); rig.add(phone);
  phone.add(plate(1.95, 2.8, .16, 0x172a24));
  const screenGeometry = new THREE.PlaneGeometry(1.79, 2.56);
  const screenMaterial = new THREE.MeshBasicMaterial({ map: screens[0] });
  materials.push(screenMaterial); geometries.push(screenGeometry);
  const screen = new THREE.Mesh(screenGeometry, screenMaterial); screen.position.z = .195; phone.add(screen);
  phone.position.set(-.1, 0, .45); phone.rotation.set(.04, -.13, -.06);
  const cards = [];
  for (let i = 0; i < 4; i++) {
    const group = new THREE.Group(); group.add(plate(1.8, 1.45, .08, 0xe1e8d8));
    const geometry = new THREE.PlaneGeometry(1.7, 1.34);
    const material = new THREE.MeshBasicMaterial({ map: screens[i + 1] });
    const face = new THREE.Mesh(geometry, material); face.position.z = .12; group.add(face);
    group.position.set(i < 2 ? -2.4 : 2.3, i % 2 === 0 ? .83 : -.96, -.3 - (i % 2) * .22);
    group.rotation.set(.05, i < 2 ? .17 : -.17, i % 2 ? -.06 : .05);
    rig.add(group); cards.push(group); materials.push(material); geometries.push(geometry);
  }
  const pathGeometry = new THREE.TorusGeometry(2.65, .012, 8, 100);
  const pathMaterial = new THREE.MeshBasicMaterial({ color: 0xa8b994, transparent: true, opacity: .6 });
  const orbit = new THREE.Mesh(pathGeometry, pathMaterial); orbit.scale.y = .48; orbit.position.z = -.65; rig.add(orbit);
  geometries.push(pathGeometry); materials.push(pathMaterial);
  let step = 0, paused = false, visible = false, frame = 0, pointerX = 0, pointerY = 0, disposed = false;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)'), narrow = matchMedia('(max-width: 700px)');
  function size() {
    host.hidden = narrow.matches || disposed;
    if (host.hidden) return;
    renderer.setSize(host.clientWidth, host.clientHeight, false);
    camera.aspect = host.clientWidth / host.clientHeight; camera.updateProjectionMatrix();
    camera.position.z = camera.aspect < 2.1 ? 9 : 7.8;
    renderer.render(world, camera);
  }
  function render(time) {
    frame = 0;
    if (!visible || host.hidden || document.hidden || disposed) return;
    if (!paused && !reduced.matches) {
      rig.rotation.y += (pointerX * .07 - rig.rotation.y) * .06;
      rig.rotation.x += (pointerY * .035 - rig.rotation.x) * .06;
      phone.position.y = Math.sin(time * .00065) * .055;
      cards.forEach((card, i) => { card.position.y = (i % 2 === 0 ? .83 : -.96) + Math.sin(time * .0007 + i) * .045; });
    }
    renderer.render(world, camera);
    if (!paused && !reduced.matches) frame = requestAnimationFrame(render);
  }
  function wake() { if (!frame && !disposed) frame = requestAnimationFrame(render); }
  function move(event) { const rect = host.getBoundingClientRect(); pointerX = (event.clientX - rect.left) / rect.width * 2 - 1; pointerY = (event.clientY - rect.top) / rect.height * 2 - 1; }
  function leave() { pointerX = pointerY = 0; }
  function preference() { size(); wake(); }
  renderer.domElement.setAttribute('aria-hidden', 'true'); host.append(renderer.domElement); host.hidden = false;
  renderer.domElement.addEventListener('webglcontextlost', event => { event.preventDefault(); dispose(); });
  const resize = new ResizeObserver(size); resize.observe(host);
  const observer = new IntersectionObserver(entries => { visible = entries[0].isIntersecting; if (!visible && frame) { cancelAnimationFrame(frame); frame = 0; } wake(); }); observer.observe(host);
  host.addEventListener('pointermove', move); host.addEventListener('pointerleave', leave);
  document.addEventListener('visibilitychange', wake); reduced.addEventListener('change', preference); narrow.addEventListener('change', preference);
  function dispose() {
    if (disposed) return; disposed = true; cancelAnimationFrame(frame); resize.disconnect(); observer.disconnect();
    document.removeEventListener('visibilitychange', wake); reduced.removeEventListener('change', preference); narrow.removeEventListener('change', preference);
    host.removeEventListener('pointermove', move); host.removeEventListener('pointerleave', leave);
    textures.forEach(t => t.dispose()); materials.forEach(m => m.dispose()); geometries.forEach(g => g.dispose()); renderer.dispose(); host.hidden = true;
  }
  size();
  return {
    setStep(index) { step = index; screenMaterial.map = screens[step]; cards.forEach((card, i) => card.scale.setScalar(i + 1 === step ? 1.08 : 1)); wake(); },
    setPaused(value) { paused = value; if (frame) { cancelAnimationFrame(frame); frame = 0; } wake(); },
    dispose
  };
}
