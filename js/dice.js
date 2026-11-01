// Dado de cristal lapidado + "palco" do dado: o tabuleiro escurece e o dado gira em destaque.
import * as THREE from 'three';
import { ConvexGeometry } from 'three/addons/geometries/ConvexGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const SERIF = '"Playfair Display", Georgia, serif';
const ease4 = t => 1 - Math.pow(1 - t, 4);
const easeInOut = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

// Romboedro de cristal: um cubo esticado ao longo da diagonal, com duas pontas e 6 faces em losango.
// Os cantos são levemente lapidados para cintilar. Faces opostas somam 7.
const STRETCH = 1.65;   // quanto o cristal é esticado entre as pontas
const INR = 0.45;       // distância do centro até cada face (o dado pousa a essa altura)
const CHAMFER = 0.13;   // lapidação dos cantos
const CROWN = 0.085;    // cada face sobe numa pirâmide baixinha: 4 facetas que cintilam
const AXES = [[1, 0, 0, 1], [-1, 0, 0, 6], [0, 1, 0, 2], [0, -1, 0, 5], [0, 0, 1, 3], [0, 0, -1, 4]];

const SHAPE = (() => {
  const tilt = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 1, 1).normalize(), new THREE.Vector3(0, 1, 0));
  const A = new THREE.Matrix4().makeScale(1, STRETCH, 1).multiply(new THREE.Matrix4().makeRotationFromQuaternion(tilt));
  const N = new THREE.Matrix3().getNormalMatrix(A);
  const k = INR * new THREE.Vector3(1, 0, 0).applyMatrix3(N).length();
  A.premultiply(new THREE.Matrix4().makeScale(k, k, k));
  const tip = new THREE.Vector3(1, 1, 1).applyMatrix4(A);
  const faces = AXES.map(([x, y, z, n]) => {
    const normal = new THREE.Vector3(x, y, z).applyMatrix3(N).normalize();
    const center = new THREE.Vector3(x, y, z).applyMatrix4(A);
    // o número fica "em pé" apontando para a ponta mais próxima
    const pole = tip.clone().multiplyScalar(Math.sign(normal.y));
    const up = pole.sub(center).projectOnPlane(normal).normalize();
    return { n, normal, center, up };
  });
  const pts = [];
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
    const v = [sx, sy, sz];
    for (let i = 0; i < 3; i++) { const c = v.slice(); c[i] *= 1 - 2 * CHAMFER; pts.push(new THREE.Vector3(...c).applyMatrix4(A)); }
  }
  for (const f of faces) pts.push(f.center.clone().addScaledVector(f.normal, CROWN));
  return { faces, pts, tipY: tip.y };
})();

// quaternion que leva a face `n` para a direção `dir`, com o número em pé (`up` vira +y, ou -z se a face olhar para cima)
function faceTo(n, toFront) {
  const f = SHAPE.faces.find(x => x.n === n);
  const right = new THREE.Vector3().crossVectors(f.up, f.normal);
  const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(right, f.up, f.normal).transpose());
  return toFront ? q : new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2).multiply(q);
}
const faceToCamera = n => faceTo(n, true);
// orientação do dado pousado no tabuleiro com `n` para cima e girado `yaw` em torno do eixo vertical
export const faceUp = (n, yaw = 0) => new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw).multiply(faceTo(n, false));

function numberTexture(n) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 256;
  const g = cv.getContext('2d');
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = `600 176px ${SERIF}`;
  const gr = g.createLinearGradient(0, 50, 0, 220);
  gr.addColorStop(0, '#fff4c4'); gr.addColorStop(0.4, '#e9bd55'); gr.addColorStop(1, '#9a6410');
  g.fillStyle = gr;
  g.fillText(String(n), 128, 140);
  if (n === 6) g.fillRect(96, 228, 64, 8);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

export function makeDie(env) {
  const g = new THREE.Group();
  const crystal = new THREE.MeshPhysicalMaterial({
    color: 0xff4a58, roughness: 0.02, metalness: 0, transmission: 1, thickness: 1.4, ior: 2.1,
    attenuationColor: new THREE.Color(0xff1a34), attenuationDistance: 2.4,
    clearcoat: 1, clearcoatRoughness: 0, specularIntensity: 1, specularColor: new THREE.Color(0xffffff),
    envMap: env, envMapIntensity: 3.2, emissive: 0x6a0012, emissiveIntensity: 0.55, flatShading: true,
  });
  const body = new THREE.Mesh(new ConvexGeometry(SHAPE.pts), crystal);
  body.castShadow = true;
  g.add(body);
  // núcleo: dá profundidade ao vermelho quando visto através do cristal
  const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.22, 0), new THREE.MeshBasicMaterial({ color: 0xff2440 }));
  core.scale.y = 1.7;
  g.add(core);
  for (const f of SHAPE.faces) {
    const map = numberTexture(f.n);
    // alphaTest + opaco: os números entram no "passe de refração" e aparecem por dentro do cristal
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.44, 0.44), new THREE.MeshStandardMaterial({
      map, alphaTest: 0.5, side: THREE.DoubleSide, metalness: 0.9, roughness: 0.32, envMap: env, envMapIntensity: 1.8,
      emissive: 0xffb437, emissiveMap: map, emissiveIntensity: 0.18,
    }));
    m.position.copy(f.center).addScaledVector(f.normal, CROWN + 0.006);
    m.quaternion.copy(faceToCamera(f.n)).invert();
    m.userData = { n: f.n };
    g.add(m);
  }
  return g;
}

