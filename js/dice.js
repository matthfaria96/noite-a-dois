// Dado de cristal lapidado + "palco" do dado: o tabuleiro escurece e o dado gira em destaque.
import * as THREE from 'three';
import { ConvexGeometry } from 'three/addons/geometries/ConvexGeometry.js';

const SERIF = '"Playfair Display", Georgia, serif';
const easeInOut = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

// Romboedro de cristal: um cubo esticado ao longo da diagonal, com duas pontas e 6 faces em losango.
// Os cantos são levemente lapidados para cintilar. Faces opostas somam 7.
const STRETCH = 1.35;   // quanto o cristal é esticado entre as pontas
const INR = 0.45;       // distância do centro até cada face (o dado pousa a essa altura)
const CHAMFER = 0.2;    // lapidação dos cantos
const CROWN = 0.13;     // cada face sobe numa pirâmide baixinha: 4 facetas que cintilam
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

// "caixa de joalheria": fundo escuro com faixas de luz fortes, como os softboxes de vitrine.
// É o que dá reflexos nítidos e contraste nas facetas.
function jewelryEnv(renderer) {
  const sc = new THREE.Scene();
  sc.background = new THREE.Color(0x070206);
  const box = (w, h, color, k, pos, look) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), side: THREE.DoubleSide }));
    m.position.set(...pos); m.lookAt(...look); sc.add(m);
  };
  box(6, 1.2, 0xff6f94, 2.6, [0, 6, 0], [0, 0, 0]);       // teto rosé
  box(0.7, 7, 0xff4a78, 5, [-5, 1, 2], [0, 0, 0]);        // faixa rosa-carmim à esquerda
  box(0.7, 7, 0xff7a96, 4, [5, 1, -1], [0, 0, 0]);        // faixa rosé à direita
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
  gr.addColorStop(0, '#fffafb'); gr.addColorStop(0.5, '#ffe3ea'); gr.addColorStop(1, '#f7b9c9');
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
    color: 0xf0123a, roughness: 0.02, metalness: 0, transmission: 1, thickness: 1.6, ior: 2.3,
    attenuationColor: new THREE.Color(0xe0102e), attenuationDistance: 1.7,
    clearcoat: 1, clearcoatRoughness: 0.02, specularIntensity: 1, specularColor: new THREE.Color(0xff8aa4),
    envMap: env, envMapIntensity: 3, emissive: 0x8a0020, emissiveIntensity: 0.5, flatShading: true,
  });
  const body = new THREE.Mesh(new ConvexGeometry(SHAPE.pts), crystal);
  body.castShadow = true;
  g.add(body);
  // núcleo: dá profundidade ao vermelho quando visto através do cristal
  const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.22, 0), new THREE.MeshBasicMaterial({ color: 0x6a0016 }));
  core.name = 'nucleo';
  core.scale.y = 1.7;
  g.add(core);
  for (const f of SHAPE.faces) {
    const map = numberTexture(f.n);
    // alphaTest + opaco: os números entram no "passe de refração" e aparecem por dentro do cristal
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.44, 0.44), new THREE.MeshStandardMaterial({
      map, alphaTest: 0.5, side: THREE.DoubleSide, metalness: 0.2, roughness: 0.35, envMap: env, envMapIntensity: 1,
      emissive: 0xffd6e0, emissiveMap: map, emissiveIntensity: 0.9,
    }));
    m.position.copy(f.center).addScaledVector(f.normal, CROWN + 0.006);
    m.quaternion.copy(faceToCamera(f.n)).invert();
    m.userData = { n: f.n };
    g.add(m);
  }
  return g;
}

export class DiceStage {
  constructor(layer) {
    this.layer = layer;
    this.speed = 1;
    this.host = layer.querySelector('#dice-stage');
    const r = this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    r.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.05;
    r.setClearColor(0x000000, 0);
    this.host.appendChild(r.domElement);
    this.scene = new THREE.Scene();
    this.env = jewelryEnv(r);
    // câmera parada e centralizada: só se aproxima devagar (nunca sai do centro, nem no celular)
    this.camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);

    // luz só em tons de rubi e vinho: realça as facetas sem brilho branco
    const key = new THREE.SpotLight(0xff6f90, 55, 20, 0.5, 0.6, 1); key.position.set(2.2, 4.5, 4);
    const rim = new THREE.SpotLight(0xa0102e, 60, 12, 0.6, 0.5, 1); rim.position.set(-1.4, 2, -3);
    const baixo = new THREE.PointLight(0x7a0020, 14, 8, 1.4); baixo.position.set(0, -2, 1.5);
    const fill = new THREE.HemisphereLight(0x3a0a26, 0x0a0006, 0.35);
    this.scene.add(key, rim, baixo, fill);

    this.die = makeDie(this.env);
    this.scene.add(this.die);

