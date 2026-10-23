// Ensure Three.js r128 colorSpace compatibility
if (typeof THREE !== 'undefined' && !THREE.SRGBColorSpace) {
    THREE.SRGBColorSpace = THREE.sRGBEncoding;
}

// Global Knowledge Level State (default matches #level-slider value="3" -> 'lvl10')
let currentLevel = 'lvl10';
window.currentLevel = currentLevel;

// --- Cosmic Space-Themed Top Progress Bar ---
const spaceLoader = {
    el: null,
    titleEl: null,
    percentEl: null,
    barEl: null,
    iconEl: null,
    hideTimeout: null,
    active: false,
    total: 100,
    
    init() {
        this.el = document.getElementById('space-top-loader');
        this.titleEl = document.getElementById('loader-title');
        this.percentEl = document.getElementById('loader-percent');
        this.barEl = document.getElementById('loader-progress-bar');
        this.iconEl = document.querySelector('.loader-icon');
    },
    
    show(title = 'Laden...', icon = '🪐') {
        if (!this.el) this.init();
        this.active = true;
        if (this.hideTimeout) {
            clearTimeout(this.hideTimeout);
            this.hideTimeout = null;
        }
        if (this.titleEl) this.titleEl.textContent = title;
        if (this.iconEl) this.iconEl.textContent = icon;
        if (this.percentEl) this.percentEl.textContent = '0%';
        if (this.barEl) this.barEl.style.width = '0%';
        if (this.el) {
            this.el.classList.remove('hidden', 'fade-out');
        }
    },

    start(total = 100, title = 'Laden...', icon = '🪐') {
        this.total = Math.max(1, total);
        this.show(title, icon);
    },

    update(loaded, total = this.total, title = null) {
        const tot = Math.max(1, total || this.total || 1);
        const pct = (loaded / tot) * 100;
        this.setProgress(pct, title);
    },

    complete(title = null) {
        this.setProgress(100, title);
    },
    
    setProgress(percent, title = null) {
        if (!this.el) this.init();
        const p = Math.min(100, Math.max(0, Math.round(percent)));
        if (this.percentEl) this.percentEl.textContent = p + '%';
        if (this.barEl) this.barEl.style.width = p + '%';
        if (title && this.titleEl) this.titleEl.textContent = title;
        
        if (p >= 100) {
            if (this.hideTimeout) clearTimeout(this.hideTimeout);
            this.hideTimeout = setTimeout(() => {
                this.hide();
            }, 600);
        }
    },
    
    hide() {
        this.active = false;
        if (!this.el) return;
        this.el.classList.add('fade-out');
        this.hideTimeout = setTimeout(() => {
            if (this.el) {
                this.el.classList.add('hidden');
                this.el.classList.remove('fade-out');
            }
        }, 400);
    }
};

function applyTextureSharpness(tex) {
    if (!tex) return;
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    if (typeof renderer !== 'undefined' && renderer && renderer.capabilities) {
        tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    }
}

const globalLoadingManager = new THREE.LoadingManager();
globalLoadingManager.onStart = (url, itemsLoaded, itemsTotal) => {
    if (typeof currentMode === 'undefined' || currentMode === 'solarSystem') {
        spaceLoader.show('Lade hochauflösende Planetentexturen...', '🪐');
    }
};
globalLoadingManager.onProgress = (url, itemsLoaded, itemsTotal) => {
    const percent = Math.min(100, (itemsLoaded / itemsTotal) * 100);
    if (typeof currentMode === 'undefined' || currentMode === 'solarSystem') {
        spaceLoader.setProgress(percent, 'Lade hochauflösende Planetentexturen...');
    }
};
globalLoadingManager.onLoad = () => {
    if (typeof currentMode === 'undefined' || currentMode === 'solarSystem') {
        spaceLoader.setProgress(100, 'Planetentexturen bereit');
    }
};

const globalTextureLoader = new THREE.TextureLoader(globalLoadingManager);
let cachedRocketGltfs = null;

// --- Performance Management (Adaptive Quality) ---
class PerformanceManager {
    constructor() {
        this.isLowPerf = false;
        this.isLowPerfEarly = false;
        this.frameCounter = 0;
        this.startTime = 0;
        this.enabled = true;
        this.gpuInfo = "Unknown";
        
        this.detectInitialQuality();
    }

    detectInitialQuality() {
        try {
            const canvas = document.createElement('canvas');
            const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
            if (gl) {
                const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
                if (debugInfo) {
                    this.gpuInfo = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
                }
            }
            
            const pixelLoad = window.screen.width * window.screen.height * Math.pow(window.devicePixelRatio, 2);
            
            const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
            
            // iPad 10 / generic low performant devices check (only on mobile/tablet, never on desktop Macs)
            if (isMobile && this.gpuInfo.includes("Apple") && pixelLoad > 3000000 && !this.gpuInfo.includes("A15")) {
                 console.log("PerformanceManager: Heavy pixel load detected on mobile, potential Low-Perf device.");
                 this.isLowPerf = true;
                 this.isLowPerfEarly = true;
            }

            if (isMobile && pixelLoad > 4000000) {
                 this.isLowPerf = true;
                 this.isLowPerfEarly = true;
            }

            if (this.isLowPerf) {
                this.applyLowPerfModeEarly();
            }

        } catch (e) {
            console.error("Perf Check Failed", e);
        }
    }

    applyLowPerfModeEarly() {
        console.warn("PerformanceManager: Applying Early Low Performance Mode!");
        document.body.classList.add('low-perf');
        this.isLowPerf = true;
        this.isLowPerfEarly = true;
    }

    applyLowPerfModeLate() {
        if (this.isLowPerf) return; 
        console.warn("PerformanceManager: Applying Late Low Performance Mode!");
        this.isLowPerf = true;
        document.body.classList.add('low-perf');
    }

    startMonitoring() {
        this.startTime = performance.now();
    }

    update() {
        if (this.isLowPerf || !this.enabled) return;

        this.frameCounter++;
        
        if (this.frameCounter === 120) {
            const elapsed = performance.now() - this.startTime;
            const avgFPS = (this.frameCounter / elapsed) * 1000;
            
            console.log(`PerformanceManager: Startup average FPS = ${avgFPS.toFixed(1)}`);
            
            if (avgFPS < 30) {
                this.applyLowPerfModeLate();
            }
            this.enabled = false;
        }
    }
}

const perfManager = new PerformanceManager();

function createProceduralSunTexture(colorHex) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createRadialGradient(256, 256, 0, 256, 256, 256);
    const col = new THREE.Color(colorHex);
    gradient.addColorStop(0, '#ffffff');
    gradient.addColorStop(0.2, '#' + col.clone().lerp(new THREE.Color(0xffffff), 0.5).getHexString());
    gradient.addColorStop(0.8, '#' + col.getHexString());
    gradient.addColorStop(1, '#' + col.clone().lerp(new THREE.Color(0x000000), 0.5).getHexString());
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 512, 512);
    ctx.globalAlpha = 0.5;
    for (let i = 0; i < 20000; i++) {
        ctx.fillStyle = Math.random() > 0.5 ? '#ffffff' : '#' + col.getHexString();
        ctx.beginPath();
        ctx.arc(Math.random() * 512, Math.random() * 512, Math.random() * 3, 0, Math.PI * 2);
        ctx.fill();
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
}

function generateProceduralFallback(data) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    const col = new THREE.Color(data.color || 0x888888);
    
    // Background base color
    ctx.fillStyle = '#' + col.getHexString();
    ctx.fillRect(0, 0, 512, 512);
    
    // Add noise or stripes based on type
    if (data.type === 'Gasriese' || data.type === 'Eisriese') {
        // Stripes for giants
        for (let i = 0; i < 20; i++) {
            ctx.fillStyle = 'rgba(255,255,255,' + (Math.random() * 0.2) + ')';
            ctx.fillRect(0, Math.random() * 512, 512, Math.random() * 50);
        }
    } else {
        // Noise for rocky planets/moons
        for (let i = 0; i < 5000; i++) {
            ctx.fillStyle = 'rgba(255,255,255,' + (Math.random() * 0.1) + ')';
            ctx.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
        }
    }
    
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
}


let sharedSoftParticleTex = null;
function getSoftParticleTexture() {
    if (sharedSoftParticleTex) return sharedSoftParticleTex;
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.28, 'rgba(255,255,255,0.85)');
    grad.addColorStop(0.65, 'rgba(255,255,255,0.22)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);
    sharedSoftParticleTex = new THREE.CanvasTexture(canvas);
    return sharedSoftParticleTex;
}

function createAtmosphereHalo(colorHex, scaleFactor = 1.045, opacity = 0.24) {
    const geom = new THREE.SphereGeometry(scaleFactor, 48, 48);
    const mat = new THREE.MeshBasicMaterial({
        color: colorHex || 0x4da6ff,
        transparent: true,
        opacity: opacity,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });
    const halo = new THREE.Mesh(geom, mat);
    halo.userData.isAtmosphere = true;
    return halo;
}

function createIrregularBodyMesh(data, texLoader = globalTextureLoader) {
    const geom = new THREE.SphereGeometry(1, 48, 36);
    const pos = geom.attributes.position;
    const seedStr = (data.id || data.name || 'rock');
    let seed = 0;
    for (let i = 0; i < seedStr.length; i++) seed = (seed * 31 + seedStr.charCodeAt(i)) % 10000;

    // Deterministic pseudo-craters & triaxial bumps
    const craters = [];
    for (let c = 0; c < 7; c++) {
        const theta = ((seed * (c + 3) * 1.73) % 6.283);
        const phi = ((seed * (c + 7) * 0.91) % 2.4) + 0.35;
        craters.push({
            dir: new THREE.Vector3(Math.sin(phi) * Math.cos(theta), Math.cos(phi), Math.sin(phi) * Math.sin(theta)).normalize(),
            radius: 0.25 + ((c * 17 + seed) % 25) * 0.01,
            depth: 0.08 + ((c * 13 + seed) % 15) * 0.008
        });
    }

    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i);
        const dir = v.clone().normalize();
        let disp = 1.0
            + 0.09 * Math.sin(dir.x * 4.2 + seed * 0.1) * Math.cos(dir.y * 3.7 - seed * 0.2)
            + 0.06 * Math.sin(dir.z * 6.5 + dir.x * 5.1)
            + 0.03 * Math.cos(dir.y * 9.0 + dir.z * 7.3);
        for (let c = 0; c < craters.length; c++) {
            const d = dir.distanceTo(craters[c].dir);
            if (d < craters[c].radius) {
                const normD = d / craters[c].radius;
                const bowl = Math.cos(normD * Math.PI * 0.5);
                disp -= craters[c].depth * bowl * bowl;
            }
        }
        v.copy(dir).multiplyScalar(disp);
        if (Array.isArray(data.aspectScale) && data.aspectScale.length === 3) {
            v.x *= data.aspectScale[0];
            v.y *= data.aspectScale[1];
            v.z *= data.aspectScale[2];
        }
        pos.setXYZ(i, v.x, v.y, v.z);
    }
    geom.computeVertexNormals();

    const mat = new THREE.MeshStandardMaterial({
        color: data.textureUrl ? 0xffffff : (data.color || 0x999088),
        roughness: 0.88,
        metalness: 0.06,
        bumpScale: 0.05
    });
    if (data.textureUrl) {
        texLoader.load(data.textureUrl, (tex) => {
            tex.colorSpace = THREE.SRGBColorSpace;
            applyTextureSharpness(tex);
            mat.map = tex;
            mat.color.setHex(0xffffff);
            mat.needsUpdate = true;
        });
    }
    if (data.normalMapUrl) {
        texLoader.load(data.normalMapUrl, (tex) => {
            applyTextureSharpness(tex);
            mat.normalMap = tex;
            mat.normalScale = new THREE.Vector2(1.35, 1.35);
            mat.needsUpdate = true;
        });
    }
    return new THREE.Mesh(geom, mat);
}

function createSpacecraftModel(typeOrData, baseColor = 0xddeeff) {
    const type = (typeof typeOrData === 'object' && typeOrData !== null)
        ? (typeOrData.spacecraftType || typeOrData.id || 'orbiter')
        : typeOrData;
    const group = new THREE.Group();
    const metalMat = new THREE.MeshStandardMaterial({ color: 0xd8dee9, metalness: 0.82, roughness: 0.25 });
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xffb833, metalness: 0.88, roughness: 0.2, emissive: 0x331f00, emissiveIntensity: 0.25 });
    const panelMat = new THREE.MeshStandardMaterial({ color: 0x1a4b8c, metalness: 0.65, roughness: 0.2, emissive: 0x081c3a, emissiveIntensity: 0.35, side: THREE.DoubleSide });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x222831, metalness: 0.5, roughness: 0.45 });

    if (type === 'iss') {
        // Integrated Truss Backbone
        const truss = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.14, 0.14), metalMat);
        group.add(truss);
        // Pressurized Modules (Destiny, Harmony, Columbus, Kibo, Zvezda)
        const mainMod = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 1.7, 20), metalMat);
        mainMod.rotation.x = Math.PI / 2;
        group.add(mainMod);
        const crossMod = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 1.0, 16), goldMat);
        group.add(crossMod);
        // 8 Solar Array Wings (4 pairs)
        [-1.35, -0.95, 0.95, 1.35].forEach(xPos => {
            const wingTop = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.02, 1.35), panelMat);
            wingTop.position.set(xPos, 0, 0.78);
            const wingBot = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.02, 1.35), panelMat);
            wingBot.position.set(xPos, 0, -0.78);
            group.add(wingTop, wingBot);
        });
    } else if (type === 'jwst') {
        // 5-layer diamond Kapton sunshield
        for (let i = 0; i < 5; i++) {
            const sGeom = new THREE.CylinderGeometry(1.15 - i * 0.04, 1.2 - i * 0.04, 0.015, 4);
            const sMat = new THREE.MeshStandardMaterial({
                color: i === 0 ? 0xffaacc : 0xd8dde8,
                metalness: 0.9, roughness: 0.15
            });
            const layer = new THREE.Mesh(sGeom, sMat);
            layer.position.y = -0.25 + i * 0.055;
            layer.scale.set(1.35, 1, 0.85);
            group.add(layer);
        }
        // Golden hexagonal primary mirror
        const mirror = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.08, 6), goldMat);
        mirror.rotation.z = Math.PI / 2;
        mirror.position.set(0, 0.48, 0);
        group.add(mirror);
        // Secondary mirror tripod struts
        for (let a = 0; a < 3; a++) {
            const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.75, 8), darkMat);
            strut.position.set(0.32, 0.48 + Math.cos(a * 2.1) * 0.2, Math.sin(a * 2.1) * 0.2);
            strut.rotation.z = Math.PI / 3;
            group.add(strut);
        }
    } else if (type === 'juno') {
        const body = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.35, 6), goldMat);
        const dish = new THREE.Mesh(new THREE.SphereGeometry(0.42, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.42), metalMat);
        dish.rotation.x = Math.PI;
        dish.position.y = 0.25;
        group.add(body, dish);
        // 3 massive solar wings
        for (let i = 0; i < 3; i++) {
            const angle = (i * Math.PI * 2) / 3;
            const arm = new THREE.Group();
            arm.rotation.y = angle;
            const wing = new THREE.Mesh(new THREE.BoxGeometry(1.65, 0.03, 0.38), panelMat);
            wing.position.x = 1.05;
            arm.add(wing);
            group.add(arm);
        }
    } else if (type === 'cassini') {
        const bus = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 0.85, 12), goldMat);
        const hga = new THREE.Mesh(new THREE.SphereGeometry(0.55, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.45), metalMat);
        hga.rotation.x = Math.PI;
        hga.position.y = 0.5;
        const huygens = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.18, 16), goldMat);
        huygens.rotation.z = Math.PI / 2;
        huygens.position.set(0.34, 0, 0);
        const boom = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.5, 8), darkMat);
        boom.rotation.z = Math.PI / 2;
        boom.position.x = -0.8;
        group.add(bus, hga, huygens, boom);
    } else if (type === 'parker') {
        const shield = new THREE.Mesh(new THREE.CylinderGeometry(0.68, 0.68, 0.08, 6), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 }));
        shield.position.y = 0.35;
        const bus = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.3, 0.7, 8), goldMat);
        group.add(shield, bus);
        [-0.48, 0.48].forEach(x => {
            const paddle = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.03, 0.25), panelMat);
            paddle.position.set(x, -0.05, 0);
            paddle.rotation.z = x > 0 ? -0.35 : 0.35;
            group.add(paddle);
        });
    } else {
        // Generic planetary orbiter (BepiColombo / MRO)
        const bus = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.55, 0.5), goldMat);
        const dish = new THREE.Mesh(new THREE.SphereGeometry(0.4, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.42), metalMat);
        dish.rotation.x = Math.PI;
        dish.position.y = 0.36;
        const wingL = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.03, 0.36), panelMat);
        wingL.position.x = -0.9;
        const wingR = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.03, 0.36), panelMat);
        wingR.position.x = 0.9;
        group.add(bus, dish, wingL, wingR);
    }
    return group;
}

function createCometMesh(data, texLoader = globalTextureLoader) {
    const group = new THREE.Group();
    const nucleus = createIrregularBodyMesh({
        ...data,
        aspectScale: [1.5, 0.85, 0.8]
    }, texLoader);
    group.add(nucleus);

    // Glowing cyan-green coma
    const comaMat = new THREE.SpriteMaterial({
        map: getSoftParticleTexture(),
        color: 0x66ffee,
        transparent: true,
        opacity: 0.75,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });
    const coma = new THREE.Sprite(comaMat);
    coma.scale.set(4.5, 4.5, 1);
    group.add(coma);

    // Tail group (points away from the Sun dynamically in SolarSystem.update)
    const tailGroup = new THREE.Group();
    const dustGeom = new THREE.ConeGeometry(1.6, 18, 24, 1, true);
    dustGeom.translate(0, 9, 0);
    dustGeom.rotateX(Math.PI / 2);
    const dustMat = new THREE.MeshBasicMaterial({
        color: 0xaaddff,
        transparent: true,
        opacity: 0.28,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });
    const dustTail = new THREE.Mesh(dustGeom, dustMat);

    const ionGeom = new THREE.ConeGeometry(0.65, 24, 16, 1, true);
    ionGeom.translate(0, 12, 0);
    ionGeom.rotateX(Math.PI / 2);
    const ionMat = new THREE.MeshBasicMaterial({
        color: 0x33ccff,
        transparent: true,
        opacity: 0.42,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });
    const ionTail = new THREE.Mesh(ionGeom, ionMat);
    ionTail.rotation.y = -0.08;
    tailGroup.add(dustTail, ionTail);
    group.add(tailGroup);
    group.userData.tailGroup = tailGroup;
    return group;
}

function fixRingUVs(ringGeom, innerR, outerR) {
    const pos = ringGeom.attributes.position;
    const v3 = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
        v3.fromBufferAttribute(pos, i);
        const r = v3.length();
        const u = (r - innerR) / (outerR - innerR);
        ringGeom.attributes.uv.setXY(i, u, 0.5);
    }
}

