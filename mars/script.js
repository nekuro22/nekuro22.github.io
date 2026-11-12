import * as THREE from "three";
import { CSS2DRenderer, CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js";

const canvas = document.querySelector("#marsCanvas");
const slider = document.querySelector("#terraformSlider");

window.scrollTo(0, 0);

const stageTitle = document.querySelector("#stageTitle");
const stageKicker = document.querySelector("#stageKicker");
const stageYear = document.querySelector("#stageYear");
const stageName = document.querySelector("#stageName");
const stageText = document.querySelector("#stageText");
const atmoValue = document.querySelector("#atmoValue");
const waterValue = document.querySelector("#waterValue");
const fieldValue = document.querySelector("#fieldValue");

let texts = {};
let stages = [];

function isMobile() {
    return window.innerWidth < 860;
}

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile() ? 1.5 : 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;

const labelRenderer = new CSS2DRenderer();
labelRenderer.setSize(canvas.clientWidth, canvas.clientHeight);
labelRenderer.domElement.style.position = 'absolute';
labelRenderer.domElement.style.top = '0';
labelRenderer.domElement.style.left = '0';
labelRenderer.domElement.style.pointerEvents = 'none';
labelRenderer.domElement.style.fontFamily = 'Inter, ui-sans-serif, system-ui, sans-serif';
labelRenderer.domElement.style.fontSize = '14px';
labelRenderer.domElement.style.fontWeight = '600';
canvas.parentElement.appendChild(labelRenderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x080807, 0.025);

const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 100);
camera.position.set(0, 0, 8.4);

const root = new THREE.Group();
scene.add(root);

const keyLight = new THREE.DirectionalLight(0xffd49d, 3.2);
keyLight.position.set(-4, 2.4, 5);
scene.add(keyLight);

const rimLight = new THREE.DirectionalLight(0x48d5ff, 1.5);
rimLight.position.set(5, 0.2, -3);
scene.add(rimLight);

scene.add(new THREE.AmbientLight(0x4c3427, 0.85));

function seededRandom(seed) {
    let value = seed;
    return () => {
        value = (value * 16807) % 2147483647;
        return (value - 1) / 2147483646;
    };
}

function makePlanetTexture() {
    const size = 1024;
    const c = document.createElement("canvas");
    c.width = size;
    c.height = size / 2;
    const ctx = c.getContext("2d");
    const img = ctx.createImageData(c.width, c.height);
    const rand = seededRandom(42);
    const basins = Array.from({ length: 34 }, () => ({
        x: rand(),
        y: rand(),
        r: 0.025 + rand() * 0.12,
        tone: rand()
    }));

    for (let y = 0; y < c.height; y++) {
        const v = y / c.height;
        for (let x = 0; x < c.width; x++) {
            const u = x / c.width;
            let heat = Math.sin(u * 34.0) * 0.08 + Math.sin((u + v) * 79.0) * 0.05;
            let dark = 0;

            for (const b of basins) {
                const dx = Math.min(Math.abs(u - b.x), 1 - Math.abs(u - b.x));
                const dy = v - b.y;
                const d = Math.sqrt(dx * dx + dy * dy);
                if (d < b.r) {
                    dark += (1 - d / b.r) * (0.35 + b.tone * 0.3);
                }
            }

            const polar = Math.max(0, Math.abs(v - 0.5) - 0.39) * 5.5;
            const idx = (y * c.width + x) * 4;
            img.data[idx] = 154 + heat * 120 - dark * 95 + polar * 70;
            img.data[idx + 1] = 70 + heat * 48 - dark * 42 + polar * 76;
            img.data[idx + 2] = 38 + heat * 24 - dark * 24 + polar * 86;
            img.data[idx + 3] = 255;
        }
    }

    ctx.putImageData(img, 0, 0);
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = "#e6b67a";
    for (let i = 0; i < 220; i++) {
        const x = rand() * c.width;
        const y = rand() * c.height;
        const r = 1 + rand() * 6;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
    }

    const texture = new THREE.CanvasTexture(c);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
    return texture;
}

