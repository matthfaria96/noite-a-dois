// Dado de cristal lapidado + "palco" do dado: o tabuleiro escurece e o dado gira em destaque.
import * as THREE from 'three';
import { ConvexGeometry } from 'three/addons/geometries/ConvexGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const SERIF = '"Playfair Display", Georgia, serif';
const ease4 = t => 1 - Math.pow(1 - t, 4);

// Faces: +x:3  -x:4  +y:1  -y:6  +z:2  -z:5  (opostas somam 7)
export const FACES = [
  [3, [1, 0, 0], [0, Math.PI / 2, 0]], [4, [-1, 0, 0], [0, -Math.PI / 2, 0]],
  [1, [0, 1, 0], [-Math.PI / 2, 0, 0]], [6, [0, -1, 0], [Math.PI / 2, 0, 0]],
  [2, [0, 0, 1], [0, 0, 0]], [5, [0, 0, -1], [0, Math.PI, 0]],
];
// rotação (Euler YXZ) que deixa a face `n` virada para cima
export const TOP = { 1: [0, 0], 6: [Math.PI, 0], 2: [-Math.PI / 2, 0], 5: [Math.PI / 2, 0], 3: [0, Math.PI / 2], 4: [0, -Math.PI / 2] };

function numberTexture(n) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 256;
  const g = cv.getContext('2d');
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = `600 196px ${SERIF}`;
  const gr = g.createLinearGradient(0, 40, 0, 230);
  gr.addColorStop(0, '#fff4c4'); gr.addColorStop(0.4, '#e9bd55'); gr.addColorStop(1, '#9a6410');
  g.fillStyle = gr;
  g.fillText(String(n), 128, 136);
  if (n === 6) g.fillRect(92, 236, 72, 9);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

// Gema estilo "Asscher": cubo com arestas e cantos lapidados.
function gemGeometry(c = 0.15) {
  const a = 0.5, b = 0.5 - c, pts = [];
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
    pts.push(new THREE.Vector3(sx * a, sy * b, sz * b));
    pts.push(new THREE.Vector3(sx * b, sy * a, sz * b));
    pts.push(new THREE.Vector3(sx * b, sy * b, sz * a));
  }
  return new ConvexGeometry(pts);
}

export function makeDie(env) {
  const g = new THREE.Group();
  const crystal = new THREE.MeshPhysicalMaterial({
    color: 0xff2a3a, roughness: 0.07, metalness: 0, transmission: 1, thickness: 1.2, ior: 2.0,
    attenuationColor: new THREE.Color(0xff0a24), attenuationDistance: 1.1,
    clearcoat: 1, clearcoatRoughness: 0, specularIntensity: 1, specularColor: new THREE.Color(0xffffff),
    envMap: env, envMapIntensity: 2.6, emissive: 0x3a0006, emissiveIntensity: 0.4, flatShading: true,
  });
  const body = new THREE.Mesh(gemGeometry(), crystal);
  body.castShadow = true;
  g.add(body);
  // núcleo: dá profundidade ao vermelho quando visto através do cristal
  const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.24, 0), new THREE.MeshBasicMaterial({ color: 0xff2440 }));
  g.add(core);
  for (const [n, nrm, rot] of FACES) {
    const map = numberTexture(n);
    // alphaTest + opaco: os números entram no "passe de refração" e aparecem por dentro do cristal
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.56), new THREE.MeshStandardMaterial({
      map, alphaTest: 0.5, side: THREE.DoubleSide, metalness: 0.9, roughness: 0.32, envMap: env, envMapIntensity: 1.8,
      emissive: 0xffb437, emissiveMap: map, emissiveIntensity: 0.18,
    }));
    m.position.set(nrm[0] * 0.503, nrm[1] * 0.503, nrm[2] * 0.503);
    m.rotation.set(...rot);
    m.userData = { n, nrm: new THREE.Vector3(...nrm) };
    g.add(m);
  }
  g.rotation.order = 'YXZ';
  return g;
}