function createCelestialBody(data) {
    let mesh;
    const softTex = getSoftParticleTexture();

    if (data.isUniverse) {
        // 3D Cosmic Web with filaments, galaxy superclusters & background radiation glow
        const group = new THREE.Group();
        const particleCount = 24000;
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(particleCount * 3);
        const colors = new Float32Array(particleCount * 3);
        const color = new THREE.Color();

        // Generate 36 cluster nodes to string cosmic web filaments between
        const nodes = [];
        for (let n = 0; n < 36; n++) {
            const r = 35 + Math.random() * 175;
            const theta = 2 * Math.PI * Math.random();
            const phi = Math.acos(2 * Math.random() - 1);
            nodes.push(new THREE.Vector3(
                r * Math.sin(phi) * Math.cos(theta),
                r * Math.sin(phi) * Math.sin(theta),
                r * Math.cos(phi)
            ));
        }

        for (let i = 0; i < particleCount; i++) {
            let x, y, z;
            if (i < particleCount * 0.65) {
                // Filament particles connecting cosmic web nodes
                const nA = nodes[i % nodes.length];
                const nB = nodes[(i * 7 + 3) % nodes.length];
                const t = Math.random();
                const scatter = 4.5 + Math.sin(t * Math.PI) * 9.0;
                x = THREE.MathUtils.lerp(nA.x, nB.x, t) + (Math.random() - 0.5) * scatter;
                y = THREE.MathUtils.lerp(nA.y, nB.y, t) + (Math.random() - 0.5) * scatter;
                z = THREE.MathUtils.lerp(nA.z, nB.z, t) + (Math.random() - 0.5) * scatter;
                color.setHSL(0.55 + Math.random() * 0.25, 0.85, 0.6 + Math.random() * 0.35);
            } else {
                // Spherical halo of distant galaxies
                const r = 40 + Math.random() * 200;
                const theta = 2 * Math.PI * Math.random();
                const phi = Math.acos(2 * Math.random() - 1);
                x = r * Math.sin(phi) * Math.cos(theta);
                y = r * Math.sin(phi) * Math.sin(theta);
                z = r * Math.cos(phi);
                color.setHSL(0.08 + Math.random() * 0.65, 0.75, 0.55 + Math.random() * 0.4);
            }
            positions[i * 3] = x;
            positions[i * 3 + 1] = y;
            positions[i * 3 + 2] = z;
            colors[i * 3] = color.r;
            colors[i * 3 + 1] = color.g;
            colors[i * 3 + 2] = color.b;
        }
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        const material = new THREE.PointsMaterial({
            size: 0.42,
            map: softTex,
            vertexColors: true,
            transparent: true,
            opacity: 0.9,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        group.add(new THREE.Points(geometry, material));
        mesh = group;
    } else if (data.isMilkyWay || (data.isGalaxy && data.name === "Milchstraße")) {
        // Hybrid 3D Barred Spiral Galaxy: High-Res Plane + 3D Volumetric Bulge & Spiral Star Cloud
        const group = new THREE.Group();
        const geom = new THREE.PlaneGeometry(2.5, 2.5);
        const texUrl = data.textureUrl || 'textures/celestial/milkyway.jpg';
        const map = globalTextureLoader.load(texUrl, (tex) => {
            tex.colorSpace = THREE.SRGBColorSpace;
            applyTextureSharpness(tex);
        });

        const canvas = document.createElement('canvas');
        canvas.width = 512; canvas.height = 512;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = 'black';
        ctx.fillRect(0, 0, 512, 512);
        const grad = ctx.createRadialGradient(256, 256, 0, 256, 256, 250);
        grad.addColorStop(0, 'white');
        grad.addColorStop(0.55, 'white');
        grad.addColorStop(1, 'black');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 512, 512);
        const alphaMap = new THREE.CanvasTexture(canvas);

        const material = new THREE.MeshBasicMaterial({
            map: map,
            alphaMap: alphaMap,
            color: 0xffffff,
            transparent: true,
            blending: THREE.AdditiveBlending,
            side: THREE.DoubleSide,
            depthWrite: false
        });
        const diskPlane = new THREE.Mesh(geom, material);
        group.add(diskPlane);

        // 3D volumetric star halo & spiral arms
        const starCount = 6500;
        const sGeom = new THREE.BufferGeometry();
        const sPos = new Float32Array(starCount * 3);
        const sCol = new Float32Array(starCount * 3);
        const c = new THREE.Color();
        for (let i = 0; i < starCount; i++) {
            const arm = i % 4;
            const r = Math.pow(Math.random(), 1.35) * 1.18;
            const angle = r * 5.2 + (arm * Math.PI) / 2 + (Math.random() - 0.5) * 0.55;
            const thickness = (1.0 - r * 0.72) * 0.16;
            sPos[i * 3] = Math.cos(angle) * r;
            sPos[i * 3 + 1] = Math.sin(angle) * r;
            sPos[i * 3 + 2] = (Math.random() - 0.5) * thickness;
            if (r < 0.28) c.setHex(0xffe4aa);
            else if (Math.random() < 0.15) c.setHex(0xff66aa); // H-II regions
            else c.setHex(0x88ccff);
            sCol[i * 3] = c.r; sCol[i * 3 + 1] = c.g; sCol[i * 3 + 2] = c.b;
        }
        sGeom.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
        sGeom.setAttribute('color', new THREE.BufferAttribute(sCol, 3));
        const sMat = new THREE.PointsMaterial({
            size: 0.035, map: softTex, vertexColors: true,
            transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false
        });
        group.add(new THREE.Points(sGeom, sMat));

        group.rotation.x = Math.PI / 3;
        group.rotation.y = Math.PI / 6;
        data.rotationSpeed = 0;
        mesh = group;
    } else if (data.isVoid) {
        // Boötes Void: dark cavernous 3D sphere surrounded by luminous galaxy filaments on the shell
        const group = new THREE.Group();
        const geom = new THREE.SphereGeometry(1.0, 48, 48);
        const mat = new THREE.MeshBasicMaterial({ color: 0x010106, side: THREE.BackSide });
        group.add(new THREE.Mesh(geom, mat));

        const borderCount = 2800;
        const cgeom = new THREE.BufferGeometry();
        const cpos = new Float32Array(borderCount * 3);
        const ccol = new Float32Array(borderCount * 3);
        const col = new THREE.Color();
        for (let i = 0; i < borderCount; i++) {
            const r = 0.96 + Math.random() * 0.22;
            const theta = 2 * Math.PI * Math.random();
            const phi = Math.acos(2 * Math.random() - 1);
            cpos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
            cpos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
            cpos[i * 3 + 2] = r * Math.cos(phi);
            col.setHSL(0.72 + Math.random() * 0.18, 0.8, 0.55 + Math.random() * 0.35);
            ccol[i * 3] = col.r; ccol[i * 3 + 1] = col.g; ccol[i * 3 + 2] = col.b;
        }
        cgeom.setAttribute('position', new THREE.BufferAttribute(cpos, 3));
        cgeom.setAttribute('color', new THREE.BufferAttribute(ccol, 3));
        const cmat = new THREE.PointsMaterial({
            size: 0.045, map: softTex, vertexColors: true,
            transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false
        });
        group.add(new THREE.Points(cgeom, cmat));
        mesh = group;
    } else if (data.isNebula || data.isGalaxy || data.isCluster) {
        // Volumetric 3D Deep-Sky Objects (Nebulae, Globular Cluster Omega Centauri, Galaxies)
        const group = new THREE.Group();
        const count = data.isCluster ? 12000 : 8000;
        const pGeom = new THREE.BufferGeometry();
        const pPos = new Float32Array(count * 3);
        const pCol = new Float32Array(count * 3);
        const col = new THREE.Color();
        const baseColor = new THREE.Color(data.color || 0x44aaff);

        for (let i = 0; i < count; i++) {
            let x = 0, y = 0, z = 0;
            if (data.isCluster) {
                // King-profile 3D globular star cluster (Omega Centauri)
                const u = Math.random();
                const r = Math.pow(u, 1.8) * 1.05;
                const theta = 2 * Math.PI * Math.random();
                const phi = Math.acos(2 * Math.random() - 1);
                x = r * Math.sin(phi) * Math.cos(theta);
                y = r * Math.sin(phi) * Math.sin(theta);
                z = r * Math.cos(phi);
                if (r < 0.35 || Math.random() < 0.7) col.setHSL(0.09 + Math.random() * 0.06, 0.85, 0.65 + Math.random() * 0.3);
                else col.setHSL(0.58 + Math.random() * 0.08, 0.9, 0.75);
            } else if (data.nebulaStyle === 'helix') {
                // 3D Toroidal Eye of God (Helix Nebula)
                const t = Math.random() * Math.PI * 2;
                const ringR = 0.58 + (Math.random() - 0.5) * 0.38;
                x = Math.cos(t) * ringR;
                y = Math.sin(t) * ringR;
                z = (Math.random() - 0.5) * 0.32;
                if (ringR < 0.48) col.setHex(0x44ddff);
                else if (ringR < 0.68) col.setHex(0x44ffaa);
                else col.setHex(0xff5533);
            } else if (data.nebulaStyle === 'catseye') {
                // Bipolar interlocking 3D shells (Cat's Eye Nebula)
                const lobe = (i % 2 === 0) ? 1 : -1;
                const theta = Math.random() * Math.PI * 2;
                const phi = Math.acos(2 * Math.random() - 1);
                const r = 0.45 + 0.38 * Math.abs(Math.cos(phi * 2));
                x = r * Math.sin(phi) * Math.cos(theta);
                y = r * Math.cos(phi) + lobe * 0.18;
                z = r * Math.sin(phi) * Math.sin(theta);
                col.copy(baseColor).lerp(new THREE.Color(0xff55aa), Math.random() * 0.55);
            } else if (data.isGalaxy && data.galaxyStyle === 'elliptical') {
                // Giant golden 3D elliptical galaxy (IC 1101)
                const r = Math.pow(Math.random(), 1.5) * 1.1;
                const theta = 2 * Math.PI * Math.random();
                const phi = Math.acos(2 * Math.random() - 1);
                x = r * Math.sin(phi) * Math.cos(theta) * 1.25;
                y = r * Math.sin(phi) * Math.sin(theta) * 0.82;
                z = r * Math.cos(phi) * 0.75;
                col.setHSL(0.1 + Math.random() * 0.04, 0.9, 0.55 + (1 - r) * 0.4);
            } else {
                // Turbulent 3D star-forming cloud / irregular galaxy (Orion Nebula, SMC)
                const r = Math.pow(Math.random(), 0.9) * 1.05;
                const theta = 2 * Math.PI * Math.random();
                const phi = Math.acos(2 * Math.random() - 1);
                x = r * Math.sin(phi) * Math.cos(theta) + 0.18 * Math.sin(theta * 3);
                y = r * Math.sin(phi) * Math.sin(theta) + 0.18 * Math.cos(phi * 3);
                z = r * Math.cos(phi) * 0.65;
                col.copy(baseColor).lerp(new THREE.Color(0x66ccff), Math.random() * 0.5);
            }
            pPos[i * 3] = x;
            pPos[i * 3 + 1] = y;
            pPos[i * 3 + 2] = z;
            pCol[i * 3] = col.r;
            pCol[i * 3 + 1] = col.g;
            pCol[i * 3 + 2] = col.b;
        }
        pGeom.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
        pGeom.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
        const pMat = new THREE.PointsMaterial({
            size: data.isCluster ? 0.032 : 0.06,
            map: softTex,
            vertexColors: true,
            transparent: true,
            opacity: 0.88,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        group.add(new THREE.Points(pGeom, pMat));

        // Central white dwarf / Trapezium core glow for nebulae
        if (data.isNebula) {
            const coreSprite = new THREE.Sprite(new THREE.SpriteMaterial({
                map: softTex, color: 0xffffff, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending
            }));
            coreSprite.scale.set(0.35, 0.35, 1);
            group.add(coreSprite);
        }
        mesh = group;
    } else if (data.isIrregular) {
        mesh = createIrregularBodyMesh(data, globalTextureLoader);
    } else {
        // High-Resolution 3D Sphere Objects (Planets, Moons, Stars, Black Holes)
        const geom = new THREE.SphereGeometry(1, 96, 96);
        let mat;
        const isStar = data.type === "Stern" || data.type === "Roter Zwerg" || (data.type && data.type.includes("Riese")) || data.emissive;
        const isBlackHole = data.type === "Schwarzes Loch";

        if (isBlackHole) {
            mat = new THREE.MeshBasicMaterial({ color: 0x000000 });
        } else if (isStar) {
            const starColor = new THREE.Color(data.color || 0xffcc00);
            mat = new THREE.MeshBasicMaterial({ color: starColor });
            if (data.textureUrl) {
                globalTextureLoader.load(data.textureUrl, (tex) => {
                    tex.colorSpace = THREE.SRGBColorSpace;
                    applyTextureSharpness(tex);
                    mat.map = tex;
                    if (data.name === 'Proxima Centauri') {
                        mat.color.setHex(0xff9977);
                    } else if (data.name === 'Sonne') {
                        mat.color.setHex(0xfffae6);
                    } else if (data.color && data.color !== 0xffffff) {
                        mat.color.copy(starColor);
                    } else {
                        mat.color.setHex(0xffffff);
                    }
                    mat.needsUpdate = true;
                }, undefined, () => {
                    mat.color.copy(starColor);
                });
            }
        } else {
            const isGasGiant = data.type === 'Gasriese' || data.type === 'Eisriese';
            mat = new THREE.MeshPhysicalMaterial({
                color: data.textureUrl ? 0xffffff : (data.color || 0xffffff),
                roughness: isGasGiant ? 0.28 : (data.roughness !== undefined ? data.roughness : 0.62),
                metalness: 0.03,
                clearcoat: isGasGiant ? 0.3 : 0.0,
                clearcoatRoughness: 0.1
            });
            if (data.textureUrl) {
                globalTextureLoader.load(data.textureUrl, (tex) => {
                    tex.colorSpace = THREE.SRGBColorSpace;
                    applyTextureSharpness(tex);
                    mat.map = tex;
                    mat.color.setHex(0xffffff);
                    mat.needsUpdate = true;
                });
            }
            if (data.normalMapUrl) {
                globalTextureLoader.load(data.normalMapUrl, (tex) => {
                    applyTextureSharpness(tex);
                    mat.normalMap = tex;
                    mat.normalScale = new THREE.Vector2(1.2, 1.2);
                    mat.needsUpdate = true;
                });
            }
            if (data.roughnessMapUrl) {
                globalTextureLoader.load(data.roughnessMapUrl, (tex) => {
                    applyTextureSharpness(tex);
                    mat.roughnessMap = tex;
                    mat.needsUpdate = true;
                });
            }
        }
        mesh = new THREE.Mesh(geom, mat);

        // Earth clouds + night-side city lights
        if ((data.id === 'earth' || data.name === 'Erde') && !data.disableClouds) {
            const cloudTexUrl = data.cloudMapUrl || 'textures/planets/earth_clouds.png';
            const cloudTex = globalTextureLoader.load(cloudTexUrl);
            applyTextureSharpness(cloudTex);
            const cloudMat = new THREE.MeshStandardMaterial({
                map: cloudTex,
                transparent: true, opacity: 0.88,
                blending: THREE.NormalBlending, depthWrite: false
            });
            const cloudMesh = new THREE.Mesh(new THREE.SphereGeometry(1.014, 72, 72), cloudMat);
            cloudMesh.userData = { isCloud: true };
            mesh.add(cloudMesh);

            if (data.nightMapUrl) {
                const nightTex = globalTextureLoader.load(data.nightMapUrl);
                nightTex.colorSpace = THREE.SRGBColorSpace;
                applyTextureSharpness(nightTex);
                const nightMat = new THREE.MeshBasicMaterial({
                    map: nightTex,
                    transparent: true,
                    opacity: 0.55,
                    blending: THREE.AdditiveBlending,
                    depthWrite: false
                });
                const nightMesh = new THREE.Mesh(new THREE.SphereGeometry(1.003, 64, 64), nightMat);
                nightMesh.userData = { isNightLights: true };
                mesh.add(nightMesh);
            }
        }

        // Atmospheric Fresnel Glow Halo for planets/moons with atmospheres
        if (data.hasAtmosphere) {
            mesh.add(createAtmosphereHalo(data.atmosphereColor || 0x4da6ff, 1.045, data.atmosphereOpacity || 0.22));
        }

        // Rings & Accretion Disks
        if (data.hasRings || data.hasAccretionDisk) {
            const innerR = data.ringInnerRadius || 1.25;
            const outerR = data.hasAccretionDisk ? 3.5 : (data.ringOuterRadius || 2.25);
            const ringGeom = new THREE.RingGeometry(innerR, outerR, 128);
            fixRingUVs(ringGeom, innerR, outerR);
            let ringMat;
            if (data.hasAccretionDisk) {
                const accTex = globalTextureLoader.load('textures/celestial/accretion_disk.png');
                accTex.colorSpace = THREE.SRGBColorSpace;
                applyTextureSharpness(accTex);
                ringMat = new THREE.MeshBasicMaterial({
                    map: accTex,
                    color: 0xffffff,
                    side: THREE.DoubleSide,
                    transparent: true,
                    opacity: 0.95,
                    blending: THREE.AdditiveBlending,
                    depthWrite: false
                });
                // Add Gravitational Lensing vertical ring & photon ring
                const lensGeom = new THREE.RingGeometry(1.05, 2.35, 96);
                fixRingUVs(lensGeom, 1.05, 2.35);
                const lensMesh = new THREE.Mesh(lensGeom, ringMat.clone());
                lensMesh.rotation.x = 0.12;
                mesh.add(lensMesh);

                // Relativistic Polar Jets for supermassive black holes
                const jetGeom = new THREE.ConeGeometry(0.28, 3.6, 24, 1, true);
                jetGeom.translate(0, 1.8, 0);
                const jetMat = new THREE.MeshBasicMaterial({
                    color: 0x88ccff, transparent: true, opacity: 0.38,
                    blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false
                });
                const jetTop = new THREE.Mesh(jetGeom, jetMat);
                const jetBot = new THREE.Mesh(jetGeom, jetMat);
                jetBot.rotation.x = Math.PI;
                mesh.add(jetTop, jetBot);
            } else if (data.ringTextureUrl && data.ringAlphaMapUrl) {
                const rmap = globalTextureLoader.load(data.ringTextureUrl);
                const amap = globalTextureLoader.load(data.ringAlphaMapUrl);
                rmap.colorSpace = THREE.SRGBColorSpace;
                applyTextureSharpness(rmap);
                applyTextureSharpness(amap);
                ringMat = new THREE.MeshStandardMaterial({
                    map: rmap,
                    alphaMap: amap,
                    color: 0xffffff,
                    side: THREE.DoubleSide,
                    transparent: true,
                    opacity: 0.98,
                    roughness: 0.55
                });
            } else {
                ringMat = new THREE.MeshStandardMaterial({
                    color: data.color || 0xaaaaaa,
                    side: THREE.DoubleSide,
                    transparent: true,
                    opacity: 0.65
                });
            }
            const ring = new THREE.Mesh(ringGeom, ringMat);
            ring.rotation.x = Math.PI / 2 + 0.1;
            mesh.add(ring);
        }
    }
    return mesh;
}

class CameraManager {
    static zoomToPlanet(camera, controls, planetMesh, planetRadius) {
        // Calculate a target position for the camera offset from planet
        const targetWorldPosition = new THREE.Vector3();
        planetMesh.getWorldPosition(targetWorldPosition);

        const distance = planetRadius * 5; 
        
        // Position camera diagonally from the planet
        const destPos = targetWorldPosition.clone().add(new THREE.Vector3(distance, distance * 0.5, distance));

        gsap.to(camera.position, {
            x: destPos.x,
            y: destPos.y,
            z: destPos.z,
            duration: 1.5,
            ease: "power2.inOut"
        });

        gsap.to(controls.target, {
            x: targetWorldPosition.x,
            y: targetWorldPosition.y,
            z: targetWorldPosition.z,
            duration: 1.5,
            ease: "power2.inOut",
            onUpdate: () => controls.update()
        });
    }
}
class MoonPhases {
    constructor(scene) {
        this.parentScene = scene;
        this.group = new THREE.Group();
        this.group.visible = false;

        // Visible Sun - gigantic and far away with corona glow
        this.sunGeom = new THREE.SphereGeometry(150, 96, 96);
        this.sunMat = new THREE.MeshStandardMaterial({ 
            color: 0xffffee,
            emissive: 0xffaa00,
            emissiveIntensity: 1.6,
            roughness: 0.9
        });
        
        globalTextureLoader.load('textures/planets/sun.jpg', (tex) => {
            tex.colorSpace = THREE.SRGBColorSpace;
            applyTextureSharpness(tex);
            this.sunMat.map = tex;
            this.sunMat.emissiveMap = tex;
            this.sunMat.needsUpdate = true;
        });

        this.sun = new THREE.Mesh(this.sunGeom, this.sunMat);
        this.sun.position.set(600, 0, 0);
        const sunCorona = new THREE.Sprite(new THREE.SpriteMaterial({
            map: getSoftParticleTexture(),
            color: 0xffaa33,
            transparent: true,
            opacity: 0.55,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        }));
        sunCorona.scale.set(480, 480, 1);
        this.sun.add(sunCorona);
        this.group.add(this.sun);

        // Sunlight source from the Sun's position
        const dirLight = new THREE.DirectionalLight(0xffffff, 2.8);
        dirLight.position.copy(this.sun.position);
        dirLight.castShadow = true;
        dirLight.shadow.mapSize.width = 4096;
        dirLight.shadow.mapSize.height = 4096;
        dirLight.shadow.camera.near = 400;
        dirLight.shadow.camera.far = 800;
        dirLight.shadow.camera.left = -50;
        dirLight.shadow.camera.right = 50;
        dirLight.shadow.camera.top = 50;
        dirLight.shadow.camera.bottom = -50;
        this.group.add(dirLight);

        // Subtle earthshine & ambient fill
        this.group.add(new THREE.AmbientLight(0x10182c, 0.22));

        // Earth with normal map, specular/roughness map, cloud layer, night lights & atmosphere
        const earthGeom = new THREE.SphereGeometry(4, 96, 96);
        const earthMat = new THREE.MeshPhysicalMaterial({ 
            color: 0xffffff,
            roughness: 0.58,
            metalness: 0.04,
            normalScale: new THREE.Vector2(1.2, 1.2)
        });
        
        globalTextureLoader.load('textures/planets/earth.jpg', (tex) => {
            tex.colorSpace = THREE.SRGBColorSpace;
            applyTextureSharpness(tex);
            earthMat.map = tex;
            earthMat.needsUpdate = true;
        });
        globalTextureLoader.load('textures/planets/earth_normal.jpg', (tex) => {
            applyTextureSharpness(tex);
            earthMat.normalMap = tex;
            earthMat.needsUpdate = true;
        });
        globalTextureLoader.load('textures/planets/earth_roughness.jpg', (tex) => {
            applyTextureSharpness(tex);
            earthMat.roughnessMap = tex;
            earthMat.needsUpdate = true;
        });

        this.earth = new THREE.Mesh(earthGeom, earthMat);
        this.earth.castShadow = true;
        this.earth.receiveShadow = true;

        // Clouds
        const cloudTex = globalTextureLoader.load('textures/planets/earth_clouds.png');
        applyTextureSharpness(cloudTex);
        this.earthClouds = new THREE.Mesh(
            new THREE.SphereGeometry(4.06, 72, 72),
            new THREE.MeshStandardMaterial({ map: cloudTex, transparent: true, opacity: 0.85, depthWrite: false })
        );
        this.earth.add(this.earthClouds);

        // Atmosphere halo
        this.earth.add(createAtmosphereHalo(0x4da6ff, 4.18, 0.25));
        this.group.add(this.earth);

        // Moon (Strict 1:4 scale of Earth) -> Earth is 4, so Moon is 1.0 with normal map
        this.moonGroup = new THREE.Group();
        const moonGeom = new THREE.SphereGeometry(1.0, 96, 96);
        const moonMat = new THREE.MeshStandardMaterial({ 
            color: 0xffffff,
            roughness: 0.88,
            normalScale: new THREE.Vector2(1.4, 1.4)
        });

        globalTextureLoader.load('textures/planets/moon.jpg', (tex) => {
            tex.colorSpace = THREE.SRGBColorSpace;
            applyTextureSharpness(tex);
            moonMat.map = tex;
            moonMat.needsUpdate = true;
        });
        globalTextureLoader.load('textures/planets/moon_normal.jpg', (tex) => {
            applyTextureSharpness(tex);
            moonMat.normalMap = tex;
            moonMat.needsUpdate = true;
        });

        this.moon = new THREE.Mesh(moonGeom, moonMat);
        this.moon.castShadow = true;
        this.moon.receiveShadow = true;
        this.moonDistance = 20; 
        this.moon.position.x = this.moonDistance;
        this.moonGroup.add(this.moon);
        this.group.add(this.moonGroup);

        // Moon Orbit Line
        const orbitGeom = new THREE.RingGeometry(this.moonDistance - 0.08, this.moonDistance + 0.08, 160);
        const orbitMat = new THREE.MeshBasicMaterial({ color: 0x88bbff, side: THREE.DoubleSide, transparent: true, opacity: 0.25 });
        const orbitLine = new THREE.Mesh(orbitGeom, orbitMat);
        orbitLine.rotation.x = Math.PI / 2;
        this.group.add(orbitLine);

        // Starfield for Moon Phases
        const starGeo = new THREE.BufferGeometry();
        const starPositions = new Float32Array(1800 * 3);
        for (let i = 0; i < 1800 * 3; i += 3) {
            starPositions[i] = (Math.random() - 0.5) * 900;
            starPositions[i + 1] = (Math.random() - 0.5) * 900;
            starPositions[i + 2] = (Math.random() - 0.5) * 900;
        }
        starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
        this.group.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.65, transparent: true, opacity: 0.7 })));

        this.parentScene.add(this.group);
    }

    updateLevelExplanation() {
        const el = document.getElementById('moon-level-explanation');
        if (!el) return;
        const texts = {
            lvl4: "Der Mond leuchtet nicht selbst, sondern wird von der Sonne angestrahlt. Während er um die Erde wandert, sehen wir mal mehr und mal weniger von seiner hellen Seite!",
            lvl5: "Ein Mondumlauf dauert etwa einen Monat (29,5 Tage). Steht der Mond zwischen Erde und Sonne, sehen wir nur seine dunkle Rückseite (Neumond). Gegenüber der Sonne scheint er als Vollmond.",
            lvl7: "Durch die gebundene Rotation dreht sich der Mond genau einmal um sich selbst, während er die Erde umkreist – deshalb zeigt er uns immer dieselbe Seite mit ihren dunklen Maria und hellen Kratern.",
            lvl10: "Wir unterscheiden die siderische Periode (27,3 Tage relativ zu den Sternen) und die synodische Periode (29,53 Tage von Neumond zu Neumond), da sich die Erde gleichzeitig um die Sonne weiterbewegt.",
            lvl16: "Da die Mondbahn um 5,14° gegen die Ekliptik geneigt ist, entsteht nicht bei jedem Neumond oder Vollmond eine Finsternis, sondern nur in der Nähe der Bahnknoten (Drakonitischer Monat: 27,21 Tage).",
            expert: "Phasenwinkel α (Sonne–Mond–Beobachter) bestimmt den beleuchteten Bruchteil k = (1 + cos α)/2. Optische und physische Libration erlauben über die Zeit hinweg die Beobachtung von 59 % der Mondoberfläche."
        };
        el.textContent = texts[currentLevel] || texts.lvl5;
    }

    update() {
        if (!this.group.visible) return;
        
        const timeScale = (typeof window.appTimeScale === 'number' ? window.appTimeScale : 1) * 0.5;
        const rotFactor = typeof window.rotationSpeedFactor === 'number' ? window.rotationSpeedFactor : 1;
        const orbFactor = typeof window.orbitSpeedFactor === 'number' ? window.orbitSpeedFactor : 1;

        this.earth.rotation.y += 0.01 * timeScale * rotFactor;
        if (this.earthClouds) this.earthClouds.rotation.y += 0.0015 * timeScale * rotFactor;

        this.moonGroup.rotation.y += 0.003 * timeScale * orbFactor;
        this.moon.rotation.y -= 0.003 * timeScale * rotFactor;

        // Calculate current moon phase from orbital angle (Sun is at +X)
        const angle = ((this.moonGroup.rotation.y % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
        const phaseEl = document.getElementById('moon-phase-current');
        if (phaseEl) {
            let phaseName = '';
            if (angle < 0.35 || angle > Math.PI * 2 - 0.35) phaseName = '🌑 Neumond (0 % beleuchtet)';
            else if (angle < Math.PI * 0.5 - 0.3) phaseName = '🌒 Zunehmende Sichel';
            else if (angle < Math.PI * 0.5 + 0.3) phaseName = '🌓 Erstes Viertel (Halbmond)';
            else if (angle < Math.PI - 0.35) phaseName = '🌔 Zunehmender Mond';
            else if (angle < Math.PI + 0.35) phaseName = '🌕 Vollmond (100 % beleuchtet)';
            else if (angle < Math.PI * 1.5 - 0.3) phaseName = '🌖 Abnehmender Mond';
            else if (angle < Math.PI * 1.5 + 0.3) phaseName = '🌗 Letztes Viertel (Halbmond)';
            else phaseName = '🌘 Abnehmende Sichel';
            phaseEl.textContent = `Aktuelle Phase: ${phaseName}`;
        }
    }

    show() {
        this.group.visible = true;
        this.updateLevelExplanation();
    }

    hide() {
        this.group.visible = false;
    }
}
const planetMnemonics = {
    mercury: { word: 'Mein', letter: 'M' },
    venus: { word: 'Vater', letter: 'V' },
    earth: { word: 'erklärt', letter: 'e' },
    mars: { word: 'mir', letter: 'm' },
    jupiter: { word: 'jeden', letter: 'j' },
    saturn: { word: 'Sonntag', letter: 'S' },
    uranus: { word: 'unseren', letter: 'u' },
    neptune: { word: 'Nachthimmel', letter: 'N' }
};

const planetLinePositions = {
    mercury: -38,
    venus: -30,
    earth: -22,
    mars: -15,
    jupiter: -4,
    saturn: 13,
    uranus: 28,
    neptune: 40
};

class SolarSystem {
    constructor(scene) {
        this.parentScene = scene;
        this.group = new THREE.Group();
        this.planets = [];
        this.extraBodies = [];
        this.moonLookup = new Map(); // "planetId:moonId" -> { mesh, data, parentPlanet }
        this.interactableObjects = [];
        this.isLinedUp = false;
        this.showExtraBodies = true;
        this.currentLevelIndex = 1;
        this.currentPillPlanetId = null;

        // Sun (High-Res 96x96 + multi-layer corona)
        const sunRadius = planetData.sun.radius || 5;
        this.sunGeom = new THREE.SphereGeometry(sunRadius, 96, 96);
        this.sunMat = new THREE.MeshStandardMaterial({ 
            color: 0xffffff,
            emissive: 0xffaa00,
            emissiveIntensity: 1.6,
            roughness: 0.7
        });
        
        if (planetData.sun.textureUrl) {
            globalTextureLoader.load(planetData.sun.textureUrl, (tex) => {
                tex.colorSpace = THREE.SRGBColorSpace;
                applyTextureSharpness(tex);
                this.sunMat.map = tex;
                this.sunMat.emissiveMap = tex;
                this.sunMat.needsUpdate = true;
            });
        }

        this.sun = new THREE.Mesh(this.sunGeom, this.sunMat);
        this.sun.userData = { planetId: 'sun' };

        const sunGlow = new THREE.Sprite(new THREE.SpriteMaterial({
            map: getSoftParticleTexture(),
            color: 0xffaa22,
            transparent: true,
            opacity: 0.55,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        }));
        sunGlow.scale.set(sunRadius * 3.8, sunRadius * 3.8, 1);
        this.sun.add(sunGlow);

        this.group.add(this.sun);
        this.interactableObjects.push(this.sun);

        // Sun 3D CSS2D Badge for Lined-up mode
        const sunBadgeDiv = document.createElement('div');
        sunBadgeDiv.className = 'solar-mnemonic-badge sun-badge';
        sunBadgeDiv.innerHTML = `
            <div class="badge-mnemonic sun-color">Sonne</div>
            <div class="badge-sub">Zentralstern</div>
        `;
        sunBadgeDiv.style.display = 'none';
        sunBadgeDiv.addEventListener('click', (e) => {
            e.stopPropagation();
            focusPlanet(this.sun);
        });
        const sunBadgeObj = new THREE.CSS2DObject(sunBadgeDiv);
        sunBadgeObj.position.set(0, sunRadius + 2.5, 0);
        sunBadgeObj.visible = false;
        this.sun.add(sunBadgeObj);
        this.sunBadgeDiv = sunBadgeDiv;
        this.sunBadgeObj = sunBadgeObj;

        // Sunlight
        this.pointLight = new THREE.PointLight(0xffffff, 3.6, 3500);
        this.pointLight.position.set(0, 0, 0);
        this.group.add(this.pointLight); 
        this.group.add(new THREE.AmbientLight(0xdbe8ff, 0.08));

        // Directional Light for lined-up side-by-side mode
        this.lineDirLight = new THREE.DirectionalLight(0xffffff, 0);
        this.lineDirLight.position.set(-5, 35, 75);
        this.lineDirLight.visible = false;
        this.group.add(this.lineDirLight);

        // Background Stars & Milky Way Band
        this.createStars();

        // Planets
        const planetKeys = Object.keys(planetData).filter(k => k !== 'sun');
        planetKeys.forEach(key => {
            const data = planetData[key];
            const orbitGroup = new THREE.Group();
            orbitGroup.rotation.y = Math.random() * Math.PI * 2;

            // Anchor holds planet + moons at orbital distance so planet self-rotation doesn't spin moon orbits
            const anchor = new THREE.Group();
            anchor.position.x = data.distanceFromCenter;
            orbitGroup.add(anchor);

            const planet = createCelestialBody(data);
            planet.scale.setScalar(data.radius);
            planet.userData = { planetId: key, anchor: anchor };
            anchor.add(planet);

            const moonsContainer = new THREE.Group();
            anchor.add(moonsContainer);
            
            // Orbit visual line
            const orbitGeom = new THREE.RingGeometry(data.distanceFromCenter - 0.1, data.distanceFromCenter + 0.1, 160);
            const orbitMat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, transparent: true, opacity: 0.15 });
            const orbitLine = new THREE.Mesh(orbitGeom, orbitMat);
            orbitLine.rotation.x = Math.PI / 2;
            this.group.add(orbitLine);

            // 3D Mnemonic CSS2D Badge
            const m = planetMnemonics[key];
            const badgeDiv = document.createElement('div');
            badgeDiv.className = 'solar-mnemonic-badge';
            if (m) {
                badgeDiv.innerHTML = `
                    <div class="badge-mnemonic"><strong class="highlight-letter">${m.letter}</strong>${m.word.slice(1)}</div>
                    <div class="badge-sub">${data.name}</div>
                `;
            } else {
                badgeDiv.innerHTML = `<div class="badge-mnemonic">${data.name}</div>`;
            }
            badgeDiv.style.display = 'none';
            badgeDiv.addEventListener('click', (e) => {
                e.stopPropagation();
                focusPlanet(planet);
            });
            const badgeObj = new THREE.CSS2DObject(badgeDiv);
            const badgeY = (key === 'saturn') ? (1.0 + 2.2 / data.radius) : (1.0 + 1.8 / data.radius);
            badgeObj.position.set(0, badgeY, 0);
            badgeObj.visible = false;
            planet.add(badgeObj);

            const lineX = planetLinePositions[key] || data.distanceFromCenter;

            this.planets.push({
                key: key,
                mesh: planet,
                anchor: anchor,
                moonsContainer: moonsContainer,
                activeMoons: new Map(), // moonId -> { tiltGroup, pivot, mesh, orbitRing, labelDiv, labelObj, orbitSpeed, data }
                levelRingMesh: null,
                group: orbitGroup,
                data: data,
                orbitLine: orbitLine,
                lineX: lineX,
                badgeDiv: badgeDiv,
                badgeObj: badgeObj
            });
            this.group.add(orbitGroup);
        });

        // Containers for Asteroid Belt, Kuiper Belt, and Extra Celestial Bodies
        this.beltsGroup = new THREE.Group();
        this.group.add(this.beltsGroup);
        this.extraBodiesGroup = new THREE.Group();
        this.group.add(this.extraBodiesGroup);

        this.parentScene.add(this.group);

        const initialSlider = document.getElementById('level-slider');
        const parsedLvl = initialSlider ? parseInt(initialSlider.value, 10) : 3;
        this.currentLevelIndex = Number.isNaN(parsedLvl) ? 3 : parsedLvl;
        this.applyKnowledgeLevel(this.currentLevelIndex, false);
    }

    createCryoPlume(colorHex = 0xccf2ff) {
        const count = 45;
        const geom = new THREE.BufferGeometry();
        const pos = new Float32Array(count * 3);
        for (let i = 0; i < count; i++) {
            const t = (i / count);
            const spread = t * 0.35;
            pos[i * 3] = (Math.random() - 0.5) * spread;
            pos[i * 3 + 1] = -1.0 - t * 1.4;
            pos[i * 3 + 2] = (Math.random() - 0.5) * spread;
        }
        geom.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        const mat = new THREE.PointsMaterial({
            map: getSoftParticleTexture(),
            color: colorHex,
            size: 0.25,
            transparent: true,
            opacity: 0.75,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        const points = new THREE.Points(geom, mat);
        points.userData = { isPlume: true };
        return points;
    }

    createMoonEntry(pEntry, mData, texLoader) {
        const isSpacecraft = Boolean(mData.isSpacecraft || mData.shape === 'spacecraft');
        const isIrregular = Boolean(mData.isIrregular || mData.shape === 'irregular');
        const orbitRadius = (typeof mData.orbitRadius === 'number' && !Number.isNaN(mData.orbitRadius))
            ? mData.orbitRadius
            : (parseFloat(String(mData.distance || '').replace(',', '.')) || 2.5);
        const orbitSpeed = (typeof mData.orbitSpeed === 'number' && !Number.isNaN(mData.orbitSpeed))
            ? mData.orbitSpeed
            : (typeof mData.speed === 'number' ? mData.speed : 0.035);
        const orbitTilt = (typeof mData.orbitTilt === 'number' && !Number.isNaN(mData.orbitTilt))
            ? mData.orbitTilt
            : (mData.inclination ? THREE.MathUtils.degToRad(mData.inclination * 0.28) : 0);

        const tiltGroup = new THREE.Group();
        tiltGroup.rotation.z = orbitTilt;

        const pivot = new THREE.Group();
        pivot.rotation.y = Math.random() * Math.PI * 2;
        tiltGroup.add(pivot);

        let moonMesh;
        if (isSpacecraft) {
            moonMesh = createSpacecraftModel(mData);
        } else if (isIrregular) {
            moonMesh = createIrregularBodyMesh(mData, texLoader);
        } else {
            const geom = new THREE.SphereGeometry(1, 64, 64);
            const mat = new THREE.MeshStandardMaterial({
                color: mData.textureUrl ? 0xffffff : (mData.color || 0xcccccc),
                roughness: mData.roughness !== undefined ? mData.roughness : 0.75,
                metalness: 0.04
            });
            if (mData.textureUrl) {
                texLoader.load(mData.textureUrl, (tex) => {
                    tex.colorSpace = THREE.SRGBColorSpace;
                    applyTextureSharpness(tex);
                    mat.map = tex;
                    mat.color.setHex(0xffffff);
                    mat.needsUpdate = true;
                });
            }
            if (mData.normalMapUrl) {
                texLoader.load(mData.normalMapUrl, (tex) => {
                    applyTextureSharpness(tex);
                    mat.normalMap = tex;
                    mat.normalScale = new THREE.Vector2(1.25, 1.25);
                    mat.needsUpdate = true;
                });
            }
            moonMesh = new THREE.Mesh(geom, mat);

            if (mData.hasAtmosphere) {
                moonMesh.add(createAtmosphereHalo(mData.atmosphereColor || 0xe8a245, 1.08, 0.32));
            }
            if (mData.hasGeysers || mData.id === 'enceladus' || mData.id === 'triton') {
                moonMesh.add(this.createCryoPlume(mData.id === 'enceladus' ? 0xd8f6ff : 0xaad8ff));
            }
            if (mData.id === 'io') {
                moonMesh.add(createAtmosphereHalo(0xffaa22, 1.06, 0.24));
            }
        }

        const moonRadius = (typeof mData.radius === 'number' && !Number.isNaN(mData.radius)) ? mData.radius : 0.22;
        moonMesh.scale.setScalar(moonRadius);
        moonMesh.position.set(orbitRadius, 0, 0);

        const lookupKey = `${pEntry.key}:${mData.id}`;
        moonMesh.userData = {
            planetId: lookupKey,
            isMoon: true,
            moonData: mData,
            parentPlanetId: pEntry.key,
            parentPlanetName: pEntry.data.name,
            visualRadius: moonRadius
        };
        // Propagate planetId to child meshes for raycasting on spacecraft/irregular groups
        moonMesh.traverse(child => {
            if (child !== moonMesh) {
                child.userData = { ...child.userData, planetId: lookupKey, rootSelectable: moonMesh };
            }
        });

        // Subtle orbit ring around parent planet in the same tilted plane
        const orbitGeom = new THREE.RingGeometry(Math.max(0.05, orbitRadius - 0.025), orbitRadius + 0.025, 96);
        const orbitMat = new THREE.MeshBasicMaterial({
            color: isSpacecraft ? 0xffcc55 : 0x7aa8ff,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: isSpacecraft ? 0.28 : 0.18
        });
        const orbitRing = new THREE.Mesh(orbitGeom, orbitMat);
        orbitRing.rotation.x = Math.PI / 2;
        tiltGroup.add(orbitRing);

        // 3D CSS2D mini label for the moon/probe
        const labelDiv = document.createElement('div');
        labelDiv.className = `moon-3d-label${isSpacecraft ? ' is-spacecraft' : ''}`;
        labelDiv.textContent = mData.name;
        labelDiv.addEventListener('click', (e) => {
            e.stopPropagation();
            focusPlanet(moonMesh);
        });
        const labelObj = new THREE.CSS2DObject(labelDiv);
        labelObj.position.set(0, 1.45, 0);
        moonMesh.add(labelObj);

        pivot.add(moonMesh);
        pEntry.moonsContainer.add(tiltGroup);

        return { tiltGroup, pivot, mesh: moonMesh, orbitRing, labelDiv, labelObj, orbitSpeed, data: mData };
    }

    rebuildBelts(levelIndex) {
        // Clear previous belts
        while (this.beltsGroup.children.length > 0) {
            const c = this.beltsGroup.children[0];
            this.beltsGroup.remove(c);
        }

        // Asteroid Belt between Mars (28) and Jupiter (42) -> r = 32..37.5 (from lvl7 / index 2)
        if (levelIndex >= 2) {
            const count = levelIndex >= 4 ? 900 : 480;
            const rockGeom = new THREE.DodecahedronGeometry(0.11, 1);
            const rockMat = new THREE.MeshStandardMaterial({
                color: 0x9b9286,
                roughness: 0.9,
                metalness: 0.08
            });
            const inst = new THREE.InstancedMesh(rockGeom, rockMat, count);
            const dummy = new THREE.Object3D();
            for (let i = 0; i < count; i++) {
                const angle = Math.random() * Math.PI * 2;
                const r = 32.2 + Math.random() * 5.2;
                const y = (Math.random() - 0.5) * 1.6;
                dummy.position.set(Math.cos(angle) * r, y, Math.sin(angle) * r);
                dummy.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
                const s = 0.5 + Math.random() * 1.4;
                dummy.scale.set(s * 1.3, s * 0.85, s);
                dummy.updateMatrix();
                inst.setMatrixAt(i, dummy.matrix);
            }
            inst.instanceMatrix.needsUpdate = true;
            inst.userData = { isBelt: true, speed: 0.0005 };
            this.beltsGroup.add(inst);
        }

        // Kuiper Belt beyond Neptune (95) -> r = 100..124 (from lvl10 / index 3)
        if (levelIndex >= 3) {
            const count = levelIndex >= 4 ? 1100 : 600;
            const iceGeom = new THREE.IcosahedronGeometry(0.13, 1);
            const iceMat = new THREE.MeshStandardMaterial({
                color: 0xa8c8e8,
                roughness: 0.65,
                metalness: 0.1
            });
            const inst = new THREE.InstancedMesh(iceGeom, iceMat, count);
            const dummy = new THREE.Object3D();
            for (let i = 0; i < count; i++) {
                const angle = Math.random() * Math.PI * 2;
                const r = 100 + Math.random() * 24;
                const y = (Math.random() - 0.5) * 4.2;
                dummy.position.set(Math.cos(angle) * r, y, Math.sin(angle) * r);
                dummy.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
                const s = 0.6 + Math.random() * 1.6;
                dummy.scale.set(s, s * 0.8, s * 1.2);
                dummy.updateMatrix();
                inst.setMatrixAt(i, dummy.matrix);
            }
            inst.instanceMatrix.needsUpdate = true;
            inst.userData = { isBelt: true, speed: 0.0002 };
            this.beltsGroup.add(inst);
        }
    }

    rebuildExtraBodies(levelIndex, texLoader) {
        // Remove old CSS2D labels & objects
        this.extraBodies.forEach(eb => {
            if (eb.labelObj && eb.mesh) eb.mesh.remove(eb.labelObj);
            if (eb.labelDiv && eb.labelDiv.parentNode) eb.labelDiv.parentNode.removeChild(eb.labelDiv);
            if (eb.subMoons) {
                eb.subMoons.forEach(sm => {
                    if (sm.labelObj && sm.mesh) sm.mesh.remove(sm.labelObj);
                    if (sm.labelDiv && sm.labelDiv.parentNode) sm.labelDiv.parentNode.removeChild(sm.labelDiv);
                });
            }
        });
        while (this.extraBodiesGroup.children.length > 0) {
            this.extraBodiesGroup.remove(this.extraBodiesGroup.children[0]);
        }
        this.extraBodies = [];

        if (typeof solarSystemExtraBodies === 'undefined') return;

        solarSystemExtraBodies.forEach(ebData => {
            if (ebData.minLevel > levelIndex) return;

            const ebTilt = (typeof ebData.orbitTilt === 'number' && !Number.isNaN(ebData.orbitTilt))
                ? ebData.orbitTilt
                : (ebData.inclination ? THREE.MathUtils.degToRad(ebData.inclination * 0.35) : 0);

            const planeGroup = new THREE.Group();
            planeGroup.rotation.z = ebTilt;

            const orbitGroup = new THREE.Group();
            orbitGroup.rotation.y = Math.random() * Math.PI * 2;
            planeGroup.add(orbitGroup);

            const anchor = new THREE.Group();
            anchor.position.x = ebData.distanceFromCenter;
            orbitGroup.add(anchor);

            const isIrregular = Boolean(ebData.isIrregular || ebData.shape === 'irregular');
            let mesh;
            if (ebData.isComet) {
                mesh = createCometMesh(ebData, texLoader);
            } else if (isIrregular) {
                mesh = createIrregularBodyMesh(ebData, texLoader);
            } else {
                mesh = createCelestialBody(ebData);
            }

            if (!isIrregular && Array.isArray(ebData.aspectScale) && ebData.aspectScale.length === 3) {
                mesh.scale.set(
                    ebData.radius * ebData.aspectScale[0],
                    ebData.radius * ebData.aspectScale[1],
                    ebData.radius * ebData.aspectScale[2]
                );
            } else {
                mesh.scale.setScalar(ebData.radius);
            }

            const lookupKey = `extra:${ebData.id}`;
            mesh.userData = {
                ...mesh.userData,
                planetId: lookupKey,
                isExtraBody: true,
                extraData: ebData,
                anchor: anchor,
                visualRadius: ebData.radius
            };
            mesh.traverse(child => {
                if (child !== mesh) {
                    child.userData = { ...child.userData, planetId: lookupKey, rootSelectable: mesh };
                }
            });
            anchor.add(mesh);

            // Orbit line inside the same tilted planeGroup
            const orbitGeom = new THREE.RingGeometry(ebData.distanceFromCenter - 0.08, ebData.distanceFromCenter + 0.08, 160);
            const orbitMat = new THREE.MeshBasicMaterial({
                color: ebData.isComet ? 0x66ccff : 0x99aacc,
                side: THREE.DoubleSide,
                transparent: true,
                opacity: ebData.isComet ? 0.22 : 0.12
            });
            const orbitLine = new THREE.Mesh(orbitGeom, orbitMat);
            orbitLine.rotation.x = Math.PI / 2;
            planeGroup.add(orbitLine);

            // 3D label
            const labelDiv = document.createElement('div');
            labelDiv.className = 'moon-3d-label is-dwarf';
            labelDiv.textContent = ebData.name;
            labelDiv.addEventListener('click', (e) => {
                e.stopPropagation();
                focusPlanet(mesh);
            });
            const labelObj = new THREE.CSS2DObject(labelDiv);
            labelObj.position.set(0, 1.5, 0);
            mesh.add(labelObj);

            // Sub-moons for dwarf planets (e.g. Charon for Pluto, Dysnomia for Eris)
            const subMoons = [];
            if (Array.isArray(ebData.moons)) {
                ebData.moons.forEach(smData => {
                    if (smData.minLevel > levelIndex) return;
                    const smOrbitRadius = (typeof smData.orbitRadius === 'number' && !Number.isNaN(smData.orbitRadius))
                        ? smData.orbitRadius
                        : (parseFloat(String(smData.distance || '').replace(',', '.')) || 1.2);
                    const smOrbitSpeed = (typeof smData.orbitSpeed === 'number' && !Number.isNaN(smData.orbitSpeed))
                        ? smData.orbitSpeed
                        : (typeof smData.speed === 'number' ? smData.speed : 0.035);
                    const smOrbitTilt = (typeof smData.orbitTilt === 'number' && !Number.isNaN(smData.orbitTilt))
                        ? smData.orbitTilt
                        : 0;

                    const smTiltGroup = new THREE.Group();
                    smTiltGroup.rotation.z = smOrbitTilt;

                    const smPivot = new THREE.Group();
                    smPivot.rotation.y = Math.random() * Math.PI * 2;
                    smTiltGroup.add(smPivot);

                    const smGeom = new THREE.SphereGeometry(1, 48, 48);
                    const smMat = new THREE.MeshStandardMaterial({
                        color: smData.textureUrl ? 0xffffff : (smData.color || 0xaaaaaa),
                        roughness: smData.roughness || 0.8
                    });
                    if (smData.textureUrl) {
                        texLoader.load(smData.textureUrl, (tex) => {
                            tex.colorSpace = THREE.SRGBColorSpace;
                            applyTextureSharpness(tex);
                            smMat.map = tex;
                            smMat.color.setHex(0xffffff);
                            smMat.needsUpdate = true;
                        });
                    }
                    if (smData.normalMapUrl) {
                        texLoader.load(smData.normalMapUrl, (tex) => {
                            applyTextureSharpness(tex);
                            smMat.normalMap = tex;
                            smMat.needsUpdate = true;
                        });
                    }
                    const smMesh = new THREE.Mesh(smGeom, smMat);
                    const smRadius = (typeof smData.radius === 'number' && !Number.isNaN(smData.radius)) ? smData.radius : 0.2;
                    smMesh.scale.setScalar(smRadius);
                    smMesh.position.set(smOrbitRadius, 0, 0);

                    const smOrbitGeom = new THREE.RingGeometry(Math.max(0.05, smOrbitRadius - 0.02), smOrbitRadius + 0.02, 64);
                    const smOrbitRing = new THREE.Mesh(smOrbitGeom, new THREE.MeshBasicMaterial({
                        color: 0x7aa8ff,
                        side: THREE.DoubleSide,
                        transparent: true,
                        opacity: 0.16
                    }));
                    smOrbitRing.rotation.x = Math.PI / 2;
                    smTiltGroup.add(smOrbitRing);

                    const smKey = `extra:${ebData.id}:${smData.id}`;
                    smMesh.userData = {
                        planetId: smKey,
                        isMoon: true,
                        moonData: smData,
                        parentPlanetId: lookupKey,
                        parentPlanetName: ebData.name,
                        visualRadius: smRadius
                    };
                    const smLabelDiv = document.createElement('div');
                    smLabelDiv.className = 'moon-3d-label';
                    smLabelDiv.textContent = smData.name;
                    smLabelDiv.addEventListener('click', (e) => {
                        e.stopPropagation();
                        focusPlanet(smMesh);
                    });
                    const smLabelObj = new THREE.CSS2DObject(smLabelDiv);
                    smLabelObj.position.set(0, 1.4, 0);
                    smMesh.add(smLabelObj);

                    smPivot.add(smMesh);
                    anchor.add(smTiltGroup);
                    subMoons.push({
                        tiltGroup: smTiltGroup,
                        pivot: smPivot,
                        mesh: smMesh,
                        labelDiv: smLabelDiv,
                        labelObj: smLabelObj,
                        orbitSpeed: smOrbitSpeed,
                        data: smData,
                        key: smKey
                    });
                });
            }

            this.extraBodiesGroup.add(planeGroup);
            this.extraBodies.push({
                key: lookupKey,
                mesh,
                anchor,
                planeGroup,
                group: orbitGroup,
                orbitLine,
                labelDiv,
                labelObj,
                data: ebData,
                subMoons
            });
        });
    }

    setShowExtraBodies(show) {
        this.showExtraBodies = Boolean(show);
        this.updateLabelsAndVisibility();

        // If an extra body or moon was currently tracked and we are hiding them, reset view to overview
        if (!this.showExtraBodies && trackedPlanet && trackedPlanet.userData) {
            const pId = trackedPlanet.userData.planetId || '';
            const isMoon = trackedPlanet.userData.isMoon;
            const isExtra = trackedPlanet.userData.isExtraBody || pId.startsWith('extra:');
            if (isExtra || isMoon) {
                hideInfoPanel();
                trackedPlanet = null;
                isFocusTweening = false;
                if (camera && controls) {
                    gsap.to(camera.position, { x: 0, y: 150, z: 200, duration: 1.2, ease: "power2.out" });
                    gsap.to(controls.target, { x: 0, y: 0, z: 0, duration: 1.2, ease: "power2.out" });
                }
            }
        }
    }

    updateLabelsAndVisibility() {
        const isSolarActive = Boolean(this.group && this.group.visible && (typeof currentMode === 'undefined' || currentMode === 'solarSystem'));
        const showOrbitExtras = isSolarActive && !this.isLinedUp && this.showExtraBodies;
        const showMnemonicBadges = isSolarActive && this.isLinedUp;

        if (this.beltsGroup) this.beltsGroup.visible = showOrbitExtras;
        if (this.extraBodiesGroup) this.extraBodiesGroup.visible = showOrbitExtras;

        if (this.sunBadgeObj) this.sunBadgeObj.visible = showMnemonicBadges;
        if (this.sunBadgeDiv) this.sunBadgeDiv.style.display = showMnemonicBadges ? 'flex' : 'none';

        this.planets.forEach(p => {
            if (p.moonsContainer) p.moonsContainer.visible = showOrbitExtras;
            if (p.badgeObj) p.badgeObj.visible = showMnemonicBadges;
            if (p.badgeDiv) p.badgeDiv.style.display = showMnemonicBadges ? 'flex' : 'none';
        });

        // Trigger dynamic zoom-reactive pill visibility
        this.currentPillPlanetId = undefined;
        this.updatePillVisibility();
    }

    updatePillVisibility() {
        const isSolarActive = Boolean(this.group && this.group.visible && (typeof currentMode === 'undefined' || currentMode === 'solarSystem'));

        // Hide all pills if not active in solar system, or lined-up mode, or extra bodies are toggled off
        if (!isSolarActive || this.isLinedUp || !this.showExtraBodies) {
            if (this.currentPillPlanetId !== null) {
                this.currentPillPlanetId = null;
                this.planets.forEach(p => {
                    p.activeMoons.forEach(m => {
                        if (m.labelObj) m.labelObj.visible = false;
                        if (m.labelDiv) m.labelDiv.style.display = 'none';
                    });
                });
                this.extraBodies.forEach(eb => {
                    if (eb.labelObj) eb.labelObj.visible = false;
                    if (eb.labelDiv) eb.labelDiv.style.display = 'none';
                    if (eb.subMoons) {
                        eb.subMoons.forEach(sm => {
                            if (sm.labelObj) sm.labelObj.visible = false;
                            if (sm.labelDiv) sm.labelDiv.style.display = 'none';
                        });
                    }
                });
            }
            return;
        }

        // Determine if any planet or extra body is currently zoomed in
        let zoomedPlanetId = null;

        // 1. Check if a planet/moon is actively tracked
        if (trackedPlanet && trackedPlanet.userData) {
            const pId = trackedPlanet.userData.parentPlanetId || trackedPlanet.userData.planetId;
            const pPos = new THREE.Vector3();
            trackedPlanet.getWorldPosition(pPos);
            const dist = camera ? camera.position.distanceTo(pPos) : 999;
            const r = trackedPlanet.userData.visualRadius || 1.2;
            const maxZoomDist = Math.max(32, r * 16);
            if (dist < maxZoomDist) {
                zoomedPlanetId = pId;
            }
        }

        // 2. Proximity check for manual zoom (mouse wheel / touch gesture)
        if (!zoomedPlanetId && camera) {
            for (let i = 0; i < this.planets.length; i++) {
                const p = this.planets[i];
                const pPos = new THREE.Vector3();
                p.mesh.getWorldPosition(pPos);
                const dist = camera.position.distanceTo(pPos);
                const r = p.data.radius || 1.2;
                const maxZoomDist = Math.max(26, r * 14);
                if (dist < maxZoomDist) {
                    zoomedPlanetId = p.data.id;
                    break;
                }
            }
            if (!zoomedPlanetId && this.showExtraBodies) {
                for (let i = 0; i < this.extraBodies.length; i++) {
                    const eb = this.extraBodies[i];
                    const ebPos = new THREE.Vector3();
                    eb.mesh.getWorldPosition(ebPos);
                    const dist = camera.position.distanceTo(ebPos);
                    if (dist < 18) {
                        zoomedPlanetId = eb.key;
                        break;
                    }
                }
            }
        }

        // Only update DOM / CSS2D objects when the active zoom planet changes
        if (zoomedPlanetId === this.currentPillPlanetId) return;
        this.currentPillPlanetId = zoomedPlanetId;

        // Apply visibility: only the zoomed planet gets its companion pills!
        this.planets.forEach(p => {
            const isThisZoomed = (zoomedPlanetId === p.data.id);
            p.activeMoons.forEach(m => {
                const show = isThisZoomed;
                if (m.labelObj) m.labelObj.visible = show;
                if (m.labelDiv) m.labelDiv.style.display = show ? '' : 'none';
            });
        });

        this.extraBodies.forEach(eb => {
            const isThisZoomed = (zoomedPlanetId === eb.key);
            if (eb.labelObj) eb.labelObj.visible = isThisZoomed;
            if (eb.labelDiv) eb.labelDiv.style.display = isThisZoomed ? '' : 'none';
            if (eb.subMoons) {
                eb.subMoons.forEach(sm => {
                    if (sm.labelObj) sm.labelObj.visible = isThisZoomed;
                    if (sm.labelDiv) sm.labelDiv.style.display = isThisZoomed ? '' : 'none';
                });
            }
        });
    }

    applyKnowledgeLevel(levelIndex, useLoader = false) {
        this.currentLevelIndex = levelIndex;
        const levelNames = ['Ab 4 J.', 'Klasse 5', 'Klasse 7', 'Klasse 10', 'Oberstufe (16+)', 'Experte'];
        const levelLabel = levelNames[levelIndex] || 'Klasse 5';

        // Count how many 3D models & textures are active for this level
        let targetMoonCount = 0;
        let targetExtraCount = 0;
        this.planets.forEach(p => {
            if (Array.isArray(p.data.moons)) {
                p.data.moons.forEach(m => {
                    if (m.minLevel <= levelIndex) targetMoonCount++;
                });
            }
        });
        if (typeof solarSystemExtraBodies !== 'undefined') {
            solarSystemExtraBodies.forEach(eb => {
                if (eb.minLevel <= levelIndex) {
                    targetExtraCount++;
                    if (Array.isArray(eb.moons)) {
                        eb.moons.forEach(sm => { if (sm.minLevel <= levelIndex) targetMoonCount++; });
                    }
                }
            });
        }

        // Use a dedicated LoadingManager when useLoader is true so the top loading bar shows real progress
        let texLoader = globalTextureLoader;
        let completedSteps = 0;
        const totalVirtualSteps = Math.max(6, targetMoonCount + targetExtraCount + 2);

        if (useLoader && typeof spaceLoader !== 'undefined') {
            spaceLoader.start(totalVirtualSteps, `Lade 3D-Modelle (${levelLabel}): 0 / ${totalVirtualSteps}`);
            const levelManager = new THREE.LoadingManager();
            levelManager.onStart = (url, loaded, total) => {
                spaceLoader.total = Math.max(totalVirtualSteps, total);
            };
            levelManager.onProgress = (url, loaded, total) => {
                const grandTotal = Math.max(totalVirtualSteps, total);
                const cur = Math.min(grandTotal - 1, Math.max(completedSteps, loaded));
                spaceLoader.update(cur, grandTotal, `Lade 3D-Modelle & Texturen (${levelLabel})...`);
            };
            levelManager.onLoad = () => {
                spaceLoader.complete(`Wissensniveau "${levelLabel}" aktiv (${targetMoonCount} Monde/Sonden geladen)`);
            };
            texLoader = new THREE.TextureLoader(levelManager);
        }

        const stepProgress = (detailName) => {
            if (!useLoader || typeof spaceLoader === 'undefined') return;
            completedSteps++;
            spaceLoader.update(
                Math.min(completedSteps, totalVirtualSteps),
                totalVirtualSteps,
                `Generiere 3D-Himmelskörper (${levelLabel}): ${detailName}`
            );
        };

        // 1. Update each planet's moons, spacecraft, and level-unlocked rings
        this.planets.forEach(pEntry => {
            const pData = pEntry.data;

            // Level-dependent planetary rings (Uranus lvl7, Neptune lvl10, Jupiter lvl16)
            if (pData.levelRingMinLevel !== undefined) {
                if (levelIndex >= pData.levelRingMinLevel && !pEntry.levelRingMesh) {
                    const innerR = pData.levelRingInner || 1.3;
                    const outerR = pData.levelRingOuter || 1.9;
                    const rGeom = new THREE.RingGeometry(innerR, outerR, 128);
                    fixRingUVs(rGeom, innerR, outerR);
                    const rTex = texLoader.load(pData.levelRingTextureUrl);
                    rTex.colorSpace = THREE.SRGBColorSpace;
                    applyTextureSharpness(rTex);
                    const rMat = new THREE.MeshStandardMaterial({
                        map: rTex,
                        side: THREE.DoubleSide,
                        transparent: true,
                        opacity: 0.85,
                        roughness: 0.6,
                        depthWrite: false
                    });
                    const rMesh = new THREE.Mesh(rGeom, rMat);
                    rMesh.rotation.x = Math.PI / 2 + (pEntry.key === 'uranus' ? 1.45 : 0.08);
                    pEntry.mesh.add(rMesh);
                    pEntry.levelRingMesh = rMesh;
                } else if (levelIndex < pData.levelRingMinLevel && pEntry.levelRingMesh) {
                    pEntry.mesh.remove(pEntry.levelRingMesh);
                    pEntry.levelRingMesh = null;
                }
            }

            // Moons & spacecraft for this planet
            const moonsList = Array.isArray(pData.moons) ? pData.moons : [];
            moonsList.forEach(mData => {
                const shouldExist = mData.minLevel <= levelIndex;
                const exists = pEntry.activeMoons.has(mData.id);

                if (shouldExist && !exists) {
                    const moonEntry = this.createMoonEntry(pEntry, mData, texLoader);
                    pEntry.activeMoons.set(mData.id, moonEntry);
                    stepProgress(mData.name);
                } else if (!shouldExist && exists) {
                    const old = pEntry.activeMoons.get(mData.id);
                    if (old.labelObj && old.mesh) old.mesh.remove(old.labelObj);
                    if (old.labelDiv && old.labelDiv.parentNode) {
                        old.labelDiv.parentNode.removeChild(old.labelDiv);
                    }
                    if (old.tiltGroup) {
                        pEntry.moonsContainer.remove(old.tiltGroup);
                    } else {
                        pEntry.moonsContainer.remove(old.pivot);
                        pEntry.moonsContainer.remove(old.orbitRing);
                    }
                    pEntry.activeMoons.delete(mData.id);
                } else if (shouldExist && exists) {
                    stepProgress(mData.name);
                }
            });
        });

        // 2. Rebuild Asteroid & Kuiper Belts for this level
        this.rebuildBelts(levelIndex);
        stepProgress('Asteroiden- & Kuipergürtel');

        // 3. Rebuild Extra Celestial Bodies (Dwarf Planets, Comets, Trojans)
        this.rebuildExtraBodies(levelIndex, texLoader);
        stepProgress('Zwergplaneten & Kometen');

        // 4. Refresh lookup map & interactable objects array
        this.moonLookup.clear();
        this.interactableObjects = [this.sun];

        this.planets.forEach(pEntry => {
            this.interactableObjects.push(pEntry.mesh);
            pEntry.activeMoons.forEach((mEntry, mId) => {
                const key = `${pEntry.key}:${mId}`;
                this.moonLookup.set(key, {
                    mesh: mEntry.mesh,
                    data: mEntry.data,
                    parentPlanet: pEntry
                });
                this.interactableObjects.push(mEntry.mesh);
            });
        });

        this.extraBodies.forEach(eb => {
            this.moonLookup.set(eb.key, {
                mesh: eb.mesh,
                data: eb.data,
                isExtraBody: true
            });
            this.interactableObjects.push(eb.mesh);
            eb.subMoons.forEach(sm => {
                this.moonLookup.set(sm.key, {
                    mesh: sm.mesh,
                    data: sm.data,
                    parentExtra: eb
                });
                this.interactableObjects.push(sm.mesh);
            });
        });

        // Sync CSS2DObject and container visibility for current mode & layout
        this.updateLabelsAndVisibility();

        // If tracked object was removed by lowering the level, fall back to its parent planet or overview
        if (trackedPlanet && trackedPlanet.userData && trackedPlanet.userData.planetId) {
            const tid = trackedPlanet.userData.planetId;
            if (tid.includes(':') && !this.moonLookup.has(tid)) {
                const parentKey = trackedPlanet.userData.parentPlanetId;
                const parentEntry = this.planets.find(p => p.key === parentKey);
                if (parentEntry) {
                    focusPlanet(parentEntry.mesh);
                } else {
                    trackedPlanet = null;
                }
            }
        }

        // Ensure loader finishes cleanly even if all textures were already in browser cache
        if (useLoader && typeof spaceLoader !== 'undefined') {
            setTimeout(() => {
                if (spaceLoader.active) {
                    spaceLoader.complete(`Wissensniveau "${levelLabel}" geladen (${targetMoonCount} Monde/Sonden & ${targetExtraCount} Zwergplaneten/Körper)`);
                }
            }, 380);
        }
    }

    setLayout(isLinedUp) {
        if (this.isLinedUp === isLinedUp) {
            this.updateLabelsAndVisibility();
            return;
        }
        this.isLinedUp = isLinedUp;

        gsap.killTweensOf(this.sun.position);
        if (this.pointLight) gsap.killTweensOf(this.pointLight.position);
        if (this.lineDirLight) gsap.killTweensOf(this.lineDirLight);

        this.planets.forEach(p => {
            gsap.killTweensOf(p.group.rotation);
            gsap.killTweensOf(p.anchor.position);
            if (p.orbitLine && p.orbitLine.material) {
                gsap.killTweensOf(p.orbitLine.material);
            }
        });

        const banner = document.getElementById('solar-mnemonic-banner');

        // If switching into lined-up mnemonic mode while a moon or extra body is focused, unfocus it
        if (isLinedUp && trackedPlanet && trackedPlanet.userData && trackedPlanet.userData.planetId) {
            const tid = trackedPlanet.userData.planetId;
            if (tid.includes(':')) {
                trackedPlanet = null;
                isFocusTweening = false;
                gsap.killTweensOf(focusTweenObj);
                hideInfoPanel();
            }
        }

        // Immediately sync 3D groups and CSS2DObject visibility (hides Ceres, Pluto, Halley & moon pills in lined-up mode)
        this.updateLabelsAndVisibility();

        if (isLinedUp) {
            gsap.to(this.sun.position, {
                x: -50, y: 0, z: 0,
                duration: 1.4,
                ease: "power2.inOut"
            });
            if (this.pointLight) {
                gsap.to(this.pointLight.position, {
                    x: -50, y: 0, z: 0,
                    duration: 1.4,
                    ease: "power2.inOut"
                });
            }
            if (this.lineDirLight) {
                this.lineDirLight.visible = true;
                gsap.to(this.lineDirLight, { intensity: 0.95, duration: 1.2 });
            }

            this.planets.forEach(p => {
                const curY = p.group.rotation.y;
                const targetRot = Math.round(curY / (Math.PI * 2)) * (Math.PI * 2);

                gsap.to(p.group.rotation, {
                    y: targetRot,
                    duration: 1.4,
                    ease: "power2.inOut"
                });

                gsap.to(p.anchor.position, {
                    x: p.lineX,
                    y: 0,
                    z: 0,
                    duration: 1.4,
                    ease: "power2.inOut"
                });

                if (p.orbitLine && p.orbitLine.material) {
                    gsap.to(p.orbitLine.material, {
                        opacity: 0,
                        duration: 0.6,
                        onComplete: () => {
                            if (this.isLinedUp) p.orbitLine.visible = false;
                        }
                    });
                }

                if (p.badgeObj) p.badgeObj.visible = true;
                if (p.badgeDiv) {
                    p.badgeDiv.style.display = 'flex';
                    p.badgeDiv.style.opacity = '0';
                    gsap.to(p.badgeDiv, { opacity: 1, duration: 0.8, delay: 0.5 });
                }
            });

            if (this.sunBadgeObj) this.sunBadgeObj.visible = true;
            if (this.sunBadgeDiv) {
                this.sunBadgeDiv.style.display = 'flex';
                this.sunBadgeDiv.style.opacity = '0';
                gsap.to(this.sunBadgeDiv, { opacity: 1, duration: 0.8, delay: 0.5 });
            }

            if (banner) banner.classList.remove('hidden');

            if (!trackedPlanet && currentMode === 'solarSystem') {
                sanitizeCameraAndControls();
                gsap.to(camera.position, {
                    x: -5, y: 12, z: 72,
                    duration: 1.5,
                    ease: "power2.inOut"
                });
                gsap.to(controls.target, {
                    x: -5, y: 0, z: 0,
                    duration: 1.5,
                    ease: "power2.inOut"
                });
            }
        } else {
            gsap.to(this.sun.position, {
                x: 0, y: 0, z: 0,
                duration: 1.4,
                ease: "power2.inOut"
            });
            if (this.pointLight) {
                gsap.to(this.pointLight.position, {
                    x: 0, y: 0, z: 0,
                    duration: 1.4,
                    ease: "power2.inOut"
                });
            }
            if (this.lineDirLight) {
                gsap.to(this.lineDirLight, {
                    intensity: 0,
                    duration: 0.8,
                    onComplete: () => {
                        if (!this.isLinedUp) this.lineDirLight.visible = false;
                    }
                });
            }

            this.planets.forEach(p => {
                gsap.to(p.anchor.position, {
                    x: p.data.distanceFromCenter,
                    y: 0,
                    z: 0,
                    duration: 1.4,
                    ease: "power2.inOut"
                });

                if (p.orbitLine && p.orbitLine.material) {
                    p.orbitLine.visible = true;
                    gsap.to(p.orbitLine.material, {
                        opacity: 0.15,
                        duration: 1.0
                    });
                }

                if (p.badgeObj) p.badgeObj.visible = false;
                if (p.badgeDiv) {
                    p.badgeDiv.style.display = 'none';
                }
            });

            if (this.sunBadgeObj) this.sunBadgeObj.visible = false;
            if (this.sunBadgeDiv) {
                this.sunBadgeDiv.style.display = 'none';
            }

            if (banner) banner.classList.add('hidden');

            if (!trackedPlanet && currentMode === 'solarSystem') {
                sanitizeCameraAndControls();
                gsap.to(camera.position, {
                    x: 0, y: 150, z: 200,
                    duration: 1.5,
                    ease: "power2.inOut"
                });
                gsap.to(controls.target, {
                    x: 0, y: 0, z: 0,
                    duration: 1.5,
                    ease: "power2.inOut"
                });
            }
        }
    }

    createStars() {
        // Deep space starfield with realistic stellar temperatures (O/B blue-white, G yellow, K/M orange-red)
        // Uniform spherical shell distribution without any texture seams or dark boundaries
        const starGeo = new THREE.BufferGeometry();
        const baseStarCount = 5000;
        const milkyWayCount = 2500;
        const totalCount = baseStarCount + milkyWayCount;
        
        const positions = new Float32Array(totalCount * 3);
        const colors = new Float32Array(totalCount * 3);
        const palette = [
            new THREE.Color(0x9bb8ff), // O/B Blue-White
            new THREE.Color(0xcad8ff), // A White-Blue
            new THREE.Color(0xf8f7ff), // F White
            new THREE.Color(0xfff4ea), // G Yellow-White (Sun)
            new THREE.Color(0xffd2a1), // K Orange
            new THREE.Color(0xffaa66)  // M Red-Orange
        ];

        // 1. Uniform 360° spherical celestial star shell (r = 850 - 1300)
        for (let i = 0; i < baseStarCount * 3; i += 3) {
            const u = Math.random();
            const v = Math.random();
            const theta = u * 2.0 * Math.PI;
            const phi = Math.acos(2.0 * v - 1.0);
            const r = 850 + Math.random() * 450;

            positions[i] = r * Math.sin(phi) * Math.cos(theta);
            positions[i + 1] = r * Math.sin(phi) * Math.sin(theta);
            positions[i + 2] = r * Math.cos(phi);

            const c = palette[Math.floor(Math.random() * palette.length)];
            const lum = 0.5 + Math.random() * 0.5;
            colors[i] = c.r * lum;
            colors[i + 1] = c.g * lum;
            colors[i + 2] = c.b * lum;
        }

        // 2. Procedural Milky Way stellar density stream (pure 3D points along an inclined galactic disk, NO texture/edges)
        const mwOffset = baseStarCount * 3;
        const mwInclination = 1.05; // ~60° inclination to ecliptic
        for (let i = 0; i < milkyWayCount; i++) {
            const idx = mwOffset + i * 3;
            const theta = Math.random() * Math.PI * 2;
            const spread = (Math.random() - 0.5) * (Math.random() - 0.5) * 0.35;
            const phi = Math.PI / 2 + spread;
            const r = 900 + Math.random() * 350;

            const x0 = r * Math.sin(phi) * Math.cos(theta);
            const y0 = r * Math.sin(phi) * Math.sin(theta);
            const z0 = r * Math.cos(phi);

            const yRot = y0 * Math.cos(mwInclination) - z0 * Math.sin(mwInclination);
            const zRot = y0 * Math.sin(mwInclination) + z0 * Math.cos(mwInclination);

            positions[idx] = x0;
            positions[idx + 1] = yRot;
            positions[idx + 2] = zRot;

            const c = Math.random() > 0.4 ? palette[0] : (Math.random() > 0.5 ? palette[2] : palette[3]);
            const lum = 0.25 + Math.random() * 0.45;
            colors[idx] = c.r * lum;
            colors[idx + 1] = c.g * lum;
            colors[idx + 2] = c.b * lum;
        }

        starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        starGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        const starMaterial = new THREE.PointsMaterial({
            size: 0.75,
            vertexColors: true,
            transparent: true,
            opacity: 0.92
        });

        this.stars = new THREE.Points(starGeo, starMaterial);
        this.group.add(this.stars);
    }

    update() {
        if (!this.group.visible) return;

        const timeScale = (typeof window.appTimeScale === 'number' ? window.appTimeScale : 1) * 0.5;
        const rotFactor = typeof window.rotationSpeedFactor === 'number' ? window.rotationSpeedFactor : 1;
        const orbFactor = typeof window.orbitSpeedFactor === 'number' ? window.orbitSpeedFactor : 1;

        // Rotate Sun
        this.sun.rotation.y += 0.002 * timeScale * rotFactor;

        // Update Planets & their Moons
        this.planets.forEach(p => {
            if (!this.isLinedUp) {
                p.group.rotation.y += p.data.speed * 0.2 * timeScale * orbFactor;
            }
            p.mesh.rotation.y += (0.005 + (0.01 / p.data.radius)) * timeScale * rotFactor;
            p.mesh.children.forEach(c => {
                if (c.userData && c.userData.isCloud) {
                    c.rotation.y += 0.0012 * timeScale * rotFactor;
                }
            });

            // Orbit Moons & Spacecraft around the planet's anchor
            if (!this.isLinedUp) {
                p.activeMoons.forEach(mEntry => {
                    const spd = mEntry.orbitSpeed || mEntry.data.orbitSpeed || mEntry.data.speed || 0.025;
                    mEntry.pivot.rotation.y += spd * 0.45 * timeScale * orbFactor;
                    mEntry.mesh.rotation.y += 0.01 * timeScale * rotFactor;
                });
            }
        });

        // Rotate Asteroid & Kuiper belts
        this.beltsGroup.children.forEach(belt => {
            if (belt.userData && belt.userData.speed) {
                belt.rotation.y += belt.userData.speed * timeScale * orbFactor;
            }
        });

        // Update Extra Celestial Bodies (Dwarf Planets, Comets, Trojans)
        if (!this.isLinedUp) {
            this.extraBodies.forEach(eb => {
                eb.group.rotation.y += (eb.data.speed || 0.002) * 0.2 * timeScale * orbFactor;
                eb.mesh.rotation.y += 0.008 * timeScale * rotFactor;
                eb.subMoons.forEach(sm => {
                    const smSpd = sm.orbitSpeed || sm.data.orbitSpeed || sm.data.speed || 0.03;
                    sm.pivot.rotation.y += smSpd * 0.45 * timeScale * orbFactor;
                    sm.mesh.rotation.y += 0.01 * timeScale * rotFactor;
                });
            });
        }
        
        if (this.stars && timeScale !== 0 && rotFactor > 0) {
            this.stars.rotation.y -= 0.0001 * (timeScale > 0 ? 1 : -1) * rotFactor;
        }

        // Dynamically update companion pill visibility based on camera proximity
        this.updatePillVisibility();
    }

    show() {
        this.group.visible = true;
        this.updateLabelsAndVisibility();
        const banner = document.getElementById('solar-mnemonic-banner');
        if (banner) {
            if (this.isLinedUp) banner.classList.remove('hidden');
            else banner.classList.add('hidden');
        }
    }

    hide() {
        this.group.visible = false;
        this.updateLabelsAndVisibility();
        const banner = document.getElementById('solar-mnemonic-banner');
        if (banner) banner.classList.add('hidden');
    }

    getInteractableObjects() {
        if (this.isLinedUp || !this.showExtraBodies) {
            return [this.sun, ...this.planets.map(p => p.mesh)];
        }
        return this.interactableObjects;
    }
}
class SizeComparison {
    constructor(scene, labelRenderer) {
        this.parentScene = scene;
        this.labelRenderer = labelRenderer;
        this.group = new THREE.Group();
        this.group.visible = false;
        
        this.currentIndex = 0;
        this.allData = sizeComparisonData;
        this.activeData = [...this.allData];
        
        this.ambientLight = new THREE.AmbientLight(0xffffff, 0.7); // Increased for better fill
        this.group.add(this.ambientLight);
        
        this.dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
        this.dirLight.position.set(500, 300, 1000); // More frontal position
        this.group.add(this.dirLight);

        // Add a back light for some depth and to ensure visibility of massive edges
        this.backLight = new THREE.DirectionalLight(0xffffff, 0.5);
        this.backLight.position.set(-500, -200, -1000);
        this.group.add(this.backLight);

        this.allMeshes = [];
        this.activeMeshes = [];
        this.activeMeshesGroup = new THREE.Group();
        this.group.add(this.activeMeshesGroup);

        this.textureLoader = new THREE.TextureLoader();
        
        // Pre-create all 32 meshes instantly so they never "pop" in
        this.initAllMeshes();
        this.setFilter(false); // Initializes activeMeshes properly without filter

        this.parentScene.add(this.group);
    }
    
    setFilter(onlySolarSystem) {
        this.onlySolarSystem = onlySolarSystem;
        if (onlySolarSystem) {
            const strictOrder = ['Merkur', 'Mars', 'Venus', 'Erde', 'Neptun', 'Uranus', 'Saturn', 'Jupiter'];
            this.activeData = strictOrder.map(name => this.allData.find(d => d.name === name)).filter(Boolean);
        } else {
            this.activeData = [...this.allData];
        }
        
        // Update active meshes mapping
        this.activeMeshes = this.activeData.map(d => this.allMeshes.find(m => m.data.name === d.name));
        
        // Hide all, only show active
        this.allMeshes.forEach(m => {
            m.mesh.visible = false;
            if (m.labelDiv) m.labelDiv.style.display = 'none';
        });
        this.activeMeshes.forEach(m => m.mesh.visible = true);
        
        // Re-populate global UI list if the function exists
        if (window.updateFinaleSidebar) {
            window.updateFinaleSidebar(this.activeData);
        }
        
        // Restart layout from index 0
        this.currentIndex = 0;
        if (this.group.visible) {
            this.applyLayout(0, true);
        }
    }
    
    playBlackHoleAnimation() {
        if (this.isAnimatingBH) return;
        this.isAnimatingBH = true;
        
        const astronaut = new THREE.Group();
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });
        const bodyGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.6, 16);
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        astronaut.add(body);
        
        const headGeo = new THREE.SphereGeometry(0.25, 16, 16);
        const headMat = new THREE.MeshStandardMaterial({ color: 0xffaa00, roughness: 0.1, metalness: 0.8 });
        const head = new THREE.Mesh(headGeo, headMat);
        head.position.y = 0.4;
        astronaut.add(head);

        const packGeo = new THREE.BoxGeometry(0.3, 0.4, 0.2);
        const pack = new THREE.Mesh(packGeo, bodyMat);
        pack.position.set(0, 0, -0.2);
        astronaut.add(pack);

        const targetBH = this.activeMeshes[this.currentIndex].mesh;
        const bhZ = targetBH.position.z;
        const startZ = camera.position.z - 5; 
        
        astronaut.position.set(0, 0, startZ);
        this.parentScene.add(astronaut);
        
        gsap.to(astronaut.position, {
            z: bhZ,
            x: targetBH.position.x,
            y: targetBH.position.y,
            duration: 2.0,
            ease: "power3.in"
        });
        
        gsap.to(astronaut.rotation, {
            x: Math.PI * 4,
            y: Math.PI * 4,
            z: Math.PI * 4,
            duration: 2.0,
            ease: "power2.in"
        });

        setTimeout(() => {
            astronaut.scale.y = 0.01; 
            astronaut.scale.z = 0.01; // Platt wie eine Briefmarke
            astronaut.scale.x = 2.0; 
            
            gsap.to(astronaut.position, {
                z: camera.position.z - 15,
                x: astronaut.position.x + 8, 
                y: astronaut.position.y + 4,
                duration: 3.0,
                ease: "power1.out"
            });
            
            gsap.killTweensOf(astronaut.rotation);
            astronaut.rotation.set(Math.PI / 4, 0, Math.PI / 4); 
            
            setTimeout(() => {
                this.parentScene.remove(astronaut);
                this.isAnimatingBH = false;
            }, 4000);
            
        }, 2000);
    }

    createStarGlow(colorHex) {
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');
        const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
        const col = new THREE.Color(colorHex);
        gradient.addColorStop(0, `rgba(${Math.min(255, Math.floor(col.r*255 + 40))}, ${Math.min(255, Math.floor(col.g*255 + 40))}, ${Math.min(255, Math.floor(col.b*255 + 40))}, 0.4)`);
        gradient.addColorStop(0.4, `rgba(${Math.floor(col.r*255)}, ${Math.floor(col.g*255)}, ${Math.floor(col.b*255)}, 0.18)`);
        gradient.addColorStop(0.8, `rgba(${Math.floor(col.r*255)}, ${Math.floor(col.g*255)}, ${Math.floor(col.b*255)}, 0.04)`);
        gradient.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 128, 128);
        const tex = new THREE.CanvasTexture(canvas);
        const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
        const sprite = new THREE.Sprite(mat);
        sprite.scale.set(2.4, 2.4, 1); 
        return sprite;
    }

    createSunTexture(colorHex) {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');
        const gradient = ctx.createRadialGradient(256, 256, 0, 256, 256, 256);
        const col = new THREE.Color(colorHex);
        gradient.addColorStop(0, '#ffffff');
        gradient.addColorStop(0.2, '#' + col.clone().lerp(new THREE.Color(0xffffff), 0.5).getHexString());
        gradient.addColorStop(0.8, '#' + col.getHexString());
        gradient.addColorStop(1, '#' + col.clone().lerp(new THREE.Color(0x000000), 0.5).getHexString());
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 512, 512);
        ctx.globalAlpha = 0.5;
        for (let i = 0; i < 20000; i++) {
            ctx.fillStyle = Math.random() > 0.5 ? '#ffffff' : '#' + col.getHexString();
            ctx.beginPath();
            ctx.arc(Math.random() * 512, Math.random() * 512, Math.random() * 3, 0, Math.PI * 2);
            ctx.fill();
        }
        const tex = new THREE.CanvasTexture(canvas);
        tex.colorSpace = THREE.SRGBColorSpace;
        return tex;
    }

    initAllMeshes() {
        for (let i = 0; i < this.allData.length; i++) {
            const data = this.allData[i];
            let mesh = createCelestialBody(data);
            
            mesh.traverse((m) => {
                if (m.isMesh && m.material) {
                    m.userData.originalOpacity = m.material.opacity !== undefined ? m.material.opacity : 1.0;
                    m.material.transparent = true;
                }
            });

            // Add glow to stars
            const isStar = data.type === "Stern" || data.type === "Roter Zwerg" || data.type.includes("Riese") || data.emissive;
            if (isStar) {
                const glow = this.createStarGlow(data.color || 0xffffff);
                mesh.add(glow);
            }

            // Create CSS Label for Finale Mode
            const labelDiv = document.createElement('div');
            labelDiv.className = 'planet-label';
            labelDiv.style.display = 'none'; // explicitly stripped from rendering pipeline initially
            labelDiv.textContent = data.name;
            const label = new THREE.CSS2DObject(labelDiv);
            label.position.set(0, 1.2, 0); // Display slightly above
            mesh.add(label);

            this.activeMeshesGroup.add(mesh);
            this.allMeshes.push({ mesh: mesh, data: data, labelDiv: labelDiv });
        }
    }

    getLayout(focusIndex) {
        const layout = [];
        const baseRadius = this.activeData[focusIndex].radiusKm;
        
        const getEffectiveRadius = (i, scale) => {
            return (this.activeData[i].hasRings || this.activeData[i].hasAccretionDisk) ? scale * 3.0 : scale;
        };

        for (let i = 0; i < this.activeData.length; i++) {
            let ratio = this.activeData[i].radiusKm / baseRadius;
            // Cap ratio tightly for rendering stability:
            // massive objects on right are capped at 5000 so they look visually flat as walls but don't break scene depth
            if (ratio > 5000) ratio = 5000;
            if (ratio < 0.0001) ratio = 0.0001; 
            layout[i] = { scale: ratio * 10, x: 0, z: 0 };
        }
        
        layout[focusIndex].x = 0;
        layout[focusIndex].z = 0;
        
        // Right items (Teasing the next giants)
        for (let i = focusIndex + 1; i < this.activeData.length; i++) {
            const prevEffR = getEffectiveRadius(i - 1, layout[i-1].scale);
            const currEffR = getEffectiveRadius(i, layout[i].scale);
            const currR = layout[i].scale;
            
            // Push massive objects back severely to mathematically prevent occlusion and camera clipping
            layout[i].z = -currR + 10;
            // Pad properly: gap ensures left edge of giant sphere is partially in frame on the right
            layout[i].x = layout[i-1].x + prevEffR + currEffR + Math.max(prevEffR, currEffR) * 0.2 + 8;
            
            // Regel 1A: Keine Ankündigung / No early preview for ringed objects
            if (i === focusIndex + 1 && (this.activeData[i].hasRings || this.activeData[i].hasAccretionDisk)) {
                layout[i].x += 80 + currEffR; // Push far enough out of frustum
            }
        }
        
        // Left items (Chain of predecessors)
        for (let i = focusIndex - 1; i >= 0; i--) {
            const nextEffR = getEffectiveRadius(i + 1, layout[i+1].scale);
            const currEffR = getEffectiveRadius(i, layout[i].scale);
            const currR = layout[i].scale;
            
            layout[i].z = -currR + 10;
            // Pad backwards to string a natural chain
            layout[i].x = layout[i+1].x - nextEffR - currEffR - Math.max(nextEffR, currEffR) * 0.2 - 8;
        }
        
        return layout;
    }

    show() {
        this.group.visible = true;
        camera.far = 200000; // Give massive buffer for Z-pushed enormous planes/stars
        camera.updateProjectionMatrix();
        
        // Jump to 0 initially without tween
        this.applyLayout(0, true);
    }

    hide() {
        this.group.visible = false;
        // Aggressive HTML label cleanup during mode context switch
        this.allMeshes.forEach(item => {
            if (item.labelDiv) {
                item.labelDiv.classList.remove('visible');
                item.labelDiv.style.display = 'none';
            }
        });
        camera.far = 2000; 
        camera.updateProjectionMatrix();
    }

    getInteractableObjects() {
        if (this.currentIndex === this.activeData.length - 1 && this.group.visible) {
            return this.activeMeshes.map(m => m.mesh);
        }
        return [];
    }

    jumpToIndex(index) {
        if (index >= 0 && index < this.activeData.length) {
            this.applyLayout(index, false);
        }
    }

    next() {
        if (this.currentIndex < this.activeData.length - 1) {
            this.applyLayout(this.currentIndex + 1, false);
        }
    }

    prev() {
        if (this.currentIndex > 0) {
            this.applyLayout(this.currentIndex - 1, false);
        }
    }

    applyLayout(newIndex, isInstant) {
        this.currentIndex = newIndex;
        this.updateUI(this.activeData[newIndex]);
        
        const isFinale = this.activeData[newIndex].isUniverse;
        let layout;
        
        if (!isFinale) {
            layout = this.getLayout(newIndex);
            
            // UI is now static and handled via main.js population
            // No more hiding jump button or snapping list collapsed here if we want a manual control only or specific main.js logic
            
            // Reset opacity to original and hide all labels statically
            this.activeMeshes.forEach(item => {
                item.mesh.traverse((m) => {
                    if (m.isMesh && m.material && m.userData.originalOpacity !== undefined) {
                        gsap.to(m.material, { opacity: m.userData.originalOpacity, duration: 1.0 });
                    }
                });
                if (item.labelDiv) {
                    item.labelDiv.classList.remove('visible');
                    item.labelDiv.style.display = 'none';
                }
            });

            // Return camera to normal mode view if coming from finale
            if (!isInstant) {
                gsap.to(camera.position, { x: 0, y: 0, z: 35, duration: 2.5, ease: "power2.inOut" });
                gsap.to(controls.target, { x: 0, y: 0, z: 0, duration: 2.5, ease: "power2.inOut" });
            }
        } else {
            // FINALE: Das Universum
            // UI remains static
            
            this.activeMeshes.forEach(item => {
                item.mesh.traverse((m) => {
                    if (m.isMesh && m.material && m.userData.originalOpacity !== undefined) {
                        gsap.to(m.material, { opacity: m.userData.originalOpacity, duration: 1.0 });
                    }
                });
            });

            layout = [];
            for (let i = 0; i < this.activeData.length; i++) {
                if (this.activeData[i].isUniverse) {
                    layout[i] = { scale: 30, x: 0, y: 0, z: -400 };
                } else {
                    // Distribute remaining spheres visually appealingly in 3D Space (spherical pattern)
                    const phi = Math.acos(1 - 2 * (i + 0.5) / (this.activeData.length - 1));
                    const theta = Math.PI * (1 + Math.sqrt(5)) * i;
                    const radius = 250 + Math.random() * 200; 
                    
                    layout[i] = {
                        scale: Math.max(0.5, Math.min(this.activeData[i].radiusKm / 3000, 20)), // Capped normalized scales
                        x: radius * Math.sin(phi) * Math.cos(theta),
                        y: radius * Math.cos(phi),
                        z: -400 + radius * Math.sin(phi) * Math.sin(theta)
                    };
                }
            }
            
            this.activeMeshes.forEach(item => {
                if(item.labelDiv && !item.data.isUniverse) {
                    item.labelDiv.style.display = 'block';
                    // Tick delay allows display:block to digest before CSS opacity triggers
                    setTimeout(() => item.labelDiv.classList.add('visible'), 30);
                }
            });
            
            // Pull camera back to observe the cosmos cloud (and Universe in bg)
            if (!isInstant) {
                gsap.to(camera.position, { x: 0, y: 150, z: 600, duration: 3.5, ease: "power2.inOut" });
                gsap.to(controls.target, { x: 0, y: 0, z: -400, duration: 3.5, ease: "power2.inOut" });
            }
        }

        // Animate all active objects physically
        for (let i = 0; i < this.activeMeshes.length; i++) {
            const mesh = this.activeMeshes[i].mesh;
            const target = layout[i];
            
            if (isInstant) {
                mesh.position.set(target.x, target.y || 0, target.z);
                mesh.scale.setScalar(target.scale);
            } else {
                gsap.to(mesh.position, {
                    x: target.x,
                    y: target.y || 0,
                    z: target.z,
                    duration: 3.5, // Slow, majestic sweep
                    ease: "power2.inOut"
                });
                gsap.to(mesh.scale, {
                    x: target.scale,
                    y: target.scale,
                    z: target.scale,
                    duration: 3.5,
                    ease: "power2.inOut"
                });
            }
        }
    }

    updateCurrentUIMetadata() {
        if (this.activeData && this.activeData[this.currentIndex]) {
            this.updateUI(this.activeData[this.currentIndex]);
        }
    }

    updateUI(data) {
        if (!data) return;
        document.getElementById('size-name').textContent = data.name;
        document.getElementById('size-diameter').textContent = `Durchmesser: ${data.diameter}`;
        document.getElementById('size-type').textContent = `Typ: ${data.type}`;
        const descText = data.texts ? (data.texts[currentLevel] || data.texts.lvl10 || "") : "";
        document.getElementById('size-desc').textContent = descText;
        
        const playBtn = document.getElementById('btn-play-blackhole');
        if (data.type === 'Schwarzes Loch') {
            playBtn.classList.remove('hidden');
        } else {
            playBtn.classList.add('hidden');
        }
        
        document.getElementById('btn-prev-size').style.opacity = this.currentIndex === 0 ? '0.3' : '1';
        document.getElementById('btn-prev-size').style.pointerEvents = this.currentIndex === 0 ? 'none' : 'auto';
        
        document.getElementById('btn-next-size').style.opacity = this.currentIndex === this.activeData.length - 1 ? '0.3' : '1';
        document.getElementById('btn-next-size').style.pointerEvents = this.currentIndex === this.activeData.length - 1 ? 'none' : 'auto';
    }

    update() {
        if (!this.group.visible) return;
        const rotFactor = typeof window.rotationSpeedFactor === 'number' ? window.rotationSpeedFactor : 1;
        
        // Let everything spin continuously (50% slower)
        this.activeMeshes.forEach(item => {
            // ZWINGEND: Keine Eigenrotation für Objekte mit Ringen oder Akkretionsscheiben
            if (item.data.hasRings || item.data.hasAccretionDisk) return;

            if (item.data.rotationSpeed) {
                if (item.data.isNebula || item.data.isGalaxy || item.data.isUniverse) {
                    item.mesh.rotation.z -= item.data.rotationSpeed * 0.5 * rotFactor;
                    item.mesh.rotation.x = 0;
                    item.mesh.rotation.y = 0;
                } else {
                    item.mesh.rotation.y += item.data.rotationSpeed * 0.5 * rotFactor;
                }
            }
        });
    }

}
class StarCycle {
    constructor(scene) {
        this.parentScene = scene;
        this.group = new THREE.Group();
        this.group.visible = false;
        
        this.ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        this.group.add(this.ambientLight);

        this.dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
        this.dirLight.position.set(50, 50, 50);
        this.group.add(this.dirLight);

        this.currentPhaseId = null;
        this.currentMesh = null;
        this.isAnimating = false;

        this.parentScene.add(this.group);

        document.getElementById('btn-sc-opt1').addEventListener('click', () => {
            if (document.getElementById('btn-sc-opt1').textContent === "Neu starten") {
                this.start();
                return;
            }
            if (this.currentPhaseId && starCycleData[this.currentPhaseId].options[0]) {
                this.transitionToPhase(starCycleData[this.currentPhaseId].options[0].id);
            }
        });
        document.getElementById('btn-sc-opt2').addEventListener('click', () => {
            if (this.currentPhaseId && starCycleData[this.currentPhaseId].options[1]) {
                this.transitionToPhase(starCycleData[this.currentPhaseId].options[1].id);
            }
        });
    }