function makeAlphaTexture(color, seed, count, minRadius, maxRadius) {
    const size = 1024;
    const c = document.createElement("canvas");
    c.width = size;
    c.height = size / 2;
    const ctx = c.getContext("2d");
    const rand = seededRandom(seed);
    ctx.clearRect(0, 0, c.width, c.height);
    for (let i = 0; i < count; i++) {
        const x = rand() * c.width;
        const y = rand() * c.height;
        const r = minRadius + rand() * (maxRadius - minRadius);
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, color);
        g.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
    }
    const texture = new THREE.CanvasTexture(c);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
}

function smoothstep(edge0, edge1, x) {
    const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
    return t * t * (3 - 2 * t);
}

function mix(a, b, t) {
    return a + (b - a) * t;
}

const sphere = new THREE.SphereGeometry(1.7, 128, 128);
const marsMaterial = new THREE.MeshStandardMaterial({
    map: makePlanetTexture(),
    roughness: 0.92,
    metalness: 0.0
});
const mars = new THREE.Mesh(sphere, marsMaterial);
root.add(mars);

const ocean = new THREE.Mesh(
    new THREE.SphereGeometry(1.706, 128, 128),
    new THREE.MeshPhysicalMaterial({
        color: 0x0f8eaa,
        transparent: true,
        opacity: 0,
        roughness: 0.18,
        metalness: 0.0,
        transmission: 0.08
    })
);
root.add(ocean);

const green = new THREE.Mesh(
    new THREE.SphereGeometry(1.715, 128, 128),
    new THREE.MeshStandardMaterial({
        map: makeAlphaTexture("rgba(64,160,82,0.78)", 123, 90, 18, 86),
        color: 0x76c46b,
        transparent: true,
        opacity: 0,
        roughness: 0.74,
        alphaTest: 0.02
    })
);
root.add(green);

const clouds = new THREE.Mesh(
    new THREE.SphereGeometry(1.77, 96, 96),
    new THREE.MeshBasicMaterial({
        map: makeAlphaTexture("rgba(255,255,255,0.54)", 321, 130, 16, 78),
        color: 0xffffff,
        transparent: true,
        opacity: 0,
        depthWrite: false
    })
);
root.add(clouds);

const atmosphere = new THREE.Mesh(
    new THREE.SphereGeometry(1.86, 96, 96),
    new THREE.MeshBasicMaterial({
        color: 0x45cbff,
        transparent: true,
        opacity: 0.02,
        side: THREE.BackSide,
        depthWrite: false
    })
);
root.add(atmosphere);

const laserGroup = new THREE.Group();
root.add(laserGroup);

const laserMaterials = [];
const laserSatelliteMaterials = [];
const laserSatellites = [];
const laserTargets = [
    new THREE.Vector3(-0.9, 0.55, 1.34),
    new THREE.Vector3(0.72, -0.18, 1.53),
    new THREE.Vector3(0.2, 0.88, 1.43)
];

function alignCylinderBetween(mesh, start, end) {
    const midpoint = start.clone().add(end).multiplyScalar(0.5);
    const direction = end.clone().sub(start);
    mesh.position.copy(midpoint);
    mesh.scale.y = direction.length();
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
}