function starTexture() {
  const cv = document.createElement('canvas'); cv.width = cv.height = 128;
  const g = cv.getContext('2d');
  const rg = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  rg.addColorStop(0, 'rgba(255,255,255,1)'); rg.addColorStop(0.12, 'rgba(255,220,220,.8)'); rg.addColorStop(0.4, 'rgba(255,60,90,.15)'); rg.addColorStop(1, 'rgba(255,0,40,0)');
  g.fillStyle = rg; g.fillRect(0, 0, 128, 128);
  g.fillStyle = 'rgba(255,255,255,.9)';
  g.beginPath(); g.moveTo(64, 0); g.quadraticCurveTo(68, 60, 128, 64); g.quadraticCurveTo(68, 68, 64, 128);
  g.quadraticCurveTo(60, 68, 0, 64); g.quadraticCurveTo(60, 60, 64, 0); g.fill();
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class DiceStage {
  constructor(layer) {
    this.layer = layer;
    this.speed = 1;
    this.host = layer.querySelector('#dice-stage');
    const r = this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    r.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.15;
    r.setClearColor(0x000000, 0);
    this.host.appendChild(r.domElement);
    this.scene = new THREE.Scene();
    this.env = new THREE.PMREMGenerator(r).fromScene(new RoomEnvironment(), 0.02).texture;
    this.camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
    this.camera.position.set(0, 0.35, 4.4);
    this.camera.lookAt(0, -0.05, 0);

    const key = new THREE.SpotLight(0xfff1e8, 70, 20, 0.5, 0.6, 1);
    key.position.set(2.5, 5, 4);
    const red1 = new THREE.PointLight(0xff1030, 30, 10, 1.4); red1.position.set(-2.4, -0.4, -1.6);
    const red2 = new THREE.PointLight(0xff3a5a, 18, 10, 1.4); red2.position.set(2.2, 1.4, -2);
    const fill = new THREE.HemisphereLight(0x6a4080, 0x200008, 0.5);
    // luz de contorno por trás: acende as arestas e as pontas do cristal
    const rim = new THREE.SpotLight(0xffd6e0, 60, 12, 0.6, 0.5, 1); rim.position.set(-1.2, 2.2, -3);
    this.scene.add(key, red1, red2, fill, rim);

    this.die = makeDie(this.env);
    this.die.scale.setScalar(0.62);
    this.scene.add(this.die);

    // estúdio infinito: esfera escura com brilho carmim na altura do dado
    const bcv = document.createElement('canvas'); bcv.width = 16; bcv.height = 512;
    const bg = bcv.getContext('2d');
    const gr = bg.createLinearGradient(0, 0, 0, 512);
    gr.addColorStop(0, '#0c0412'); gr.addColorStop(0.34, '#2a0c26'); gr.addColorStop(0.5, '#5a1a34');
    gr.addColorStop(0.6, '#2a0a1c'); gr.addColorStop(0.8, '#0c040a'); gr.addColorStop(1, '#050205');
    bg.fillStyle = gr; bg.fillRect(0, 0, 16, 512);
    const btex = new THREE.CanvasTexture(bcv); btex.colorSpace = THREE.SRGBColorSpace;
    const dome = new THREE.Mesh(new THREE.SphereGeometry(14, 48, 32), new THREE.MeshBasicMaterial({ map: btex, side: THREE.BackSide }));
    dome.rotation.y = Math.PI;
    this.scene.add(dome);

    // poça de luz vermelha embaixo do dado (como a luz atravessando o cristal)
    const pcv = document.createElement('canvas'); pcv.width = pcv.height = 128;
    const pg = pcv.getContext('2d');
    const prg = pg.createRadialGradient(64, 64, 0, 64, 64, 64);
    prg.addColorStop(0, 'rgba(255,90,90,1)'); prg.addColorStop(0.45, 'rgba(230,40,60,.4)'); prg.addColorStop(1, 'rgba(120,0,20,0)');
    pg.fillStyle = prg; pg.fillRect(0, 0, 128, 128);
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.6), new THREE.MeshBasicMaterial({
      map: new THREE.CanvasTexture(pcv), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    pool.rotation.x = -Math.PI / 2; pool.position.set(0.25, -0.79, 0.2);
    this.pool = pool; this.scene.add(pool);

    // aura aconchegante atrás do dado (âmbar-rosado, respira devagar)
    const acv = document.createElement('canvas'); acv.width = acv.height = 256;
    const ag = acv.getContext('2d');
    const arg = ag.createRadialGradient(128, 128, 0, 128, 128, 128);
    arg.addColorStop(0, 'rgba(255,200,170,.9)'); arg.addColorStop(0.25, 'rgba(255,120,130,.45)');
    arg.addColorStop(0.55, 'rgba(200,60,120,.14)'); arg.addColorStop(1, 'rgba(120,20,80,0)');
    ag.fillStyle = arg; ag.fillRect(0, 0, 256, 256);
    this.aura = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(acv), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 }));
    this.aura.position.set(0, 0.05, -1.2); this.aura.scale.setScalar(4.2);
    this.scene.add(this.aura);
    this.halo = new THREE.Mesh(new THREE.RingGeometry(1.25, 1.28, 96), new THREE.MeshBasicMaterial({ color: 0xffc0b0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.halo.position.set(0, 0.05, -0.9);
    this.scene.add(this.halo);
    // feixe de luz que desce do alto: dois planos cruzados com degradê (barato, sem pós-processamento)
    const bmcv = document.createElement('canvas'); bmcv.width = 64; bmcv.height = 256;
    const bmg = bmcv.getContext('2d');
    const bx = bmg.createLinearGradient(0, 0, 64, 0);
    bx.addColorStop(0, 'rgba(255,190,200,0)'); bx.addColorStop(0.5, 'rgba(255,225,215,1)'); bx.addColorStop(1, 'rgba(255,190,200,0)');
    bmg.fillStyle = bx; bmg.fillRect(0, 0, 64, 256);
    bmg.globalCompositeOperation = 'destination-in';
    const by = bmg.createLinearGradient(0, 0, 0, 256);
    by.addColorStop(0, 'rgba(0,0,0,0)'); by.addColorStop(0.35, 'rgba(0,0,0,.9)'); by.addColorStop(0.8, 'rgba(0,0,0,.5)'); by.addColorStop(1, 'rgba(0,0,0,0)');
    bmg.fillStyle = by; bmg.fillRect(0, 0, 64, 256);
    const beamMat = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(bmcv), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    this.beam = new THREE.Group();
    for (const ry of [0, Math.PI / 2]) {
      const pl = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 6), beamMat); pl.rotation.y = ry; this.beam.add(pl);
    }
    this.beam.position.set(0, 2.2, -0.4);
    this.beam.userData.mat = beamMat;
    this.scene.add(this.beam);
    const warm = new THREE.PointLight(0xffb08a, 14, 8, 1.4); warm.position.set(0.8, 1.6, 2.2);
    this.scene.add(warm);

    // brilhos cintilantes
    const star = starTexture();
    this.sparks = Array.from({ length: 14 }, () => {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: star, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 }));
      s.userData = { a: Math.random() * Math.PI * 2, r: 0.9 + Math.random() * 0.9, y: (Math.random() - 0.5) * 1.6, ph: Math.random() * 6, sp: 0.4 + Math.random() };
      this.scene.add(s);
      return s;
    });
    this.glint = new THREE.Sprite(new THREE.SpriteMaterial({ map: star, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 }));
    this.scene.add(this.glint);

    window.addEventListener('resize', () => this.resize());
    this.resize();
    // pré-aquece os shaders e o passe de refração quando o navegador estiver ocioso,
    // para a primeira rolagem não travar
    const warmup = () => { this.renderer.compile(this.scene, this.camera); this.renderer.render(this.scene, this.camera); this.renderer.clear(); };
    (window.requestIdleCallback ?? (f => setTimeout(f, 1500)))(warmup, { timeout: 4000 });
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.fov = w / h < 1 ? 56 : 30;
    this.camera.updateProjectionMatrix();
  }

  setQuality(q) {
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, q === 'leve' ? 1 : 1.5));
    this.resize();
  }

  // Mostra o dado girando em destaque e resolve quando ele pousa em `value`.
  roll(value, onLand) {
    return new Promise(resolve => {
      const L = this.layer;
      L.classList.remove('hidden', 'out');
      void L.offsetWidth;
      L.classList.add('in');
      const caption = L.querySelector('.dice-caption');
      caption.classList.remove('show');

      // pousa levemente inclinado, mostrando as facetas e a ponta de cima
      const qT = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.2, -0.36, 0.05, 'YXZ')).multiply(faceToCamera(value));
      const axis = new THREE.Vector3(Math.random() - 0.5, 1.6, Math.random() - 0.5).normalize(); // gira mais em torno do próprio eixo, como um pião
      const axis2 = new THREE.Vector3(1, Math.random() - 0.5, Math.random() - 0.5).normalize();
      const spin = Math.PI * 2 * (2.5 + Math.random());
      const T = 2900 / this.speed, HOLD = 1400 / this.speed, t0 = performance.now();
      let landed = false;
      const qa = new THREE.Quaternion(), qb = new THREE.Quaternion();
      const cam = this.camera, beamMat = this.beam.userData.mat;

      const frame = () => {
        const now = performance.now();
        const t = Math.min(1, (now - t0) / T);
        const e = easeInOut(t);
        const tl = landed ? (now - t0 - T) / 1000 : 0; // segundos desde o pouso
        // desce flutuando dentro do feixe, girando devagar, e assenta exatamente na face sorteada
        qa.setFromAxisAngle(axis, spin * (1 - e));
        qb.setFromAxisAngle(axis2, Math.sin(t * Math.PI) * 0.5 * (1 - e));
        this.die.quaternion.copy(qT).multiply(qa).multiply(qb);
        const fall = ease4(Math.min(1, t * 1.1));
        const bob = Math.sin(now / 700) * 0.035 * fall;
        this.die.position.set(0, 2.4 * (1 - fall) + bob + (landed ? Math.min(0.12, tl * 0.4) * Math.max(0, 1 - tl) : 0), -0.8 * (1 - fall));
        // "respiro" ao pousar
        const pulse = landed ? Math.exp(-tl * 4) * 0.08 : 0;
        this.die.scale.setScalar((0.4 + 0.22 * fall) * (1 + pulse));
        // a câmera se aproxima devagar
        cam.position.z = 4.6 - 0.5 * easeInOut(Math.min(1, (now - t0) / (T + HOLD)));
        // feixe: acende, e depois do pouso se recolhe
        beamMat.opacity = Math.min(1, (now - t0) / 500) * (landed ? Math.max(0.15, 1 - tl * 1.4) : 1) * 0.55;
        this.beam.rotation.y = now / 5000;
        this.pool.material.opacity = 0.7 * fall;
        this.pool.scale.setScalar(0.6 + fall * 0.5 + pulse * 3);
        this.aura.material.opacity = (0.7 + Math.sin(now / 700) * 0.12 + pulse * 3) * fall;
        this.aura.scale.setScalar(4 + Math.sin(now / 900) * 0.2);
        // anel de luz: aro discreto que vira uma onda ao pousar
        const wave = landed ? Math.min(1, tl / 0.9) : 0;
        this.halo.material.opacity = landed ? 0.16 + 0.7 * (1 - wave) * (1 - wave) : 0.16 * fall;
        this.halo.scale.setScalar(landed ? 1 + ease4(wave) * 1.6 : 1 + Math.sin(now / 800) * 0.03);
        this.halo.rotation.z = now / 4000;
        // brilhos sobem em espiral em volta do cristal
        this.sparks.forEach(s => {
          const d = s.userData;
          d.a += 0.006 * d.sp * (1 + (1 - e) * 3);
          d.y += 0.004 * d.sp; if (d.y > 1.2) d.y = -1.1;
          s.position.set(Math.cos(d.a) * d.r, d.y, Math.sin(d.a) * d.r * 0.6);
          const tw = Math.max(0, Math.sin(now / 260 + d.ph));
          s.material.opacity = tw * 0.8 * fall * Math.min(1, (1.2 - d.y) * 2);
          s.scale.setScalar(0.05 + tw * 0.08 + pulse);
        });
        if (t >= 1 && !landed) {
          landed = true;
          caption.textContent = String(value);
          caption.classList.add('show');
          onLand?.();
        }
        if (landed) { // brilho que atravessa o cristal ao pousar
          const g = Math.min(1, tl / 0.7);
          this.glint.position.set(-0.5 + g, 0.75 - g * 0.6, 0.75);
          this.glint.material.opacity = Math.sin(g * Math.PI) * 0.8;
          this.glint.scale.setScalar(0.15 + Math.sin(g * Math.PI) * 0.22);
        }
        this.renderer.render(this.scene, this.camera);
        if (now - t0 < T + HOLD) requestAnimationFrame(frame);
        else {
          L.classList.remove('in'); L.classList.add('out');
          setTimeout(() => { L.classList.add('hidden'); L.classList.remove('out'); this.renderer.clear(); }, 450);
          resolve();
        }
      };
      requestAnimationFrame(frame);
    });
  }
}