    start() {
        this.currentPhaseId = 'gas_cloud';
        this.createPhaseMesh(this.currentPhaseId, true);
        this.updateUI();
    }

    createPhaseMesh(phaseId, instant = false) {
        const data = starCycleData[phaseId];
        const oldMesh = this.currentMesh;
        let newMesh;

        if (data.type === 'nebula') {
            const particleCount = 14000;
            const geom = new THREE.BufferGeometry();
            const pos = new Float32Array(particleCount * 3);
            const cols = new Float32Array(particleCount * 3);
            const cMagenta = new THREE.Color(0xd855aa);
            const cTeal = new THREE.Color(0x44ccff);
            const cGold = new THREE.Color(0xffbb66);
            for (let i = 0; i < particleCount; i++) {
                const r = Math.pow(Math.random(), 0.7) * 9.5;
                const theta = 2 * Math.PI * Math.random();
                const phi = Math.acos(2 * Math.random() - 1);
                const filament = Math.sin(theta * 3) * 1.4;
                pos[i * 3] = (r + filament) * Math.sin(phi) * Math.cos(theta);
                pos[i * 3 + 1] = (r * 0.75) * Math.sin(phi) * Math.sin(theta);
                pos[i * 3 + 2] = r * Math.cos(phi);
                const t = r / 9.5;
                const col = t < 0.35 ? cGold.clone().lerp(cTeal, t / 0.35) : cTeal.clone().lerp(cMagenta, (t - 0.35) / 0.65);
                cols[i * 3] = col.r; cols[i * 3 + 1] = col.g; cols[i * 3 + 2] = col.b;
            }
            geom.setAttribute('position', new THREE.BufferAttribute(pos, 3));
            geom.setAttribute('color', new THREE.BufferAttribute(cols, 3));
            const mat = new THREE.PointsMaterial({
                size: 0.38,
                map: getSoftParticleTexture(),
                vertexColors: true,
                transparent: true,
                opacity: 0,
                blending: THREE.AdditiveBlending,
                depthWrite: false
            });
            newMesh = new THREE.Points(geom, mat);
            newMesh.userData.isParticles = true;
        } else if (data.type === 'explosion') {
            newMesh = new THREE.Group();
            newMesh.userData.isExplosion = true;
            newMesh.userData.explosionTime = 0;

            const particleTex = getSoftParticleTexture();

            // 1. Central blast sphere
            const blastGeom = new THREE.SphereGeometry(1, 32, 32);
            const blastMat = new THREE.MeshBasicMaterial({
                color: 0xffffff, transparent: true, opacity: 1,
                blending: THREE.AdditiveBlending, depthWrite: false
            });
            const blastSphere = new THREE.Mesh(blastGeom, blastMat);
            blastSphere.scale.setScalar(0.5);
            newMesh.add(blastSphere);

            // 2. Inner glow shell
            const glowGeom = new THREE.SphereGeometry(1, 32, 32);
            const glowMat = new THREE.MeshBasicMaterial({
                color: 0xffaa33, transparent: true, opacity: 0.7,
                blending: THREE.AdditiveBlending, depthWrite: false
            });
            const glowSphere = new THREE.Mesh(glowGeom, glowMat);
            glowSphere.scale.setScalar(0.3);
            newMesh.add(glowSphere);

            // 3. Fast hot debris
            const hotCount = 12000;
            const hotGeom = new THREE.BufferGeometry();
            const hotPos = new Float32Array(hotCount * 3);
            const hotCols = new Float32Array(hotCount * 3);
            const hotVels = [];
            for (let i = 0; i < hotCount; i++) {
                const r = Math.random() * 1.5;
                const theta = 2 * Math.PI * Math.random();
                const phi = Math.acos(2 * Math.random() - 1);
                hotPos[i*3]   = r * Math.sin(phi) * Math.cos(theta);
                hotPos[i*3+1] = r * Math.sin(phi) * Math.sin(theta);
                hotPos[i*3+2] = r * Math.cos(phi);
                const speed = Math.random() * 0.6 + 0.2;
                const v = new THREE.Vector3(hotPos[i*3], hotPos[i*3+1], hotPos[i*3+2]).normalize().multiplyScalar(speed);
                hotVels.push(v);
                const t = Math.random();
                hotCols[i*3]   = 1.0;
                hotCols[i*3+1] = 0.7 + t * 0.3;
                hotCols[i*3+2] = 0.3 + t * 0.7;
            }
            hotGeom.setAttribute('position', new THREE.BufferAttribute(hotPos, 3));
            hotGeom.setAttribute('color', new THREE.BufferAttribute(hotCols, 3));
            const hotMat = new THREE.PointsMaterial({
                size: 0.35, vertexColors: true, transparent: true, opacity: 1,
                map: particleTex, blending: THREE.AdditiveBlending, depthWrite: false
            });
            const hotPoints = new THREE.Points(hotGeom, hotMat);
            newMesh.add(hotPoints);

            // 4. Medium debris
            const midCount = 10000;
            const midGeom = new THREE.BufferGeometry();
            const midPos = new Float32Array(midCount * 3);
            const midCols = new Float32Array(midCount * 3);
            const midVels = [];
            for (let i = 0; i < midCount; i++) {
                const r = Math.random() * 2.5;
                const theta = 2 * Math.PI * Math.random();
                const phi = Math.acos(2 * Math.random() - 1);
                midPos[i*3]   = r * Math.sin(phi) * Math.cos(theta);
                midPos[i*3+1] = r * Math.sin(phi) * Math.sin(theta);
                midPos[i*3+2] = r * Math.cos(phi);
                const speed = Math.random() * 0.35 + 0.08;
                const v = new THREE.Vector3(midPos[i*3], midPos[i*3+1], midPos[i*3+2]).normalize().multiplyScalar(speed);
                midVels.push(v);
                const t = Math.random();
                midCols[i*3]   = 1.0;
                midCols[i*3+1] = 0.15 + t * 0.45;
                midCols[i*3+2] = 0.0 + t * 0.1;
            }
            midGeom.setAttribute('position', new THREE.BufferAttribute(midPos, 3));
            midGeom.setAttribute('color', new THREE.BufferAttribute(midCols, 3));
            const midMat = new THREE.PointsMaterial({
                size: 0.28, vertexColors: true, transparent: true, opacity: 1,
                map: particleTex, blending: THREE.AdditiveBlending, depthWrite: false
            });
            const midPoints = new THREE.Points(midGeom, midMat);
            newMesh.add(midPoints);

            // 5. Slow outer debris
            const outerCount = 6000;
            const outerGeom = new THREE.BufferGeometry();
            const outerPos = new Float32Array(outerCount * 3);
            const outerCols = new Float32Array(outerCount * 3);
            const outerVels = [];
            for (let i = 0; i < outerCount; i++) {
                const r = Math.random() * 4;
                const theta = 2 * Math.PI * Math.random();
                const phi = Math.acos(2 * Math.random() - 1);
                outerPos[i*3]   = r * Math.sin(phi) * Math.cos(theta);
                outerPos[i*3+1] = r * Math.sin(phi) * Math.sin(theta);
                outerPos[i*3+2] = r * Math.cos(phi);
                const speed = Math.random() * 0.15 + 0.03;
                const v = new THREE.Vector3(outerPos[i*3], outerPos[i*3+1], outerPos[i*3+2]).normalize().multiplyScalar(speed);
                outerVels.push(v);
                const t = Math.random();
                outerCols[i*3]   = 0.7 + t * 0.3;
                outerCols[i*3+1] = 0.02 + t * 0.15;
                outerCols[i*3+2] = 0.01 + t * 0.05;
            }
            outerGeom.setAttribute('position', new THREE.BufferAttribute(outerPos, 3));
            outerGeom.setAttribute('color', new THREE.BufferAttribute(outerCols, 3));
            const outerMat = new THREE.PointsMaterial({
                size: 0.22, vertexColors: true, transparent: true, opacity: 0.9,
                map: particleTex, blending: THREE.AdditiveBlending, depthWrite: false
            });
            const outerPoints = new THREE.Points(outerGeom, outerMat);
            newMesh.add(outerPoints);

            // 6. Shockwave rings
            const ring1Geom = new THREE.RingGeometry(0.3, 1.2, 64);
            const ring1Mat = new THREE.MeshBasicMaterial({
                color: 0xffcc66, transparent: true, opacity: 0.9,
                side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false
            });
            const ring1 = new THREE.Mesh(ring1Geom, ring1Mat);
            ring1.rotation.x = Math.PI / 2;
            newMesh.add(ring1);

            const ring2Geom = new THREE.RingGeometry(0.2, 0.8, 64);
            const ring2Mat = new THREE.MeshBasicMaterial({
                color: 0xff6622, transparent: true, opacity: 0.7,
                side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false
            });
            const ring2 = new THREE.Mesh(ring2Geom, ring2Mat);
            ring2.rotation.x = Math.PI / 2 + 0.8;
            ring2.rotation.z = 0.5;
            newMesh.add(ring2);

            newMesh.userData.blastSphere = blastSphere;
            newMesh.userData.blastMat = blastMat;
            newMesh.userData.glowSphere = glowSphere;
            newMesh.userData.glowMat = glowMat;
            newMesh.userData.rings = [
                { mesh: ring1, mat: ring1Mat },
                { mesh: ring2, mat: ring2Mat }
            ];
            newMesh.userData.layers = [
                { points: hotPoints,   vels: hotVels,   mat: hotMat,   fadeDelay: 3.0, fadeSpeed: 0.003 },
                { points: midPoints,   vels: midVels,   mat: midMat,   fadeDelay: 2.5, fadeSpeed: 0.0025 },
                { points: outerPoints, vels: outerVels, mat: outerMat, fadeDelay: 5.0, fadeSpeed: 0.0015 }
            ];
        } else if (data.type === 'black_hole') {
            const geom = new THREE.SphereGeometry(2, 96, 96);
            const mat = new THREE.MeshBasicMaterial({ color: 0x000000 });
            newMesh = new THREE.Mesh(geom, mat);
            const diskGeom = new THREE.RingGeometry(2.3, 7.2, 128);
            fixRingUVs(diskGeom, 2.3, 7.2);
            const accTex = globalTextureLoader.load('textures/celestial/accretion_disk.png');
            accTex.colorSpace = THREE.SRGBColorSpace;
            applyTextureSharpness(accTex);
            const diskMat = new THREE.MeshBasicMaterial({
                map: accTex,
                color: 0xffffff,
                side: THREE.DoubleSide,
                transparent: true,
                opacity: 0.95,
                blending: THREE.AdditiveBlending,
                depthWrite: false
            });
            const disk = new THREE.Mesh(diskGeom, diskMat);
            disk.rotation.x = Math.PI / 2 + 0.18;
            newMesh.add(disk);

            // Gravitational Lensing vertical ring
            const lensGeom = new THREE.RingGeometry(2.05, 4.6, 96);
            fixRingUVs(lensGeom, 2.05, 4.6);
            const lensRing = new THREE.Mesh(lensGeom, diskMat.clone());
            lensRing.rotation.x = 0.12;
            newMesh.add(lensRing);

            newMesh.userData.isBlackHole = true;
        } else if (data.type === 'white_dwarf') {
            newMesh = new THREE.Group();
            const radius = data.scale || 0.7;

            // 1. Intense Blue-White Degenerate Core
            const coreGeom = new THREE.SphereGeometry(radius, 64, 64);
            const coreMat = new THREE.MeshStandardMaterial({
                color: 0xffffff,
                emissive: 0xaaddff,
                emissiveIntensity: 2.5,
                transparent: true,
                opacity: 0,
                roughness: 0.2
            });
            const coreMesh = new THREE.Mesh(coreGeom, coreMat);
            const coreGlow = new THREE.Sprite(new THREE.SpriteMaterial({
                map: getSoftParticleTexture(),
                color: 0xaaddff,
                transparent: true,
                opacity: 0.85,
                blending: THREE.AdditiveBlending,
                depthWrite: false
            }));
            coreGlow.scale.set(radius * 5.0, radius * 5.0, 1);
            coreMesh.add(coreGlow);
            newMesh.add(coreMesh);

            // 2. Surrounding 3D Planetary Nebula Shell (OIII teal inner + H-alpha magenta outer)
            const shellCount = 7000;
            const shellGeom = new THREE.BufferGeometry();
            const sPos = new Float32Array(shellCount * 3);
            const sCol = new Float32Array(shellCount * 3);
            const cInner = new THREE.Color(0x22f0cc);
            const cOuter = new THREE.Color(0xff44aa);
            for (let i = 0; i < shellCount; i++) {
                const isOuter = Math.random() > 0.55;
                const rBase = isOuter ? (3.8 + Math.random() * 2.2) : (2.0 + Math.random() * 1.8);
                const theta = Math.random() * Math.PI * 2;
                const phi = Math.acos(2 * Math.random() - 1);
                sPos[i * 3] = rBase * Math.sin(phi) * Math.cos(theta) * 1.25;
                sPos[i * 3 + 1] = rBase * Math.sin(phi) * Math.sin(theta);
                sPos[i * 3 + 2] = rBase * Math.cos(phi);
                const c = isOuter ? cOuter : cInner;
                sCol[i * 3] = c.r; sCol[i * 3 + 1] = c.g; sCol[i * 3 + 2] = c.b;
            }
            shellGeom.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
            shellGeom.setAttribute('color', new THREE.BufferAttribute(sCol, 3));
            const shellMat = new THREE.PointsMaterial({
                size: 0.28,
                map: getSoftParticleTexture(),
                vertexColors: true,
                transparent: true,
                opacity: 0,
                blending: THREE.AdditiveBlending,
                depthWrite: false
            });
            const shellPoints = new THREE.Points(shellGeom, shellMat);
            newMesh.add(shellPoints);

            newMesh.userData.isWhiteDwarf = true;
            newMesh.userData.coreMat = coreMat;
            newMesh.userData.shellMat = shellMat;
            newMesh.userData.shellPoints = shellPoints;
        } else if (data.type === 'neutron_star') {
            newMesh = new THREE.Group();
            const radius = data.scale || 0.8;
            
            // 1. Core
            const coreGeom = new THREE.SphereGeometry(radius, 64, 64);
            const coreMat = new THREE.MeshStandardMaterial({
                color: 0xffffff,
                emissive: 0x88ccff,
                emissiveIntensity: 3.0,
                transparent: true, opacity: 0,
                roughness: 0.1, metalness: 0.8
            });
            const coreMesh = new THREE.Mesh(coreGeom, coreMat);
            newMesh.add(coreMesh);
            
            // 2. Pulsar Jets (ConeGeometry)
            const beamHeight = radius * 20;
            const beamGeom = new THREE.ConeGeometry(radius * 0.5, beamHeight, 32, 1, true);
            beamGeom.translate(0, beamHeight / 2, 0);
            
            const beamMat = new THREE.MeshBasicMaterial({
                color: 0xaaddff,
                transparent: true, opacity: 0,
                blending: THREE.AdditiveBlending,
                side: THREE.DoubleSide,
                depthWrite: false
            });
            
            const beamTop = new THREE.Mesh(beamGeom, beamMat);
            const beamBottom = new THREE.Mesh(beamGeom, beamMat);
            beamBottom.rotation.x = Math.PI;
            
            newMesh.add(beamTop);
            newMesh.add(beamBottom);
            
            // 3. Magnetic Field Lines (Torus)
            const torusMat = new THREE.MeshBasicMaterial({
                color: 0xc888ff,
                transparent: true, opacity: 0,
                blending: THREE.AdditiveBlending,
                side: THREE.DoubleSide,
                depthWrite: false
            });
            
            const ringsParams = [
                { rad: radius * 3.0, thick: 0.05, rx: Math.PI/3, ry: 0 },
                { rad: radius * 4.0, thick: 0.03, rx: -Math.PI/4, ry: Math.PI/6 },
                { rad: radius * 5.0, thick: 0.02, rx: Math.PI/6, ry: -Math.PI/4 }
            ];
            
            ringsParams.forEach(p => {
                const tGeom = new THREE.TorusGeometry(p.rad, p.thick, 16, 128);
                const tMesh = new THREE.Mesh(tGeom, torusMat);
                tMesh.rotation.set(p.rx, p.ry, 0);
                newMesh.add(tMesh);
            });

            newMesh.rotation.z = Math.PI / 4; 
            newMesh.rotation.x = Math.PI / 12;

            newMesh.userData.isNeutronStar = true;
            newMesh.userData.coreMat = coreMat;
            newMesh.userData.beamMat = beamMat;
            newMesh.userData.torusMat = torusMat;
        } else {
            const radius = data.scale || 1;
            const geom = new THREE.SphereGeometry(radius, 96, 96);
            const tex = createProceduralSunTexture(data.color || 0xffffff);
            const mat = new THREE.MeshStandardMaterial({
                color: data.color || 0xffffff,
                emissive: data.color || 0xffffff,
                emissiveIntensity: 1.15, 
                transparent: true, opacity: 0
            });
            if (tex) { mat.map = tex; mat.emissiveMap = tex; }
            newMesh = new THREE.Mesh(geom, mat);

            // Add solar corona glow sprite
            const glowSprite = new THREE.Sprite(new THREE.SpriteMaterial({
                map: getSoftParticleTexture(),
                color: data.color || 0xffcc44,
                transparent: true,
                opacity: 0.52,
                blending: THREE.AdditiveBlending,
                depthWrite: false
            }));
            glowSprite.scale.set(radius * 3.2, radius * 3.2, 1);
            newMesh.add(glowSprite);
        }

        this.group.add(newMesh);
        this.currentMesh = newMesh;

        if (instant) {
            if (newMesh.userData && newMesh.userData.isNeutronStar) {
                newMesh.userData.coreMat.opacity = 1;
                newMesh.userData.beamMat.opacity = 0.6;
                newMesh.userData.torusMat.opacity = 0.3;
            } else if (newMesh.userData && newMesh.userData.isWhiteDwarf) {
                newMesh.userData.coreMat.opacity = 1;
                newMesh.userData.shellMat.opacity = 0.85;
            } else if (newMesh.userData && newMesh.userData.isExplosion) {
                // Explosion Group: layers are already at full opacity
            } else if (newMesh.material) {
                newMesh.material.opacity = 1;
            }
            if (oldMesh) { this.group.remove(oldMesh); }
            const targetZ = data.type === 'black_hole' ? 20 : (data.type === 'explosion' ? 18 : (data.scale ? Math.max(15, data.scale * 4) : 25));
            camera.position.z = targetZ;
        } else {
            this.isAnimating = true;

            if (data.type === 'explosion') {
                const flash1 = new THREE.PointLight(0xffffff, 30, 200);
                this.group.add(flash1);
                gsap.to(flash1, { intensity: 0, duration: 3, ease: "power2.out", onComplete: () => this.group.remove(flash1) });
                const flash2 = new THREE.PointLight(0xffaa33, 20, 150);
                this.group.add(flash2);
                gsap.to(flash2, { intensity: 0, duration: 5, ease: "power3.out", onComplete: () => this.group.remove(flash2) });
            }

            if (oldMesh) {
                if (oldMesh.userData && oldMesh.userData.isNeutronStar) {
                    gsap.to(oldMesh.userData.coreMat, { opacity: 0, duration: 1.5 });
                    gsap.to(oldMesh.userData.torusMat, { opacity: 0, duration: 1.5 });
                    gsap.to(oldMesh.userData.beamMat, { opacity: 0, duration: 1.5, onComplete: () => this.group.remove(oldMesh) });
                } else if (oldMesh.userData && oldMesh.userData.isWhiteDwarf) {
                    gsap.to(oldMesh.userData.coreMat, { opacity: 0, duration: 1.2 });
                    gsap.to(oldMesh.userData.shellMat, { opacity: 0, duration: 1.2, onComplete: () => this.group.remove(oldMesh) });
                } else if (oldMesh.userData && oldMesh.userData.isExplosion) {
                    if (oldMesh.userData.blastMat) gsap.to(oldMesh.userData.blastMat, { opacity: 0, duration: 0.8 });
                    if (oldMesh.userData.glowMat) gsap.to(oldMesh.userData.glowMat, { opacity: 0, duration: 0.8 });
                    oldMesh.userData.layers.forEach(l => gsap.to(l.mat, { opacity: 0, duration: 1.0 }));
                    oldMesh.userData.rings.forEach(r => gsap.to(r.mat, { opacity: 0, duration: 1.0 }));
                    setTimeout(() => this.group.remove(oldMesh), 1500);
                } else if (oldMesh.material) {
                    gsap.to(oldMesh.material, { opacity: 0, duration: 1.5, onComplete: () => this.group.remove(oldMesh) });
                } else { 
                    this.group.remove(oldMesh); 
                }
            }
            if (newMesh.userData && newMesh.userData.isNeutronStar) {
                gsap.to(newMesh.userData.coreMat, { opacity: 1, duration: 1.5 });
                gsap.to(newMesh.userData.torusMat, { opacity: 0.3, duration: 1.5 });
                gsap.to(newMesh.userData.beamMat, { opacity: 0.6, duration: 1.5, onComplete: () => { this.isAnimating = false; } });
            } else if (newMesh.userData && newMesh.userData.isWhiteDwarf) {
                gsap.to(newMesh.userData.coreMat, { opacity: 1, duration: 1.5 });
                gsap.to(newMesh.userData.shellMat, { opacity: 0.85, duration: 1.5, onComplete: () => { this.isAnimating = false; } });
            } else if (newMesh.userData && newMesh.userData.isExplosion) {
                setTimeout(() => { this.isAnimating = false; }, 1500);
            } else if (newMesh.material) {
                gsap.to(newMesh.material, { opacity: 1, duration: 1.5, onComplete: () => { this.isAnimating = false; } });
            } else {
                this.isAnimating = false;
            }

            const targetZ = data.type === 'black_hole' ? 20 : (data.type === 'explosion' ? 18 : (data.scale ? Math.max(15, data.scale * 4) : 25));
            gsap.to(camera.position, { z: targetZ, duration: 2, ease: "power2.inOut" });
        }
        
        if (data.type === 'black_hole') {
            this.playAstronautAnimation();
        }
    }

