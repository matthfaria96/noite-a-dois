// Dado de cristal lapidado + "palco" do dado: o tabuleiro escurece e o dado gira em destaque.
import * as THREE from 'three';
import { ConvexGeometry } from 'three/addons/geometries/ConvexGeometry.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const SERIF = '"Playfair Display", Georgia, serif';
const ease4 = t => 1 - Math.pow(1 - t, 4);
const easeOutBack = t => 1 + 2.2 * Math.pow(t - 1, 3) + 1.2 * Math.pow(t - 1, 2); // passa um pouco do ponto e volta
const easeInOut = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

// Romboedro de cristal: um cubo esticado ao longo da diagonal, com duas pontas e 6 faces em losango.
// Os cantos são levemente lapidados para cintilar. Faces opostas somam 7.
const STRETCH = 1.35;   // quanto o cristal é esticado entre as pontas
const INR = 0.45;       // distância do centro até cada face (o dado pousa a essa altura)
const CHAMFER = 0.2;    // lapidação dos cantos
const CROWN = 0.06;     // cada face sobe numa pirâmide baixinha: 4 facetas que cintilam
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

// "caixa de joalheria": fundo escuro com faixas de luz fortes, como os softboxes de vitrine.
// É o que dá reflexos nítidos e contraste nas facetas.
function jewelryEnv(renderer) {
  const sc = new THREE.Scene();
  sc.background = new THREE.Color(0x070206);
  const box = (w, h, color, k, pos, look) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), side: THREE.DoubleSide }));
    m.position.set(...pos); m.lookAt(...look); sc.add(m);
  };
  box(6, 1.2, 0xc8405e, 1.6, [0, 6, 0], [0, 0, 0]);        // teto rubi (fraco: a ponta não estoura em branco)
  box(0.7, 7, 0xff5a7a, 4, [-5, 1, 2], [0, 0, 0]);        // faixa carmim à esquerda
  box(0.7, 7, 0xd4a14a, 3, [5, 1, -1], [0, 0, 0]);        // faixa de ouro velho à direita
  box(4, 0.5, 0x9a1040, 4, [0, -1, -5], [0, 0, 0]);       // brasa atrás
  box(3, 3, 0x5a0a2a, 2, [2.5, 2, 5], [0, 0, 0]);         // vinho na frente
  const pm = new THREE.PMREMGenerator(renderer);
  const tex = pm.fromScene(sc, 0.01).texture;
  pm.dispose();
  return tex;
}

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
    color: 0xe0203f, roughness: 0.04, metalness: 0, transmission: 1, thickness: 1.8, ior: 2.3,
    attenuationColor: new THREE.Color(0xc0102c), attenuationDistance: 2.1,
    clearcoat: 1, clearcoatRoughness: 0.05, specularIntensity: 0.8, specularColor: new THREE.Color(0xffb0bc),
    envMap: env, envMapIntensity: 2.4, emissive: 0x5a0010, emissiveIntensity: 0.5, flatShading: true,
  });
  const body = new THREE.Mesh(new ConvexGeometry(SHAPE.pts), crystal);
  body.castShadow = true;
  g.add(body);
  // núcleo: dá profundidade ao vermelho quando visto através do cristal
  const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.22, 0), new THREE.MeshBasicMaterial({ color: 0xff1a3a }));
  core.name = 'nucleo';
  core.scale.y = 1.7;
  g.add(core);
  for (const f of SHAPE.faces) {
    const map = numberTexture(f.n);
    // alphaTest + opaco: os números entram no "passe de refração" e aparecem por dentro do cristal
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.44, 0.44), new THREE.MeshStandardMaterial({
      map, alphaTest: 0.5, side: THREE.DoubleSide, metalness: 1, roughness: 0.22, envMap: env, envMapIntensity: 2.2,
      emissive: 0xffc04a, emissiveMap: map, emissiveIntensity: 0.7,
    }));
    m.position.copy(f.center).addScaledVector(f.normal, CROWN + 0.006);
    m.quaternion.copy(faceToCamera(f.n)).invert();
    m.userData = { n: f.n };
    g.add(m);
  }
  return g;
}