function makeOrbitalLaser(target, index) {
    const targetPoint = target.clone().normalize().multiplyScalar(1.72);
    const orbitPoint = target.clone().normalize().multiplyScalar(3.25 + index * 0.18);
    const group = new THREE.Group();
    group.position.copy(orbitPoint);
    group.lookAt(0, 0, 0);

    const body = new THREE.Mesh(
        new THREE.BoxGeometry(0.18, 0.1, 0.12),
        new THREE.MeshStandardMaterial({
            color: 0xb9b0a2,
            transparent: true,
            opacity: 0.28,
            roughness: 0.55,
            metalness: 0.15
        })
    );
    group.add(body);

    const panelMaterial = new THREE.MeshStandardMaterial({
        color: 0x263f52,
        transparent: true,
        opacity: 0.24,
        roughness: 0.45,
        metalness: 0.08
    });
    const leftPanel = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.018, 0.13), panelMaterial);
    const rightPanel = leftPanel.clone();
    leftPanel.position.x = -0.28;
    rightPanel.position.x = 0.28;
    group.add(leftPanel, rightPanel);
    laserGroup.add(group);

    const beamMaterial = new THREE.MeshBasicMaterial({
        color: 0xffc36b,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.028, 1, 16), beamMaterial);
    alignCylinderBetween(beam, orbitPoint, targetPoint);
    laserGroup.add(beam);

    const coreMaterial = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });
    const core = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.009, 1, 12), coreMaterial);
    alignCylinderBetween(core, orbitPoint, targetPoint);
    laserGroup.add(core);

    const spotMaterial = new THREE.MeshBasicMaterial({
        color: 0xff7a3b,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });
    const spot = new THREE.Mesh(new THREE.SphereGeometry(0.075, 24, 24), spotMaterial);
    spot.position.copy(targetPoint.clone().multiplyScalar(1.01));
    laserGroup.add(spot);

    laserMaterials.push(beamMaterial, coreMaterial, spotMaterial);
    laserSatelliteMaterials.push(body.material, panelMaterial);
    laserSatellites.push(group, spot);
}

laserTargets.forEach(makeOrbitalLaser);

const nitrogenGroup = new THREE.Group();
root.add(nitrogenGroup);

const nitrogenMaterials = [];
const nitrogenCapsules = [];
const nitrogenSource = new THREE.Vector3(-4.6, 1.35, 2.2);
const nitrogenTargets = [
    new THREE.Vector3(-0.55, 0.62, 1.72),
    new THREE.Vector3(0.02, 0.08, 1.86),
    new THREE.Vector3(0.52, -0.38, 1.78),
    new THREE.Vector3(-0.2, -0.72, 1.72),
    new THREE.Vector3(0.74, 0.5, 1.62)
];

function makeNitrogenCapsule(target, index) {
    const trailMaterial = new THREE.MeshBasicMaterial({
        color: 0x53c7ff,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });
    const explosionMaterial = new THREE.MeshBasicMaterial({
        color: 0xb8efff,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });

    const trailGeometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(),
        new THREE.Vector3()
    ]);
    const trail = new THREE.Line(trailGeometry, trailMaterial);
    nitrogenGroup.add(trail);

    const explosion = new THREE.Mesh(new THREE.SphereGeometry(0.16, 24, 24), explosionMaterial);
    explosion.position.copy(target);
    nitrogenGroup.add(explosion);

    nitrogenMaterials.push(trailMaterial, explosionMaterial);
    nitrogenCapsules.push({
        trail,
        explosion,
        start: nitrogenSource.clone().add(new THREE.Vector3(index * -0.08, index * 0.03, index * 0.04)),
        end: target.clone(),
        delay: index * 0.16
    });
}

nitrogenTargets.forEach(makeNitrogenCapsule);

const plasmaGroup = new THREE.Group();

const plasmaTorus = new THREE.Mesh(
    new THREE.TorusGeometry(3.8, 0.35, 48, 220),
    new THREE.MeshBasicMaterial({
        color: 0x0a92ff,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    })
);
plasmaTorus.scale.y = 0.7;
plasmaGroup.add(plasmaTorus);

const plasmaCore = new THREE.Mesh(
    new THREE.TorusGeometry(3.8, 0.12, 32, 220),
    new THREE.MeshBasicMaterial({
        color: 0x27e6ff,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    })
);
plasmaCore.scale.y = 0.7;
plasmaGroup.add(plasmaCore);