    transitionToPhase(phaseId) {
        if (this.isAnimating) return;
        this.currentPhaseId = phaseId;
        this.createPhaseMesh(phaseId, false);
        this.updateUI();
    }

    updateUI() {
        if (!this.currentPhaseId) return;
        const data = starCycleData[this.currentPhaseId];
        document.getElementById('sc-phase-name').textContent = data.name;
        document.getElementById('sc-phase-desc').textContent = data.texts[currentLevel] || data.texts.lvl10;
        
        const btn1 = document.getElementById('btn-sc-opt1');
        const btn2 = document.getElementById('btn-sc-opt2');
        
        if (data.options && data.options.length > 0) {
            btn1.textContent = data.options[0].label;
            btn1.classList.remove('hidden');
            if (data.options.length > 1) {
                btn2.textContent = data.options[1].label;
                btn2.classList.remove('hidden');
            } else {
                btn2.classList.add('hidden');
            }
        } else {
            btn1.textContent = "Neu starten";
            btn1.classList.remove('hidden');
            btn2.classList.add('hidden');
        }
    }

    playAstronautAnimation() {
        const astronaut = new THREE.Group();
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });
        const bodyGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.6, 16);
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        astronaut.add(body);
        const headGeo = new THREE.SphereGeometry(0.25, 16, 16);
        const headMat = new THREE.MeshStandardMaterial({ color: 0xffaa00, roughness: 0.1, metalness: 0.8 });
        const head = new THREE.Mesh(headGeo, headMat);
        head.position.y = 0.4;
        astronaut.add(head);

        astronaut.position.set(10, 5, 5);
        this.group.add(astronaut);

        gsap.to(astronaut.position, {
            x: 0, y: 0, z: 0,
            duration: 2.0,
            ease: "power3.in"
        });
        gsap.to(astronaut.rotation, {
            x: Math.PI * 8, y: Math.PI * 8, z: Math.PI * 8,
            duration: 2.0,
            ease: "power2.in"
        });

        setTimeout(() => {
            astronaut.scale.z = 0.01; // Briefmarke
            gsap.to(astronaut.position, {
                x: -15, y: -5, z: 10,
                duration: 3.0,
                ease: "power1.out"
            });
            astronaut.rotation.set(0, 0, 0);
            setTimeout(() => this.group.remove(astronaut), 4000);
        }, 2100);
    }

    update() {
        if (!this.group.visible || !this.currentMesh) return;
        const timeScale = (typeof window.appTimeScale === 'number' ? window.appTimeScale : 1) * 0.5;
        const rotFactor = typeof window.rotationSpeedFactor === 'number' ? window.rotationSpeedFactor : 1;

        if (this.currentMesh.userData.isParticles) {
            this.currentMesh.rotation.y += 0.001 * timeScale * rotFactor;
        } else if (this.currentMesh.userData.isExplosion) {
            this.currentMesh.userData.explosionTime += (1/60) * timeScale;
            const t = this.currentMesh.userData.explosionTime;

            // 1. Expand and fade the blast sphere (rapid growth)
            const blast = this.currentMesh.userData.blastSphere;
            const blastMat = this.currentMesh.userData.blastMat;
            if (blast && blastMat.opacity > 0) {
                const blastScale = 0.5 + t * 8;
                blast.scale.setScalar(blastScale);
                blastMat.opacity = Math.max(0, 1.0 - t * 0.4);
                // Color shifts from white → yellow → orange as it expands
                const r = 1.0;
                const g = Math.max(0.3, 1.0 - t * 0.15);
                const b = Math.max(0.0, 1.0 - t * 0.5);
                blastMat.color.setRGB(r, g, b);
            }

            // 2. Expand the inner glow (slightly slower)
            const glow = this.currentMesh.userData.glowSphere;
            const glowMat = this.currentMesh.userData.glowMat;
            if (glow && glowMat.opacity > 0) {
                const glowScale = 0.3 + t * 5;
                glow.scale.setScalar(glowScale);
                glowMat.opacity = Math.max(0, 0.7 - t * 0.2);
            }

            // 3. Move all particle layers outward
            this.currentMesh.userData.layers.forEach(layer => {
                const pos = layer.points.geometry.attributes.position.array;
                const vels = layer.vels;
                for (let i = 0; i < vels.length; i++) {
                    pos[i*3]   += vels[i].x * timeScale;
                    pos[i*3+1] += vels[i].y * timeScale;
                    pos[i*3+2] += vels[i].z * timeScale;
                }
                layer.points.geometry.attributes.position.needsUpdate = true;

                if (t > layer.fadeDelay && layer.mat.opacity > 0) {
                    layer.mat.opacity = Math.max(0, layer.mat.opacity - layer.fadeSpeed * timeScale);
                }
            });

            // 4. Expand and fade shockwave rings
            this.currentMesh.userData.rings.forEach(ring => {
                ring.mesh.scale.x += 0.12 * timeScale;
                ring.mesh.scale.y += 0.12 * timeScale;
                ring.mesh.scale.z += 0.12 * timeScale;
                if (t > 1.0 && ring.mat.opacity > 0) {
                    ring.mat.opacity = Math.max(0, ring.mat.opacity - 0.004 * timeScale);
                }
            });
        } else if (this.currentMesh.userData.isNeutronStar) {
            this.currentMesh.rotation.y += 0.04 * timeScale * rotFactor;
        } else if (this.currentMesh.userData.isWhiteDwarf) {
            this.currentMesh.rotation.y += 0.008 * timeScale * rotFactor;
            if (this.currentMesh.userData.shellPoints) {
                this.currentMesh.userData.shellPoints.rotation.y -= 0.003 * timeScale * rotFactor;
                this.currentMesh.userData.shellPoints.rotation.z += 0.002 * timeScale * rotFactor;
            }
        } else {
            this.currentMesh.rotation.y += (this.currentMesh.userData.isBlackHole ? 0.05 : 0.005) * timeScale * rotFactor;
            if (this.currentMesh.children[0]) {
                this.currentMesh.children[0].rotation.z += 0.02 * timeScale * rotFactor;
            }
        }
    }

    show() {
        this.group.visible = true;
        if (!this.currentPhaseId) {
            this.start();
        } else {
            this.updateUI();
        }
        gsap.to(camera.position, { x: 0, y: 0, z: this.currentMesh && this.currentMesh.userData.isBlackHole ? 20 : (starCycleData[this.currentPhaseId].scale ? Math.max(15, starCycleData[this.currentPhaseId].scale * 4) : 25), duration: 1.5, ease: "power2.inOut" });
        gsap.to(controls.target, { x: 0, y: 0, z: 0, duration: 1.5, ease: "power2.inOut" });
    }

    hide() {
        this.group.visible = false;
    }
}

