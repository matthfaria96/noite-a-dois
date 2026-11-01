// Cena 3D: mapa sinuoso de blocos de obsidiana, ilhas à luz de velas, pétalas,
// lua de sangue, peças (Ele / Ela), dado de cristal vermelho e câmera imersiva.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { CATEGORIAS, FASES } from './data.js';
import { drawIcon } from './icons.js';

const PIECE_COLORS = { ele: 0x2a6bff, ela: 0xff1f55 };
const CELL = 2.05;   // tamanho da célula do mapa
const RISE = 0.11;   // subida por degrau
const SERIF = '"Playfair Display", Georgia, serif';
const SANS = '-apple-system, BlinkMacSystemFont, "SF Pro Display", Inter, system-ui, sans-serif';
const GOLD = '#e8c27a';

const ease = t => 1 - Math.pow(1 - t, 3);
const wait = ms => new Promise(r => setTimeout(r, ms));
const rnd = n => Math.floor(Math.random() * n);

function canvas(w, h = w) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  return [cv, cv.getContext('2d')];
}
function tex(cv) {
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
function shade(hex, amt) { // clareia (+) ou escurece (-)
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

export class Board3D {
  constructor(container) {
    this.container = container;
    const r = this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    r.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.0;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(r.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = this.#skyTexture();
    this.scene.fog = new THREE.Fog(0x16040a, 22, 78);

    const pm = new THREE.PMREMGenerator(r);
    this.env = pm.fromScene(new RoomEnvironment(), 0.04).texture;

    this.camera = new THREE.PerspectiveCamera(55, 1, 0.1, 400);
    this.camPos = new THREE.Vector3(0, 30, 25);
    this.camLook = new THREE.Vector3(0, 0, -20);
    this.camDir = new THREE.Vector3(0, 0, -1);
    this.wantPos = new THREE.Vector3();
    this.wantLook = new THREE.Vector3();
    this.mode = 'orbit'; // 'orbit' (tela inicial) | 'follow' | 'overview' | 'free'

    // Iluminação de pouca luz: ambiente baixo + "luz de vela" seguindo a peça
    this.scene.add(new THREE.HemisphereLight(0x6a4a8a, 0x2a0508, 0.45));
    this.key = new THREE.SpotLight(0xffb27a, 55, 40, 0.62, 0.75, 1.2);
    this.key.castShadow = true;
    this.key.shadow.mapSize.set(1024, 1024);
    this.key.shadow.bias = -0.002;
    this.scene.add(this.key, this.key.target);
    this.rim = new THREE.PointLight(0xff1a3a, 30, 22, 1.5);
    this.blue = new THREE.PointLight(0x3550ff, 20, 18, 1.6);
    this.scene.add(this.rim, this.blue);

    this.composer = new EffectComposer(r);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.7, 0.55, 0.8);
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
    this.#makeDie();

    window.addEventListener('resize', () => this.resize());
    this.resize();
    r.setAnimationLoop(() => this.#tick());
  }

  // ================================================================ texturas
  #skyTexture() {
    const [cv, g] = canvas(8, 1024);
    const gr = g.createLinearGradient(0, 0, 0, 1024);
    gr.addColorStop(0, '#04040f');
    gr.addColorStop(0.3, '#0b0a26');
    gr.addColorStop(0.55, '#24061a');
    gr.addColorStop(0.78, '#4a0712');
    gr.addColorStop(1, '#7a1a0a');
    g.fillStyle = gr; g.fillRect(0, 0, 8, 1024);
    return tex(cv);
  }

  #tileTexture(tile, i) {
    // camada transparente que fica sobre o bloco de vidro
    const S = 256, [cv, g] = canvas(S);
    const fase = FASES[tile.fase];
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 3;
    g.beginPath(); g.roundRect(16, 16, S - 32, S - 32, 40); g.stroke();
    const cat = CATEGORIAS[tile.tipo];
    if (cat) {
      g.fillStyle = 'rgba(10,2,8,.35)';
      g.beginPath(); g.arc(S / 2, S / 2, 72, 0, Math.PI * 2); g.fill();
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

  #sideTexture(color) {
    // lateral escura com um filete de luz na borda superior
    const [cv, g] = canvas(16, 64);
    g.fillStyle = '#000'; g.fillRect(0, 0, 16, 64);
    const gr = g.createLinearGradient(0, 0, 0, 64);
    gr.addColorStop(0, color); gr.addColorStop(0.12, color); gr.addColorStop(0.3, '#00000000');
    g.fillStyle = gr; g.fillRect(0, 0, 16, 64);
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

  #numberTexture(n) {
    const [cv, g] = canvas(256);
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = `700 190px ${SERIF}`;
    const gr = g.createLinearGradient(0, 40, 0, 220);
    gr.addColorStop(0, '#fff1b0'); gr.addColorStop(0.45, '#f0c040'); gr.addColorStop(1, '#a26a00');
    g.fillStyle = gr;
    g.fillText(String(n), 128, 140);
    if (n === 6) g.fillRect(88, 238, 80, 10);
    return tex(cv);
  }

  // ================================================================ atmosfera
  #makeEmbers() {
    const N = 700, pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
    const palette = [0xff5a1a, 0xff2a2a, 0xffb347, 0xffe0a0, 0x6a7bff].map(c => new THREE.Color(c));
    for (let i = 0; i < N; i++) {
      pos.set([(Math.random() - 0.5) * 80, Math.random() * 36 - 12, 20 - Math.random() * 110], i * 3);
      const c = palette[i % 17 === 0 ? 4 : rnd(4)];
      col.set([c.r, c.g, c.b], i * 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this.embers = new THREE.Points(geo, new THREE.PointsMaterial({
      size: 0.2, map: glowTexture('#ffffff'), vertexColors: true, transparent: true,
      depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    }));
    this.scene.add(this.embers);
  }

  #makePetals() {
    // pétalas de rosa caindo devagar ao redor da peça da vez
    const s = new THREE.Shape();
    s.moveTo(0, -0.5);
    s.bezierCurveTo(0.45, -0.3, 0.4, 0.35, 0, 0.5);
    s.bezierCurveTo(-0.4, 0.35, -0.45, -0.3, 0, -0.5);
    const geo = new THREE.ShapeGeometry(s, 6);
    geo.scale(0.22, 0.3, 0.22);
    const mat = new THREE.MeshStandardMaterial({ color: 0xb0001c, emissive: 0x3a0006, roughness: 0.5, side: THREE.DoubleSide });
    const N = 140;
    this.petals = new THREE.InstancedMesh(geo, mat, N);
    this.petalData = Array.from({ length: N }, () => ({
      x: (Math.random() - 0.5) * 26, y: Math.random() * 14, z: (Math.random() - 0.5) * 26,
      rx: Math.random() * 6, ry: Math.random() * 6, sp: 0.3 + Math.random() * 0.5, sw: Math.random() * 6,
    }));
    this.petals.frustumCulled = false;
    this.scene.add(this.petals);
    this.petalCenter = new THREE.Vector3();
    this.tmpObj = new THREE.Object3D();
  }

  #makeDie() {
    // Dado de cristal lapidado (cantos chanfrados) com números dourados.
    const geo = new RoundedBoxGeometry(1, 1, 1, 1, 0.2);
    const crystal = new THREE.MeshPhysicalMaterial({
      color: 0xe8001f, emissive: 0x5a0008, emissiveIntensity: 0.35,
      roughness: 0.04, metalness: 0, transmission: 0.55, thickness: 1.2, ior: 1.75,
      attenuationColor: new THREE.Color(0xa0000e), attenuationDistance: 0.7,
      clearcoat: 1, clearcoatRoughness: 0.03, specularIntensity: 1,
      envMap: this.env, envMapIntensity: 2.2, flatShading: true,
    });
    this.die = new THREE.Group();
    const body = new THREE.Mesh(geo, crystal);
    body.castShadow = true;
    this.die.add(body);
    const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.33, 0),
      new THREE.MeshBasicMaterial({ color: 0xc8001c, transparent: true, opacity: 0.5 }));
    this.die.add(core);
    // +x:3  -x:4  +y:1  -y:6  +z:2  -z:5
    const faces = [
      [3, [0.501, 0, 0], [0, Math.PI / 2, 0]], [4, [-0.501, 0, 0], [0, -Math.PI / 2, 0]],
      [1, [0, 0.501, 0], [-Math.PI / 2, 0, 0]], [6, [0, -0.501, 0], [Math.PI / 2, 0, 0]],
      [2, [0, 0, 0.501], [0, 0, 0]], [5, [0, 0, -0.501], [0, Math.PI, 0]],
    ];
    for (const [n, p, rot] of faces) {
      const map = this.#numberTexture(n);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.58, 0.58), new THREE.MeshStandardMaterial({
        map, transparent: true, metalness: 0.85, roughness: 0.3, envMap: this.env, envMapIntensity: 1.6,
        emissive: 0xffb02e, emissiveMap: map, emissiveIntensity: 0.25, depthWrite: false,
      }));
      m.position.set(...p); m.rotation.set(...rot);
      this.die.add(m);
    }
    this.die.rotation.order = 'YXZ';
    this.die.scale.setScalar(1.15);
    this.dieLight = new THREE.PointLight(0xff1a2e, 18, 6, 1.5);
    this.scene.add(this.dieLight);
    this.die.visible = false;
    this.scene.add(this.die);
  }

  #pawn(color, symbol) {
    const g = new THREE.Group();
    const pts = [[0, 0], [0.44, 0], [0.46, 0.1], [0.32, 0.18], [0.18, 0.5], [0.14, 0.8], [0.27, 0.86], [0.11, 0.93], [0, 0.93]]
      .map(([x, y]) => new THREE.Vector2(x, y));
    const mat = new THREE.MeshPhysicalMaterial({
      color: shade(color, 0.35), transmission: 1, roughness: 0.06, thickness: 0.9, ior: 1.5,
      attenuationColor: new THREE.Color(color), attenuationDistance: 0.45,
      clearcoat: 1, clearcoatRoughness: 0.03, envMap: this.env, envMapIntensity: 1.4, specularIntensity: 1,
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
    const l = new THREE.PointLight(color, 4, 3, 1.6); l.position.y = 0.6;
    g.add(coreB, coreH, body, head, band, l);
    // medalhão flutuante com o símbolo
    const [cv, c2] = canvas(128);
    c2.beginPath(); c2.arc(64, 64, 56, 0, Math.PI * 2); c2.fillStyle = 'rgba(255,255,255,.16)'; c2.fill();
    c2.lineWidth = 3; c2.strokeStyle = 'rgba(255,255,255,.75)'; c2.stroke();
    const hex = '#' + new THREE.Color(color).getHexString();
    c2.fillStyle = '#fff'; c2.shadowColor = hex; c2.shadowBlur = 18;
    c2.font = '600 62px system-ui, sans-serif';
    c2.textAlign = 'center'; c2.textBaseline = 'middle'; c2.fillText(symbol, 64, 68);
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex(cv), depthWrite: false, fog: false }));
    spr.scale.setScalar(0.55); spr.position.y = 1.75; g.add(spr);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.62, 48),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, side: THREE.DoubleSide }));
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
      const h = 0.35 + Math.random() * 0.5;
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.12, h, 14), wax);
      const a = (k / n) * Math.PI * 2 + Math.random() * 0.5, r = k === 0 ? 0 : 0.32 + Math.random() * 0.15;
      c.position.set(Math.cos(a) * r, h / 2, Math.sin(a) * r);
      const flame = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTex, blending: THREE.AdditiveBlending, depthWrite: false, color: 0xffb36b }));
      flame.scale.set(0.32, 0.5, 1);
      flame.position.set(c.position.x, h + 0.16, c.position.z);
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

  #island(radius, color) {
    const g = new THREE.Group();
    const topMat = new THREE.MeshPhysicalMaterial({ color: shade(color, 0.5), transmission: 1, roughness: 0.35, thickness: 0.6, ior: 1.4,
      attenuationColor: new THREE.Color(color), attenuationDistance: 1.2, clearcoat: 1, envMap: this.env, envMapIntensity: 0.9 });
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x0e0406, roughness: 0.9, flatShading: true });
    const top = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius * 0.96, 0.4, 10), topMat);
    const rock = new THREE.Mesh(new THREE.ConeGeometry(radius * 0.95, radius * 1.9, 10, 2), rockMat);
    rock.rotation.x = Math.PI; rock.position.y = -0.2 - radius * 0.95;
    const rim = new THREE.Mesh(new THREE.TorusGeometry(radius * 0.99, 0.035, 6, 48),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55 }));
    rim.rotation.x = Math.PI / 2; rim.position.y = 0.2;
    const glowDisc = new THREE.Mesh(new THREE.CircleGeometry(radius * 0.7, 32), new THREE.MeshBasicMaterial({ color }));
    glowDisc.rotation.x = -Math.PI / 2; glowDisc.position.y = -0.1;
    g.add(glowDisc);
    top.receiveShadow = true;
    g.add(top, rock, rim);
    return g;
  }

  // ================================================================ mapa
  #genCells(N) {
    // Caminho sinuoso: avança, vira para um lado, avança, vira para o outro...
    const cells = [[0, 0]];
    let x = 0, z = 0, first = true;
    const run = (dx, dz, len) => { for (let k = 0; k < len && cells.length < N; k++) { x += dx; z += dz; cells.push([x, z]); } };
    while (cells.length < N) {
      run(0, -1, first ? 3 : 2 + rnd(2));
      first = false;
      if (cells.length >= N) break;
      const side = x >= 2 ? -1 : x <= -2 ? 1 : (Math.random() < 0.5 ? -1 : 1);
      const room = side > 0 ? 5 - x : x + 5;
      run(side, 0, Math.max(2, Math.min(room, 2 + rnd(4))));
    }
    return cells;
  }

  build(tiles) {
    this.world.clear();
    this.animated = [];
    this.flames = [];
    this.tiles = tiles;
    const N = tiles.length;
    const cells = this.#genCells(N);
    this.path = cells.map(([x, z], i) => new THREE.Vector3(x * CELL, i * RISE, z * CELL));
    this.dirs = this.path.map((p, i) => {
      const a = i < N - 1 ? p : this.path[i - 1], b = i < N - 1 ? this.path[i + 1] : p;
      return b.clone().sub(a).setY(0).normalize();
    });

    // ---- degraus de vidro com núcleo de luz
    const geo = new RoundedBoxGeometry(1.86, 0.5, 1.86, 4, 0.16);
    const coreGeo = new RoundedBoxGeometry(1.36, 0.08, 1.36, 2, 0.04);
    const topGeo = new THREE.PlaneGeometry(1.86, 1.86).rotateX(-Math.PI / 2);
    const glassCache = {}, coreCache = {};
    tiles.forEach((tile, i) => {
      const fase = FASES[tile.fase];
      glassCache[fase.cor] ??= new THREE.MeshPhysicalMaterial({
        color: shade(fase.cor, 0.55), transmission: 1, roughness: 0.3, thickness: 0.9, ior: 1.45,
        attenuationColor: new THREE.Color(fase.cor), attenuationDistance: 0.8,
        clearcoat: 1, clearcoatRoughness: 0.06, specularIntensity: 1, envMap: this.env, envMapIntensity: 1.1,
      });
      coreCache[fase.cor] ??= new THREE.MeshBasicMaterial({ color: shade(fase.cor, 0.1) });
      const g = new THREE.Group();
      g.position.copy(this.path[i]);
      g.rotation.y = Math.atan2(this.dirs[i].x, this.dirs[i].z) + Math.PI;
      const block = new THREE.Mesh(geo, glassCache[fase.cor]);
      block.position.y = -0.25;
      block.receiveShadow = true;
      const core = new THREE.Mesh(coreGeo, coreCache[fase.cor]);
      core.position.y = -0.3;
      const top = new THREE.Mesh(topGeo, new THREE.MeshBasicMaterial({ map: this.#tileTexture(tile, i), transparent: true, depthWrite: false }));
      top.position.y = 0.006;
      g.add(block, core, top);
      if (tile.tipo === 'inicio' || tile.tipo === 'fim') g.scale.set(1.25, 1, 1.25);
      this.world.add(g);
      if (i % 3 === 0) {
        const pil = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 7, 8),
          new THREE.MeshBasicMaterial({ color: shade(fase.cor, 0.2), transparent: true, opacity: 0.35 }));
        pil.position.copy(this.path[i]).setY(this.path[i].y - 4);
        this.world.add(pil);
      }
    });

    // ---- utilidades de espaço livre
    const freeAt = (p, r) => this.path.every(q => Math.hypot(q.x - p.x, q.z - p.z) > r);
    const findSpot = (i, r) => {
      const d = this.dirs[i], perp = new THREE.Vector3(-d.z, 0, d.x);
      for (const dist of [4.5, 5.5, 6.5, 8]) for (const s of [1, -1]) {
        const p = this.path[i].clone().addScaledVector(perp, dist * s);
        if (freeAt(p, r)) return p;
      }
      return null;
    };

    // ---- ilhas de cada fase: placa, velas e coração
    FASES.forEach((fase, f) => {
      const i = tiles.findIndex(t => t.fase === f && t.tipo !== 'inicio');
      const p = findSpot(Math.max(1, i), 3.4);
      if (!p) return;
      const isl = this.#island(2.4, fase.cor);
      isl.position.copy(p).setY(this.path[i].y - 0.8);
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 1.05),
        new THREE.MeshBasicMaterial({ map: this.#signTexture(fase.nome, fase.cor), transparent: true, side: THREE.DoubleSide }));
      sign.position.y = 2.6;
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.3, 6),
        new THREE.MeshStandardMaterial({ color: 0xf2e6e0, metalness: 1, roughness: 0.2, envMap: this.env }));
      post.position.y = 1.2;
      const cand = this.#candles(5, true);
      cand.position.set(-1.2, 0.2, 0.5);
      const h = this.#heart(fase.cor, 0.5, 0.6);
      h.position.set(1.3, 1.0, 0.4);
      isl.add(post, sign, cand, h);
      this.world.add(isl);
      this.animated.push({ o: isl, base: isl.position.y, sp: 0.7 + f * 0.1, amp: 0.2, sign, heart: h });
    });

    // ---- ilhotas com velas e discos flutuantes
    for (let k = 0; k < 22; k++) {
      const i = rnd(N);
      const d = this.dirs[i], perp = new THREE.Vector3(-d.z, 0, d.x);
      const p = this.path[i].clone().addScaledVector(perp, (Math.random() < 0.5 ? -1 : 1) * (3.2 + Math.random() * 9));
      p.z += (Math.random() - 0.5) * 4;
      if (!freeAt(p, 2.2)) continue;
      let o;
      if (Math.random() < 0.5) {
        const fc = FASES[tiles[i].fase].cor;
        o = new THREE.Mesh(new RoundedBoxGeometry(1, 0.12, 1, 2, 0.05), new THREE.MeshPhysicalMaterial({
          color: shade(fc, 0.5), transmission: 1, roughness: 0.25, thickness: 0.3, attenuationColor: new THREE.Color(fc),
          attenuationDistance: 0.5, clearcoat: 1, envMap: this.env }));
        o.rotation.y = Math.random() * 3;
      } else {
        o = this.#island(0.8 + Math.random() * 0.7, FASES[tiles[i].fase].cor);
        o.add(this.#candles(2 + rnd(3), false));
      }
      o.position.copy(p).setY(this.path[i].y - 1 - Math.random() * 2.5);
      this.world.add(o);
      this.animated.push({ o, base: o.position.y, sp: 0.5 + Math.random() * 0.8, amp: 0.25 + Math.random() * 0.3 });
    }

    // ---- lua de sangue ao fundo
    const end = this.path[N - 1];
    const [mcv, mg] = canvas(256);
    const mgr = mg.createRadialGradient(100, 96, 10, 128, 128, 128);
    mgr.addColorStop(0, '#ff9a5a'); mgr.addColorStop(0.5, '#d0301a'); mgr.addColorStop(1, '#5a0808');
    mg.fillStyle = mgr; mg.fillRect(0, 0, 256, 256);
    for (let k = 0; k < 30; k++) { // crateras suaves
      mg.fillStyle = `rgba(60,0,0,${0.08 + Math.random() * 0.12})`;
      mg.beginPath(); mg.arc(Math.random() * 256, Math.random() * 256, 4 + Math.random() * 22, 0, Math.PI * 2); mg.fill();
    }
    const moon = new THREE.Mesh(new THREE.SphereGeometry(13, 48, 32), new THREE.MeshBasicMaterial({ map: tex(mcv), fog: false }));
    moon.position.set(end.x - 30, end.y + 22, end.z - 60);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('#ff3a1a'), blending: THREE.AdditiveBlending, depthWrite: false, fog: false, opacity: 0.8 }));
    halo.scale.setScalar(70);
    moon.add(halo);
    this.world.add(moon);

    // ---- coração do Clímax
    this.heartBig = this.#heart(0xff1a3a, 1.5, 0.9);
    this.heartBig.position.copy(end).setY(end.y + 2.6);
    const hl = new THREE.PointLight(0xff1a3a, 20, 12, 1.5);
    this.heartBig.add(hl);
    this.world.add(this.heartBig);

    // ---- peças
    for (const who of ['ele', 'ela']) {
      const p = this.#pawn(PIECE_COLORS[who], who === 'ele' ? '♂' : '♀');
      this.pieces[who] = p;
      this.world.add(p);
      this.place(who, 0);
    }

    // ---- enquadramento
    const box = new THREE.Box3().setFromPoints(this.path);
    this.center = box.getCenter(new THREE.Vector3());
    this.size = box.getSize(new THREE.Vector3());
    this.embers.position.set(this.center.x, 0, this.center.z + 40);
    this.die.position.copy(this.path[0]).add(new THREE.Vector3(1.5, 0.8, -1.6));
    this.die.rotation.set(0.3, 0.6, 0);
    this.die.visible = true;
    this.dieFocus = null;
    this.camDir.set(0, 0, -1);
    this.camPos.copy(this.path[0]).add(new THREE.Vector3(0, 16, 14));
    this.camLook.copy(this.path[Math.min(N - 1, 6)]);
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

  async movePiece(who, from, to, onStep) {
    const dir = to > from ? 1 : -1;
    const piece = this.pieces[who];
    for (let i = from; i !== to; i += dir) {
      const a = this.#spot(who, i), b = this.#spot(who, i + dir);
      const T = 320, t0 = performance.now();
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

  async rollDie(value, who) {
    const idx = this.pieces[who].userData.idx;
    const d = this.camDir.clone();
    const perp = new THREE.Vector3(-d.z, 0, d.x);
    const land = this.path[idx].clone().addScaledVector(d, 1.9).addScaledVector(perp, who === 'ele' ? 0.9 : -0.9);
    land.y += 0.8;
    const start = land.clone().addScaledVector(d, -2.5); start.y += 4.5;
    const tgt = { 1: [0, 0], 6: [Math.PI, 0], 2: [-Math.PI / 2, 0], 5: [Math.PI / 2, 0], 3: [0, Math.PI / 2], 4: [0, -Math.PI / 2] }[value];
    const sx = Math.random() * 6, sz = Math.random() * 6, yaw = Math.atan2(-d.x, -d.z) + (Math.random() - 0.5) * 0.8;
    const ex = tgt[0] + Math.PI * 2 * 3, ez = tgt[1] + Math.PI * 2 * 2;
    this.die.visible = true;
    this.dieFocus = land.clone();
    const T = 1400, t0 = performance.now();
    await new Promise(res => {
      const step = () => {
        const t = Math.min(1, (performance.now() - t0) / T);
        const e = ease(t);
        const fall = Math.min(1, t * 1.7);
        this.die.position.lerpVectors(start, land, ease(fall));
        const bt = Math.max(0, t * 1.7 - 1);
        this.die.position.y = fall < 1
          ? start.y + (land.y - start.y) * fall * fall
          : land.y + Math.abs(Math.sin(bt * Math.PI * 1.7)) * 0.55 * (1 - bt / 0.7);
        this.die.rotation.set(sx + (ex - sx) * e, yaw, sz + (ez - sz) * e);
        this.dieLight.intensity = 22 + Math.sin(t * 30) * 8;
        if (t < 1) requestAnimationFrame(step); else res();
      };
      step();
    });
    this.die.position.y = land.y;
    this.die.rotation.set(tgt[0], yaw, tgt[1]);
    this.dieLight.intensity = 26;
    await wait(700);
  }

  hideDie() { this.dieFocus = null; this.dieLight.intensity = 12; }

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
    const dt = Math.min(0.1, this.clock.getDelta());
    const t = this.clock.elapsedTime;
    if (this.path) {
      const p = this.pieces[this.active];
      const idx = p.userData.idx ?? 0;
      const N = this.path.length;
      const pos = p.position;

      if (this.mode === 'follow') {
        const ahead = this.path[Math.min(N - 1, idx + 3)], behind = this.path[Math.max(0, idx - 1)];
        const want = ahead.clone().sub(behind).setY(0);
        if (want.lengthSq() > 0.01) this.camDir.lerp(want.normalize(), 1 - Math.exp(-dt * 2)).normalize();
        const back = this.portrait ? 5.6 : 6.4, up = this.portrait ? 6.8 : 5.6;
        this.wantPos.copy(pos).addScaledVector(this.camDir, -back).setY(pos.y + up);
        this.wantLook.copy(pos).addScaledVector(this.camDir, this.portrait ? 2.2 : 2.8);
        if (this.dieFocus) this.wantLook.lerp(this.dieFocus, 0.45);
      } else if (this.mode !== 'free') {
        const L = Math.max(this.size.z, this.size.x);
        const ang = this.mode === 'orbit' ? t * 0.07 : (this.portrait ? 0 : Math.PI / 2);
        const dist = this.portrait ? L * 0.7 : L * 0.68;
        const c = this.center;
        this.wantLook.copy(c);
        this.wantPos.set(c.x + Math.sin(ang) * dist * 0.75, c.y + dist * (this.portrait ? 1.25 : 0.95), c.z + Math.cos(ang) * dist * 0.75);
      }
      const k = 1 - Math.exp(-dt * (this.mode === 'follow' ? 2.8 : 1.6));
      this.camPos.lerp(this.wantPos, k);
      this.camLook.lerp(this.wantLook, k);
      this.camera.position.copy(this.camPos);
      this.camera.lookAt(this.camLook);

      // luz de vela acima da peça + contraluz carmim e um toque de azul
      const focus = this.mode === 'follow' ? pos : this.center;
      this.key.position.copy(focus).add(new THREE.Vector3(2.5, 11, 4));
      this.key.target.position.copy(focus);
      this.key.angle = this.mode === 'follow' ? 0.62 : 1.0;
      this.key.intensity = (this.mode === 'follow' ? 55 : 90) * (0.96 + Math.sin(t * 7) * 0.02 + Math.sin(t * 13) * 0.02);
      this.key.distance = this.mode === 'follow' ? 40 : 90;
      this.rim.position.copy(pos).addScaledVector(this.camDir, 6).setY(pos.y + 2.5);
      this.blue.position.copy(pos).addScaledVector(this.camDir, -3).add(new THREE.Vector3(-4, 3, 0));

      for (const k2 in this.pieces) {
        const pc = this.pieces[k2];
        pc.userData.ring.scale.setScalar(1 + Math.sin(t * 3) * 0.08);
        pc.userData.ring.material.opacity = 0.6 + Math.sin(t * 3) * 0.3;
        pc.userData.sprite.position.y = 1.75 + Math.sin(t * 2 + (k2 === 'ele' ? 0 : 1.5)) * 0.08;
      }
      const tmp = new THREE.Vector3();
      for (const a of this.animated) {
        a.o.position.y = a.base + Math.sin(t * a.sp + a.o.position.x) * a.amp;
        if (a.sign) a.sign.lookAt(this.camera.position.x, a.sign.getWorldPosition(tmp).y, this.camera.position.z);
        if (a.heart) a.heart.rotation.y = t * 1.2;
      }
      for (const f of this.flames) {
        const fl = 1 + Math.sin(t * 11 + f.ph) * 0.12 + Math.sin(t * 23 + f.ph * 2) * 0.08;
        if (f.s) f.s.scale.set(0.32 * fl, 0.5 * fl, 1);
        if (f.l) f.l.intensity = 6 * fl;
      }
      this.dieLight.position.copy(this.die.position).setY(this.die.position.y - 0.35);
      this.heartBig.rotation.y = t * 1.1;
      this.heartBig.scale.setScalar(1.5 + Math.pow(Math.max(0, Math.sin(t * 3.2)), 8) * 0.18); // batimento

      // pétalas ao redor do foco
      this.petalCenter.lerp(this.mode === 'follow' ? pos : this.center, 1 - Math.exp(-dt));
      const o = this.tmpObj;
      this.petalData.forEach((d, i) => {
        d.y -= dt * d.sp; d.rx += dt * 0.8; d.ry += dt * 0.6;
        if (d.y < -3) { d.y = 12; d.x = (Math.random() - 0.5) * 26; d.z = (Math.random() - 0.5) * 26; }
        o.position.set(this.petalCenter.x + d.x + Math.sin(t * 0.7 + d.sw) * 0.6, this.petalCenter.y + d.y, this.petalCenter.z + d.z);
        o.rotation.set(d.rx, d.ry, 0);
        o.updateMatrix();
        this.petals.setMatrixAt(i, o.matrix);
      });
      this.petals.instanceMatrix.needsUpdate = true;
    }
    const pa = this.embers.geometry.attributes.position;
    for (let i = 0; i < pa.count; i++) {
      let y = pa.getY(i) + dt * 0.45;
      if (y > 24) y = -12;
      pa.setY(i, y);
    }
    pa.needsUpdate = true;
    this.composer.render();
  }
}