// quaternion que vira a face `n` para a câmera (+z) com o número em pé
function faceToCamera(n) {
  const [, nrm, rot] = FACES.find(f => f[0] === n);
  const e = new THREE.Euler(...rot);
  const normal = new THREE.Vector3(...nrm);
  const up = new THREE.Vector3(0, 1, 0).applyEuler(e);
  const right = new THREE.Vector3().crossVectors(up, normal);
  const m = new THREE.Matrix4().makeBasis(right, up, normal).transpose();
  return new THREE.Quaternion().setFromRotationMatrix(m);
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
    r.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.15;
    r.setClearColor(0x000000, 0);
    this.host.appendChild(r.domElement);
    this.scene = new THREE.Scene();
    this.env = new THREE.PMREMGenerator(r).fromScene(new RoomEnvironment(), 0.02).texture;
    this.camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
    this.camera.position.set(0, 0.9, 4.6);
    this.camera.lookAt(0, -0.05, 0);

    const key = new THREE.SpotLight(0xfff1e8, 70, 20, 0.5, 0.6, 1);
    key.position.set(2.5, 5, 4);
    const red1 = new THREE.PointLight(0xff1030, 30, 10, 1.4); red1.position.set(-2.4, -0.4, -1.6);
    const red2 = new THREE.PointLight(0xff3a5a, 18, 10, 1.4); red2.position.set(2.2, 1.4, -2);
    const fill = new THREE.HemisphereLight(0x6a4080, 0x200008, 0.5);
    this.scene.add(key, red1, red2, fill);

    this.die = makeDie(this.env);
    this.die.scale.setScalar(1.15);
    this.scene.add(this.die);

    // estúdio infinito: esfera escura com brilho carmim na altura do dado
    const bcv = document.createElement('canvas'); bcv.width = 16; bcv.height = 512;
    const bg = bcv.getContext('2d');
    const gr = bg.createLinearGradient(0, 0, 0, 512);
    gr.addColorStop(0, '#0a0006'); gr.addColorStop(0.36, '#3a0414'); gr.addColorStop(0.5, '#8a0a24');
    gr.addColorStop(0.56, '#3a0212'); gr.addColorStop(0.75, '#0c0006'); gr.addColorStop(1, '#000000');
    bg.fillStyle = gr; bg.fillRect(0, 0, 16, 512);
    const btex = new THREE.CanvasTexture(bcv); btex.colorSpace = THREE.SRGBColorSpace;
    const dome = new THREE.Mesh(new THREE.SphereGeometry(14, 48, 32), new THREE.MeshBasicMaterial({ map: btex, side: THREE.BackSide }));
    dome.rotation.y = Math.PI;
    this.scene.add(dome);

    // poça de luz vermelha embaixo do dado (como a luz atravessando o cristal)
    const pcv = document.createElement('canvas'); pcv.width = pcv.height = 128;
    const pg = pcv.getContext('2d');
    const prg = pg.createRadialGradient(64, 64, 0, 64, 64, 64);
    prg.addColorStop(0, 'rgba(255,40,70,1)'); prg.addColorStop(0.45, 'rgba(220,0,40,.45)'); prg.addColorStop(1, 'rgba(120,0,20,0)');
    pg.fillStyle = prg; pg.fillRect(0, 0, 128, 128);
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.6), new THREE.MeshBasicMaterial({
      map: new THREE.CanvasTexture(pcv), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    pool.rotation.x = -Math.PI / 2; pool.position.set(0.25, -0.79, 0.2);
    this.pool = pool; this.scene.add(pool);

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
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.fov = w / h < 1 ? 56 : 30;
    this.camera.updateProjectionMatrix();
  }

  setQuality(q) {
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, q === 'leve' ? 1.25 : 1.75));
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

      const qT = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.38, -0.52, 0, 'YXZ')).multiply(faceToCamera(value));
      const axis = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
      const axis2 = new THREE.Vector3(Math.random() - 0.5, 1, Math.random() - 0.5).normalize();
      const spin = Math.PI * 2 * (5 + Math.random() * 2);
      const T = 2600 / this.speed, HOLD = 1300 / this.speed, t0 = performance.now();
      let landed = false;
      const qa = new THREE.Quaternion(), qb = new THREE.Quaternion();

      const frame = () => {
        const now = performance.now();
        const t = Math.min(1, (now - t0) / T);
        const e = ease4(t);
        // gira forte no começo e desacelera até parar exatamente na face sorteada
        qa.setFromAxisAngle(axis, spin * (1 - e));
        qb.setFromAxisAngle(axis2, spin * 0.35 * (1 - e) * (1 - e));
        this.die.quaternion.copy(qT).multiply(qa).multiply(qb);
        // entra flutuando de cima e assenta
        const fall = ease4(Math.min(1, t * 1.25));
        this.die.position.set(0, 2.6 * (1 - fall) + Math.sin(now / 600) * 0.03 * fall, -1.5 * (1 - fall));
        const sc = 0.55 + 0.6 * fall;
        this.die.scale.setScalar(sc * (t >= 1 ? 1 + Math.max(0, 0.06 - (now - t0 - T) / 3000) : 1));
        this.pool.material.opacity = 0.85 * fall;
        this.pool.scale.setScalar(0.6 + fall * 0.5);
        this.sparks.forEach(s => {
          const d = s.userData;
          d.a += 0.004 * d.sp * (1 + (1 - e) * 4);
          s.position.set(Math.cos(d.a) * d.r, d.y + Math.sin(now / 900 + d.ph) * 0.1, Math.sin(d.a) * d.r * 0.6);
          s.material.opacity = Math.max(0, Math.sin(now / 260 + d.ph)) * 0.8 * fall;
          s.scale.setScalar(0.06 + Math.max(0, Math.sin(now / 260 + d.ph)) * 0.08);
        });
        if (t >= 1 && !landed) {
          landed = true;
          caption.textContent = String(value);
          caption.classList.add('show');
          onLand?.();
        }
        if (landed) { // brilho que atravessa o cristal ao pousar
          const g = Math.min(1, (now - t0 - T) / 700);
          this.glint.position.set(-0.6 + g * 1.2, 0.55 - g * 0.5, 0.75);
          this.glint.material.opacity = Math.sin(g * Math.PI) * 0.95;
          this.glint.scale.setScalar(0.25 + Math.sin(g * Math.PI) * 0.25);
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