class RocketLaunch {
    constructor(scene) {
        this.parentScene = scene;
        this.group = new THREE.Group();
        this.group.visible = false;
        
        this.simulationTime = 0;
        this.timeScale = 0;
        this.isPlaying = false;
        this.isLaunched = false;
        this.countdownValue = 5;
        this.isStaging1Done = false;
        this.isStaging2Done = false;
        this.isLanded = false;

        this.rocket = new THREE.Group();
        this.shuttle = null;
        this.tank = null;
        this.boosterL = null;
        this.boosterR = null;
        this.mixer = null;
        
        this.particles = [];
        this.particlePool = [];
        this.specificLights = [];
        
        this.worldGroup = new THREE.Group();
        this.group.add(this.worldGroup);
        
        this.initScene();
        this.loadModels();
        
        this.parentScene.add(this.group);
        this.setupEventListeners();
    }

    initScene() {
        const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || window.innerWidth < 768;

        // Directional Light - shadows only on desktop (expensive on mobile GPUs)
        const shipLight = new THREE.DirectionalLight(0xffffff, 2.0);
        shipLight.position.set(20, 50, 20);
        if (!isMobile) {
            shipLight.castShadow = true;
            shipLight.shadow.mapSize.width = 1024;
            shipLight.shadow.mapSize.height = 1024;
        }
        this.group.add(shipLight);
        this.specificLights.push(shipLight);

        // Soft fill light from the opposite side
        const fillLight = new THREE.DirectionalLight(0xaaccff, 0.6);
        fillLight.position.set(-15, 10, -10);
        this.group.add(fillLight);
        this.specificLights.push(fillLight);

        // Hemisphere light for gentle ambient fill (sky + ground)
        const hemiLight = new THREE.HemisphereLight(0xbbccdd, 0x333333, 0.6);
        this.group.add(hemiLight);
        this.specificLights.push(hemiLight);

        const ambient = new THREE.AmbientLight(0xffffff, 0.5);
        this.group.add(ambient);
        this.specificLights.push(ambient);

        this._isMobile = isMobile;

        // Planet Creation (High-Resolution Earth & Mars surfaces for launchpad & landing)
        const earthData = planetData.earth;
        const marsData = planetData.mars;

        if (earthData) {
            this.earth = createCelestialBody({ ...earthData, disableClouds: true, hasAtmosphere: false });
            this.earthRadius = earthData.radius * 200; 
            this.earth.scale.setScalar(this.earthRadius);
            this.earth.position.y = -this.earthRadius;
            // Position Germany at the top
            this.earth.rotation.x = 0.5; 
            this.earth.rotation.y = 4.4; 
            this.worldGroup.add(this.earth);
        }

        if (marsData) {
            this.mars = createCelestialBody({ ...marsData, hasAtmosphere: false });
            this.marsRadius = marsData.radius * 150;
            this.mars.scale.setScalar(this.marsRadius);
            // Position Mars center at 50000 + marsRadius so its UNDERSIDE (bottom surface) is at y = 50000
            this.mars.position.set(0, 50000 + this.marsRadius, 0); 
            this.worldGroup.add(this.mars);
        }

        // Hyperrealistic Spherical Starfield
        const starGeo = new THREE.BufferGeometry();
        const starCount = perfManager.isLowPerf ? 1000 : (isMobile ? 3000 : 10000);
        const positions = new Float32Array(starCount * 3);
        for(let i=0; i<starCount*3; i+=3) {
            const radius = 80000 + Math.random() * 20000;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            
            positions[i] = radius * Math.sin(phi) * Math.cos(theta);
            positions[i+1] = radius * Math.sin(phi) * Math.sin(theta);
            positions[i+2] = radius * Math.cos(phi);
        }
        starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        const starMat = new THREE.PointsMaterial({ size: 1.8, color: 0xffffff, transparent: true, opacity: 0.9 });
        this.stars = new THREE.Points(starGeo, starMat);
        this.group.add(this.stars);
    }

    getPlumeConeTexture(isCryo = false) {
        const key = isCryo ? '_plumeTexCryo' : '_plumeTexSolid';
        if (this[key]) return this[key];
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');
        const imgData = ctx.createImageData(128, 256);
        const d = imgData.data;
        for (let y = 0; y < 256; y++) {
            const v = y / 255; // 0 = nozzle exit (top of cone base), 1 = flame tip (bottom)
            // Mach shock-diamond modulation along plume length
            const mach = 0.78 + 0.22 * Math.pow(Math.max(0, Math.cos(v * Math.PI * 7.0)), 2) * (1 - v * 0.7);
            const axialAlpha = Math.pow(1 - v, 1.35) * mach;
            for (let x = 0; x < 128; x++) {
                const u = Math.abs((x - 63.5) / 63.5); // 0 = center axis, 1 = edge
                const radial = Math.pow(Math.max(0, 1 - u), 1.6);
                const intensity = Math.min(1, axialAlpha * radial * 1.35);
                let r, g, b;
                if (isCryo) {
                    // Cryogenic SSME: brilliant white-cyan core transitioning to golden-blue plasma
                    r = Math.min(255, Math.floor(255 * Math.pow(intensity, 0.7) * (1 - v * 0.25) + 90 * (1 - v)));
                    g = Math.min(255, Math.floor(245 * Math.pow(intensity, 0.85) * (1 - v * 0.35) + 60 * (1 - v)));
                    b = Math.min(255, Math.floor(255 * Math.pow(intensity, 0.55)));
                } else {
                    // Solid Booster / Main Flame: blinding white-yellow core -> intense orange -> deep red tip
                    r = Math.min(255, Math.floor(255 * Math.pow(intensity, 0.45)));
                    g = Math.min(255, Math.floor(255 * Math.pow(intensity, 1.15) * (1 - v * 0.55)));
                    b = Math.min(255, Math.floor(240 * Math.pow(intensity, 2.6) * (1 - v * 0.85)));
                }
                const alpha = Math.min(255, Math.floor(intensity * 255));
                const idx = (y * 128 + x) * 4;
                d[idx] = r;
                d[idx + 1] = g;
                d[idx + 2] = b;
                d[idx + 3] = alpha;
            }
        }
        ctx.putImageData(imgData, 0, 0);
        const tex = new THREE.CanvasTexture(canvas);
        this[key] = tex;
        return tex;
    }