const fieldLineMaterials = [];
const fieldLineMarkers = [];
function addFieldLine(width, height, z, color = 0x22d8c7) {
    const points = [];
    for (let i = 0; i <= 180; i++) {
        const t = (i / 180) * Math.PI * 2;
        points.push(new THREE.Vector3(Math.cos(t) * width, Math.sin(t) * height, z));
    }
    const material = new THREE.LineBasicMaterial({
        color,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), material);
    fieldLineMaterials.push(material);
    plasmaGroup.add(line);

    const positions = line.geometry.attributes.position.array;
    const total = positions.length / 3;
    for (let j = 0; j < 3; j++) {
        const t = (j + 1) / 4;
        const idx = Math.floor(t * (total - 1));
        const idx2 = Math.min(idx + 1, total - 1);
        const px = positions[idx * 3], py = positions[idx * 3 + 1], pz = positions[idx * 3 + 2];
        const nx = positions[idx2 * 3], ny = positions[idx2 * 3 + 1], nz = positions[idx2 * 3 + 2];
        const dir = new THREE.Vector3(nx - px, ny - py, nz - pz).normalize();
        const cone = new THREE.Mesh(
            new THREE.ConeGeometry(0.045, 0.11, 6),
            new THREE.MeshBasicMaterial({
                color,
                transparent: true,
                opacity: 0,
                depthWrite: false
            })
        );
        cone.position.set(px, py, pz);
        cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
        plasmaGroup.add(cone);
        fieldLineMarkers.push(cone);
    }
}

for (let i = 0; i < 7; i++) {
    addFieldLine(4.2 + i * 0.3, 2.2 + i * 0.2, -0.55 - i * 0.02);
    addFieldLine(4.2 + i * 0.3, 2.2 + i * 0.2, 0.55 + i * 0.02);
}

const torusDisc = new THREE.Mesh(
    new THREE.RingGeometry(2.8, 4.6, 64),
    new THREE.MeshBasicMaterial({
        color: 0x000000,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        depthWrite: false
    })
);
torusDisc.scale.y = 0.7;
torusDisc.renderOrder = -1;
plasmaGroup.add(torusDisc);

const deimosLineGeo = new THREE.BufferGeometry();
const deimosLinePos = new Float32Array(6);
deimosLineGeo.setAttribute('position', new THREE.BufferAttribute(deimosLinePos, 3));
const deimosLineMat = new THREE.LineBasicMaterial({
    color: 0xffffff, transparent: true, opacity: 0, depthWrite: false
});
const deimosLine = new THREE.Line(deimosLineGeo, deimosLineMat);
plasmaGroup.add(deimosLine);

const phobosLineGeo = new THREE.BufferGeometry();
const phobosLinePos = new Float32Array(6);
phobosLineGeo.setAttribute('position', new THREE.BufferAttribute(phobosLinePos, 3));
const phobosLineMat = new THREE.LineBasicMaterial({
    color: 0xffffff, transparent: true, opacity: 0, depthWrite: false
});
const phobosLine = new THREE.Line(phobosLineGeo, phobosLineMat);
plasmaGroup.add(phobosLine);

const labelGroup = new THREE.Group();
root.add(labelGroup);

function makeLabel(text, x, y, z, fontSize = '14px', color = '#22d8c7') {
    const div = document.createElement('div');
    div.textContent = text;
    div.style.color = color;
    div.style.fontFamily = 'Inter, ui-sans-serif, system-ui, sans-serif';
    div.style.fontSize = fontSize;
    div.style.fontWeight = '600';
    div.style.textShadow = '0 0 8px rgba(0,0,0,0.8), 0 0 4px rgba(0,0,0,0.9)';
    div.style.pointerEvents = 'none';
    div.style.userSelect = 'none';
    const label = new CSS2DObject(div);
    label.position.set(x, y, z);
    label.visible = false;
    labelGroup.add(label);
    return label;
}

