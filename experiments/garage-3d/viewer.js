import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const canvas = document.getElementById('carCanvas');
const box = document.getElementById('canvasBox');
const status = document.getElementById('sceneStatus');
const select = document.getElementById('modelSelect');
const problemSelect = document.getElementById('problemSelect');
const modeButtons = [...document.querySelectorAll('[data-mode]')];
const partLabel = document.getElementById('partLabel');
const modeHint = document.getElementById('modeHint');
const models = new Set(['sedan','sedan-sports','hatchback-sports','suv','suv-luxury','van']);
const modes = {
  body: {
    symptoms: ['Вмятина','Царапина','Коррозия','Покраска','Полировка','Другое'],
    hint: 'Нажмите на кузов или колесо, чтобы выбрать реальную группу модели. Отдельные панели пока не размечены.'
  },
  electric: {
    symptoms: ['Не запускается','Не заряжается АКБ','Ошибка ЭБУ','Не работает освещение','Другое'],
    hint: 'Режим выбора услуги. Электрические цепи и конкретные компоненты в данной модели отсутствуют.'
  },
  mechanic: {
    symptoms: ['Стук подвески','Троит двигатель','Проблемы с тормозами','Течь жидкости','Другое'],
    hint: 'Режим выбора услуги. Двигатель, коробка и подвеска ещё не представлены отдельными 3D-узлами.'
  }
};
let mode = 'body';
let currentPart = '';
let renderer, scene, camera, controls, car, floor, resizeObserver;
let destroyed = false;
let loadSequence = 0;
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const loader = new GLTFLoader();
const initialView = new THREE.Vector3(4, 2.8, 4.5);

function showStatus(message) {
  status.textContent = message;
  status.hidden = false;
}
function hideStatus() { status.hidden = true; }
function updateMode(modeValue) {
  if (!Object.hasOwn(modes, modeValue)) return;
  mode = modeValue;
  currentPart = '';
  partLabel.textContent = 'Узел не выбран';
  modeHint.textContent = modes[mode].hint;
  modeButtons.forEach((b) => {
    const active = b.dataset.mode === mode;
    b.classList.toggle('is-active', active);
    b.setAttribute('aria-pressed', String(active));
  });
  problemSelect.replaceChildren(...modes[mode].symptoms.map((name) => {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    return opt;
  }));
}
modeButtons.forEach((button) => button.addEventListener('click', () => updateMode(button.dataset.mode)));
updateMode(mode);

