// Cena 3D: montanha cósmica de rocha cristalina com trilha em espiral até o Clímax,
// céu de nebulosa hipnótico, cristais venenosos, degraus e peças de vidro e câmera imersiva.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { CATEGORIAS, FASES } from './data.js';
import { drawIcon } from './icons.js';
import { makeDie, TOP } from './dice.js';

const PIECE_COLORS = { ele: 0x8a9cff, ela: 0xff7ab0 };
const FOG = 0x2a1238;   // névoa rosa-violeta
const FOCUS = 0xff2a4a; // vermelho dos pontos de foco (dado, peça da vez, pico)
const SPACING = 2.15;  // distância entre casas ao longo da trilha
const LEDGE = 1.95;     // meia-largura do terraço da trilha
const SERIF = '"Playfair Display", Georgia, serif';
const SANS = '-apple-system, BlinkMacSystemFont, "SF Pro Display", Inter, system-ui, sans-serif';
const V_KEY = new THREE.Vector3(2.5, 11, 4), V_UP3 = new THREE.Vector3(0, 3, 0);
const TAU = Math.PI * 2;

const ease = t => 1 - Math.pow(1 - t, 3);
const rnd = n => Math.floor(Math.random() * n);
const smooth = t => t * t * (3 - 2 * t);
const clamp01 = t => Math.max(0, Math.min(1, t));

function canvas(w, h = w) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  return [cv, cv.getContext('2d')];
}
function tex(cv) {
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
function shade(hex, amt) {
  const c = new THREE.Color(hex);
  return amt > 0 ? c.lerp(new THREE.Color(0xffffff), amt) : c.lerp(new THREE.Color(0x000000), -amt);
}
function glowTexture(inner = '#ffffff') {
  const [cv, g] = canvas(128);
  const rg = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  rg.addColorStop(0, inner); rg.addColorStop(0.2, inner + 'cc'); rg.addColorStop(0.5, inner + '33'); rg.addColorStop(1, inner + '00');
  g.fillStyle = rg; g.fillRect(0, 0, 128, 128);
  return tex(cv);
}
// ruído suave 2D (para a rocha)
function hash(x, y) { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); }
function noise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = smooth(xf), v = smooth(yf);
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const fbm = (x, y) => noise(x, y) * 0.55 + noise(x * 2.1, y * 2.1) * 0.3 + noise(x * 4.3, y * 4.3) * 0.15;

// ---------------------------------------------------------------- céu de nebulosa
const SKY_VERT = /* glsl */`
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  vec4 p = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * p;
  gl_Position.z = gl_Position.w; // sempre no fundo
}`;
const SKY_FRAG = /* glsl */`
uniform float uTime;
uniform vec3 uFog;
varying vec3 vDir;
float h3(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float n3(vec3 x) {
  vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(h3(i), h3(i + vec3(1,0,0)), f.x), mix(h3(i + vec3(0,1,0)), h3(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(h3(i + vec3(0,0,1)), h3(i + vec3(1,0,1)), f.x), mix(h3(i + vec3(0,1,1)), h3(i + vec3(1,1,1)), f.x), f.y), f.z);
}
float fbm(vec3 p) { float a = 0.5, s = 0.0; for (int k = 0; k < 3; k++) { s += a * n3(p); p = p * 2.07 + 1.7; a *= 0.5; } return s; }
void main() {
  vec3 d = normalize(vDir);
  float ang = atan(d.z, d.x), el = d.y;
  float sw = ang + uTime * 0.012 + (1.0 - el) * 1.4;
  vec3 q = vec3(cos(sw), el * 1.3, sin(sw)) * 1.8;
  float n1 = fbm(q + vec3(0.0, uTime * 0.008, 0.0));
  float n2 = fbm(q * 1.6 + vec3(4.0, 0.0, 1.3) + n1);
  vec3 top = vec3(0.035, 0.015, 0.07);
  vec3 col = mix(uFog, top, smoothstep(0.0, 0.75, el));
  col += vec3(0.55, 0.28, 0.85) * smoothstep(0.45, 0.85, n1) * 0.22;   // véu lilás
  col += vec3(0.95, 0.38, 0.68) * smoothstep(0.55, 0.9, n2) * 0.16;    // véu rosa
  vec3 sp = floor(d * 260.0);
  float st = h3(sp);
  col += vec3(1.0, 0.92, 0.98) * step(0.998, st) * (0.5 + 0.5 * sin(uTime * 1.5 + st * 60.0)) * smoothstep(0.1, 0.5, el) * 0.8;
  col = mix(col, uFog, pow(1.0 - clamp(el + 0.15, 0.0, 1.0), 4.0)); // horizonte some na névoa
  gl_FragColor = vec4(col, 1.0);
}`;

export class Board3D {
  constructor(container) {
    this.container = container;
    const r = this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    r.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.05;
    container.appendChild(r.domElement);

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(FOG, 0.03);
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(300, 48, 32), new THREE.ShaderMaterial({
      vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, uniforms: { uTime: { value: 0 }, uFog: { value: new THREE.Color(FOG) } },
      side: THREE.BackSide, depthWrite: false, fog: false,
    }));
    this.sky.renderOrder = -1;
    this.scene.add(this.sky);

    this.env = new THREE.PMREMGenerator(r).fromScene(new RoomEnvironment(), 0.04).texture;