// brasa: ponto de luz carmim com halo (sobe da pedra como desejo)
function emberTexture() {
  const cv = document.createElement('canvas'); cv.width = cv.height = 64;
  const g = cv.getContext('2d');
  const rg = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  rg.addColorStop(0, 'rgba(255,190,160,1)'); rg.addColorStop(0.18, 'rgba(255,70,90,.85)'); rg.addColorStop(0.5, 'rgba(170,10,50,.25)'); rg.addColorStop(1, 'rgba(90,0,30,0)');
  g.fillStyle = rg; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// selo da pedra filosofal: círculo, triângulo, quadrado e círculo, um dentro do outro, com marcas em volta
function sigilTexture() {
  const S = 512, c = S / 2, cv = document.createElement('canvas'); cv.width = cv.height = S;
  const g = cv.getContext('2d');
  g.strokeStyle = 'rgba(190,30,70,.9)'; g.shadowColor = 'rgba(160,10,50,.9)'; g.shadowBlur = 6; g.lineWidth = 1.8;
  const circ = r => { g.beginPath(); g.arc(c, c, r, 0, Math.PI * 2); g.stroke(); };
  const R = 230;
  circ(R); circ(R - 14);
  for (let i = 0; i < 48; i++) { // marcas em volta, como um relógio alquímico
    const a = (i / 48) * Math.PI * 2, r1 = R - 14, r2 = i % 4 ? R - 22 : R - 32;
    g.beginPath(); g.moveTo(c + Math.cos(a) * r1, c + Math.sin(a) * r1); g.lineTo(c + Math.cos(a) * r2, c + Math.sin(a) * r2); g.stroke();
  }
  const r = R - 40, tri = [0, 1, 2].map(i => [c + Math.cos(-Math.PI / 2 + i * 2.0944) * r, c + Math.sin(-Math.PI / 2 + i * 2.0944) * r]);
  g.beginPath(); tri.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.stroke();
  // quadrado apoiado na base do triângulo e o círculo dentro dele
  const lado = (r * Math.sqrt(3)) * Math.sqrt(3) / (2 + Math.sqrt(3)), base = c + r / 2;
  g.strokeRect(c - lado / 2, base - lado, lado, lado);
  g.beginPath(); g.arc(c, base - lado / 2, lado / 2, 0, Math.PI * 2); g.stroke();
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
    this.env = jewelryEnv(r);
    this.camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
    this.camera.position.set(0, 0.35, 4.4);
    this.camera.lookAt(0, -0.05, 0);

    const key = new THREE.SpotLight(0xe0607c, 45, 20, 0.5, 0.6, 1);
    key.position.set(2.5, 5, 4);
    const red1 = new THREE.PointLight(0xff1030, 30, 10, 1.4); red1.position.set(-2.4, -0.4, -1.6);
    const red2 = new THREE.PointLight(0xff3a5a, 18, 10, 1.4); red2.position.set(2.2, 1.4, -2);
    const fill = new THREE.HemisphereLight(0x4a1a40, 0x14000a, 0.4);
    // luz de contorno por trás: acende as arestas e as pontas do cristal
    const rim = new THREE.SpotLight(0xff4a6e, 70, 12, 0.6, 0.5, 1); rim.position.set(-1.2, 2.2, -3);
    this.scene.add(key, red1, red2, fill, rim);

    this.die = makeDie(this.env);
    this.die.scale.setScalar(0.7);
    this.scene.add(this.die);

    // estúdio infinito: esfera escura com brilho carmim na altura do dado
    const bcv = document.createElement('canvas'); bcv.width = 16; bcv.height = 512;
    const bg = bcv.getContext('2d');
    const gr = bg.createLinearGradient(0, 0, 0, 512);
    gr.addColorStop(0, '#050106'); gr.addColorStop(0.34, '#14040f'); gr.addColorStop(0.5, '#33081c');
    gr.addColorStop(0.6, '#160410'); gr.addColorStop(0.8, '#060106'); gr.addColorStop(1, '#020102');
    bg.fillStyle = gr; bg.fillRect(0, 0, 16, 512);
    const btex = new THREE.CanvasTexture(bcv); btex.colorSpace = THREE.SRGBColorSpace;
    const dome = new THREE.Mesh(new THREE.SphereGeometry(14, 48, 32), new THREE.MeshBasicMaterial({ map: btex, side: THREE.BackSide }));
    dome.rotation.y = Math.PI;
    this.scene.add(dome);

    // poça de luz vermelha embaixo do dado (como a luz atravessando o cristal)
    const pcv = document.createElement('canvas'); pcv.width = pcv.height = 128;
    const pg = pcv.getContext('2d');
    const prg = pg.createRadialGradient(64, 64, 0, 64, 64, 64);
    prg.addColorStop(0, 'rgba(220,30,60,1)'); prg.addColorStop(0.45, 'rgba(140,10,40,.4)'); prg.addColorStop(1, 'rgba(60,0,20,0)');
    pg.fillStyle = prg; pg.fillRect(0, 0, 128, 128);
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.6), new THREE.MeshBasicMaterial({
      map: new THREE.CanvasTexture(pcv), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    pool.rotation.x = -Math.PI / 2; pool.position.set(0.25, -0.79, 0.2);
    this.pool = pool; this.scene.add(pool);

    // aura aconchegante atrás do dado (âmbar-rosado, respira devagar)
    const acv = document.createElement('canvas'); acv.width = acv.height = 256;
    const ag = acv.getContext('2d');
    const arg = ag.createRadialGradient(128, 128, 0, 128, 128, 128);
    arg.addColorStop(0, 'rgba(200,20,60,.75)'); arg.addColorStop(0.3, 'rgba(120,8,50,.35)');
    arg.addColorStop(0.6, 'rgba(70,4,40,.12)'); arg.addColorStop(1, 'rgba(30,0,20,0)');
    ag.fillStyle = arg; ag.fillRect(0, 0, 256, 256);
    this.aura = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(acv), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 }));
    this.aura.position.set(0, 0.05, -1.2); this.aura.scale.setScalar(4.2);
    this.scene.add(this.aura);
    this.halo = new THREE.Mesh(new THREE.RingGeometry(1.25, 1.28, 96), new THREE.MeshBasicMaterial({ color: 0xff3a64, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.halo.position.set(0, 0.05, -0.9);
    this.scene.add(this.halo);
    // feixe de luz que desce do alto: dois planos cruzados com degradê (barato, sem pós-processamento)
    const bmcv = document.createElement('canvas'); bmcv.width = 64; bmcv.height = 256;
    const bmg = bmcv.getContext('2d');
    const bx = bmg.createLinearGradient(0, 0, 64, 0);
    bx.addColorStop(0, 'rgba(120,0,40,0)'); bx.addColorStop(0.5, 'rgba(190,20,60,1)'); bx.addColorStop(1, 'rgba(120,0,40,0)');
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
    const warm = new THREE.PointLight(0xd4a14a, 8, 8, 1.4); warm.position.set(0.8, 1.6, 2.2);
    this.scene.add(warm);

    // brilhos cintilantes
    // selo alquímico atrás da pedra
    this.sigil = new THREE.Mesh(new THREE.PlaneGeometry(2.7, 2.7), new THREE.MeshBasicMaterial({
      map: sigilTexture(), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.sigil.position.set(0, -0.02, -1.4);
    this.scene.add(this.sigil);
    const star = emberTexture();
    this.sparks = Array.from({ length: 22 }, () => {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: star, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 }));
      s.userData = { a: Math.random() * Math.PI * 2, r: 0.15 + Math.random() * 0.5, y: -0.6 + Math.random() * 2.2, ph: Math.random() * 6, sp: 0.5 + Math.random() };
      this.scene.add(s);
      return s;
    });
    this.glint = new THREE.Sprite(new THREE.SpriteMaterial({ map: star, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 }));
    this.scene.add(this.glint);

    // bloom em meia resolução, só durante a rolagem: faz as facetas "estourarem" de luz
    this.composer = new EffectComposer(r);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.5, 0.5, 0.9);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());

    window.addEventListener('resize', () => this.resize());
    this.resize();
    // pré-aquece os shaders e o passe de refração quando o navegador estiver ocioso,
    // para a primeira rolagem não travar
    const warmup = () => { this.renderer.compile(this.scene, this.camera); this.composer.render(); this.renderer.clear(); };
    (window.requestIdleCallback ?? (f => setTimeout(f, 1500)))(warmup, { timeout: 4000 });
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
    this.bloom.resolution.set(w / 2, h / 2);
    this.camera.aspect = w / h;
    this.camera.fov = w / h < 1 ? 44 : 30; // no celular a câmera fecha mais para o dado não ficar pequeno
    this.camera.updateProjectionMatrix();
  }

  setQuality(q) {
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, q === 'leve' ? 1 : 1.5));
    this.composer.setPixelRatio(Math.min(window.devicePixelRatio, q === 'leve' ? 1 : 1.5));
    this.bloom.enabled = q !== 'leve';
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
      // pose final de frente e simétrica (um losango em pé), só levemente inclinada para mostrar a coroa
      const qT = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.3, 0, 0)).multiply(faceToCamera(value));
      const Y = new THREE.Vector3(0, 1, 0), Z = new THREE.Vector3(0, 0, 1);
      const spin = Math.PI * 2 * (3 + Math.floor(Math.random() * 2)); // voltas inteiras: termina exatamente de frente
      const nucleo = this.die.getObjectByName('nucleo'), corpo = this.die.children[0].material;
      this.die.children.forEach(c => { if (c.userData.n) c.visible = true; });
      const T = 3000 / this.speed, HOLD = 1400 / this.speed, t0 = performance.now();
      let landed = false;
      const qa = new THREE.Quaternion(), qb = new THREE.Quaternion();
      const cam = this.camera, beamMat = this.beam.userData.mat;

      const frame = () => {
        const now = performance.now();
        const t = Math.min(1, (now - t0) / T);
        // entra girando rápido, desacelera em câmera lenta mostrando as facetas
        // e assenta com peso: passa um pouco do ponto e volta
        const e = 1 - Math.pow(1 - t, 3.2); // desacelera suave até parar de frente, sem tranco
        const tl = landed ? (now - t0 - T) / 1000 : 0; // segundos desde o pouso
        // desce flutuando dentro do feixe, girando devagar, e assenta exatamente na face sorteada
        // levita girando em torno do eixo vertical (nunca parece tombada) com um balanço leve
        qa.setFromAxisAngle(Y, spin * (1 - e));
        qb.setFromAxisAngle(Z, Math.sin(now / 520) * 0.05 * (1 - e));
        this.die.quaternion.copy(qa).multiply(qb).multiply(qT);
        // o coração da pedra pulsa
        const bate = Math.pow(Math.max(0, Math.sin(now / 260)), 6);
        corpo.emissiveIntensity = 0.6 + bate * 0.6;
        nucleo.scale.setScalar(1 + bate * 0.18);
        const fall = ease4(Math.min(1, t * 1.1));
        const bob = Math.sin(now / 700) * 0.035 * fall;
        this.die.position.set(0, 2.4 * (1 - fall) + bob + (landed ? Math.min(0.12, tl * 0.4) * Math.max(0, 1 - tl) : 0), -0.8 * (1 - fall));
        // "respiro" ao pousar
        const pulse = landed ? Math.exp(-tl * 4) * 0.08 : 0;
        this.die.scale.setScalar((0.45 + 0.25 * fall) * (1 + pulse));
        this.bloom.strength = 0.55 + pulse * 6;
        // a câmera se aproxima devagar e orbita de leve: dá profundidade e paralaxe
        const k = easeInOut(Math.min(1, (now - t0) / (T + HOLD)));
        const orb = 0.16 * (1 - k); // termina exatamente de frente (centralizada, no celular também)
        cam.position.set(Math.sin(orb) * (4.6 - 0.6 * k), 0.35 + 0.25 * (1 - k), Math.cos(orb) * (4.6 - 0.6 * k));
        cam.lookAt(0, -0.05, 0);
        // feixe: acende, e depois do pouso se recolhe
        beamMat.opacity = Math.min(1, (now - t0) / 500) * (landed ? Math.max(0.1, 1 - tl * 1.4) : 1) * 0.28;
        this.beam.rotation.y = now / 5000;
        this.pool.material.opacity = 0.45 * fall;
        this.pool.scale.setScalar(0.6 + fall * 0.5 + pulse * 3);
        this.aura.material.opacity = (0.38 + Math.sin(now / 700) * 0.06 + pulse * 2) * fall;
        this.aura.scale.setScalar(4 + Math.sin(now / 900) * 0.2);
        // anel de luz: aro discreto que vira uma onda ao pousar
        const wave = landed ? Math.min(1, tl / 0.9) : 0;
        this.halo.material.opacity = landed ? 0.16 + 0.7 * (1 - wave) * (1 - wave) : 0.16 * fall;
        this.halo.scale.setScalar(landed ? 1 + ease4(wave) * 1.6 : 1 + Math.sin(now / 800) * 0.03);
        this.halo.rotation.z = now / 4000;
        // brasas de desejo: nascem da pedra e sobem ondulando, abrindo e sumindo no alto
        this.sparks.forEach(s => {
          const d = s.userData;
          d.y += 0.0055 * d.sp; d.a += 0.012 * d.sp;
          if (d.y > 1.7) { d.y = -0.5; d.r = 0.15 + Math.random() * 0.4; }
          const abre = d.r + Math.max(0, d.y) * 0.45;
          s.position.set(Math.cos(d.a) * abre, this.die.position.y + d.y, Math.sin(d.a) * abre * 0.5 - 0.1);
          const vida = Math.min(1, (d.y + 0.5) * 2) * Math.min(1, (1.7 - d.y) * 1.2);
          const tw = 0.55 + 0.45 * Math.sin(now / 300 + d.ph);
          s.material.opacity = vida * tw * 0.85 * fall;
          s.scale.setScalar(0.07 + tw * 0.06 + pulse * 0.5);
        });
        // selo alquímico: surge devagar, gira e acende quando a pedra pousa
        this.sigil.material.opacity = Math.min(0.14, (now - t0) / 3000) + (landed ? 0.22 * Math.exp(-tl * 2.2) : 0);
        this.sigil.rotation.z = -now / 9000;
        this.sigil.scale.setScalar(1 + (landed ? 0.06 * (1 - Math.exp(-tl * 3)) : 0));
        if (t >= 1 && !landed) {
          landed = true;
          this.die.children.forEach(c => { if (c.userData.n) c.visible = c.userData.n === value; });
          caption.textContent = String(value);
          caption.classList.add('show');
          onLand?.();
        }
        if (landed) { // brilho que atravessa o cristal ao pousar
          const g = Math.min(1, tl / 0.7);
          this.glint.position.set(-0.5 + g, 0.75 - g * 0.6, 0.75);
          this.glint.material.opacity = Math.sin(g * Math.PI) * 0.6;
          this.glint.scale.setScalar(0.12 + Math.sin(g * Math.PI) * 0.16);
        }
        if (this.bloom.enabled) this.composer.render(); else this.renderer.render(this.scene, this.camera);
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