    createNozzlePlume(radius, length, isCryo = false) {
        const plume = new THREE.Group();
        const tex = this.getPlumeConeTexture(isCryo);

        // Outer turbulent supersonic flame cone (base at y=0, tip pointing down to y=-length)
        const outerGeo = new THREE.ConeGeometry(radius, length, 24, 1, true);
        outerGeo.rotateX(Math.PI); // Flip so wide base is at y=+length/2 and tip is at y=-length/2
        outerGeo.translate(0, -length * 0.5, 0);
        const outerMat = new THREE.MeshBasicMaterial({
            map: tex,
            transparent: true,
            opacity: 0.95,
            blending: THREE.AdditiveBlending,
            side: THREE.DoubleSide,
            depthWrite: false
        });
        const outerCone = new THREE.Mesh(outerGeo, outerMat);
        plume.add(outerCone);

        // Inner white-hot Mach shock core
        const innerLen = length * 0.58;
        const innerGeo = new THREE.ConeGeometry(radius * 0.52, innerLen, 20, 1, true);
        innerGeo.rotateX(Math.PI);
        innerGeo.translate(0, -innerLen * 0.5, 0);
        const innerMat = new THREE.MeshBasicMaterial({
            map: tex,
            color: isCryo ? 0xdff8ff : 0xfff6cc,
            transparent: true,
            opacity: 1.0,
            blending: THREE.AdditiveBlending,
            side: THREE.DoubleSide,
            depthWrite: false
        });
        const innerCone = new THREE.Mesh(innerGeo, innerMat);
        plume.add(innerCone);

        // Bright nozzle exit glare sprite
        const glowMat = new THREE.SpriteMaterial({
            map: getSoftParticleTexture(),
            color: isCryo ? 0x88ddff : 0xffaa33,
            transparent: true,
            opacity: 0.9,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        const glowSprite = new THREE.Sprite(glowMat);
        glowSprite.scale.set(radius * 4.2, radius * 4.2, 1);
        glowSprite.position.set(0, -radius * 0.3, 0);
        plume.add(glowSprite);

        plume.userData = { outerCone, innerCone, glowSprite, baseLength: length, baseRadius: radius };
        plume.visible = false;
        return plume;
    }

    setupEnginePlumes() {
        if (this.plumeGroup && this.plumeGroup.parent) {
            this.plumeGroup.parent.remove(this.plumeGroup);
        }
        this.plumeGroup = new THREE.Group();
        this.rocket.add(this.plumeGroup);

        // 1. Left & Right SRB Plumes (at bottom of Hilfstriebwerk: x = ±1.8, y = -1.5, z = 0)
        this.plumeSRBL = this.createNozzlePlume(0.68, 6.2, false);
        this.plumeSRBL.position.set(-1.8, -1.45, 0);
        this.plumeGroup.add(this.plumeSRBL);

        this.plumeSRBR = this.createNozzlePlume(0.68, 6.2, false);
        this.plumeSRBR.position.set(1.8, -1.45, 0);
        this.plumeGroup.add(this.plumeSRBR);

        // 2. Central Tank / Main Booster Plume (at x = 0, y = -0.1, z = 0)
        this.plumeTank = this.createNozzlePlume(0.82, 5.4, false);
        this.plumeTank.position.set(0, -0.05, 0);
        this.plumeGroup.add(this.plumeTank);

        // 3. Space Shuttle SSME / OMS 3-Nozzle Cluster (at tail of Shuttle: x = 0, y = 1.5, z = 1.05)
        this.plumeShuttle = this.createNozzlePlume(0.58, 4.2, true);
        this.plumeShuttle.position.set(0, 1.5, 1.05);
        this.plumeGroup.add(this.plumeShuttle);

        // 4. Dynamic Engine PointLight illuminating the rocket base & launchpad
        this.engineLight = new THREE.PointLight(0xff8822, 0, 50);
        this.engineLight.position.set(0, -2.2, 0.6);
        this.plumeGroup.add(this.engineLight);
    }

    updateEnginePlumes() {
        if (!this.plumeGroup) return;
        const activeBurn = this.isLaunched && this.simulationTime > 0 && this.simulationTime < 44.6 && this.timeScale !== 0;
        if (!activeBurn) {
            if (this.plumeSRBL) this.plumeSRBL.visible = false;
            if (this.plumeSRBR) this.plumeSRBR.visible = false;
            if (this.plumeTank) this.plumeTank.visible = false;
            if (this.plumeShuttle) this.plumeShuttle.visible = false;
            if (this.engineLight) this.engineLight.intensity = 0;
            return;
        }

        const t = performance.now() * 0.001;
        // Smooth throttle-down between t=40 and t=44.6 during final Mars docking approach
        const throttle = this.simulationTime > 40
            ? Math.max(0, 1 - (this.simulationTime - 40) / 4.6)
            : 1.0;

        const animatePlume = (plume, visible, phaseOffset, powerScale = 1.0) => {
            if (!plume) return;
            plume.visible = visible && powerScale > 0.02;
            if (!plume.visible) return;
            const flickerY = (0.88 + 0.24 * Math.sin(t * 58 + phaseOffset) + 0.12 * Math.cos(t * 93)) * powerScale;
            const flickerXZ = (0.94 + 0.12 * Math.sin(t * 47 + phaseOffset)) * Math.sqrt(powerScale);
            plume.scale.set(flickerXZ, flickerY, flickerXZ);
            plume.rotation.y = t * 14 + phaseOffset;
        };

        const srbActive = !this.isStaging1Done && this.simulationTime < 10;
        const tankActive = !this.isStaging2Done && this.simulationTime < 15;

        animatePlume(this.plumeSRBL, srbActive, 0.0, 1.0);
        animatePlume(this.plumeSRBR, srbActive, 1.7, 1.0);
        animatePlume(this.plumeTank, tankActive, 3.1, 1.0);
        animatePlume(this.plumeShuttle, true, 4.5, throttle);

        if (this.engineLight) {
            const baseIntensity = srbActive ? 4.5 : (tankActive ? 3.2 : 2.2 * throttle);
            this.engineLight.intensity = baseIntensity * (0.85 + 0.3 * Math.random());
            this.engineLight.color.setHex(srbActive || tankActive ? 0xff8822 : 0x88ccff);
        }
    }

    loadModels() {
        const assetPath = 'Assets/';
        const progressBar = document.getElementById('rocket-progress-fill');
        const loadingContainer = document.getElementById('rocket-loading-container');
        const startBtn = document.getElementById('btn-start-countdown');

        const assembleRocket = (shuttleGltf, tankGltf, boosterGltf) => {
            while (this.rocket.children.length > 0) {
                this.rocket.remove(this.rocket.children[0]);
            }

            this.shuttle = shuttleGltf.scene.clone(true);
            this.tank = tankGltf.scene.clone(true);
            
            this.tank.scale.setScalar(12.0); 
            this.tank.position.set(0, 0, 0);
            this.shuttle.scale.setScalar(10.0); 
            this.shuttle.position.set(0, 1.5, 1.1);
            
            if (shuttleGltf.animations && shuttleGltf.animations.length > 0) {
                this.mixer = new THREE.AnimationMixer(this.shuttle);
                this.landingGearAction = this.mixer.clipAction(shuttleGltf.animations[0]);
                this.landingGearAction.setLoop(THREE.LoopOnce);
                this.landingGearAction.clampWhenFinished = true;
            }

            const fixMaterialsForMobile = (obj) => {
                obj.traverse((child) => {
                    if (child.isMesh && child.material) {
                        const mats = Array.isArray(child.material) ? child.material : [child.material];
                        mats.forEach(mat => {
                            if (mat.isMeshStandardMaterial || mat.isMeshPhysicalMaterial) {
                                if (mat.map) {
                                    mat.map.colorSpace = THREE.SRGBColorSpace;
                                    if (THREE.sRGBEncoding) mat.map.encoding = THREE.sRGBEncoding;
                                    applyTextureSharpness(mat.map);
                                }
                                if (!mat.emissive || mat.emissive.getHex() === 0x000000) {
                                    mat.emissive = mat.color ? mat.color.clone().multiplyScalar(0.05) : new THREE.Color(0x111111);
                                    mat.emissiveIntensity = 1.0;
                                }
                                mat.needsUpdate = true;
                            }
                        });
                    }
                });
            };

            fixMaterialsForMobile(this.shuttle);
            fixMaterialsForMobile(this.tank);

            this.rocket.add(this.tank);
            this.rocket.add(this.shuttle);
            
            this.boosterL = boosterGltf.scene.clone(true);
            this.boosterL.position.set(-1.8, -1.5, 0);
            this.boosterL.scale.setScalar(10.0); 
            this.rocket.add(this.boosterL);
            
            this.boosterR = boosterGltf.scene.clone(true);
            this.boosterR.position.set(1.8, -1.5, 0);
            this.boosterR.scale.setScalar(10.0); 
            this.rocket.add(this.boosterR);

            fixMaterialsForMobile(this.boosterL);
            fixMaterialsForMobile(this.boosterR);

            this.setupEnginePlumes();
            
            this.rocket.scale.set(1.5, 1.5, 1.5); 
            this.rocket.position.set(0, 1, 0);
            this.rocket.visible = true;
            if (this.rocket.parent !== this.group) {
                this.group.add(this.rocket);
            }

            spaceLoader.setProgress(100, '3D-Modelle bereit');
            if (progressBar) progressBar.style.width = '100%';
            if (loadingContainer) loadingContainer.classList.add('hidden');
            if (startBtn) startBtn.classList.remove('hidden');
        };

        if (cachedRocketGltfs) {
            assembleRocket(cachedRocketGltfs.shuttle, cachedRocketGltfs.tank, cachedRocketGltfs.booster);
            return;
        }

        spaceLoader.show('Lade 3D-Modelle: Spaceshuttle & Antriebe...', '🚀');
        if (loadingContainer) loadingContainer.classList.remove('hidden');
        if (startBtn) startBtn.classList.add('hidden');

        const loader = new THREE.GLTFLoader();
        const dracoLoader = new THREE.DRACOLoader();
        dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.4.1/');
        loader.setDRACOLoader(dracoLoader);

        const modelProgress = { shuttle: 0, tank: 0, booster: 0 };
        const updateProgress = (key, percent, statusLabel) => {
            modelProgress[key] = percent;
            const totalPercent = Math.min(99, (modelProgress.shuttle + modelProgress.tank + modelProgress.booster) / 3);
            spaceLoader.setProgress(totalPercent, statusLabel || 'Lade 3D-Modelle: Spaceshuttle & Antriebe...');
            if (progressBar) progressBar.style.width = totalPercent + '%';
        };

        const loadModel = (filename, key) => {
            return new Promise((resolve, reject) => {
                loader.load(
                    assetPath + filename,
                    (gltf) => {
                        updateProgress(key, 100, 'Entpacke & baue 3D-Rakete zusammen...');
                        resolve(gltf);
                    },
                    (xhr) => {
                        if (xhr.lengthComputable && xhr.total > 0) {
                            const p = Math.min(88, (xhr.loaded / xhr.total) * 88);
                            const label = p >= 85
                                ? 'Entpacke 3D-Geometrie (Draco)...'
                                : 'Lade 3D-Modelle: Spaceshuttle & Antriebe...';
                            updateProgress(key, p, label);
                        }
                    },
                    (err) => {
                        console.error(`Failed to load ${filename}:`, err);
                        reject(err);
                    }
                );
            });
        };

        Promise.all([
            loadModel('Spaceshuttle.glb', 'shuttle'),
            loadModel('Traegerrakete.glb', 'tank'),
            loadModel('Hilfstriebwerk.glb', 'booster')
        ]).then(([shuttleGltf, tankGltf, boosterGltf]) => {
            cachedRocketGltfs = { shuttle: shuttleGltf, tank: tankGltf, booster: boosterGltf };
            if (!this.disposed) {
                assembleRocket(shuttleGltf, tankGltf, boosterGltf);
            } else {
                spaceLoader.hide();
            }
        }).catch(err => {
            console.error("Critical error loading 3D rocket models:", err);
            spaceLoader.setProgress(100, 'Fehler beim Laden');
            const label = document.querySelector('.loading-label');
            if (label) label.textContent = "Fehler beim Laden der 3D-Modelle.";
        });
    }

    setupEventListeners() {
        document.getElementById('btn-start-countdown').onclick = () => this.startCountdown();
        document.getElementById('btn-rocket-playpause').onclick = () => this.togglePlay();
        document.getElementById('btn-rocket-reset').onclick = () => this.reset();
        
        const rewindBtn = document.getElementById('btn-rocket-rewind');
        const ffBtn = document.getElementById('btn-rocket-fastforward');
        
        const setTS = (val) => this.timeScale = val;
        const resetTS = () => this.timeScale = this.isPlaying ? 1 : 0;

        rewindBtn.onmousedown = () => setTS(-5);
        rewindBtn.onmouseup = resetTS;
        ffBtn.onmousedown = () => setTS(5);
        ffBtn.onmouseup = resetTS;
        
        rewindBtn.ontouchstart = (e) => { e.preventDefault(); setTS(-5); };
        rewindBtn.ontouchend = resetTS;
        ffBtn.ontouchstart = (e) => { e.preventDefault(); setTS(5); };
        ffBtn.ontouchend = resetTS;
    }

    startCountdown() {
        const initPanel = document.getElementById('rocket-launch-init');
        if (initPanel) initPanel.classList.add('hidden');
        
        const countdownEl = document.getElementById('rocket-countdown');
        if (countdownEl) {
            countdownEl.classList.remove('hidden');
            this.countdownValue = 5;
            countdownEl.textContent = this.countdownValue;
            
            const timer = setInterval(() => {
                this.countdownValue--;
                if (this.countdownValue <= 0) {
                    clearInterval(timer);
                    countdownEl.textContent = "Abflug!";
                    setTimeout(() => countdownEl.classList.add('hidden'), 1000);
                    this.launch();
                } else {
                    countdownEl.textContent = this.countdownValue;
                }
            }, 1000);
        } else {
            this.launch();
        }
    }

    launch() {
        this.isLaunched = true;
        this.isPlaying = true;
        this.timeScale = 1;
        document.getElementById('rocket-controls').classList.remove('hidden');
        this.updatePlayPauseUI();
        const timerEl = document.getElementById('rocket-timer');
        if (timerEl) timerEl.classList.remove('hidden');
    }

    togglePlay() {
        this.isPlaying = !this.isPlaying;
        this.timeScale = this.isPlaying ? 1 : 0;
        this.updatePlayPauseUI();
    }

    updatePlayPauseUI() {
        const play = document.getElementById('rocket-play-icon');
        const pause = document.getElementById('rocket-pause-icon');
        if (this.isPlaying) { play.classList.add('hidden'); pause.classList.remove('hidden'); }
        else { play.classList.remove('hidden'); pause.classList.add('hidden'); }
    }

    reset() {
        this.simulationTime = 0;
        this.isLaunched = false;
        this.isPlaying = false;
        this.timeScale = 0;
        this.isStaging1Done = false;
        this.isStaging2Done = false;
        this.isLanded = false;
        
        if (this.mixer) this.mixer.stopAllAction();
        if (this.shuttle) {
            this.rocket.add(this.shuttle);
            this.shuttle.position.set(0, 1.5, 1.1);
            this.shuttle.rotation.set(0, 0, 0);
            this.shuttle.visible = true;
        }
        if (this.tank) { 
            this.rocket.add(this.tank); 
            this.tank.visible = true; 
            this.tank.position.set(0,0,0); 
            this.tank.rotation.set(0,0,0); 
        }
        if (this.boosterL) { 
            this.rocket.add(this.boosterL); 
            this.boosterL.visible = true; 
            this.boosterL.position.set(-1.8,-1.5,0); 
            this.boosterL.rotation.set(0,0,0); 
        }
        if (this.boosterR) { 
            this.rocket.add(this.boosterR); 
            this.boosterR.visible = true; 
            this.boosterR.position.set(1.8,-1.5,0); 
            this.boosterR.rotation.set(0,0,0); 
        }
        
        this.rocket.position.set(0, 1, 0);
        this.rocket.rotation.set(0, 0, 0);
        this.worldGroup.position.set(0, 0, 0);
        this.updateEnginePlumes();

        if (this.particles && this.particles.length > 0) {
            for (let i = this.particles.length - 1; i >= 0; i--) {
                const p = this.particles[i];
                p.visible = false;
                this.particlePool.push(p);
            }
            this.particles.length = 0;
        }
        
        if (this.earth) {
            this.earth.position.set(0, -this.earthRadius, 0);
            this.earth.rotation.x = 0.5;
            this.earth.rotation.y = 4.4;
        }
        if (this.mars) this.mars.position.set(0, 50000 + (this.marsRadius || 105), 0);
        if (this.marsSurface) this.marsSurface.visible = false;
        
        const loadingContainer = document.getElementById('rocket-loading-container');
        const startBtn = document.getElementById('btn-start-countdown');
        if (this.shuttle) {
            if (loadingContainer) loadingContainer.classList.add('hidden');
            if (startBtn) startBtn.classList.remove('hidden');
        } else {
            if (loadingContainer) loadingContainer.classList.remove('hidden');
            if (startBtn) startBtn.classList.add('hidden');
        }

        document.getElementById('rocket-controls').classList.add('hidden');
        document.getElementById('rocket-launch-init').classList.remove('hidden');
        document.getElementById('rocket-timer').classList.add('hidden');
        this.updatePlayPauseUI();
        
        sanitizeCameraAndControls({ x: 20, y: 10, z: 50 }, { x: 0, y: 5, z: 0 });
        if (typeof gsap !== 'undefined') {
            gsap.killTweensOf(camera.position);
            gsap.killTweensOf(controls.target);
            gsap.to(camera.position, { x: 20, y: 10, z: 50, duration: 1.5 });
            gsap.to(controls.target, { x: 0, y: 5, z: 0, duration: 1.5 });
        } else {
            camera.position.set(20, 10, 50);
            controls.target.set(0, 5, 0);
        }
        controls.update();
    }

    update(dt) {
        if (!this.group.visible || !this.shuttle) return;
        dt *= 0.5;

        if (this.mixer) this.mixer.update(dt * this.timeScale);

        if (this.isLaunched || this.timeScale !== 0) {
            this.simulationTime += dt * this.timeScale;
            if (this.simulationTime < 0) this.simulationTime = 0;
            if (this.simulationTime >= 45) {
                this.simulationTime = 45;
                if (this.timeScale > 0) {
                    this.isLanded = true;
                }
            } else {
                this.isLanded = false;
            }

            // Smooth monotonic C2 quintic trajectory from Earth launchpad (h=0) to Mars underside docking (targetH=49998.7)
            // Mars center is at 50000 + marsRadius, so its bottom pole (Unterseite) is at y = 50000 in worldGroup.
            // At h = 49998.7, Mars underside is at world y = 1.3, flush with the horizontal Shuttle's belly (y = 1.3).
            const targetH = 49998.7;
            const u = Math.max(0, Math.min(1, this.simulationTime / 45));
            const smoothTrajectory = u * u * u * (10 - 15 * u + 6 * u * u);
            const h = targetH * smoothTrajectory;
            this.worldGroup.position.y = -h;

            // Smooth turnover & centering under Mars bottom pole so Shuttle belly docks flush without overshooting
            if (this.simulationTime <= 25) {
                this.rocket.rotation.x = 0;
                this.rocket.position.set(0, 1, 0);
            } else {
                const tiltProgress = Math.max(0, Math.min(1, (this.simulationTime - 25) / 13));
                const smoothTilt = tiltProgress * tiltProgress * (3 - 2 * tiltProgress);
                this.rocket.rotation.x = smoothTilt * (Math.PI / 2);
                // Shift z to -10.5 as it rotates 90° so the Shuttle's fuselage center sits directly at (x=0, z=0) under Mars's bottom apex
                this.rocket.position.set(0, 1, -smoothTilt * 10.5);

                if (tiltProgress > 0.6 && this.landingGearAction && !this.landingGearAction.isRunning()) {
                    this.landingGearAction.play();
                }
            }

            if (this.simulationTime >= 10 && !this.isStaging1Done) {
                this.isStaging1Done = true;
                this.separatePart(this.boosterL);
                this.separatePart(this.boosterR);
            } else if (this.simulationTime < 10 && this.isStaging1Done) {
                this.isStaging1Done = false;
                this.reattachPart(this.boosterL, new THREE.Vector3(-1.8, -1.5, 0));
                this.reattachPart(this.boosterR, new THREE.Vector3(1.8, -1.5, 0));
            }

            if (this.simulationTime >= 15 && !this.isStaging2Done) {
                this.isStaging2Done = true;
                this.separatePart(this.tank);
            } else if (this.simulationTime < 15 && this.isStaging2Done) {
                this.isStaging2Done = false;
                this.reattachPart(this.tank, new THREE.Vector3(0, 0, 0));
            }

            if (this.simulationTime > 0 && this.simulationTime < 6) {
                const s = (6 - this.simulationTime) * 0.05;
                camera.position.x += (Math.random() - 0.5) * s;
                camera.position.y += (Math.random() - 0.5) * s;
            }
            
            this.updateFallingParts(dt);
            this.updateTimerUI();
        }
        this.updateEnginePlumes();
        this.updateParticles(dt);
    }

    updateTimerUI() {
        const timerContainer = document.getElementById('rocket-timer');
        const timerSpan = document.getElementById('rocket-timer-countdown');
        if (!timerContainer || !timerSpan) return;
        
        if (this.isLaunched) timerContainer.classList.remove('hidden');
        
        const timeLeft = Math.max(0, 45 - Math.floor(this.simulationTime));
        const minutes = Math.floor(timeLeft / 60);
        const seconds = timeLeft % 60;
        
        const minStr = minutes.toString().padStart(2, '0');
        const secStr = seconds.toString().padStart(2, '0');
        
        timerSpan.textContent = `${minStr}:${secStr}`;
    }

    separatePart(part) {
        if (!part) return;
        const wp = new THREE.Vector3(); part.getWorldPosition(wp);
        const wq = new THREE.Quaternion(); part.getWorldQuaternion(wq);
        this.group.add(part);
        part.position.copy(wp);
        part.quaternion.copy(wq);
        part.userData.isFalling = true;
        part.userData.fallVel = new THREE.Vector3((part.position.x > 0 ? 0.3 : -0.3), -0.5, 0);
        part.userData.rotVel = new THREE.Vector3(Math.random()*0.02, Math.random()*0.02, Math.random()*0.02);
    }

    reattachPart(part, lpos) {
        if (!part) return;
        part.userData.isFalling = false;
        this.rocket.add(part);
        part.position.copy(lpos);
        part.rotation.set(0, 0, 0);
        part.visible = true;
    }

    updateFallingParts(dt) {
        [this.boosterL, this.boosterR, this.tank].forEach(p => {
            if (p && p.userData.isFalling) {
                p.position.addScaledVector(p.userData.fallVel, dt * 10 * Math.abs(this.timeScale));
                p.rotation.x += p.userData.rotVel.x * this.timeScale;
                p.userData.fallVel.y -= dt * 9.81 * 2 * Math.abs(this.timeScale);
                if (p.position.y < -500) p.visible = false;
            }
        });
    }

    updateParticles(dt) {
        if (!this.createParticle) {
            this._maxParticles = perfManager.isLowPerf ? 35 : (this._isMobile ? 60 : 160);
            const softTex = getSoftParticleTexture();
            this.createParticle = () => {
                if (this.particlePool.length > 0) {
                    const p = this.particlePool.pop();
                    p.visible = true;
                    return p;
                }
                const mat = new THREE.SpriteMaterial({
                    map: softTex,
                    color: 0xffffff,
                    transparent: true,
                    opacity: 0.9,
                    blending: THREE.AdditiveBlending,
                    depthWrite: false
                });
                const p = new THREE.Sprite(mat);
                this.group.add(p);
                return p;
            };
        }

        const activeBurn = this.isLaunched && this.timeScale !== 0 && this.simulationTime > 0 && this.simulationTime < 44.5;
        if (activeBurn) {
            const throttle = this.simulationTime > 40
                ? Math.max(0.15, 1 - (this.simulationTime - 40) / 4.5)
                : 1.0;

            // Compute nozzle world positions and exhaust direction in world space (follows rocket tilt!)
            const exhaustDir = new THREE.Vector3(0, -Math.cos(this.rocket.rotation.x), -Math.sin(this.rocket.rotation.x)).normalize();
            const localToRocketWorld = (lx, ly, lz) => {
                const sx = lx * 1.5;
                const sy = ly * 1.5;
                const sz = lz * 1.5;
                const cosX = Math.cos(this.rocket.rotation.x);
                const sinX = Math.sin(this.rocket.rotation.x);
                return new THREE.Vector3(
                    this.rocket.position.x + sx,
                    this.rocket.position.y + sy * cosX - sz * sinX,
                    this.rocket.position.z + sy * sinX + sz * cosX
                );
            };

            const emitters = [];
            if (!this.isStaging1Done && this.simulationTime < 10) {
                emitters.push({ pos: localToRocketWorld(-1.8, -1.5, 0), size: 2.2, speed: 28, isSmokeCapable: true });
                emitters.push({ pos: localToRocketWorld(1.8, -1.5, 0), size: 2.2, speed: 28, isSmokeCapable: true });
            }
            if (!this.isStaging2Done && this.simulationTime < 15) {
                emitters.push({ pos: localToRocketWorld(0, -0.1, 0), size: 2.4, speed: 26, isSmokeCapable: false });
            }
            emitters.push({ pos: localToRocketWorld(0, 1.5, 1.05), size: 1.6 * throttle, speed: 22 * throttle, isCryo: true });

            const spawnPerEmitter = perfManager.isLowPerf ? 1 : (this._isMobile ? 1 : 2);
            for (let eIdx = 0; eIdx < emitters.length; eIdx++) {
                const em = emitters[eIdx];
                for (let k = 0; k < spawnPerEmitter; k++) {
                    if (this.particles.length >= this._maxParticles) break;
                    const p = this.createParticle();
                    const jitter = 0.35;
                    p.position.set(
                        em.pos.x + (Math.random() - 0.5) * jitter,
                        em.pos.y + (Math.random() - 0.5) * jitter,
                        em.pos.z + (Math.random() - 0.5) * jitter
                    );
                    p.userData.life = 1.0;
                    p.userData.decay = 1.6 + Math.random() * 0.9;
                    p.userData.baseSize = em.size * (0.85 + Math.random() * 0.35);
                    p.userData.isCryo = Boolean(em.isCryo && this.simulationTime >= 15);
                    p.userData.isGroundSteam = false;

                    const spd = em.speed * (0.8 + Math.random() * 0.45);
                    const spread = 2.6;
                    p.userData.vel = new THREE.Vector3(
                        exhaustDir.x * spd + (Math.random() - 0.5) * spread,
                        exhaustDir.y * spd + (Math.random() - 0.5) * spread,
                        exhaustDir.z * spd + (Math.random() - 0.5) * spread
                    );
                    p.scale.setScalar(p.userData.baseSize);
                    this.particles.push(p);
                }
            }

            // Ground launchpad billowing steam & fire cloud during liftoff (0 < t < 4.5)
            if (this.simulationTime < 4.5 && this.particles.length < this._maxParticles) {
                const p = this.createParticle();
                const angle = Math.random() * Math.PI * 2;
                const rad = 0.5 + Math.random() * 2.5;
                p.position.set(Math.cos(angle) * rad, 0.4 + Math.random() * 0.8, Math.sin(angle) * rad);
                p.userData.life = 1.0;
                p.userData.decay = 0.85 + Math.random() * 0.4;
                p.userData.baseSize = 3.2 + Math.random() * 1.8;
                p.userData.isCryo = false;
                p.userData.isGroundSteam = true;
                const outSpd = 6 + Math.random() * 10;
                p.userData.vel = new THREE.Vector3(
                    Math.cos(angle) * outSpd,
                    1.2 + Math.random() * 2.5,
                    Math.sin(angle) * outSpd
                );
                p.scale.setScalar(p.userData.baseSize);
                this.particles.push(p);
            }
        }

        const step = dt * Math.max(0.5, Math.abs(this.timeScale));
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.userData.life -= step * (p.userData.decay || 1.8);
            if (p.userData.life <= 0) {
                p.visible = false;
                this.particlePool.push(p);
                this.particles.splice(i, 1);
            } else {
                const l = p.userData.life; // 1.0 -> 0.0
                p.position.addScaledVector(p.userData.vel, step);

                if (p.userData.isGroundSteam) {
                    // Expands into warm lit launchpad smoke/steam cloud
                    const sc = p.userData.baseSize * (1.0 + (1.0 - l) * 2.4);
                    p.scale.setScalar(sc);
                    p.material.opacity = Math.min(0.65, l * 0.75);
                    if (l > 0.6) p.material.color.setHex(0xffbb77);
                    else p.material.color.setHex(0x998877);
                } else if (p.userData.isCryo) {
                    // Vacuum SSME plasma plume: white-cyan -> electric blue -> soft gold
                    const sc = p.userData.baseSize * (0.7 + (1.0 - l) * 2.1);
                    p.scale.setScalar(sc);
                    p.material.opacity = Math.pow(l, 1.2) * 0.85;
                    if (l > 0.75) p.material.color.setHex(0xffffff);
                    else if (l > 0.4) p.material.color.setHex(0x88ddff);
                    else p.material.color.setHex(0xffaa44);
                } else {
                    // Main Booster Fire: blinding white -> yellow-gold -> fiery orange -> deep crimson ember
                    const sc = p.userData.baseSize * (0.8 + (1.0 - l) * 2.8);
                    p.scale.setScalar(sc);
                    p.material.opacity = Math.pow(l, 1.15) * 0.92;
                    if (l > 0.82) p.material.color.setHex(0xffffff);
                    else if (l > 0.58) p.material.color.setHex(0xffdd55);
                    else if (l > 0.30) p.material.color.setHex(0xff6611);
                    else p.material.color.setHex(0xaa1800);
                }
            }
        }
    }

    show() {
        this.group.visible = true;
        if (camera) {
            camera.far = 200000;
            camera.updateProjectionMatrix();
        }
        document.getElementById('rocket-launch-overlay').classList.remove('hidden');
        this.reset();
    }

    hide() {
        this.group.visible = false;
        if (camera) {
            camera.far = 2000;
            camera.updateProjectionMatrix();
        }
        document.getElementById('rocket-launch-overlay').classList.add('hidden');
    }

    dispose() {
        this.disposed = true;
        if (this.rocket) this.group.remove(this.rocket);
        [this.shuttle, this.tank, this.boosterL, this.boosterR].forEach(part => {
            if (part && part.parent) part.parent.remove(part);
        });
        this.group.traverse(obj => {
            if (obj.geometry) obj.geometry.dispose();
            if (obj.material) {
                if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
                else obj.material.dispose();
            }
        });
        this.parentScene.remove(this.group);
        this.specificLights.forEach(l => this.parentScene.remove(l));
    }
}


class SeasonsSimulation {
    constructor(parentScene, cameraRef, controlsRef) {
        this.parentScene = parentScene;
        this.camera = cameraRef;
        this.controls = controlsRef;
        this.group = new THREE.Group();
        this.group.visible = false;
        this.disposed = false;
        this.listeners = [];
        this.isPlaying = false;
        this.isZoomed = false;
        this.currentDay = 171; // Start at Sommeranfang (21. Juni)

        this.bindEvents();
        this.buildScene();
        
        this.parentScene.add(this.group);
    }

    buildScene() {
        // 1. Sun (High-Res 96x96 + Corona)
        const sunRadius = planetData.sun.radius || 5;
        const sunGeom = new THREE.SphereGeometry(sunRadius, 96, 96);
        const sunMat = new THREE.MeshBasicMaterial({ color: 0xfffae6 });
        
        globalTextureLoader.load('textures/planets/sun.jpg', (tex) => {
            tex.colorSpace = THREE.SRGBColorSpace;
            applyTextureSharpness(tex);
            sunMat.map = tex;
            sunMat.needsUpdate = true;
        });

        this.sun = new THREE.Mesh(sunGeom, sunMat);
        const sunGlow = new THREE.Sprite(new THREE.SpriteMaterial({
            map: getSoftParticleTexture(),
            color: 0xffaa33,
            transparent: true,
            opacity: 0.55,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        }));
        sunGlow.scale.set(sunRadius * 3.6, sunRadius * 3.6, 1);
        this.sun.add(sunGlow);
        this.group.add(this.sun);

        // 2. Lighting: PointLight at center for crisp day/night terminator
        const sunLight = new THREE.PointLight(0xffffff, 3.8, 1000);
        sunLight.castShadow = true;
        sunLight.shadow.mapSize.width = 2048;
        sunLight.shadow.mapSize.height = 2048;
        this.group.add(sunLight);

        this.ambientLight = new THREE.AmbientLight(0x101830, 0.18);
        this.group.add(this.ambientLight);

        // 3. Hierarchy Nodes for 23.44 Degree Tilt
        this.orbitNode = new THREE.Group();
        this.group.add(this.orbitNode);

        const distance = 40;
        this.translationNode = new THREE.Group();
        this.translationNode.position.x = distance;
        this.orbitNode.add(this.translationNode);

        // Counter-rotate to keep tilt aligned globally toward Polaris
        this.counterRotateNode = new THREE.Group();
        this.translationNode.add(this.counterRotateNode);

        // Tilt node (23.44 degrees)
        this.tiltNode = new THREE.Group();
        this.tiltNode.rotation.z = 23.44 * Math.PI / 180;
        this.counterRotateNode.add(this.tiltNode);

        // 4. High-Res Earth Mesh (96x96 + normal + roughness + clouds + night lights + atmosphere)
        const earthData = planetData.earth;
        const earthR = earthData.radius || 1.3;
        const earthGeom = new THREE.SphereGeometry(earthR, 96, 96);
        const earthMat = new THREE.MeshPhysicalMaterial({
            color: 0xffffff,
            roughness: 0.58,
            metalness: 0.04,
            normalScale: new THREE.Vector2(1.2, 1.2)
        });
        
        globalTextureLoader.load('textures/planets/earth.jpg', (tex) => {
            tex.colorSpace = THREE.SRGBColorSpace;
            applyTextureSharpness(tex);
            earthMat.map = tex;
            earthMat.needsUpdate = true;
        });
        globalTextureLoader.load('textures/planets/earth_normal.jpg', (tex) => {
            applyTextureSharpness(tex);
            earthMat.normalMap = tex;
            earthMat.needsUpdate = true;
        });
        globalTextureLoader.load('textures/planets/earth_roughness.jpg', (tex) => {
            applyTextureSharpness(tex);
            earthMat.roughnessMap = tex;
            earthMat.needsUpdate = true;
        });

        this.earthMesh = new THREE.Mesh(earthGeom, earthMat);
        this.earthMesh.castShadow = true;
        this.earthMesh.receiveShadow = true;
        this.tiltNode.add(this.earthMesh);

        // Clouds
        const cloudTex = globalTextureLoader.load('textures/planets/earth_clouds.png');
        applyTextureSharpness(cloudTex);
        const cloudMat = new THREE.MeshStandardMaterial({
            map: cloudTex,
            transparent: true, opacity: 0.85, blending: THREE.NormalBlending, depthWrite: false
        });
        const cloudMesh = new THREE.Mesh(new THREE.SphereGeometry(earthR * 1.015, 72, 72), cloudMat);
        cloudMesh.userData = { isCloud: true };
        this.tiltNode.add(cloudMesh);
        this.cloudMesh = cloudMesh;

        // Atmosphere Fresnel Glow
        this.tiltNode.add(createAtmosphereHalo(0x4da6ff, earthR * 1.05, 0.24));

        // 5. Visual Aids: Axis Rod + Equator Ring
        const axisGeom = new THREE.CylinderGeometry(0.04, 0.04, earthR * 4.2, 12);
        const axisMat = new THREE.MeshBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.85 });
        const axisMesh = new THREE.Mesh(axisGeom, axisMat);
        this.tiltNode.add(axisMesh);

        const eqRingGeom = new THREE.TorusGeometry(earthR * 1.03, 0.018, 12, 96);
        const eqRingMat = new THREE.MeshBasicMaterial({ color: 0xffcc44, transparent: true, opacity: 0.65 });
        const eqRing = new THREE.Mesh(eqRingGeom, eqRingMat);
        eqRing.rotation.x = Math.PI / 2;
        this.tiltNode.add(eqRing);

        // Orbit Ring
        const orbitRingGeom = new THREE.RingGeometry(distance - 0.1, distance + 0.1, 160);
        const orbitRingMat = new THREE.MeshBasicMaterial({ color: 0x88bbff, side: THREE.DoubleSide, transparent: true, opacity: 0.2 });
        const orbitRing = new THREE.Mesh(orbitRingGeom, orbitRingMat);
        orbitRing.rotation.x = Math.PI / 2;
        this.group.add(orbitRing);