    this.camera = new THREE.PerspectiveCamera(55, 1, 0.1, 700);
    this.camPos = new THREE.Vector3(0, 40, 40);
    this.camLook = new THREE.Vector3(0, 4, 0);
    this.camDir = new THREE.Vector3(0, 0, -1);
    this.wantPos = new THREE.Vector3();
    this.wantLook = new THREE.Vector3();
    this.quality = 'alta';
    this.speed = 1;        // modo de teste acelera as animações
    this.paused = false;   // pausa o 3D enquanto o palco do dado cobre a tela
    this.throttle = false; // 30 fps quando uma tela cobre o tabuleiro
    this.frame = 0;
    this.tmpOut = new THREE.Vector3(); this.tmpV = new THREE.Vector3();
    this.mode = 'orbit'; // 'orbit' (tela inicial) | 'follow' | 'overview' | 'free'

    this.scene.add(new THREE.HemisphereLight(0x9a7ad0, 0x2a1030, 0.75));
    this.key = new THREE.SpotLight(0xffd0e0, 40, 40, 0.7, 0.9, 1.2);
    this.scene.add(this.key, this.key.target);
    const moonLight = new THREE.DirectionalLight(0xb08aff, 0.8); moonLight.position.set(-30, 40, -20);
    const venom = new THREE.DirectionalLight(0xff8ac0, 0.45); venom.position.set(30, 18, 25);
    this.scene.add(moonLight, venom);
    this.rim = new THREE.PointLight(0xff5aa0, 16, 18, 1.5);
    this.blue = new THREE.PointLight(0x7a5cff, 12, 16, 1.6);
    this.scene.add(this.rim, this.blue);