    // fundo: quase preto, com um vinho profundo só atrás da pedra
    const cv = document.createElement('canvas'); cv.width = cv.height = 256;
    const g = cv.getContext('2d');
    const rg = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    rg.addColorStop(0, 'rgba(255,90,140,.55)'); rg.addColorStop(0.22, 'rgba(200,30,80,.35)'); rg.addColorStop(0.5, 'rgba(70,4,30,.2)'); rg.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = rg; g.fillRect(0, 0, 256, 256);
    const ctex = new THREE.CanvasTexture(cv); ctex.colorSpace = THREE.SRGBColorSpace;
    this.aura = new THREE.Mesh(new THREE.PlaneGeometry(7, 7), new THREE.MeshBasicMaterial({ map: ctex, transparent: true, opacity: 0, depthWrite: false }));
    this.aura.position.set(0, 0, -2.5);
    this.scene.add(this.aura);

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
    this.camera.fov = w / h < 1 ? 44 : 30; // no celular a câmera fecha mais para a pedra não ficar pequena
    this.camera.updateProjectionMatrix();
  }

  setQuality(q) {
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, q === 'leve' ? 1 : 1.5));
    this.resize();
  }

  // recorte quadrado em volta da pedra, logo depois de desenhar o quadro (a mesma pedra vai para o painel do jogo)
  #foto() {
    try {
      const src = this.renderer.domElement, p = this.die.position.clone().project(this.camera);
      const cx = (p.x + 1) / 2 * src.width, cy = (1 - p.y) / 2 * src.height, lado = Math.min(src.width, src.height) * 0.5;
      const cv = document.createElement('canvas'); cv.width = cv.height = 192;
      cv.getContext('2d').drawImage(src, cx - lado / 2, cy - lado / 2, lado, lado, 0, 0, 192, 192);
      return cv.toDataURL('image/png');
    } catch { return null; }
  }

  // A pedra surge do escuro no centro, girando em torno do próprio eixo, e desacelera numa curva só
  // até parar de frente na face sorteada. Resolve quando ela para.
  roll(value, onLand) {
    return new Promise(resolve => {
      const L = this.layer;
      L.classList.remove('hidden', 'out');
      void L.offsetWidth;
      L.classList.add('in');
      const caption = L.querySelector('.dice-caption');
      caption.classList.remove('show');

      // pose final: de frente e simétrica (losango em pé), levemente inclinada para mostrar a coroa
      const qT = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.28, 0, 0)).multiply(faceToCamera(value));
      const Y = new THREE.Vector3(0, 1, 0), qa = new THREE.Quaternion();
      const spin = Math.PI * 2 * (2 + Math.floor(Math.random() * 2)); // voltas inteiras: termina exatamente de frente
      const T = 2600 / this.speed, HOLD = 1300 / this.speed, t0 = performance.now();
      const nucleo = this.die.getObjectByName('nucleo'), corpo = this.die.children[0].material;
      this.die.children.forEach(c => { if (c.userData.n) c.visible = true; });
      const cam = this.camera;
      let landed = false, foto = null;

      const frame = () => {
        const now = performance.now();
        const t = Math.min(1, (now - t0) / T);
        const e = 1 - Math.pow(1 - t, 4);                 // uma desaceleração contínua, sem tranco
        const surge = 1 - Math.pow(1 - Math.min(1, t / 0.45), 3);
        qa.setFromAxisAngle(Y, spin * (1 - e));
        this.die.quaternion.copy(qa).multiply(qT);
        this.die.position.set(0, Math.sin(now / 900) * 0.025 * surge, 0);
        this.die.scale.setScalar(0.42 + 0.26 * surge);
        // o coração da pedra pulsa devagar; ela "acende" ao surgir do escuro
        const bate = Math.pow(Math.max(0, Math.sin(now / 420)), 4);
        corpo.emissiveIntensity = (0.45 + bate * 0.35) * surge;
        nucleo.scale.setScalar(1 + bate * 0.12);
        this.aura.material.opacity = (0.75 + bate * 0.25) * surge;
        const k = easeInOut(Math.min(1, (now - t0) / (T + HOLD)));
        cam.position.set(0, 0.3, 4.6 - 0.35 * k);
        cam.lookAt(0, 0, 0);
        if (t >= 1 && !landed) {
          landed = true;
          // ao parar, só o número sorteado fica aceso dentro da pedra
          this.die.children.forEach(c => { if (c.userData.n) c.visible = c.userData.n === value; });
          caption.textContent = String(value);
          caption.classList.add('show');
          onLand?.();
        }
        this.renderer.render(this.scene, this.camera);
        if (landed && !foto && now - t0 > T + 250) foto = this.#foto();
        if (now - t0 < T + HOLD) requestAnimationFrame(frame);
        else {
          L.classList.remove('in'); L.classList.add('out');
          setTimeout(() => { L.classList.add('hidden'); L.classList.remove('out'); this.renderer.clear(); }, 450);
          resolve(foto);
        }
      };
      requestAnimationFrame(frame);
    });
  }
}