        // Background Starfield
        const starGeo = new THREE.BufferGeometry();
        const starPositions = new Float32Array(2000 * 3);
        for (let i = 0; i < 2000 * 3; i += 3) {
            starPositions[i] = (Math.random() - 0.5) * 800;
            starPositions[i + 1] = (Math.random() - 0.5) * 800;
            starPositions[i + 2] = (Math.random() - 0.5) * 800;
        }
        starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
        this.group.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.6, transparent: true, opacity: 0.7 })));

        this.prevEarthPos = new THREE.Vector3();
        this.updatePositions();
    }

    updateLevelExplanation() {
        const el = document.getElementById('seasons-level-explanation');
        if (!el) return;
        const texts = {
            lvl4: "Die Erde steht ein bisschen schief wie ein Kreisel! Wenn sich unsere obere Hälfte zur Sonne neigt, haben wir warmen Sommer. Neigt sie sich weg, haben wir kalten Winter.",
            lvl5: "Die Erdachse ist um 23,5° geneigt und zeigt im Weltraum immer in dieselbe Richtung. Im Juni scheint die Sonne steil auf die Nordhalbkugel (Sommer), während auf der Südhalbkugel Winter herrscht.",
            lvl7: "Je steiler die Sonnenstrahlen auf die Erdoberfläche treffen, desto mehr Wärmeenergie pro Quadratmeter kommt an. Am 21. März und 23. September sind Tag und Nacht überall gleich lang (Äquinoktium).",
            lvl10: "Die Jahreszeiten entstehen nicht durch den Abstand zur Sonne (die Erde ist im Januar im Perihel sogar näher an der Sonne!), sondern allein durch die 23,44°-Schiefe der Ekliptik und den Einstrahlungswinkel.",
            lvl16: "Nördlich des Polarkreises (66,56° N) sinkt die Sonne zur Sommersonnenwende nicht unter den Horizont (Polartag), während zur Wintersonnenwende Polarnacht herrscht. Die Solarkonstante wird mit sin(h) projiziert.",
            expert: "Schiefe der Ekliptik ε ≈ 23° 26′ 21″ (Milanković-Zyklus: 22,1°–24,5° über 41.000 Jahre) und axiale Präzession (Zyklus ~25.772 Jahre) verschieben langfristig die Lage der Äquinoktien relativ zum Perihel."
        };
        el.textContent = texts[currentLevel] || texts.lvl5;
    }

    bindEvents() {
        this.slider = document.getElementById('seasons-day-slider');
        this.dateLabel = document.getElementById('seasons-date');
        this.eventLabel = document.getElementById('seasons-event');
        this.playBtn = document.getElementById('btn-seasons-play');
        this.playIcon = document.getElementById('seasons-play-icon');
        this.pauseIcon = document.getElementById('seasons-pause-icon');
        this.btnFocusEarth = document.getElementById('btn-seasons-focus-earth');
        this.btnOverview = document.getElementById('btn-seasons-overview');

        const onInput = () => {
            this.currentDay = parseInt(this.slider.value);
            this.updatePositions();
        };

        const togglePlay = () => {
            this.isPlaying = !this.isPlaying;
            if (this.isPlaying) {
                this.playIcon.classList.add('hidden');
                this.pauseIcon.classList.remove('hidden');
            } else {
                this.playIcon.classList.remove('hidden');
                this.pauseIcon.classList.add('hidden');
            }
        };

        const onFocusEarth = () => this.focusEarth();
        const onOverview = () => this.resetOverview();

        this.slider.addEventListener('input', onInput);
        this.playBtn.addEventListener('click', togglePlay);
        if (this.btnFocusEarth) this.btnFocusEarth.addEventListener('click', onFocusEarth);
        if (this.btnOverview) this.btnOverview.addEventListener('click', onOverview);

        this.listeners.push(
            { el: this.slider, evt: 'input', fn: onInput },
            { el: this.playBtn, evt: 'click', fn: togglePlay }
        );
        if (this.btnFocusEarth) this.listeners.push({ el: this.btnFocusEarth, evt: 'click', fn: onFocusEarth });
        if (this.btnOverview) this.listeners.push({ el: this.btnOverview, evt: 'click', fn: onOverview });
    }

    focusEarth() {
        this.isZoomed = true;
        const earthPos = new THREE.Vector3();
        this.earthMesh.getWorldPosition(earthPos);
        
        const dir = earthPos.clone().normalize();
        const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0,1,0), dir).normalize();
        const camPos = earthPos.clone().sub(dir.multiplyScalar(6)).add(right.multiplyScalar(3));
        camPos.y += 2.5;
        
        gsap.to(this.camera.position, {
            x: camPos.x, y: camPos.y, z: camPos.z,
            duration: 1.2, ease: "power2.inOut"
        });
        gsap.to(this.controls.target, {
            x: earthPos.x, y: earthPos.y, z: earthPos.z,
            duration: 1.2, ease: "power2.inOut"
        });
    }

    resetOverview() {
        this.isZoomed = false;
        const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || window.innerWidth < 768;
        const initialCamPos = isMobile ? { x: 0, y: 55, z: 105 } : { x: 0, y: 35, z: 65 };
        
        gsap.to(this.camera.position, {
            x: initialCamPos.x, y: initialCamPos.y, z: initialCamPos.z,
            duration: 1.2, ease: "power2.inOut"
        });
        gsap.to(this.controls.target, {
            x: 0, y: 0, z: 0,
            duration: 1.2, ease: "power2.inOut"
        });
    }

    updatePositions() {
        const angle = (this.currentDay / 365) * Math.PI * 2;
        
        this.orbitNode.rotation.y = angle;
        this.counterRotateNode.rotation.y = -angle;

        const start = new Date(new Date().getFullYear(), 2, 21);
        start.setDate(start.getDate() + this.currentDay);
        const options = { day: 'numeric', month: 'long' };
        this.dateLabel.textContent = start.toLocaleDateString('de-DE', options);

        let evtTxt = "Im Jahresverlauf";
        const d = Math.round(this.currentDay);
        
        if (d >= 0 && d < 45) evtTxt = "Frühling (Nordhalbkugel) – Tag & Nacht fast gleich lang";
        else if (d >= 45 && d < 135) evtTxt = "Sommersonnenwende nähert sich – Nordhalbkugel neigt sich zur Sonne";
        else if (d >= 135 && d < 225) evtTxt = "Herbstbeginn – Tage werden kürzer (Nordhalbkugel)";
        else if (d >= 225 && d < 315) evtTxt = "Wintersonnenwende nähert sich – Nordpol im Dunkeln";
        else evtTxt = "Frühlingserwachen – Tage werden wieder länger (Nordhalbkugel)";
        
        if (d === 0 || d === 365) evtTxt = "Frühlings-Tagundnachtgleiche (Äquinoktium)";
        else if (d >= 90 && d <= 94) evtTxt = "Sommersonnenwende – Längster Tag (Nordhalbkugel)";
        else if (d >= 182 && d <= 186) evtTxt = "Herbst-Tagundnachtgleiche (Äquinoktium)";
        else if (d >= 272 && d <= 276) evtTxt = "Wintersonnenwende – Kürzester Tag (Nordhalbkugel)";

        this.eventLabel.textContent = evtTxt;
    }

    show() {
        this.group.visible = true;
        this.isZoomed = false;
        this.updateLevelExplanation();
        
        if (this.controls) {
            this.controls.minDistance = 1.5;
            this.controls.maxDistance = 600;
            this.controls.enableZoom = true;
            this.controls.enablePan = true;
            this.controls.enableRotate = true;
        }

        this.prevEarthPos.set(0, 0, 0);
        if (this.earthMesh) {
            this.earthMesh.getWorldPosition(this.prevEarthPos);
        }
        
        const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || window.innerWidth < 768;
        const initialCamPos = isMobile ? { x: 0, y: 55, z: 105 } : { x: 0, y: 35, z: 65 };
        
        if (this.camera && this.controls) {
            gsap.to(this.camera.position, {
                x: initialCamPos.x, y: initialCamPos.y, z: initialCamPos.z, duration: 1.5, ease: "power2.inOut"
            });
            gsap.to(this.controls.target, {
                x: 0, y: 0, z: 0, duration: 1.5, ease: "power2.inOut"
            });
        }
    }

    hide() {
        this.group.visible = false;
        this.isPlaying = false;
        if (this.playIcon) {
            this.playIcon.classList.remove('hidden');
            this.pauseIcon.classList.add('hidden');
        }
    }

    update(dt) {
        if (!this.group.visible || this.disposed) return;
        const rotFactor = typeof window.rotationSpeedFactor === 'number' ? window.rotationSpeedFactor : 1;
        const orbFactor = typeof window.orbitSpeedFactor === 'number' ? window.orbitSpeedFactor : 1;
        
        if (this.isPlaying) {
            if (this.sun) this.sun.rotation.y += dt * 0.12 * rotFactor;
            this.earthMesh.rotation.y += dt * 0.75 * rotFactor;
            if (this.cloudMesh) this.cloudMesh.rotation.y += dt * 0.8 * rotFactor;

            if (orbFactor > 0) {
                this.currentDay += dt * 5 * orbFactor;
                if (this.currentDay > 365) this.currentDay = 0;
                this.slider.value = Math.floor(this.currentDay);
                this.updatePositions();
            }
        }

        const earthPos = new THREE.Vector3();
        this.earthMesh.getWorldPosition(earthPos);

        if (this.isZoomed) {
            if (!gsap.isTweening(this.camera.position) && !gsap.isTweening(this.controls.target)) {
                const delta = earthPos.clone().sub(this.prevEarthPos);
                this.camera.position.add(delta);
                this.controls.target.copy(earthPos);
            }
        }
        
        this.prevEarthPos.copy(earthPos);
    }

    dispose() {
        this.disposed = true;
        this.hide();
        this.listeners.forEach(({ el, evt, fn }) => el.removeEventListener(evt, fn));
        this.listeners = [];

        this.group.traverse(child => {
            if (child.isMesh) {
                if (child.geometry) child.geometry.dispose();
                if (child.material) {
                    if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
                    else child.material.dispose();
                }
            }
        });

        if (this.parentScene) this.parentScene.remove(this.group);
        this.group = null;
    }
}

// Globals
let scene, camera, renderer, controls, labelRenderer, raycaster, mouse, clock;
let solarSystemScene, moonPhasesScene, sizeComparisonScene, starCycleScene, rocketLaunchScene = null;
let seasonsScene = null;
let currentMode = 'solarSystem';

// Global state for Sonnensystem camera tracking & smooth zoom
let trackedPlanet = null;
let isInfoPanelMinimized = false;
let prevTrackedPlanetPos = new THREE.Vector3();
let isFocusTweening = false;
let focusTweenObj = { t: 0 };
let focusStartCamPos = new THREE.Vector3();
let focusStartTarget = new THREE.Vector3();
let trackingOffset = new THREE.Vector3();

function minimizeInfoPanel() {
    if (!trackedPlanet) return;
    isInfoPanelMinimized = true;
    const infoPanel = document.getElementById('info-panel');
    const dockedClose = document.getElementById('btn-docked-close');
    if (infoPanel) infoPanel.classList.add('hidden');
    if (dockedClose) dockedClose.classList.remove('hidden');
}

function reopenInfoPanel() {
    isInfoPanelMinimized = false;
    const infoPanel = document.getElementById('info-panel');
    const dockedClose = document.getElementById('btn-docked-close');
    if (dockedClose) dockedClose.classList.add('hidden');
    if (infoPanel) infoPanel.classList.remove('hidden');
}

function sanitizeCameraAndControls(fallbackPos = { x: 0, y: 150, z: 200 }, fallbackTarget = { x: 0, y: 0, z: 0 }) {
    if (camera && camera.position) {
        if (!Number.isFinite(camera.position.x) || !Number.isFinite(camera.position.y) || !Number.isFinite(camera.position.z)) {
            camera.position.set(fallbackPos.x, fallbackPos.y, fallbackPos.z);
        }
    }
    if (controls && controls.target) {
        if (!Number.isFinite(controls.target.x) || !Number.isFinite(controls.target.y) || !Number.isFinite(controls.target.z)) {
            controls.target.set(fallbackTarget.x, fallbackTarget.y, fallbackTarget.z);
        }
    }
}

function resolveSolarObjectInfo(object) {
    if (!object || !object.userData || !object.userData.planetId) return null;
    const pId = object.userData.planetId;
    if (planetData[pId]) {
        return { data: planetData[pId], isMainPlanet: true, key: pId, radius: planetData[pId].radius || 1.5 };
    }
    if (solarSystemScene && solarSystemScene.moonLookup && solarSystemScene.moonLookup.has(pId)) {
        const entry = solarSystemScene.moonLookup.get(pId);
        return {
            data: entry.data,
            isMoon: !entry.isExtraBody,
            isExtraBody: !!entry.isExtraBody,
            parentPlanet: entry.parentPlanet || entry.parentExtra || null,
            key: pId,
            radius: entry.data.radius || object.userData.visualRadius || 0.3
        };
    }
    if (object.userData.moonData) {
        return {
            data: object.userData.moonData,
            isMoon: true,
            key: pId,
            radius: object.userData.visualRadius || object.userData.moonData.radius || 0.25
        };
    }
    if (object.userData.extraData) {
        return {
            data: object.userData.extraData,
            isExtraBody: true,
            key: pId,
            radius: object.userData.visualRadius || object.userData.extraData.radius || 0.4
        };
    }
    return null;
}

// Helper to calculate ideal viewing position on the sunlit, elevated side
function getIdealPlanetCameraPosition(planetObject, currentPlanetWorldPos) {
    const pId = planetObject.userData.planetId;
    const resolved = resolveSolarObjectInfo(planetObject);
    const r = (resolved && Number.isFinite(resolved.radius) && resolved.radius > 0) ? resolved.radius : 1.2;
    const isLinedUp = solarSystemScene && solarSystemScene.isLinedUp;
    
    // Sun
    if (pId === 'sun') {
        const sunPos = isLinedUp ? new THREE.Vector3(-50, 0, 0) : new THREE.Vector3(0, 0, 0);
        return sunPos.clone().add(new THREE.Vector3(18, 9, 18));
    }
    
    // Distance based on radius (smaller minimum for moons/spacecraft so we zoom in close!)
    let dist;
    if (pId === 'saturn') {
        dist = r * 5.2;
    } else if (resolved && (resolved.isMoon || resolved.isExtraBody)) {
        dist = Math.max(r * 5.0, 1.15);
    } else {
        dist = Math.max(r * 4.2, 2.8);
    }
    
    if (isLinedUp) {
        const viewDir = new THREE.Vector3(0.18, 0.32, 1.0).normalize();
        return currentPlanetWorldPos.clone().add(viewDir.multiplyScalar(dist));
    }
    
    // Sun is at (0, 0, 0). Vector pointing from object towards Sun:
    const toSun = new THREE.Vector3().subVectors(new THREE.Vector3(0, 0, 0), currentPlanetWorldPos);
    if (toSun.lengthSq() < 1e-6) {
        toSun.set(0, 0, 1);
    } else {
        toSun.normalize();
    }
    const tangent = new THREE.Vector3(-toSun.z, 0, toSun.x);
    if (tangent.lengthSq() < 1e-6) {
        tangent.set(1, 0, 0);
    } else {
        tangent.normalize();
    }
    
    const viewDir = new THREE.Vector3()
        .addScaledVector(toSun, 0.72)
        .addScaledVector(tangent, 0.50);
    viewDir.y = 0.38;
    viewDir.normalize();
    
    return currentPlanetWorldPos.clone().add(viewDir.multiplyScalar(dist));
}

function init() {
    const container = document.getElementById('canvas-container');

    // Setup Scene
    scene = new THREE.Scene();

    // Setup Camera
    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.05, 2000);
    camera.position.set(0, 150, 200);

    // Setup Renderer
    const isMobileDevice = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || window.innerWidth < 768;
    renderer = new THREE.WebGLRenderer({
        antialias: !isMobileDevice && !perfManager.isLowPerf, 
        alpha: true,
        powerPreference: isMobileDevice || perfManager.isLowPerf ? 'low-power' : 'high-performance'
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(perfManager.isLowPerf ? 1 : Math.min(window.devicePixelRatio, isMobileDevice ? 1.5 : 2));
    renderer.outputEncoding = THREE.sRGBEncoding;
    if (!isMobileDevice && !perfManager.isLowPerf) {
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    }
    container.appendChild(renderer.domElement);

    // Setup Controls
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxDistance = 1000;
    
    clock = new THREE.Clock();
    
    controls.touches = {
        ONE: THREE.TOUCH.ROTATE,
        TWO: THREE.TOUCH.DOLLY_PAN
    };
    
    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();

    // Set up CSS2DRenderer
    labelRenderer = new THREE.CSS2DRenderer();
    labelRenderer.setSize(window.innerWidth, window.innerHeight);
    labelRenderer.domElement.style.position = 'absolute';
    labelRenderer.domElement.style.top = '0px';
    labelRenderer.domElement.style.pointerEvents = 'none';
    labelRenderer.domElement.style.zIndex = '5';
    document.body.appendChild(labelRenderer.domElement);

    // Initial Scene
    solarSystemScene = new SolarSystem(scene);

    // Initial Mode
    switchMode('solarSystem');

    // Event Listeners
    window.addEventListener('resize', onWindowResize);
    window.addEventListener('orientationchange', () => { setTimeout(onWindowResize, 100); });
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointerup', onPointerUp);

    setupUI();

    clock = new THREE.Clock();

    perfManager.startMonitoring();
    animate();
}

// Global Time & Motion Speed Controls
window.appTimeScale = 1;
let savedTimeScale = 1;
window.rotationSpeedFactor = 1;
window.orbitSpeedFactor = 1;

// Global Level Variable (matches slider default value="1" -> 'lvl5')
window.currentLevel = currentLevel;
function switchMode(mode) {
    if (currentMode === 'rocketLaunch' && mode !== 'rocketLaunch') {
        cleanupRaketenstart();
    }
    if (currentMode === 'seasons' && mode !== 'seasons') {
        cleanupJahreszeiten();
    }

    currentMode = mode;
    sanitizeCameraAndControls();
    
    document.querySelectorAll('.toggle-container button').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.sidebar-btn').forEach(b => b.classList.remove('active'));
    
    const modeKebab = mode.replace(/[A-Z]/g, m => "-" + m.toLowerCase());
    const btn = document.getElementById('btn-' + modeKebab);
    if(btn) btn.classList.add('active');

    const commonUI = ['moon-legend', 'size-comparison-overlay', 'star-cycle-overlay', 'rocket-launch-overlay', 'info-panel', 'btn-docked-close', 'seasons-info-container'];
    commonUI.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden');
    });
    hideInfoPanel();

    trackedPlanet = null;
    isFocusTweening = false;
    gsap.killTweensOf(focusTweenObj);
    if (camera) gsap.killTweensOf(camera.position);
    if (controls) {
        gsap.killTweensOf(controls.target);
        controls.minDistance = 0.2;
        controls.maxDistance = 1500;
    }

    if (mode === 'solarSystem') {
        if (!solarSystemScene) solarSystemScene = new SolarSystem(scene);
        solarSystemScene.show();
        if(moonPhasesScene) moonPhasesScene.hide();
        if(sizeComparisonScene) sizeComparisonScene.hide();
        if(starCycleScene) starCycleScene.hide();
        
        document.getElementById('local-menu-btn').style.display = 'flex';
        document.getElementById('btn-moon-info').style.display = 'none';
        document.getElementById('solar-system-list-container').classList.remove('hidden');
        document.getElementById('size-comparison-list-container').classList.add('hidden');
        document.getElementById('time-controls').classList.remove('hidden');
        
        if (solarSystemScene && solarSystemScene.isLinedUp) {
            gsap.to(camera.position, {
                x: -5, y: 12, z: 72, duration: 1.5, ease: "power2.inOut"
            });
            gsap.to(controls.target, { x: -5, y: 0, z: 0, duration: 1.5, ease: "power2.inOut" });
        } else {
            gsap.to(camera.position, {
                x: 0, y: 150, z: 200, duration: 1.5, ease: "power2.inOut"
            });
            gsap.to(controls.target, { x: 0, y: 0, z: 0, duration: 1.5, ease: "power2.inOut" });
        }
        controls.enableZoom = true;
        controls.enablePan = true;

    } else if (mode === 'moonPhases') {
        if(solarSystemScene) solarSystemScene.hide();
        if(sizeComparisonScene) sizeComparisonScene.hide();
        if(starCycleScene) starCycleScene.hide();
        if (!moonPhasesScene) moonPhasesScene = new MoonPhases(scene);
        moonPhasesScene.show();
        
        document.getElementById('local-menu-btn').style.display = 'none';
        document.getElementById('btn-moon-info').style.display = 'flex';
        document.getElementById('solar-system-list-container').classList.add('hidden');
        document.getElementById('size-comparison-list-container').classList.add('hidden');
        document.getElementById('local-sidebar-right').classList.remove('open');
        document.getElementById('time-controls').classList.remove('hidden');
        
        gsap.to(camera.position, { x: 0, y: 20, z: 35, duration: 1.5, ease: "power2.inOut" });
        gsap.to(controls.target, { x: 0, y: 0, z: 0, duration: 1.5, ease: "power2.inOut" });
        controls.enableZoom = true;
        controls.enablePan = true;

    } else if (mode === 'sizeComparison') {
        if(solarSystemScene) solarSystemScene.hide();
        if(moonPhasesScene) moonPhasesScene.hide();
        if(starCycleScene) starCycleScene.hide();
        
        document.getElementById('size-comparison-overlay').classList.remove('hidden');
        document.getElementById('local-menu-btn').style.display = 'flex';
        document.getElementById('btn-moon-info').style.display = 'none';
        document.getElementById('solar-system-list-container').classList.add('hidden');
        document.getElementById('size-comparison-list-container').classList.remove('hidden');
        document.getElementById('time-controls').classList.add('hidden');
        
        gsap.to(camera.position, { x: 0, y: 0, z: 35, duration: 1.5, ease: "power2.inOut" });
        gsap.to(controls.target, { x: 0, y: 0, z: 0, duration: 1.5, ease: "power2.inOut" });
        controls.enableZoom = true;
        controls.enablePan = true;
        
        if (!sizeComparisonScene) sizeComparisonScene = new SizeComparison(scene, labelRenderer);
        sizeComparisonScene.show();
        document.getElementById('local-sidebar-right').classList.remove('open');

    } else if (mode === 'starCycle') {
        if(solarSystemScene) solarSystemScene.hide();
        if(moonPhasesScene) moonPhasesScene.hide();
        if(sizeComparisonScene) sizeComparisonScene.hide();
        
        document.getElementById('star-cycle-overlay').classList.remove('hidden');
        if(!starCycleScene) starCycleScene = new StarCycle(scene);
        starCycleScene.show();
        document.getElementById('local-menu-btn').style.display = 'none';
        document.getElementById('btn-moon-info').style.display = 'none';
        document.getElementById('solar-system-list-container').classList.add('hidden');
        document.getElementById('size-comparison-list-container').classList.add('hidden');
        document.getElementById('local-sidebar-right').classList.remove('open');
        document.getElementById('time-controls').classList.add('hidden');
        trackedPlanet = null;

    } else if (mode === 'rocketLaunch') {
        if(solarSystemScene) solarSystemScene.hide();
        if(moonPhasesScene) moonPhasesScene.hide();
        if(sizeComparisonScene) sizeComparisonScene.hide();
        if(starCycleScene) starCycleScene.hide();
        
        document.getElementById('local-menu-btn').style.display = 'none';
        document.getElementById('btn-moon-info').style.display = 'none';
        document.getElementById('solar-system-list-container').classList.add('hidden');
        document.getElementById('size-comparison-list-container').classList.add('hidden');
        document.getElementById('local-sidebar-right').classList.remove('open');
        document.getElementById('time-controls').classList.add('hidden');
        
        if (!rocketLaunchScene) {
            rocketLaunchScene = new RocketLaunch(scene);
        }
        rocketLaunchScene.show();
        trackedPlanet = null;

    } else if (mode === 'seasons') {
        if(solarSystemScene) solarSystemScene.hide();
        if(moonPhasesScene) moonPhasesScene.hide();
        if(sizeComparisonScene) sizeComparisonScene.hide();
        if(starCycleScene) starCycleScene.hide();
        
        document.getElementById('local-menu-btn').style.display = 'flex';
        document.getElementById('btn-moon-info').style.display = 'none';
        document.getElementById('solar-system-list-container').classList.add('hidden');
        document.getElementById('size-comparison-list-container').classList.add('hidden');
        document.getElementById('seasons-info-container').classList.remove('hidden');
        document.getElementById('local-sidebar-right').classList.add('open');
        document.getElementById('time-controls').classList.add('hidden');
        
        if (!seasonsScene) {
            seasonsScene = new SeasonsSimulation(scene, camera, controls);
        }
        seasonsScene.show();
        trackedPlanet = null;
    }
}

function cleanupRaketenstart() {
    if (rocketLaunchScene) {
        rocketLaunchScene.dispose();
        rocketLaunchScene = null;
    }
}

function cleanupJahreszeiten() {
    if (seasonsScene) {
        seasonsScene.dispose();
        seasonsScene = null;
    }
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    if(labelRenderer) labelRenderer.setSize(window.innerWidth, window.innerHeight);
}

function focusPlanet(object) {
    if (!object) return;
    if (object.userData && object.userData.rootSelectable) {
        object = object.userData.rootSelectable;
    }
    if (!object.userData || !object.userData.planetId) return;

    const resolved = resolveSolarObjectInfo(object);
    if (resolved && resolved.data) {
        showInfoPanel(resolved.data, object);
    }
    
    gsap.killTweensOf(focusTweenObj);
    gsap.killTweensOf(camera.position);
    gsap.killTweensOf(controls.target);

    sanitizeCameraAndControls();

    trackedPlanet = object;
    trackedPlanet.updateMatrixWorld(true);
    isFocusTweening = true;
    focusTweenObj.t = 0;

    focusStartCamPos.copy(camera.position);
    focusStartTarget.copy(controls.target);

    const r = (resolved && Number.isFinite(resolved.radius) && resolved.radius > 0) ? resolved.radius : 1.2;
    controls.minDistance = Math.max(0.22, r * 1.25);
    controls.maxDistance = Math.max(60, r * 45);

    const initPos = new THREE.Vector3();
    trackedPlanet.getWorldPosition(initPos);
    if (!Number.isFinite(initPos.x) || !Number.isFinite(initPos.y) || !Number.isFinite(initPos.z)) {
        initPos.set(0, 0, 0);
    }
    prevTrackedPlanetPos.copy(initPos);

    gsap.to(focusTweenObj, {
        t: 1,
        duration: 1.5,
        ease: "power2.out",
        onUpdate: () => {
            if (!trackedPlanet) return;
            trackedPlanet.updateMatrixWorld(true);
            const currentPlanetPos = new THREE.Vector3();
            trackedPlanet.getWorldPosition(currentPlanetPos);
            if (!Number.isFinite(currentPlanetPos.x) || !Number.isFinite(currentPlanetPos.y) || !Number.isFinite(currentPlanetPos.z)) {
                return;
            }

            const idealCamPos = getIdealPlanetCameraPosition(trackedPlanet, currentPlanetPos);
            const t = focusTweenObj.t;

            controls.target.lerpVectors(focusStartTarget, currentPlanetPos, t);
            camera.position.lerpVectors(focusStartCamPos, idealCamPos, t);
            prevTrackedPlanetPos.copy(currentPlanetPos);
        },
        onComplete: () => {
            isFocusTweening = false;
            if (trackedPlanet) {
                trackedPlanet.updateMatrixWorld(true);
                trackedPlanet.getWorldPosition(prevTrackedPlanetPos);
            }
        }
    });
}

let pointerDownPos = { x: 0, y: 0 };
let pointerDownTime = 0;

function onPointerDown(event) {
    pointerDownPos.x = event.clientX;
    pointerDownPos.y = event.clientY;
    pointerDownTime = Date.now();
}

function onPointerUp(event) {
    if (currentMode !== 'solarSystem' && currentMode !== 'sizeComparison' && currentMode !== 'seasons') return;
    if (event.target.tagName !== 'CANVAS' && !event.target.classList.contains('planet-label')) return;

    const dx = event.clientX - pointerDownPos.x;
    const dy = event.clientY - pointerDownPos.y;
    const dist = Math.hypot(dx, dy);
    const dt = Date.now() - pointerDownTime;
    if (dist > 8 || dt > 600) {
        return;
    }

    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);

    if (currentMode === 'solarSystem') {
        const intersects = raycaster.intersectObjects(solarSystemScene.getInteractableObjects(), true);

        if (intersects.length > 0) {
            let object = intersects[0].object;
            if (object.userData && object.userData.rootSelectable) {
                object = object.userData.rootSelectable;
            }
            while (object.parent && object.parent.type !== 'Scene' && !object.userData.planetId) {
                object = object.parent;
            }

            if (object.userData && object.userData.planetId) {
                if (isInfoPanelMinimized && trackedPlanet && (object === trackedPlanet || object.userData.planetId === trackedPlanet.userData.planetId)) {
                    reopenInfoPanel();
                } else {
                    focusPlanet(object);
                }
            }
        }
    } else if (currentMode === 'sizeComparison') {
        const interactables = sizeComparisonScene.getInteractableObjects();
        if (interactables.length > 0) {
            const intersects = raycaster.intersectObjects(interactables, true);
            if (intersects.length > 0) {
                let object = intersects[0].object;
                let meshObj = object;
                while (meshObj.parent && !sizeComparisonScene.allMeshes.some(m => m.mesh === meshObj)) {
                    meshObj = meshObj.parent;
                }
                const index = sizeComparisonScene.activeMeshes.findIndex(m => m.mesh === meshObj);
                if (index !== -1) {
                    sizeComparisonScene.jumpToIndex(index);
                }
            }
        }
    } else if (currentMode === 'seasons' && seasonsScene && seasonsScene.earthMesh) {
        const checkObjects = [seasonsScene.earthMesh];
        if (seasonsScene.sun) checkObjects.push(seasonsScene.sun);
        const intersects = raycaster.intersectObjects(checkObjects, true);
        if (intersects.length > 0) {
            let hit = intersects[0].object;
            if (hit === seasonsScene.sun) {
                seasonsScene.resetOverview();
            } else {
                seasonsScene.focusEarth();
            }
        }
    }
}