    this.composer = new EffectComposer(r);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.7, 0.8, 0.7);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());

    this.world = new THREE.Group();
    this.scene.add(this.world);
    this.animated = [];
    this.flames = [];
    this.pieces = {};
    this.active = 'ele';
    this.clock = new THREE.Clock();
    this.glowTex = glowTexture('#ff9a4a');
    this.#makeEmbers();
    this.#makePetals();

    this.die = makeDie(this.env);
    this.die.scale.setScalar(0.8);
    this.die.traverse(o => { if (o.material?.envMapIntensity) o.material.envMapIntensity *= 0.45; });
    this.die.visible = false;
    this.scene.add(this.die);
    this.dieLight = new THREE.PointLight(0xff1a2e, 10, 5, 1.5);
    this.scene.add(this.dieLight);

    window.addEventListener('resize', () => this.resize());
    this.resize();
    r.setAnimationLoop(() => this.#tick());
  }

  // ================================================================ texturas
  #tileTexture(tile, i) {
    const S = 256, [cv, g] = canvas(S);
    const fase = FASES[tile.fase];
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 3;
    g.beginPath(); g.roundRect(16, 16, S - 32, S - 32, 40); g.stroke();
    const cat = CATEGORIAS[tile.tipo];
    if (cat) {
      g.fillStyle = 'rgba(10,2,8,.35)';
      g.beginPath(); g.arc(S / 2, S / 2, 72, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(255,255,255,.4)'; g.lineWidth = 2; g.stroke();
      drawIcon(g, tile.tipo, S / 2, S / 2, 46, cat.cor);
      g.font = `600 26px ${SANS}`;
      g.fillStyle = 'rgba(255,255,255,.85)';
      g.fillText(String(i), 50, 52);
    } else {
      const fim = tile.tipo === 'fim';
      g.font = `italic 700 ${fim ? 62 : 56}px ${SERIF}`;
      g.shadowColor = fim ? '#ff1a3a' : fase.cor; g.shadowBlur = 24;
      g.fillStyle = '#fff';
      g.fillText(fim ? 'Clímax' : 'Início', S / 2, S / 2 + 4);
    }
    return tex(cv);
  }

  #signTexture(text, color) {
    const [cv, g] = canvas(512, 150);
    g.textAlign = 'center'; g.textBaseline = 'middle';
    const gr = g.createLinearGradient(0, 10, 0, 140);
    gr.addColorStop(0, 'rgba(255,255,255,.28)'); gr.addColorStop(1, 'rgba(255,255,255,.08)');
    g.fillStyle = gr; g.beginPath(); g.roundRect(6, 10, 500, 130, 65); g.fill();
    g.strokeStyle = 'rgba(255,255,255,.6)'; g.lineWidth = 2; g.stroke();
    g.font = `italic 700 60px ${SERIF}`;
    g.shadowColor = color; g.shadowBlur = 22;
    g.fillStyle = '#fff';
    g.fillText(text, 256, 78);
    return tex(cv);
  }

  // ================================================================ atmosfera
  #makeEmbers() {
    const N = 320, pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
    const palette = [0xffa0d0, 0xc08aff, 0xffd0e8, 0xff7ab0, 0xffffff].map(c => new THREE.Color(c));
    for (let i = 0; i < N; i++) {
      const a = Math.random() * TAU, rr = 4 + Math.random() * 40;
      pos.set([Math.cos(a) * rr, Math.random() * 40 - 14, Math.sin(a) * rr], i * 3);
      const c = palette[i % 13 === 0 ? 4 : rnd(4)];
      col.set([c.r, c.g, c.b], i * 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this.embers = new THREE.Points(geo, new THREE.PointsMaterial({
      size: 0.16, map: glowTexture('#ffffff'), vertexColors: true, transparent: true, opacity: 0.7,
      depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    }));
    this.scene.add(this.embers);
  }

  #makePetals() {
    const s = new THREE.Shape();
    s.moveTo(0, -0.5);
    s.bezierCurveTo(0.45, -0.3, 0.4, 0.35, 0, 0.5);
    s.bezierCurveTo(-0.4, 0.35, -0.45, -0.3, 0, -0.5);
    const geo = new THREE.ShapeGeometry(s, 6);
    geo.scale(0.22, 0.3, 0.22);
    const mat = new THREE.MeshStandardMaterial({ color: 0xc23a6e, emissive: 0x2a0614, roughness: 0.6, side: THREE.DoubleSide, transparent: true, opacity: 0.8 });
    const N = 60;
    this.petals = new THREE.InstancedMesh(geo, mat, N);
    this.petalData = Array.from({ length: N }, () => ({
      x: (Math.random() - 0.5) * 24, y: Math.random() * 14, z: (Math.random() - 0.5) * 24,
      rx: Math.random() * 6, ry: Math.random() * 6, sp: 0.3 + Math.random() * 0.5, sw: Math.random() * 6,
    }));
    this.petals.frustumCulled = false;
    this.scene.add(this.petals);
    this.petalCenter = new THREE.Vector3();
    this.tmpObj = new THREE.Object3D();
  }

  #pawn(color, symbol) {
    const g = new THREE.Group();
    const pts = [[0, 0], [0.44, 0], [0.46, 0.1], [0.32, 0.18], [0.18, 0.5], [0.14, 0.8], [0.27, 0.86], [0.11, 0.93], [0, 0.93]]
      .map(([x, y]) => new THREE.Vector2(x, y));
    const mat = new THREE.MeshPhysicalMaterial({
      color: shade(color, 0.2), roughness: 0.08, transparent: true, opacity: 0.7, emissive: color, emissiveIntensity: 0.25,
      clearcoat: 1, clearcoatRoughness: 0.03, envMap: this.env, envMapIntensity: 1.2, specularIntensity: 1,
    });
    const glow = new THREE.MeshBasicMaterial({ color });
    const silver = new THREE.MeshStandardMaterial({ color: 0xf2e6e0, metalness: 1, roughness: 0.18, envMap: this.env, envMapIntensity: 1.3 });
    const body = new THREE.Mesh(new THREE.LatheGeometry(pts, 40), mat);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 32, 20), mat);
    head.position.y = 1.1;
    const coreB = new THREE.Mesh(new THREE.LatheGeometry(pts, 24), glow);
    coreB.scale.set(0.45, 0.85, 0.45); coreB.position.y = 0.05;
    const coreH = new THREE.Mesh(new THREE.SphereGeometry(0.09, 16, 12), glow);
    coreH.position.y = 1.1;
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.43, 0.025, 8, 48), silver);
    band.rotation.x = Math.PI / 2; band.position.y = 0.04;
    g.add(coreB, coreH, body, head, band);
    const [cv, c2] = canvas(128);
    c2.beginPath(); c2.arc(64, 64, 56, 0, TAU); c2.fillStyle = 'rgba(255,255,255,.16)'; c2.fill();
    c2.lineWidth = 3; c2.strokeStyle = 'rgba(255,255,255,.75)'; c2.stroke();
    const hex = '#' + new THREE.Color(color).getHexString();
    c2.fillStyle = '#fff'; c2.shadowColor = hex; c2.shadowBlur = 18;
    c2.font = '600 62px system-ui, sans-serif';
    c2.textAlign = 'center'; c2.textBaseline = 'middle'; c2.fillText(symbol, 64, 68);
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex(cv), depthWrite: false, fog: false }));
    spr.scale.setScalar(0.55); spr.position.y = 1.75; g.add(spr);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.52, 0.64, 48),
      new THREE.MeshBasicMaterial({ color: FOCUS, transparent: true, opacity: 0.9, side: THREE.DoubleSide }));
    const aura = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('#ff2a4a'), blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.5 }));
    aura.scale.set(2.2, 2.2, 1); aura.position.y = 0.2; ring.add(aura);
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.03; g.add(ring);
    g.userData = { ring, sprite: spr };
    return g;
  }

  #heart(color, scale, glow = 0.5) {
    const s = new THREE.Shape();
    s.moveTo(0, -0.6);
    s.bezierCurveTo(-0.9, 0.1, -0.6, 0.9, 0, 0.45);
    s.bezierCurveTo(0.6, 0.9, 0.9, 0.1, 0, -0.6);
    const m = new THREE.Mesh(
      new THREE.ExtrudeGeometry(s, { depth: 0.3, bevelEnabled: true, bevelSize: 0.08, bevelThickness: 0.08, bevelSegments: 4 }),
      new THREE.MeshPhysicalMaterial({ color, emissive: color, emissiveIntensity: glow, roughness: 0.1, metalness: 0.3, clearcoat: 1, envMap: this.env }));
    m.geometry.center();
    m.scale.setScalar(scale);
    m.castShadow = true;
    return m;
  }

  #candles(n, light) {
    const g = new THREE.Group();
    const wax = new THREE.MeshStandardMaterial({ color: 0xf1dcc0, roughness: 0.55, emissive: 0x3a1a08 });
    for (let k = 0; k < n; k++) {
      const h = 0.3 + Math.random() * 0.45;
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.11, h, 12), wax);
      const a = (k / n) * TAU + Math.random() * 0.5, r = k === 0 ? 0 : 0.28 + Math.random() * 0.12;
      c.position.set(Math.cos(a) * r, h / 2, Math.sin(a) * r);
      const flame = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTex, blending: THREE.AdditiveBlending, depthWrite: false, color: 0xffb36b }));
      flame.scale.set(0.3, 0.46, 1);
      flame.position.set(c.position.x, h + 0.15, c.position.z);
      g.add(c, flame);
      this.flames.push({ s: flame, ph: Math.random() * 10 });
    }
    if (light) {
      const l = new THREE.PointLight(0xff8a3a, 6, 7, 1.6);
      l.position.y = 0.9; g.add(l);
      this.flames.push({ l, ph: Math.random() * 10 });
    }
    return g;
  }

  // ================================================================ montanha
  // Espiral: ângulo θ ∈ [0, Θ]; o raio diminui e a altura sobe até o cume.
  #spiral(N) {
    const L = (N - 1) * SPACING;
    const turns = 1.3 + N / 80;
    const Θ = TAU * turns;
    const R1 = 2.8;
    const R0 = Math.max(R1 + 6, 2 * (L / Θ) - R1);
    const H = 8 + N * 0.08;
    const R = th => R0 - (R0 - R1) * (th / Θ);
    const Y = th => H * (th / Θ);
    // amostra a espiral por comprimento de arco
    const samples = [{ th: 0, s: 0 }];
    let s = 0, th = 0;
    const dth = 0.002;
    while (th < Θ) {
      const r = R(th), dr = (R0 - R1) / Θ;
      s += Math.sqrt(r * r + dr * dr) * dth; th += dth;
      samples.push({ th, s });
    }
    const total = s;
    const thAt = target => {
      let lo = 0, hi = samples.length - 1;
      while (hi - lo > 1) { const m = (lo + hi) >> 1; (samples[m].s < target ? lo = m : hi = m); }
      return samples[lo].th;
    };
    const pts = [];
    for (let i = 0; i < N; i++) {
      const t = thAt((i / (N - 1)) * total);
      pts.push({ th: t, r: R(t), y: Y(t) });
    }
    return { pts, R, Y, Θ, R0, R1, H };
  }

  #terrainHeight(r, phi, sp) {
    const { R, Y, Θ, H } = sp;
    const p0 = ((phi % TAU) + TAU) % TAU;
    const roads = [];
    // k = -1: a trilha continua (virtual) para baixo, antes do Início, sumindo na névoa
    for (let k = -1; ; k++) {
      const th = p0 + TAU * k;
      if (th > Θ) break;
      if (th < -TAU * 0.9) continue;
      roads.push({ r: R(th), y: Y(th) - 0.3 });
    }
    const nx = Math.cos(phi) * r, nz = Math.sin(phi) * r;
    const rock = fbm(nx * 0.35, nz * 0.35);
    if (!roads.length) roads.push({ r: R(Θ), y: Y(Θ) - 0.3 });
    const first = roads[0];
    if (r > first.r + LEDGE) { // encosta externa descendo para o vazio
      const d = r - first.r - LEDGE;
      return { y: first.y - d * 1.25 - rock * d * 0.5, wall: 1, t: 0.6, outer: Math.min(1, d / 3) };
    }
    for (let k = 0; k < roads.length; k++) {
      const a = roads[k];
      if (Math.abs(r - a.r) <= LEDGE) return { y: a.y + (rock - 0.5) * 0.04, wall: 0 };
      const b = roads[k + 1];
      if (b && r < a.r - LEDGE && r > b.r + LEDGE) {
        const t = clamp01((a.r - LEDGE - r) / ((a.r - LEDGE) - (b.r + LEDGE)));
        return { y: a.y + (b.y - a.y) * smooth(t) + Math.sin(t * Math.PI) * (rock - 0.35) * 1.4, wall: 1, t };
      }
    }
    const last = roads[roads.length - 1];
    // núcleo: sobe até o pico no centro
    const t = clamp01((last.r - LEDGE - r) / Math.max(0.5, last.r - LEDGE));
    return { y: last.y + (H + 2.2 - last.y) * smooth(t) + (rock - 0.4) * t * 0.8, wall: 1, t };
  }

  #buildMountain(sp) {
    const NR = 90, NA = 180, RMAX = sp.R0 + 14;
    const pos = [], col = [], idx = [];
    const cLedge = new THREE.Color(0x3a2050), cLow = new THREE.Color(0x24123e), cHigh = new THREE.Color(0x9a5a9a), cVein = new THREE.Color(0xd08ad0);
    const tmp = new THREE.Color();
    this.wallSpots = [];
    for (let i = 0; i <= NR; i++) {
      const r = RMAX * Math.pow(i / NR, 1.15);
      for (let j = 0; j < NA; j++) {
        const phi = (j / NA) * TAU;
        const h = this.#terrainHeight(r, phi, sp);
        // penhascos irregulares: empurra a rocha para dentro/fora entre os terraços
        // (nos paredões internos a rocha só recua para dentro, nunca invade a trilha)
        const nz = fbm(phi * 7 + 3, h.y * 0.7) - 0.5;
        const crag = !h.wall ? 0 : h.outer != null ? nz * 2.0 * h.outer : -Math.abs(nz) * 1.6 * Math.sin(Math.PI * (h.t ?? 0));
        const rr = Math.max(0, r + crag);
        pos.push(Math.cos(phi) * rr, h.y, Math.sin(phi) * rr);
        const hn = clamp01((h.y + 6) / (sp.H + 8));
        tmp.copy(cLow).lerp(cHigh, hn);
        if (h.wall) tmp.multiplyScalar(0.4 + 0.6 * (h.t ?? 0.6)); // sombra na base de cada paredão
        const v = fbm(Math.cos(phi) * r * 0.9, Math.sin(phi) * r * 0.9);
        if (h.wall && v > 0.62) tmp.lerp(cVein, (v - 0.62) * 2.2);
        if (!h.wall) tmp.copy(cLedge);
        col.push(tmp.r, tmp.g, tmp.b);
        if (h.wall && r > 1.5 && i % 3 === 0 && j % 5 === 0) this.wallSpots.push(new THREE.Vector3(Math.cos(phi) * r, h.y, Math.sin(phi) * r));
      }
    }
    for (let i = 0; i < NR; i++) for (let j = 0; j < NA; j++) {
      const a = i * NA + j, b = i * NA + (j + 1) % NA, c = (i + 1) * NA + j, d = (i + 1) * NA + (j + 1) % NA;
      idx.push(a, b, c, b, d, c);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0.05,
      envMap: this.env, envMapIntensity: 0.2, emissive: 0x1e0c2a, emissiveIntensity: 0.7 });
    const mesh = new THREE.Mesh(geo, mat);
    this.world.add(mesh);

    // poucos cristais lilases, discretos, brotando das paredes
    const geoC = new THREE.OctahedronGeometry(1, 0); geoC.scale(0.14, 0.7, 0.14); geoC.translate(0, 0.5, 0);
    const o = new THREE.Object3D();
    const spots = this.wallSpots.sort(() => Math.random() - 0.5).slice(0, 30);
    const im = new THREE.InstancedMesh(geoC, new THREE.MeshStandardMaterial({
      color: 0xd8a0ff, emissive: 0xb070ff, emissiveIntensity: 0.55, roughness: 0.2, transparent: true, opacity: 0.85 }), spots.length * 3);
    let n = 0;
    for (const p of spots) {
      const out = new THREE.Vector3(p.x, 0, p.z).normalize();
      for (let m = 0; m < 3; m++) {
        o.position.copy(p).addScaledVector(out, 0.1 + Math.random() * 0.2).add(new THREE.Vector3((Math.random() - 0.5) * 0.5, 0, (Math.random() - 0.5) * 0.5));
        o.lookAt(o.position.clone().add(out).add(new THREE.Vector3(0, 1.4 + Math.random(), 0)));
        o.rotateX(Math.PI / 2);
        o.scale.setScalar(0.4 + Math.random() * 0.7);
        o.updateMatrix();
        im.setMatrixAt(n++, o.matrix);
      }
    }
    im.count = n;
    this.world.add(im);
  }

  build(tiles) {
    this.world.clear();
    this.animated = [];
    this.flames = [];
    this.tiles = tiles;
    const N = tiles.length;
    const sp = this.sp = this.#spiral(N);
    this.path = sp.pts.map(p => new THREE.Vector3(Math.cos(p.th) * p.r, p.y, Math.sin(p.th) * p.r));
    this.dirs = this.path.map((p, i) => {
      const a = this.path[Math.max(0, i - 1)], b = this.path[Math.min(N - 1, i + 1)];
      return b.clone().sub(a).setY(0).normalize();
    });
    this.outward = this.path.map(p => new THREE.Vector3(p.x, 0, p.z).normalize());

    this.#buildMountain(sp);

    // ---- trilha luminosa na borda externa
    const rail = this.path.map((p, i) => p.clone().addScaledVector(this.outward[i], 1.25).setY(p.y - 0.22));
    const curve = new THREE.CatmullRomCurve3(rail);
    this.world.add(new THREE.Mesh(new THREE.TubeGeometry(curve, N * 10, 0.035, 6, false),
      new THREE.MeshBasicMaterial({ color: 0xffa0d8, transparent: true, opacity: 0.35 })));

    // ---- degraus de vidro com núcleo de luz
    const geo = new RoundedBoxGeometry(1.86, 0.5, 1.86, 4, 0.16);
    const coreGeo = new RoundedBoxGeometry(1.36, 0.08, 1.36, 2, 0.04);
    const topGeo = new THREE.PlaneGeometry(1.86, 1.86).rotateX(-Math.PI / 2);
    this.tileMats = [];
    tiles.forEach((tile, i) => {
      const fase = FASES[tile.fase];
      const glass = new THREE.MeshPhysicalMaterial({
        color: shade(fase.cor, -0.35), roughness: 0.12, transparent: true, opacity: 0.5,
        clearcoat: 1, clearcoatRoughness: 0.05, envMap: this.env, envMapIntensity: 0.9,
      });
      const coreM = new THREE.MeshBasicMaterial({ color: new THREE.Color(fase.cor), transparent: true, opacity: 0.5 });
      const topM = new THREE.MeshBasicMaterial({ map: this.#tileTexture(tile, i), transparent: true, depthWrite: false, opacity: 0.6 });
      const g = new THREE.Group();
      g.position.copy(this.path[i]);
      g.rotation.y = Math.atan2(this.dirs[i].x, this.dirs[i].z) + Math.PI;
      const block = new THREE.Mesh(geo, glass);
      block.position.y = -0.25;
      const core = new THREE.Mesh(coreGeo, coreM);
      core.position.y = -0.3;
      const top = new THREE.Mesh(topGeo, topM);
      top.position.y = 0.006;
      g.add(block, core, top);
      if (tile.tipo === 'inicio' || tile.tipo === 'fim') g.scale.set(1.25, 1, 1.25);
      this.world.add(g);
      this.tileMats.push({ glass, coreM, topM, lit: 0 });
      if (i % 7 === 3) {
        const c = this.#candles(2, false);
        c.position.copy(this.path[i]).addScaledVector(this.outward[i], 1.5).setY(this.path[i].y - 0.3);
        this.world.add(c);
      }
    });

    // ---- placas de cada fase
    FASES.forEach((fase, f) => {
      const i = tiles.findIndex(t => t.fase === f && t.tipo !== 'inicio');
      if (i < 0) return;
      const base = this.path[i].clone().addScaledVector(this.outward[i], 2.1).addScaledVector(this.dirs[i], 0.8);
      const grp = new THREE.Group();
      grp.position.copy(base).setY(this.path[i].y - 0.3);
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.64),
        new THREE.MeshBasicMaterial({ map: this.#signTexture(fase.nome, fase.cor), transparent: true, side: THREE.DoubleSide }));
      sign.position.y = 1.9;
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.6, 6),
        new THREE.MeshStandardMaterial({ color: 0xf2e6e0, metalness: 1, roughness: 0.2, envMap: this.env }));
      post.position.y = 0.8;
      const cand = this.#candles(3, false);
      cand.position.set(0.5, 0, 0.3);
      grp.add(post, sign, cand);
      this.world.add(grp);
      this.animated.push({ o: sign, base: sign.position.y, sp: 0.9, amp: 0.06, sign });
    });

    // ---- cume: coração do Clímax
    const end = this.path[N - 1];
    this.heartBig = this.#heart(0xff1a3a, 1.6, 0.9);
    this.heartBig.position.set(0, sp.H + 4.6, 0);
    const hl = new THREE.PointLight(0xff1a3a, 40, 16, 1.4);
    this.heartBig.add(hl);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('#ff2a4a'), blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.85, fog: false }));
    halo.scale.setScalar(12);
    this.heartBig.add(halo);
    this.beaconHalo = halo;
    this.world.add(this.heartBig);
    // feixe de luz subindo do pico, visível de longe através da névoa
    const [bcv, bg] = canvas(8, 256);
    const bgr = bg.createLinearGradient(0, 0, 0, 256);
    bgr.addColorStop(0, 'rgba(255,40,80,0)'); bgr.addColorStop(0.75, 'rgba(255,40,80,.1)'); bgr.addColorStop(1, 'rgba(255,60,100,.3)');
    bg.fillStyle = bgr; bg.fillRect(0, 0, 8, 256);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.45, 40, 16, 1, true), new THREE.MeshBasicMaterial({
      map: tex(bcv), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
    beam.position.set(0, sp.H + 22, 0);
    this.world.add(beam);
    const peak = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.7), new THREE.MeshBasicMaterial({
      map: this.#signTexture('Pico do Amor', '#ff2a4a'), transparent: true, side: THREE.DoubleSide, depthWrite: false }));
    peak.position.set(0, sp.H + 2.6, 0);
    this.world.add(peak);
    this.animated.push({ o: peak, base: peak.position.y, sp: 0.8, amp: 0.08, sign: peak });
    // anel de luz em volta do cume
    const ring = new THREE.Mesh(new THREE.TorusGeometry(3.2, 0.02, 8, 96), new THREE.MeshBasicMaterial({ color: 0xffa0d0, transparent: true, opacity: 0.5 }));
    ring.rotation.x = Math.PI / 2; ring.position.set(0, sp.H + 3, 0);
    this.world.add(ring);
    this.animated.push({ o: ring, base: ring.position.y, sp: 0.6, amp: 0.4, spin: 0.2 });

    // ---- lua de sangue ao longe
    const [mcv, mg] = canvas(256);
    const mgr = mg.createRadialGradient(100, 96, 10, 128, 128, 128);
    mgr.addColorStop(0, '#ffe0f0'); mgr.addColorStop(0.5, '#d08ac0'); mgr.addColorStop(1, '#5a3070');
    mg.fillStyle = mgr; mg.fillRect(0, 0, 256, 256);
    for (let k = 0; k < 30; k++) {
      mg.fillStyle = `rgba(60,20,70,${0.05 + Math.random() * 0.08})`;
      mg.beginPath(); mg.arc(Math.random() * 256, Math.random() * 256, 4 + Math.random() * 22, 0, TAU); mg.fill();
    }
    const moon = new THREE.Mesh(new THREE.SphereGeometry(10, 32, 24), new THREE.MeshBasicMaterial({ map: tex(mcv), fog: false, transparent: true, opacity: 0.75 }));
    moon.position.set(-70, sp.H + 30, -110);
    const mhalo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('#ffa0e0'), blending: THREE.AdditiveBlending, depthWrite: false, fog: false, opacity: 0.35 }));
    mhalo.scale.setScalar(80);
    moon.add(mhalo);
    this.world.add(moon);

    // ---- peças
    for (const who of ['ele', 'ela']) {
      const p = this.#pawn(PIECE_COLORS[who], who === 'ele' ? '♂' : '♀');
      this.pieces[who] = p;
      this.world.add(p);
      this.place(who, 0);
    }

    this.center = new THREE.Vector3(0, sp.H * 0.45, 0);
    this.embers.position.set(0, 0, 0);
    this.placeDie(1 + rnd(6), 'ele');
    this.camDir.copy(this.dirs[0]);
    this.camPos.set(sp.R0 * 1.6, sp.H + 18, sp.R0 * 1.6);
    this.camLook.copy(this.center);
    this.setQuality(this.quality);
    this.fps = { t0: 0, frames: 0, done: false };
  }

  setQuality(q) {
    this.quality = q;
    const hi = q !== 'leve';
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, hi ? 1.75 : 1.1));
    this.bloom.enabled = hi;
    document.body.classList.toggle('leve', !hi);
    this.resize();
  }

  #spot(who, i) {
    const perp = new THREE.Vector3(-this.dirs[i].z, 0, this.dirs[i].x);
    return this.path[i].clone().addScaledVector(perp, who === 'ele' ? -0.42 : 0.42);
  }

  place(who, i) {
    this.pieces[who].position.copy(this.#spot(who, i));
    this.pieces[who].userData.idx = i;
  }

  focus(who) {
    this.active = who;
    for (const k in this.pieces) this.pieces[k].userData.ring.visible = k === who;
  }

  setMode(m) { this.mode = m; }
  setThrottle(on) { this.throttle = on; }

  async movePiece(who, from, to, onStep) {
    const dir = to > from ? 1 : -1;
    const piece = this.pieces[who];
    for (let i = from; i !== to; i += dir) {
      const a = this.#spot(who, i), b = this.#spot(who, i + dir);
      const T = 340 / this.speed, t0 = performance.now();
      await new Promise(res => {
        const step = () => {
          const t = Math.min(1, (performance.now() - t0) / T);
          piece.position.lerpVectors(a, b, ease(t));
          piece.position.y += Math.sin(t * Math.PI) * 0.7;
          piece.userData.idx = t > 0.5 ? i + dir : i;
          if (t < 1) requestAnimationFrame(step); else res();
        };
        step();
      });
      onStep?.(i + dir);
    }
    piece.userData.idx = to;
  }

  // deixa o dado do tabuleiro pousado ao lado da peça, com o resultado para cima
  placeDie(value, who) {
    const idx = this.pieces[who]?.userData.idx ?? 0;
    const d = this.dirs[idx], o = this.outward[idx];
    const p = this.path[idx].clone().addScaledVector(d, 1.3).addScaledVector(o, 0.75);
    p.y += 0.36;
    this.die.position.copy(p);
    const [rx, rz] = TOP[value];
    this.die.rotation.set(rx, Math.random() * TAU, rz);
    this.die.visible = true;
  }

  resize() {
    const w = this.container.clientWidth, h = this.container.clientHeight;
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
    this.bloom.resolution.set(w / 2, h / 2);
    this.camera.aspect = w / h;
    this.portrait = w / h < 1;
    this.camera.fov = this.portrait ? 64 : 52;
    this.camera.updateProjectionMatrix();
  }

  #tick() {
    if (this.paused) { this.clock.getDelta(); return; }
    if (this.throttle && (this.frame++ & 1)) return;
    const dt = Math.min(0.1, this.clock.getDelta());
    const t = this.clock.elapsedTime;
    this.sky.material.uniforms.uTime.value = t;
    if (this.fps && !this.fps.done && this.mode === 'follow' && this.quality !== 'leve') {
      if (!this.fps.t0) this.fps.t0 = performance.now();
      this.fps.frames++;
      const el = performance.now() - this.fps.t0;
      if (el > 4000) {
        this.fps.done = true;
        if (this.fps.frames / (el / 1000) < 28) this.onLowFps?.();
      }
    }
    if (this.path) {
      const p = this.pieces[this.active];
      const idx = p.userData.idx ?? 0;
      const N = this.path.length;
      const pos = p.position;
      const sp = this.sp;

      if (this.mode === 'follow') {
        const ahead = this.path[Math.min(N - 1, idx + 2)], behind = this.path[Math.max(0, idx - 1)];
        const want = this.tmpV.copy(ahead).sub(behind).setY(0);
        if (want.lengthSq() > 0.01) this.camDir.lerp(want.normalize(), 1 - Math.exp(-dt * 2)).normalize();
        const out = this.tmpOut.set(pos.x, 0, pos.z).normalize();
        const back = this.portrait ? 5.0 : 5.2, up = this.portrait ? 5.0 : 4.0;
        this.wantPos.copy(pos).addScaledVector(this.camDir, -back).addScaledVector(out, 2.4).setY(pos.y + up);
        this.wantLook.copy(pos).addScaledVector(this.camDir, this.portrait ? 0.9 : 1.1).addScaledVector(out, -0.3).setY(pos.y + 0.9);
      } else if (this.mode !== 'free') {
        // visão da montanha inteira (órbita lenta e hipnótica na tela inicial)
        const D = sp.R0 * (this.portrait ? 2.5 : 1.75);
        const ang = this.mode === 'orbit' ? t * 0.05 : Math.atan2(pos.z, pos.x);
        this.wantLook.copy(this.center);
        this.wantPos.set(Math.cos(ang) * D, sp.H + D * 0.62, Math.sin(ang) * D);
      }
      // névoa: densa na trilha (mistério à frente), rala na visão geral
      const fogWant = this.mode === 'follow' ? 0.08 : 0.014;
      this.scene.fog.density += (fogWant - this.scene.fog.density) * (1 - Math.exp(-dt * 1.5));
      // os degraus perto da peça da vez se acendem; o resto fica sugerido
      this.tileMats.forEach((m, i) => {
        const d = i - idx;
        const want = this.mode !== 'follow' ? 0.5 : d >= 0 && d <= 6 ? 1 - d / 7.5 : d < 0 && d > -3 ? 0.35 : 0.08;
        m.lit += (want - m.lit) * (1 - Math.exp(-dt * 3));
        m.topM.opacity = 0.15 + m.lit * 0.85;
        m.coreM.opacity = 0.15 + m.lit * 0.7;
        m.glass.opacity = 0.35 + m.lit * 0.4;
      });
      this.beaconHalo.material.opacity = 0.6 + Math.sin(t * 2.2) * 0.25;
      const k = 1 - Math.exp(-dt * (this.mode === 'follow' ? 2.6 : 1.4));
      this.camPos.lerp(this.wantPos, k);
      this.camLook.lerp(this.wantLook, k);
      this.camera.position.copy(this.camPos);
      this.camera.lookAt(this.camLook);
      this.sky.position.copy(this.camera.position);

      const focus = this.mode === 'follow' ? pos : this.center;
      this.key.position.copy(focus).add(V_KEY);
      this.key.target.position.copy(focus);
      this.key.angle = this.mode === 'follow' ? 0.62 : 1.05;
      this.key.intensity = (this.mode === 'follow' ? 55 : 110) * (0.96 + Math.sin(t * 7) * 0.02 + Math.sin(t * 13) * 0.02);
      this.key.distance = this.mode === 'follow' ? 40 : 120;
      this.rim.position.copy(pos).addScaledVector(this.camDir, 6).setY(pos.y + 2.5);
      this.blue.position.copy(pos).addScaledVector(this.camDir, -3).add(V_UP3);

      for (const k2 in this.pieces) {
        const pc = this.pieces[k2];
        pc.userData.ring.scale.setScalar(1 + Math.sin(t * 3) * 0.08);
        pc.userData.ring.material.opacity = 0.6 + Math.sin(t * 3) * 0.3;
        pc.userData.sprite.position.y = 1.75 + Math.sin(t * 2 + (k2 === 'ele' ? 0 : 1.5)) * 0.08;
      }
      const tmp = this.tmpV;
      for (const a of this.animated) {
        a.o.position.y = a.base + Math.sin(t * a.sp) * a.amp;
        if (a.spin) a.o.rotation.z = t * a.spin;
        if (a.sign) a.sign.lookAt(this.camera.position.x, a.sign.getWorldPosition(tmp).y, this.camera.position.z);
      }
      for (const f of this.flames) {
        const fl = 1 + Math.sin(t * 11 + f.ph) * 0.12 + Math.sin(t * 23 + f.ph * 2) * 0.08;
        if (f.s) f.s.scale.set(0.3 * fl, 0.46 * fl, 1);
        if (f.l) f.l.intensity = 6 * fl;
      }
      this.dieLight.position.copy(this.die.position).setY(this.die.position.y - 0.3);
      this.heartBig.rotation.y = t * 0.8;
      this.heartBig.scale.setScalar(1.6 + Math.pow(Math.max(0, Math.sin(t * 3.2)), 8) * 0.2);

      this.petalCenter.lerp(this.mode === 'follow' ? pos : this.center, 1 - Math.exp(-dt));
      const o = this.tmpObj;
      this.petalData.forEach((d, i) => {
        d.y -= dt * d.sp; d.rx += dt * 0.8; d.ry += dt * 0.6;
        if (d.y < -3) { d.y = 12; d.x = (Math.random() - 0.5) * 24; d.z = (Math.random() - 0.5) * 24; }
        o.position.set(this.petalCenter.x + d.x + Math.sin(t * 0.7 + d.sw) * 0.6, this.petalCenter.y + d.y, this.petalCenter.z + d.z);
        o.rotation.set(d.rx, d.ry, 0);
        o.updateMatrix();
        this.petals.setMatrixAt(i, o.matrix);
      });
      this.petals.instanceMatrix.needsUpdate = true;
    }
    // brasas sobem em espiral em volta da montanha (hipnótico)
    const pa = this.embers.geometry.attributes.position;
    const ca = Math.cos(dt * 0.05), sa = Math.sin(dt * 0.05);
    for (let i = 0; i < pa.count; i++) {
      let y = pa.getY(i) + dt * 0.35;
      if (y > 26) y = -14;
      const x = pa.getX(i), z = pa.getZ(i);
      pa.setXYZ(i, x * ca - z * sa, y, x * sa + z * ca);
    }
    pa.needsUpdate = true;
    this.composer.render();
  }
}