const plasmaTorusLabel = makeLabel('Plasma torus', 0, -3.4, 2.0);
const deimosLabel = makeLabel('Deimos', 4.8, 0.6, -1.8, '14px', '#ffffff');
const phobosLabel = makeLabel('Phobos', 4.6, 0.9, 1.2, '14px', '#ffffff');
const _deimosW = new THREE.Vector3();
const _phobosW = new THREE.Vector3();

const schematicElements = {
    torusDisc,
    deimosLine,
    deimosLineMat,
    phobosLine,
    phobosLineMat,
    labels: [
        plasmaTorusLabel, deimosLabel, phobosLabel
    ]
};

function makeMoon(radius, color, seed) {
    const moon = new THREE.Mesh(
        new THREE.IcosahedronGeometry(radius, 3),
        new THREE.MeshStandardMaterial({
            color,
            roughness: 0.96,
            metalness: 0.0
        })
    );
    const rand = seededRandom(seed);
    for (let i = 0; i < moon.geometry.attributes.position.count; i++) {
        const offset = 0.88 + rand() * 0.24;
        moon.geometry.attributes.position.setXYZ(
            i,
            moon.geometry.attributes.position.getX(i) * offset,
            moon.geometry.attributes.position.getY(i) * offset,
            moon.geometry.attributes.position.getZ(i) * offset
        );
    }
    moon.geometry.computeVertexNormals();
    return moon;
}

const moonGroup = new THREE.Group();
root.add(moonGroup);

const phobosOrbit = new THREE.Group();
phobosOrbit.rotation.x = -0.12;
moonGroup.add(phobosOrbit);

const phobos = makeMoon(0.105, 0x9b8d80, 77);
phobos.position.set(3.8, 0, 0.1);
phobos.scale.set(1.55, 0.9, 1.05);
phobosOrbit.add(phobos);

const phobosGlow = new THREE.Mesh(
    new THREE.SphereGeometry(0.17, 32, 32),
    new THREE.MeshBasicMaterial({
        color: 0x68f7ff,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    })
);
phobosGlow.position.copy(phobos.position);
phobosOrbit.add(phobosGlow);
root.add(plasmaGroup);

const deimosOrbit = new THREE.Group();
deimosOrbit.rotation.x = 0.24;
moonGroup.add(deimosOrbit);

const deimos = makeMoon(0.075, 0x8a8178, 91);
deimos.position.set(3.35, 0, -0.35);
deimos.scale.set(1.35, 0.8, 1.0);
deimosOrbit.add(deimos);