function setupUI() {
    const btnCloseInfo = document.getElementById('btn-close-info');
    const btnMinimizeInfo = document.getElementById('btn-minimize-info');
    const btnDockedClose = document.getElementById('btn-docked-close');
    const btnBackParent = document.getElementById('btn-back-parent');

    document.getElementById('btn-solar-system').addEventListener('click', () => switchMode('solarSystem'));
    document.getElementById('btn-moon-phases').addEventListener('click', () => switchMode('moonPhases'));
    document.getElementById('btn-size-comparison').addEventListener('click', () => switchMode('sizeComparison'));
    document.getElementById('btn-star-cycle').addEventListener('click', () => switchMode('starCycle'));
    document.getElementById('btn-rocket-launch').addEventListener('click', () => switchMode('rocketLaunch'));
    document.getElementById('btn-seasons').addEventListener('click', () => switchMode('seasons'));

    document.getElementById('btn-moon-info').addEventListener('click', () => {
        document.getElementById('moon-legend').classList.toggle('hidden');
    });

    if (btnBackParent) {
        btnBackParent.addEventListener('click', () => {
            if (!trackedPlanet || !trackedPlanet.userData) return;
            const parentId = trackedPlanet.userData.parentPlanetId;
            if (!parentId || !solarSystemScene) return;
            const targetMesh = solarSystemScene.getInteractableObjects().find(m => m.userData && m.userData.planetId === parentId);
            if (targetMesh) focusPlanet(targetMesh);
        });
    }

    const infoPanelEl = document.getElementById('info-panel');
    if (infoPanelEl) {
        infoPanelEl.addEventListener('wheel', (e) => { e.stopPropagation(); }, { passive: true });
        infoPanelEl.addEventListener('touchmove', (e) => { e.stopPropagation(); }, { passive: true });
    }

    function closeTrackedPlanetView() {
        hideInfoPanel();
        trackedPlanet = null;
        isFocusTweening = false;
        gsap.killTweensOf(focusTweenObj);
        gsap.killTweensOf(camera.position);
        gsap.killTweensOf(controls.target);
        sanitizeCameraAndControls();
        controls.minDistance = 0.2;
        controls.maxDistance = 1500;
        if (currentMode === 'solarSystem') {
            if (solarSystemScene && solarSystemScene.isLinedUp) {
                gsap.to(camera.position, {
                    x: -5, y: 12, z: 72, duration: 1.5, ease: "power2.out"
                });
                gsap.to(controls.target, {
                    x: -5, y: 0, z: 0, duration: 1.5, ease: "power2.out"
                });
            } else {
                gsap.to(camera.position, {
                    x: 0, y: 150, z: 200, duration: 1.5, ease: "power2.out"
                });
                gsap.to(controls.target, {
                    x: 0, y: 0, z: 0, duration: 1.5, ease: "power2.out"
                });
            }
        }
    }

    if (btnCloseInfo) {
        btnCloseInfo.addEventListener('click', closeTrackedPlanetView);
    }
    if (btnDockedClose) {
        btnDockedClose.addEventListener('click', closeTrackedPlanetView);
    }
    if (btnMinimizeInfo) {
        btnMinimizeInfo.addEventListener('click', minimizeInfoPanel);
    }

    // Solar System Layout Switch Controls
    function setSolarSystemView(isLinedUp) {
        if (!solarSystemScene) {
            solarSystemScene = new SolarSystem(scene);
        }
        solarSystemScene.setLayout(isLinedUp);
        
        const checkbox = document.getElementById('solar-layout-checkbox');
        const iconOrbit = document.getElementById('btn-solar-icon-orbit');
        const iconLine = document.getElementById('btn-solar-icon-line');
        const statusText = document.getElementById('solar-layout-status-text');
        const extrasBar = document.getElementById('solar-extras-bar');
        
        if (checkbox) checkbox.checked = isLinedUp;
        if (iconOrbit) iconOrbit.classList.toggle('active', !isLinedUp);
        if (iconLine) iconLine.classList.toggle('active', isLinedUp);
        if (statusText) {
            statusText.textContent = isLinedUp ? 'Reihenfolge (Merkspruch)' : 'Umlaufbahnen';
            statusText.style.color = isLinedUp ? '#00d4ff' : '#8da4be';
        }
        if (extrasBar) {
            extrasBar.style.display = isLinedUp ? 'none' : 'flex';
        }
        
        updatePlanetList(isLinedUp);
    }

    const solarCheckbox = document.getElementById('solar-layout-checkbox');
    const btnSolarIconOrbit = document.getElementById('btn-solar-icon-orbit');
    const btnSolarIconLine = document.getElementById('btn-solar-icon-line');

    if (solarCheckbox) {
        solarCheckbox.addEventListener('change', (e) => {
            setSolarSystemView(e.target.checked);
        });
    }
    if (btnSolarIconOrbit) btnSolarIconOrbit.addEventListener('click', () => setSolarSystemView(false));
    if (btnSolarIconLine) btnSolarIconLine.addEventListener('click', () => setSolarSystemView(true));

    // Solar System Extra Bodies Switch Controls (Monde, Zwergplaneten, Kometen & Gürtel)
    function setSolarSystemExtraBodies(showExtras) {
        if (!solarSystemScene) {
            solarSystemScene = new SolarSystem(scene);
        }
        solarSystemScene.setShowExtraBodies(showExtras);

        const checkbox = document.getElementById('solar-extras-checkbox');
        const iconOff = document.getElementById('btn-solar-extras-off');
        const iconOn = document.getElementById('btn-solar-extras-on');
        const statusText = document.getElementById('solar-extras-status-text');

        if (checkbox) checkbox.checked = showExtras;
        if (iconOff) iconOff.classList.toggle('active', !showExtras);
        if (iconOn) iconOn.classList.toggle('active', showExtras);
        if (statusText) {
            statusText.textContent = showExtras ? 'Mit weiteren Himmelskörpern' : 'Nur Planeten des Sonnensystems';
            statusText.style.color = showExtras ? '#00d4ff' : '#8da4be';
        }

        updatePlanetList(solarSystemScene ? solarSystemScene.isLinedUp : false);
    }

    const solarExtrasCheckbox = document.getElementById('solar-extras-checkbox');
    const btnSolarExtrasOff = document.getElementById('btn-solar-extras-off');
    const btnSolarExtrasOn = document.getElementById('btn-solar-extras-on');

    if (solarExtrasCheckbox) {
        solarExtrasCheckbox.addEventListener('change', (e) => {
            setSolarSystemExtraBodies(e.target.checked);
        });
    }
    if (btnSolarExtrasOff) btnSolarExtrasOff.addEventListener('click', () => setSolarSystemExtraBodies(false));
    if (btnSolarExtrasOn) btnSolarExtrasOn.addEventListener('click', () => setSolarSystemExtraBodies(true));

    // Size Comparison Controls
    document.getElementById('btn-prev-size').addEventListener('click', () => sizeComparisonScene.prev());
    document.getElementById('btn-next-size').addEventListener('click', () => sizeComparisonScene.next());
    
    function setSizeComparisonFilter(onlyPlanets) {
        if (!sizeComparisonScene) {
            sizeComparisonScene = new SizeComparison(scene, labelRenderer);
        }
        sizeComparisonScene.setFilter(onlyPlanets);
        
        const checkbox = document.getElementById('size-filter-checkbox');
        const iconSolar = document.getElementById('btn-filter-icon-solar');
        const iconAll = document.getElementById('btn-filter-icon-all');
        const statusText = document.getElementById('size-filter-status-text');
        
        if (checkbox) checkbox.checked = !onlyPlanets;
        if (iconSolar) iconSolar.classList.toggle('active', onlyPlanets);
        if (iconAll) iconAll.classList.toggle('active', !onlyPlanets);
        if (statusText) {
            statusText.textContent = onlyPlanets ? 'Planeten (Sonnensystem)' : 'Alle Himmelskörper';
            statusText.style.color = onlyPlanets ? '#00d4ff' : '#8da4be';
        }
    }

    const sizeCheckbox = document.getElementById('size-filter-checkbox');
    const btnFilterIconSolar = document.getElementById('btn-filter-icon-solar');
    const btnFilterIconAll = document.getElementById('btn-filter-icon-all');

    if (sizeCheckbox) {
        sizeCheckbox.addEventListener('change', (e) => {
            setSizeComparisonFilter(!e.target.checked);
        });
    }
    if (btnFilterIconSolar) btnFilterIconSolar.addEventListener('click', () => setSizeComparisonFilter(true));
    if (btnFilterIconAll) btnFilterIconAll.addEventListener('click', () => setSizeComparisonFilter(false));

    document.getElementById('btn-play-blackhole').addEventListener('click', () => {
        sizeComparisonScene.playBlackHoleAnimation();
    });

    window.addEventListener('keydown', (e) => {
        if (currentMode !== 'sizeComparison') return;
        if (e.key === 'ArrowRight') sizeComparisonScene.next();
        if (e.key === 'ArrowLeft') sizeComparisonScene.prev();
    });

    // Time Controls
    const timeScaleDisplay = document.getElementById('time-scale-display');
    const updateTimeDisplay = () => {
        timeScaleDisplay.textContent = window.appTimeScale + 'x';
    };

    document.getElementById('btn-rewind').addEventListener('click', () => {
        if (window.appTimeScale === 0) window.appTimeScale = -1;
        else if (window.appTimeScale > 0) window.appTimeScale = -1;
        else window.appTimeScale -= 1;
        updateTimeDisplay();
    });

    document.getElementById('btn-fastforward').addEventListener('click', () => {
        if (window.appTimeScale === 0) window.appTimeScale = 1;
        else if (window.appTimeScale < 0) window.appTimeScale = 1;
        else window.appTimeScale += 1;
        updateTimeDisplay();
    });

    document.getElementById('btn-playpause').addEventListener('click', () => {
        if (window.appTimeScale === 0) {
            window.appTimeScale = savedTimeScale !== 0 ? savedTimeScale : 1;
        } else {
            savedTimeScale = window.appTimeScale;
            window.appTimeScale = 0;
        }
        updateTimeDisplay();
    });

    // Synchronized Rotation & Orbit Speed Sliders (0% to 200%, default 100%)
    const rotSliders = document.querySelectorAll('.sync-rotation-slider');
    const rotVals = document.querySelectorAll('.sync-rotation-val');
    const orbSliders = document.querySelectorAll('.sync-orbit-slider');
    const orbVals = document.querySelectorAll('.sync-orbit-val');

    const applyRotationPercent = (pct) => {
        const clamped = Math.max(0, Math.min(200, Number(pct) || 0));
        window.rotationSpeedFactor = clamped / 100;
        rotSliders.forEach(s => { if (Number(s.value) !== clamped) s.value = String(clamped); });
        rotVals.forEach(v => { v.textContent = `${clamped}%`; });
        if (clamped > 0) {
            if ((currentMode === 'solarSystem' || currentMode === 'moonPhases') && window.appTimeScale === 0) {
                window.appTimeScale = savedTimeScale !== 0 ? savedTimeScale : 1;
                updateTimeDisplay();
            } else if (currentMode === 'seasons' && seasonsScene && !seasonsScene.isPlaying) {
                seasonsScene.isPlaying = true;
                if (seasonsScene.playIcon) seasonsScene.playIcon.classList.add('hidden');
                if (seasonsScene.pauseIcon) seasonsScene.pauseIcon.classList.remove('hidden');
            }
        }
    };

    const applyOrbitPercent = (pct) => {
        const clamped = Math.max(0, Math.min(200, Number(pct) || 0));
        window.orbitSpeedFactor = clamped / 100;
        orbSliders.forEach(s => { if (Number(s.value) !== clamped) s.value = String(clamped); });
        orbVals.forEach(v => { v.textContent = `${clamped}%`; });
        if (clamped > 0) {
            if ((currentMode === 'solarSystem' || currentMode === 'moonPhases') && window.appTimeScale === 0) {
                window.appTimeScale = savedTimeScale !== 0 ? savedTimeScale : 1;
                updateTimeDisplay();
            } else if (currentMode === 'seasons' && seasonsScene && !seasonsScene.isPlaying) {
                seasonsScene.isPlaying = true;
                if (seasonsScene.playIcon) seasonsScene.playIcon.classList.add('hidden');
                if (seasonsScene.pauseIcon) seasonsScene.pauseIcon.classList.remove('hidden');
            }
        }
    };

    rotSliders.forEach(slider => {
        slider.addEventListener('input', (e) => applyRotationPercent(e.target.value));
        slider.addEventListener('pointerdown', (e) => e.stopPropagation());
        slider.addEventListener('touchstart', (e) => e.stopPropagation(), { passive: true });
    });

    orbSliders.forEach(slider => {
        slider.addEventListener('input', (e) => applyOrbitPercent(e.target.value));
        slider.addEventListener('pointerdown', (e) => e.stopPropagation());
        slider.addEventListener('touchstart', (e) => e.stopPropagation(), { passive: true });
    });

    const levelMap = ['lvl4', 'lvl5', 'lvl7', 'lvl10', 'lvl16', 'expert'];
    const levelDisplayMap = ['Ab 4 J.', 'Klasse 5', 'Klasse 7', 'Klasse 10', 'Oberstufe (16+)', 'Experte'];
    const levelBadgeSummaries = [
        'Detailstufe 1/6 • 8 Planeten + Erdmond',
        'Detailstufe 2/6 • 8 Planeten + Galileische Monde & Titan',
        'Detailstufe 3/6 • + Phobos/Deimos, Triton, Uranusringe, Ceres & Pluto',
        'Detailstufe 4/6 • + Große Eismonde, Kuipergürtel, Komet Halley & ISS',
        'Detailstufe 5/6 • + 28 Monde/Sonden, Jupiterringe, Eris, Haumea & Makemake',
        'Detailstufe 6/6 • Vollausbau: Alle Monde, Raumsonden, Trojaner & Sedna'
    ];

    const levelSliderEl = document.getElementById('level-slider');
    if (levelSliderEl) {
        const initVal = parseInt(levelSliderEl.value, 10);
        const safeVal = Number.isNaN(initVal) ? 3 : initVal;
        currentLevel = levelMap[safeVal] || 'lvl10';
        window.currentLevel = currentLevel;
        const lvlDisp = document.getElementById('level-display');
        if (lvlDisp) lvlDisp.textContent = levelDisplayMap[safeVal] || 'Klasse 10';
        const detailBadge = document.getElementById('level-detail-badge');
        if (detailBadge) detailBadge.textContent = levelBadgeSummaries[safeVal] || '';
    }
    
    document.getElementById('level-slider').addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        currentLevel = levelMap[val];
        window.currentLevel = levelMap[val];
        document.getElementById('level-display').textContent = levelDisplayMap[val];
        const detailBadge = document.getElementById('level-detail-badge');
        if (detailBadge) detailBadge.textContent = levelBadgeSummaries[val] || '';

        // Rebuild 3D Solar System models for the selected knowledge level and display progress via spaceLoader
        if (solarSystemScene) {
            solarSystemScene.applyKnowledgeLevel(val, true);
            updatePlanetList(solarSystemScene.isLinedUp);
        }
        
        // Re-render active UI based on new level
        if (currentMode === 'solarSystem' && trackedPlanet) {
            const resolved = resolveSolarObjectInfo(trackedPlanet);
            if (resolved && resolved.data) showInfoPanel(resolved.data, trackedPlanet);
        } else if (currentMode === 'sizeComparison' && sizeComparisonScene) {
            sizeComparisonScene.updateCurrentUIMetadata();
        } else if (currentMode === 'starCycle' && starCycleScene) {
            starCycleScene.updateUI();
        } else if (currentMode === 'moonPhases' && moonPhasesScene) {
            moonPhasesScene.updateLevelExplanation();
        } else if (currentMode === 'seasons' && seasonsScene) {
            seasonsScene.updateLevelExplanation();
        }
    });

    document.getElementById('global-menu-btn').addEventListener('click', () => {
        document.getElementById('global-sidebar').classList.toggle('open');
    });

    document.getElementById('local-menu-btn').addEventListener('click', () => {
        document.getElementById('local-sidebar-right').classList.toggle('open');
    });

    // Changelog Modal Event Handlers
    const changelogModal = document.getElementById('changelog-modal');
    const btnOpenChangelog = document.getElementById('btn-open-changelog');
    const btnCloseChangelog = document.getElementById('btn-close-changelog');

    function openChangelog() {
        if (!changelogModal) return;
        changelogModal.classList.remove('hidden');
        changelogModal.setAttribute('aria-hidden', 'false');
        if (typeof controls !== 'undefined' && controls) controls.enabled = false;
    }

    function closeChangelog() {
        if (!changelogModal) return;
        changelogModal.classList.add('hidden');
        changelogModal.setAttribute('aria-hidden', 'true');
        if (typeof controls !== 'undefined' && controls) controls.enabled = true;
    }

    if (btnOpenChangelog) btnOpenChangelog.addEventListener('click', openChangelog);
    if (btnCloseChangelog) btnCloseChangelog.addEventListener('click', closeChangelog);
    if (changelogModal) {
        changelogModal.addEventListener('wheel', (e) => { e.stopPropagation(); }, { passive: true });
        changelogModal.addEventListener('touchmove', (e) => { e.stopPropagation(); }, { passive: true });
        changelogModal.addEventListener('click', (e) => {
            if (e.target === changelogModal) closeChangelog();
        });
    }
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && changelogModal && !changelogModal.classList.contains('hidden')) {
            closeChangelog();
        }
    });

    // Populate Sidebar sorted by distance, including level-unlocked moons, probes & extra celestial bodies
    function updatePlanetList(isLinedUp) {
        const planetList = document.getElementById('planet-list');
        if (!planetList) return;
        planetList.innerHTML = '';

        const levelIdx = solarSystemScene ? solarSystemScene.currentLevelIndex : 1;
        const levelSummaryEl = document.getElementById('solar-level-summary');
        const showExtras = solarSystemScene ? solarSystemScene.showExtraBodies : true;
        const allowExtras = !isLinedUp && showExtras;

        let activeMoonTotal = 0;
        let activeExtraTotal = 0;
        
        const sortedPlanetKeys = Object.keys(planetData).sort((a,b) => planetData[a].distanceFromCenter - planetData[b].distanceFromCenter);
        
        sortedPlanetKeys.forEach(key => {
            const data = planetData[key];
            const li = document.createElement('li');
            li.className = 'planet-list-item';

            const unlockedMoons = (allowExtras && Array.isArray(data.moons))
                ? data.moons.filter(m => m.minLevel <= levelIdx)
                : [];
            activeMoonTotal += unlockedMoons.length;

            const headerDiv = document.createElement('div');
            headerDiv.className = 'planet-item-header-row';
            
            if (isLinedUp && planetMnemonics[key]) {
                const m = planetMnemonics[key];
                headerDiv.innerHTML = `
                    <div class="planet-item-content">
                        <span class="mnemonic-tag"><strong class="highlight-letter">${m.letter}</strong>${m.word.slice(1)}</span>
                        <span class="planet-item-name">${data.name}</span>
                    </div>
                `;
            } else if (isLinedUp && key === 'sun') {
                headerDiv.innerHTML = `
                    <div class="planet-item-content">
                        <span class="mnemonic-tag sun-tag">${data.name}</span>
                        <span class="planet-item-name" style="color: #ffaa00; font-size: 0.75rem;">Zentralstern</span>
                    </div>
                `;
            } else {
                const countBadge = (allowExtras && unlockedMoons.length > 0)
                    ? `<span class="planet-moon-count-badge">${unlockedMoons.length} Begleiter</span>`
                    : '';
                headerDiv.innerHTML = `
                    <div class="planet-item-content" style="justify-content: space-between; width: 100%;">
                        <span class="planet-item-name">${data.name}</span>
                        ${countBadge}
                    </div>
                `;
            }
            li.appendChild(headerDiv);

            // Render clickable sub-chips for unlocked moons & spacecraft
            if (allowExtras && unlockedMoons.length > 0) {
                const subList = document.createElement('div');
                subList.className = 'sidebar-moons-sublist';
                unlockedMoons.forEach(mData => {
                    const isSc = Boolean(mData.isSpacecraft || mData.shape === 'spacecraft');
                    const chip = document.createElement('button');
                    chip.type = 'button';
                    chip.className = `sidebar-moon-chip${isSc ? ' is-spacecraft' : ''}`;
                    chip.innerHTML = `<span class="moon-dot">${isSc ? '🛰️' : '🌙'}</span>${mData.name}`;
                    chip.addEventListener('click', (e) => {
                        e.stopPropagation();
                        if (currentMode !== 'solarSystem') switchMode('solarSystem');
                        const lookupKey = `${key}:${mData.id}`;
                        const interactables = solarSystemScene.getInteractableObjects();
                        const mesh = interactables.find(m => m.userData && m.userData.planetId === lookupKey);
                        if (mesh) focusPlanet(mesh);
                        document.getElementById('local-sidebar-right').classList.remove('open');
                    });
                    subList.appendChild(chip);
                });
                li.appendChild(subList);
            }
            
            li.addEventListener('click', () => {
                if (currentMode !== 'solarSystem') switchMode('solarSystem');
                const interactables = solarSystemScene.getInteractableObjects();
                const mesh = interactables.find(m => m.userData && m.userData.planetId === key);
                if (mesh) focusPlanet(mesh);
                document.getElementById('local-sidebar-right').classList.remove('open');
            });
            planetList.appendChild(li);
        });

        // Extra Celestial Bodies section (Dwarf Planets, Comets, Trojans) in Orbit mode
        if (allowExtras && typeof solarSystemExtraBodies !== 'undefined') {
            const unlockedExtras = solarSystemExtraBodies.filter(eb => eb.minLevel <= levelIdx);
            activeExtraTotal = unlockedExtras.length;
            if (unlockedExtras.length > 0) {
                const divider = document.createElement('li');
                divider.className = 'sidebar-extra-section-title';
                divider.textContent = 'Zwergplaneten, Kometen & Gürtel';
                planetList.appendChild(divider);

                unlockedExtras.forEach(eb => {
                    const li = document.createElement('li');
                    li.className = 'planet-list-item';
                    const lookupKey = `extra:${eb.id}`;
                    const unlockedSubMoons = Array.isArray(eb.moons) ? eb.moons.filter(sm => sm.minLevel <= levelIdx) : [];
                    activeMoonTotal += unlockedSubMoons.length;

                    const isIrr = Boolean(eb.isIrregular || eb.shape === 'irregular');
                    const icon = eb.isComet ? '☄️' : (isIrr ? '🪨' : '🪐');
                    li.innerHTML = `
                        <div class="planet-item-content" style="justify-content: space-between; width: 100%;">
                            <span class="planet-item-name">${icon} ${eb.name}</span>
                            <span class="planet-moon-count-badge">${eb.type.split(' ')[0]}</span>
                        </div>
                    `;

                    if (unlockedSubMoons.length > 0) {
                        const subList = document.createElement('div');
                        subList.className = 'sidebar-moons-sublist';
                        unlockedSubMoons.forEach(sm => {
                            const chip = document.createElement('button');
                            chip.type = 'button';
                            chip.className = 'sidebar-moon-chip';
                            chip.innerHTML = `<span class="moon-dot">🌙</span>${sm.name}`;
                            chip.addEventListener('click', (e) => {
                                e.stopPropagation();
                                const smKey = `extra:${eb.id}:${sm.id}`;
                                const mesh = solarSystemScene.getInteractableObjects().find(m => m.userData && m.userData.planetId === smKey);
                                if (mesh) focusPlanet(mesh);
                                document.getElementById('local-sidebar-right').classList.remove('open');
                            });
                            subList.appendChild(chip);
                        });
                        li.appendChild(subList);
                    }

                    li.addEventListener('click', () => {
                        if (currentMode !== 'solarSystem') switchMode('solarSystem');
                        const mesh = solarSystemScene.getInteractableObjects().find(m => m.userData && m.userData.planetId === lookupKey);
                        if (mesh) focusPlanet(mesh);
                        document.getElementById('local-sidebar-right').classList.remove('open');
                    });
                    planetList.appendChild(li);
                });
            }
        }

        if (levelSummaryEl) {
            if (isLinedUp) {
                levelSummaryEl.textContent = 'Ansicht: Merkspruch-Reihenfolge der 8 Hauptplaneten';
            } else if (!showExtras) {
                levelSummaryEl.textContent = 'Ansicht: Nur die 8 Planeten des Sonnensystems (weitere Körper ausgeblendet)';
            } else {
                const beltsInfo = levelIdx >= 3 ? ' + Asteroiden- & Kuipergürtel' : (levelIdx >= 2 ? ' + Asteroidengürtel' : '');
                levelSummaryEl.textContent = `Aktiv auf diesem Niveau: 8 Planeten, ${activeMoonTotal} Monde/Sonden${activeExtraTotal > 0 ? `, ${activeExtraTotal} Zwergplaneten/Kometen` : ''}${beltsInfo}`;
            }
        }
    }

    window.updatePlanetList = updatePlanetList;
    updatePlanetList(false);

    const finaleList = document.getElementById('finale-list');
    
    window.updateFinaleSidebar = (activeData) => {
        finaleList.innerHTML = '';
        
        const sortedActiveData = [...activeData]
            .filter(d => !d.isUniverse)
            .sort((a, b) => a.radiusKm - b.radiusKm);
            
        const uniIdx = activeData.findIndex(d => d.isUniverse);
        
        if (uniIdx !== -1) {
            const li = document.createElement('li');
            li.textContent = "Universum";
            li.style.fontWeight = 'bold';
            li.style.borderBottom = '1px solid rgba(255,255,255,0.2)';
            li.style.marginBottom = '8px';
            li.style.paddingBottom = '8px';
            li.addEventListener('click', () => {
                sizeComparisonScene.jumpToIndex(uniIdx);
                document.getElementById('local-sidebar-right').classList.remove('open');
            });
            finaleList.appendChild(li);
        }

        sortedActiveData.forEach((data) => {
            const currentIdx = activeData.findIndex(d => d.name === data.name);
            const li = document.createElement('li');
            li.textContent = data.name;
            li.addEventListener('click', () => {
                sizeComparisonScene.jumpToIndex(currentIdx);
                document.getElementById('local-sidebar-right').classList.remove('open');
            });
            finaleList.appendChild(li);
        });
    };

    window.updateFinaleSidebar(sizeComparisonData);
    setSolarSystemView(false);
}

function showInfoPanel(data, meshObject = null) {
    if (!data) return;
    const levelNames = {
        lvl4: 'Ab 4 J.',
        lvl5: 'Klasse 5',
        lvl7: 'Klasse 7',
        lvl10: 'Klasse 10',
        lvl16: 'Oberstufe (16+)',
        expert: 'Experte'
    };
    const levelIdx = solarSystemScene ? solarSystemScene.currentLevelIndex : 1;

    document.getElementById('info-title').textContent = data.name;
    const levelPill = document.getElementById('info-level-pill');
    if (levelPill) levelPill.textContent = levelNames[currentLevel] || 'Klasse 5';

    document.getElementById('info-type').textContent = data.type || 'Himmelskörper';
    const diamVal = String(data.diameter || '–');
    const distVal = String(data.distance || '–');
    document.getElementById('info-diameter').textContent = diamVal;
    const diamUnitEl = document.getElementById('info-diameter-unit');
    if (diamUnitEl) {
        diamUnitEl.textContent = /km|m\b/i.test(diamVal) ? '' : ' km';
    }
    document.getElementById('info-distance').textContent = distVal;
    const distUnitEl = document.getElementById('info-distance-unit');
    if (distUnitEl) {
        distUnitEl.textContent = /km|AE|AU/i.test(distVal) ? '' : ' Mio. km';
    }
    const distLabelEl = document.getElementById('info-distance-label');
    if (distLabelEl) {
        const isCompanion = Boolean(meshObject && meshObject.userData && meshObject.userData.parentPlanetId);
        distLabelEl.textContent = isCompanion ? 'Abstand zum Hauptkörper:' : 'Entfernung zur Sonne:';
    }

    // Orbital Period & Temperature rows
    const periodRow = document.getElementById('info-period-row');
    const periodSpan = document.getElementById('info-period');
    if (periodRow && periodSpan) {
        if (data.orbitalPeriod) {
            periodRow.classList.remove('hidden');
            periodSpan.textContent = data.orbitalPeriod;
        } else {
            periodRow.classList.add('hidden');
        }
    }

    const tempRow = document.getElementById('info-temp-row');
    const tempSpan = document.getElementById('info-temp');
    if (tempRow && tempSpan) {
        if (data.surfaceTemp) {
            tempRow.classList.remove('hidden');
            tempSpan.textContent = data.surfaceTemp;
        } else {
            tempRow.classList.add('hidden');
        }
    }

    // Back-to-parent button when viewing a moon or spacecraft
    const btnBackParent = document.getElementById('btn-back-parent');
    if (btnBackParent) {
        if (meshObject && meshObject.userData && meshObject.userData.parentPlanetId) {
            btnBackParent.classList.remove('hidden');
            btnBackParent.textContent = `← ${meshObject.userData.parentPlanetName || 'Hauptkörper'}`;
        } else {
            btnBackParent.classList.add('hidden');
        }
    }

    const desc = data.texts
        ? (data.texts[currentLevel] || data.texts.lvl10 || data.texts.lvl5 || '')
        : (data.description || '');
    document.getElementById('info-description').textContent = desc;
    
    // Mnemonic row in info panel
    const mnemonicRow = document.getElementById('info-mnemonic-row');
    const mnemonicSpan = document.getElementById('info-mnemonic');
    if (mnemonicRow && mnemonicSpan) {
        if (planetMnemonics && planetMnemonics[data.id]) {
            const m = planetMnemonics[data.id];
            mnemonicRow.classList.remove('hidden');
            mnemonicSpan.innerHTML = `„<strong style="color: #00d4ff; font-size: 1.05em;">${m.word}</strong>“ &nbsp;(<span style="color: #00d4ff; font-weight: bold;">${m.letter}</span> – ${data.name})<div style="font-size: 0.8rem; color: #8da4be; margin-top: 4px; font-style: italic;">„Mein Vater erklärt mir jeden Sonntag unseren Nachthimmel.“</div>`;
        } else {
            mnemonicRow.classList.add('hidden');
        }
    }

    // Companions (Moons & Spacecraft) section in Info Panel
    const compSection = document.getElementById('info-companions-section');
    const compList = document.getElementById('info-companions-list');
    const compHint = document.getElementById('info-companions-hint');
    if (compSection && compList && compHint) {
        const allMoons = Array.isArray(data.moons) ? data.moons : [];
        const unlockedMoons = allMoons.filter(m => m.minLevel <= levelIdx);
        const lockedCount = allMoons.length - unlockedMoons.length;

        if (unlockedMoons.length > 0 || lockedCount > 0) {
            compSection.classList.remove('hidden');
            compList.innerHTML = '';

            unlockedMoons.forEach(mData => {
                const isSc = Boolean(mData.isSpacecraft || mData.shape === 'spacecraft');
                const chip = document.createElement('button');
                chip.type = 'button';
                chip.className = `companion-chip${isSc ? ' is-spacecraft' : ''}`;
                chip.innerHTML = `<span>${isSc ? '🛰️' : '🌙'}</span><span>${mData.name}</span>`;
                chip.addEventListener('click', () => {
                    const parentPrefix = (meshObject && meshObject.userData && meshObject.userData.isExtraBody)
                        ? meshObject.userData.planetId
                        : data.id;
                    const lookupKey = `${parentPrefix}:${mData.id}`;
                    const target = solarSystemScene.getInteractableObjects().find(
                        obj => obj.userData && obj.userData.planetId === lookupKey
                    );
                    if (target) focusPlanet(target);
                });
                compList.appendChild(chip);
            });

            if (lockedCount > 0) {
                compHint.textContent = `💡 Erhöhe das Wissensniveau oben links, um ${lockedCount} weitere ${lockedCount === 1 ? 'Mond/Begleiter' : 'Monde/Begleiter'} in 3D freizuschalten (insgesamt bekannt: ${data.knownMoonsCount || allMoons.length}).`;
            } else if (data.knownMoonsCount !== undefined) {
                compHint.textContent = `Alle ${unlockedMoons.length} modellierten 3D-Begleiter aktiv (insgesamt bekannte Monde: ${data.knownMoonsCount}). Klicke auf einen Begleiter für den 3D-Kameraflug!`;
            } else {
                compHint.textContent = 'Klicke auf einen Begleiter für den direkten 3D-Kameraflug.';
            }
        } else {
            compSection.classList.add('hidden');
        }
    }
    
    isInfoPanelMinimized = false;
    const dockedClose = document.getElementById('btn-docked-close');
    if (dockedClose) dockedClose.classList.add('hidden');
    const timeControlsEl = document.getElementById('time-controls');
    if (timeControlsEl) {
        timeControlsEl.classList.add('hidden');
    }
    const infoPanel = document.getElementById('info-panel');
    if (infoPanel) infoPanel.classList.remove('hidden');
}

function hideInfoPanel() {
    isInfoPanelMinimized = false;
    const infoPanel = document.getElementById('info-panel');
    if (infoPanel) infoPanel.classList.add('hidden');
    const dockedClose = document.getElementById('btn-docked-close');
    if (dockedClose) dockedClose.classList.add('hidden');
    const timeControlsEl = document.getElementById('time-controls');
    if (timeControlsEl && (currentMode === 'solarSystem' || currentMode === 'moonPhases')) {
        timeControlsEl.classList.remove('hidden');
    }
}

function animate() {
    requestAnimationFrame(animate);

    if (currentMode === 'solarSystem') {
        if (solarSystemScene) solarSystemScene.update();
        
        // Dynamic Camera Tracking with free OrbitControls manipulation
        if (trackedPlanet && !isFocusTweening) {
            const currentPlanetPos = new THREE.Vector3();
            trackedPlanet.getWorldPosition(currentPlanetPos);
            
            // Delta displacement of the planet along its orbit this frame
            const delta = currentPlanetPos.clone().sub(prevTrackedPlanetPos);
            controls.target.add(delta);
            camera.position.add(delta);
            
            prevTrackedPlanetPos.copy(currentPlanetPos);
        }
    } else if (currentMode === 'moonPhases') {
        if (moonPhasesScene) moonPhasesScene.update();
    } else if (currentMode === 'sizeComparison') {
        if (sizeComparisonScene) sizeComparisonScene.update();
    } else if (currentMode === 'rocketLaunch') {
        const dt = clock ? clock.getDelta() : 0.016;
        if (rocketLaunchScene) {
            try {
                rocketLaunchScene.update(dt);
            } catch (e) {
                console.error("Error in RocketLaunch update:", e);
            }
        }
    } else if (currentMode === 'starCycle') {
        if (starCycleScene) starCycleScene.update();
    } else if (currentMode === 'seasons') {
        const dt = clock ? clock.getDelta() : 0.016;
        if (seasonsScene) {
            try {
                seasonsScene.update(dt);
            } catch (e) {
                console.error("Error in Seasons update:", e);
            }
        }
    }

    controls.update();
    // Skip main scene render when blackHole is active (it renders its own full-screen quad)
    if (currentMode !== 'blackHole') {
        renderer.render(scene, camera);
    }
    if(labelRenderer) labelRenderer.render(scene, camera);
    perfManager.update();
}

window.onload = init;