function init() {
  if (!window.WebGL2RenderingContext) {
    showStatus('WebGL2 не поддерживается: используйте форму выбора услуги ниже.');
    return false;
  }
  try {
    renderer = new THREE.WebGLRenderer({canvas,antialias:true,alpha:true,powerPreference:'low-power'});
  } catch (error) {
    showStatus('3D-режим недоступен на этом устройстве. Выбор услуги работает без него.');
    return false;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.65;

  scene = new THREE.Scene();
  scene.background = new THREE.Color('#202932');
  camera = new THREE.PerspectiveCamera(38, 1, 0.01, 500);
  camera.position.copy(initialView);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x71818f, 2.6));
  const key = new THREE.DirectionalLight(0xffffff, 3.8);
  key.position.set(3, 7, 5);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xffb582, 1.5);
  fill.position.set(-5, 3, -2);
  scene.add(fill);

  controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.minPolarAngle = 0.3;
  controls.maxPolarAngle = Math.PI * 0.75;
  controls.minDistance = 1;
  controls.maxDistance = 30;
  resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(box);
  resize();
  animate();
  return true;
}
function resize() {
  if (!renderer) return;
  const width = Math.max(1, box.clientWidth);
  const height = Math.max(1, box.clientHeight);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
}
function animate() {
  if (destroyed || !renderer) return;
  requestAnimationFrame(animate);
  if (document.hidden) return;
  controls.update();
  renderer.render(scene,camera);
}
function disposeObject(object) {
  if (!object) return;
  object.traverse((node) => {
    if (node.geometry) node.geometry.dispose();
    if (node.material) {
      for (const material of [node.material].flat()) {
        if (material && typeof material.dispose === 'function') material.dispose();
      }
    }
  });
  scene.remove(object);
}
function fitCamera(object) {
  const bounds = new THREE.Box3().setFromObject(object);
  if (bounds.isEmpty()) throw new Error('Геометрия 3D-модели не обнаружена');
  const center = bounds.getCenter(new THREE.Vector3());
  const size = bounds.getSize(new THREE.Vector3());
  object.position.sub(center);
  const radius = Math.max(size.length() * 0.85, 1);
  const dist = radius / Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5)) * 0.75;
  controls.minDistance = Math.max(radius * 0.5, 0.3);
  controls.maxDistance = radius * 8;
  controls.target.set(0, 0, 0);
  camera.position.set(dist * 0.8, dist * 0.5, dist * 0.85);
  camera.near = Math.max(0.01, radius / 100);
  camera.far = radius * 30;
  camera.updateProjectionMatrix();
  controls.update();
  if (floor) disposeObject(floor);
  const geometry = new THREE.CircleGeometry(Math.max(size.x,size.z)*0.9, 64);
  const material = new THREE.MeshStandardMaterial({color:0x28343b, roughness:0.95});
  floor = new THREE.Mesh(geometry,material);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -size.y / 2 - 0.035;
  scene.add(floor);
}
async function loadModel(name) {
  if (!models.has(name) || !scene) return;
  const requestId = ++loadSequence;
  showStatus('Загрузка модели…');
  try {
    const loaded = await loader.loadAsync('./models/' + name + '.glb');
    if (requestId !== loadSequence) {
      loaded.scene.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
      });
      return;
    }
    disposeObject(car);
    car = loaded.scene;
    scene.add(car);
    fitCamera(car);
    currentPart = '';
    partLabel.textContent = 'Узел не выбран';
    hideStatus();
  } catch(error) {
    showStatus('Не удалось загрузить модель. Проверьте локальные файлы GLB.');
    console.error('KARETA 3D load:',error);
  }
}
function labelForNode(name) {
  if (name === 'body') return 'Кузов';
  if (name === 'wheel-front-right') return 'Колесо переднее правое';
  if (name === 'wheel-front-left') return 'Колесо переднее левое';
  if (name === 'wheel-back-right') return 'Колесо заднее правое';
  if (name === 'wheel-back-left') return 'Колесо заднее левое';
  if (name.startsWith('wheel')) return 'Колесо';
  return name ? name.replaceAll('-', ' ') : 'Группа модели';
}
function pick(event) {
  if (!car || !camera || !renderer) return;
  const rect = canvas.getBoundingClientRect();
  pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -((event.clientY - rect.top) / rect.height * 2 - 1));
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObject(car, true);
  if (!hits.length) return;
  let obj = hits[0].object;
  while (obj.parent && obj.parent !== car && !obj.name) obj = obj.parent;
  currentPart = obj.name || obj.parent?.name || 'body';
  partLabel.textContent = labelForNode(currentPart);
}
let pointerStart = null;
canvas.addEventListener('pointerdown',(e)=>{pointerStart={x:e.clientX,y:e.clientY,id:e.pointerId};});
canvas.addEventListener('pointercancel',()=>{pointerStart=null;});
canvas.addEventListener('pointerup',(e)=>{
  if (pointerStart && pointerStart.id === e.pointerId && Math.hypot(pointerStart.x-e.clientX,pointerStart.y-e.clientY)<7) pick(e);
  pointerStart=null;
});
select.addEventListener('change',()=>loadModel(select.value));
document.getElementById('resetView').addEventListener('click',()=>{
  if(car) fitCamera(car);
});
document.getElementById('saveDraft').addEventListener('click',()=>{
  const draft = {
    schema:'kareta.3d-garage.draft.v1',
    status:'local_demo_only',
    vehicle_model_category: select.value,
    service_system:mode,
    geometry_part_name:currentPart || null,
    symptom:problemSelect.value,
    note:document.getElementById('problemNote').value.trim().slice(0,500),
    submitted:false
  };
  const objectUrl = URL.createObjectURL(new Blob([JSON.stringify(draft,null,2)],{type:'application/json;charset=utf-8'}));
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = 'kareta-3d-garage-draft.json';
  document.body.append(a);
  a.click();
  a.remove();
  window.setTimeout(()=>URL.revokeObjectURL(objectUrl),1000);
});
if (init()) loadModel(select.value);
window.addEventListener('pagehide',()=>{destroyed=true;resizeObserver?.disconnect();controls?.dispose();disposeObject(car);disposeObject(floor);renderer?.dispose();});