function makeStars() {
    const count = 1200;
    const positions = new Float32Array(count * 3);
    const rand = seededRandom(808);
    for (let i = 0; i < count; i++) {
        const radius = 22 + rand() * 22;
        const theta = rand() * Math.PI * 2;
        const phi = Math.acos(2 * rand() - 1);
        positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
        positions[i * 3 + 1] = radius * Math.cos(phi);
        positions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return new THREE.Points(geo, new THREE.PointsMaterial({
        color: 0xffecd4,
        size: 0.055,
        transparent: true,
        opacity: 0.72
    }));
}
scene.add(makeStars());

let terraformValue = 0;
let plasmaTorusBaseOpacity = 0;
let laserBaseOpacity = 0;
let nitrogenBaseOpacity = 0;
let targetRotationX = -0.16;
let targetRotationY = 0.34;
let cameraDistance = 8.4;
let targetCameraDistance = 8.4;
let isDragging = false;
let lastPointer = { x: 0, y: 0 };

if (isMobile()) {
    scene.fog.density = 0.015;
}

function updateStage(value) {
    const oceanT = smoothstep(0.45, 1.35, value);
    const fieldT = smoothstep(1.68, 2.22, value);
    const finalT = smoothstep(2.35, 3, value);
    const airT = smoothstep(0.18, 1.55, value);
    const laserT = smoothstep(0.52, 0.66, value) * (1 - smoothstep(1.12, 1.26, value));
    const nitrogenT = smoothstep(1.18, 1.3, value) * (1 - smoothstep(1.42, 1.5, value));
    const stageIndex = Math.min(3, Math.max(0, Math.round(value)));
    const stage = stages[stageIndex];

    ocean.material.opacity = mix(0, 0.5, oceanT) * (1 - finalT * 0.12);
    atmosphere.material.opacity = mix(0.02, 0.23, airT);
    clouds.material.opacity = mix(0, 0.46, smoothstep(0.75, 3, value));
    green.material.opacity = mix(0, 0.74, finalT);
    plasmaTorusBaseOpacity = mix(0, 0.2, fieldT) * (1 - finalT * 0.1);
    plasmaTorus.material.opacity = plasmaTorusBaseOpacity;
    plasmaCore.material.opacity = mix(0, 0.18, fieldT) * (1 - finalT * 0.1);
    phobosGlow.material.opacity = mix(0, 0.58, fieldT);
    laserBaseOpacity = mix(0, 0.66, laserT);
    laserMaterials.forEach((material, index) => {
        const isCore = index % 3 === 1;
        const isSpot = index % 3 === 2;
        material.opacity = laserBaseOpacity * (isCore ? 0.65 : isSpot ? 0.8 : 1);
    });
    laserSatelliteMaterials.forEach((material) => {
        material.opacity = mix(0.22, 1, laserT);
    });
    nitrogenBaseOpacity = mix(0, 0.92, nitrogenT);
    nitrogenMaterials.forEach((material, index) => {
        const isExplosion = index % 2 === 1;
        material.opacity = nitrogenBaseOpacity * (isExplosion ? 0.48 : 0.95);
    });
    const stageColors = [0x8a6040, 0xd4a050, 0x22d8c7, 0x5ab86e];
    const stageOpacities = [0.08, 0.12, 0.22, 0.15];
    const currentColor = stageColors[stageIndex];
    const currentOpacity = stageOpacities[stageIndex];

    fieldLineMaterials.forEach((material, index) => {
        material.color.setHex(currentColor);
        material.opacity = currentOpacity * (0.85 + (index % 2) * 0.15);
    });
    fieldLineMarkers.forEach((marker, index) => {
        marker.material.color.setHex(currentColor);
        marker.material.opacity = currentOpacity * (0.85 + (index % 2) * 0.15) * 2.0;
    });

    const schematicOpacity = fieldT * (1 - finalT * 0.3);
    torusDisc.material.opacity = fieldT * 0.6;
    deimosLineMat.opacity = schematicOpacity * 0.5;
    phobosLineMat.opacity = schematicOpacity * 0.5;
    plasmaTorusLabel.visible = fieldT > 0.01;
    deimosLabel.visible = fieldT > 0.01;
    phobosLabel.visible = fieldT > 0.01;
    marsMaterial.color.setRGB(
        mix(1, 0.72, oceanT * 0.35 + finalT * 0.2),
        mix(1, 0.86, finalT * 0.36),
        mix(1, 0.9, oceanT * 0.18)
    );

    stageKicker.textContent = `${texts.stageBadge?.stepPrefix || "Schritt"} ${stageIndex + 1}`;
    stageTitle.textContent = stage.title;
    stageYear.textContent = stage.year;
    stageName.textContent = stage.title;
    stageText.textContent = stage.text;
    atmoValue.textContent = `${Math.round(mix(1, 92, airT * 0.7 + finalT * 0.3))}%`;
    waterValue.textContent = `${Math.round(mix(0, 71, oceanT))}%`;
    fieldValue.textContent = `${Math.round(mix(0, 100, fieldT))}%`;
}

function resize() {
    let width = canvas.clientWidth || window.innerWidth;
    let height = canvas.clientHeight || window.innerHeight;
    if (width < 1) width = window.innerWidth;
    if (height < 1) height = window.innerHeight;
    renderer.setSize(width, height, false);
    labelRenderer.setSize(width, height);
    camera.aspect = width / height;
    const minDistance = width < 720 ? 8.8 : 6.8;
    const maxDistance = width < 720 ? 16.5 : 14.5;
    if (isMobile()) {
        targetRotationX = -0.05;
        targetRotationY = 0;
        root.rotation.x = -0.05;
        root.rotation.y = 0;
        const fixedDistance = Math.min(maxDistance, Math.max(minDistance, 9));
        targetCameraDistance = fixedDistance;
        cameraDistance = fixedDistance;
    } else {
        targetCameraDistance = Math.min(maxDistance, Math.max(minDistance, targetCameraDistance));
        cameraDistance = Math.min(maxDistance, Math.max(minDistance, cameraDistance));
    }
    camera.updateProjectionMatrix();
}

slider.addEventListener("input", (event) => {
    terraformValue = Number(event.target.value);
    updateStage(terraformValue);
});

canvas.addEventListener("pointerdown", (event) => {
    if (isMobile()) return;
    isDragging = true;
    lastPointer = { x: event.clientX, y: event.clientY };
    canvas.setPointerCapture(event.pointerId);
});

canvas.addEventListener("pointermove", (event) => {
    if (!isDragging || isMobile()) return;
    const dx = event.clientX - lastPointer.x;
    const dy = event.clientY - lastPointer.y;
    targetRotationY += dx * 0.006;
    targetRotationX += dy * 0.004;
    targetRotationX = Math.max(-0.75, Math.min(0.75, targetRotationX));
    lastPointer = { x: event.clientX, y: event.clientY };
});

canvas.addEventListener("pointerup", (event) => {
    if (isMobile()) return;
    isDragging = false;
    canvas.releasePointerCapture(event.pointerId);
});

canvas.addEventListener("wheel", (event) => {
    event.preventDefault();
    if (isMobile()) return;
    const width = canvas.clientWidth;
    const minDistance = width < 720 ? 8.8 : 6.8;
    const maxDistance = width < 720 ? 16.5 : 14.5;
    targetCameraDistance += event.deltaY * 0.006;
    targetCameraDistance = Math.min(maxDistance, Math.max(minDistance, targetCameraDistance));
}, { passive: false });

window.addEventListener("resize", resize);

const clock = new THREE.Clock();

function animate() {
    const elapsed = clock.getElapsedTime();
    root.rotation.x += (targetRotationX - root.rotation.x) * 0.06;
    root.rotation.y += (targetRotationY - root.rotation.y) * 0.06;
    cameraDistance += (targetCameraDistance - cameraDistance) * 0.12;
    camera.position.y = 0;
    camera.position.z = cameraDistance;
    mars.rotation.y += 0.0012;
    ocean.rotation.y += 0.0012;
    green.rotation.y += 0.0012;
    clouds.rotation.y += 0.0019;
    laserGroup.rotation.y = Math.sin(elapsed * 0.18) * 0.08;
    laserGroup.rotation.z = elapsed * 0.045;
    laserMaterials.forEach((material, index) => {
        const flicker = 0.82 + Math.sin(elapsed * 8.5 + index * 1.7) * 0.14;
        const isCore = index % 3 === 1;
        const isSpot = index % 3 === 2;
        material.opacity = laserBaseOpacity * flicker * (isCore ? 0.65 : isSpot ? 0.8 : 1);
    });
    laserSatellites.forEach((object, index) => {
        const pulse = 1 + Math.sin(elapsed * 6 + index) * 0.04;
        object.scale.setScalar(pulse);
    });
    nitrogenCapsules.forEach((capsule, index) => {
        const cycle = (elapsed * 0.18 + capsule.delay) % 1;
        const travelT = Math.min(1, cycle / 0.76);
        const easedT = travelT * travelT * (3 - 2 * travelT);
        const head = capsule.start.clone().lerp(capsule.end, easedT);
        const direction = capsule.end.clone().sub(capsule.start).normalize();
        const tail = head.clone().sub(direction.multiplyScalar(0.9));
        const positions = capsule.trail.geometry.attributes.position;
        positions.setXYZ(0, tail.x, tail.y, tail.z);
        positions.setXYZ(1, head.x, head.y, head.z);
        positions.needsUpdate = true;

        const explosionT = smoothstep(0.72, 0.86, cycle) * (1 - smoothstep(0.9, 1, cycle));
        capsule.trail.visible = nitrogenBaseOpacity > 0.01 && travelT < 1;
        capsule.trail.material.opacity = nitrogenBaseOpacity * (0.7 + Math.sin(elapsed * 14 + index) * 0.18);
        capsule.explosion.visible = nitrogenBaseOpacity > 0.01 && explosionT > 0.01;
        capsule.explosion.scale.setScalar(0.45 + explosionT * (1.8 + index * 0.08));
        capsule.explosion.material.opacity = nitrogenBaseOpacity * explosionT * 0.55;
    });
    plasmaTorus.material.opacity = plasmaTorusBaseOpacity * (0.88 + Math.sin(elapsed * 2.4) * 0.08);
    plasmaCore.rotation.z = elapsed * 0.08;
    phobosOrbit.rotation.z = elapsed * 0.42;
    phobos.rotation.x += 0.01;
    phobos.rotation.y += 0.014;
    phobosGlow.scale.setScalar(1 + Math.sin(elapsed * 4.2) * 0.16);
    deimosOrbit.rotation.z = elapsed * 0.12;
    deimos.rotation.x += 0.004;
    deimos.rotation.y += 0.006;

    deimos.getWorldPosition(_deimosW);
    const dlp = deimosLine.geometry.attributes.position.array;
    dlp[0] = _deimosW.x; dlp[1] = _deimosW.y; dlp[2] = _deimosW.z;
    dlp[3] = _deimosW.x * 0.35; dlp[4] = _deimosW.y * 0.35; dlp[5] = _deimosW.z * 0.35;
    deimosLine.geometry.attributes.position.needsUpdate = true;

    phobos.getWorldPosition(_phobosW);
    const plp = phobosLine.geometry.attributes.position.array;
    plp[0] = _phobosW.x; plp[1] = _phobosW.y; plp[2] = _phobosW.z;
    plp[3] = _phobosW.x * 0.35; plp[4] = _phobosW.y * 0.35; plp[5] = _phobosW.z * 0.35;
    phobosLine.geometry.attributes.position.needsUpdate = true;

    renderer.render(scene, camera);
    labelRenderer.render(scene, camera);
    requestAnimationFrame(animate);
}

async function loadTexts() {
    const res = await fetch('https://raw.githubusercontent.com/nekuro22/leidert.org/refs/heads/main/mars/texts.json');
    texts = await res.json();
    stages = texts.stages;

    document.title = texts.pageTitle;
    document.querySelector("#missionSubtitle").textContent = texts.mission.subtitle;
    document.querySelector("#missionHeading").textContent = texts.mission.heading;
    document.querySelector("#missionDesc").textContent = texts.mission.description;

    for (let i = 0; i < 3; i++) {
        document.querySelector(`#statusLabel${i}`).textContent = texts.statusGrid.labels[i];
    }

    document.querySelector("#timelineLabel").textContent = texts.timeline.label;

    for (let i = 0; i < 4; i++) {
        document.querySelector(`#timelineStep${i}`).textContent = texts.timeline.steps[i];
    }

    document.querySelector(".scene-panel").setAttribute("aria-label", texts.aria.scenePanel);
    document.querySelector(".status-grid").setAttribute("aria-label", texts.aria.statusGrid);
}

async function init() {
    await loadTexts();
    requestAnimationFrame(() => {
        resize();
        updateStage(0);
        animate();
    });
}

window.addEventListener("orientationchange", () => {
    setTimeout(resize, 100);
});

init();
