import { useMemo, useEffect } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { useAppState } from '../state/appContext';
import { useDebounce } from '../hooks/useDebounce';
import { parseInputs } from '../math/validation';

export interface MaterialConfig {
  color: string;
  roughness: number;
  metalness: number;
  bumpScale: number;
}

const LIGHT_CLAY: MaterialConfig = {
  color: '#ffffff',
  roughness: 1.0,
  metalness: 0.0,
  bumpScale: 0.020,
};

const GRAIN_SVG_URI =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)'/%3E%3C/svg%3E";

function createCeramicColorMap(): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#E7DDDB';
  ctx.fillRect(0, 0, size, size);

  const coolPatches = [
    { x: 0.06, y: 0.14, r: 0.18, a: 0.20 },
    { x: 0.88, y: 0.22, r: 0.14, a: 0.16 },
    { x: 0.04, y: 0.58, r: 0.20, a: 0.22 },
    { x: 0.93, y: 0.64, r: 0.16, a: 0.18 },
    { x: 0.32, y: 0.90, r: 0.18, a: 0.21 },
    { x: 0.68, y: 0.84, r: 0.14, a: 0.17 },
    { x: 0.50, y: 0.07, r: 0.12, a: 0.14 },
    { x: 0.20, y: 0.40, r: 0.09, a: 0.13 },
    { x: 0.80, y: 0.48, r: 0.11, a: 0.15 },
  ];

  for (const p of coolPatches) {
    const grd = ctx.createRadialGradient(
      p.x * size, p.y * size, 0,
      p.x * size, p.y * size, p.r * size
    );
    grd.addColorStop(0, `rgba(174, 195, 209, ${p.a})`);
    grd.addColorStop(1, 'rgba(174, 195, 209, 0)');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, size, size);
  }

  const leftEdge = ctx.createLinearGradient(0, 0, size * 0.10, 0);
  leftEdge.addColorStop(0, 'rgba(197, 186, 183, 0.45)');
  leftEdge.addColorStop(1, 'rgba(197, 186, 183, 0)');
  ctx.fillStyle = leftEdge;
  ctx.fillRect(0, 0, size, size);

  const rightEdge = ctx.createLinearGradient(size, 0, size * 0.90, 0);
  rightEdge.addColorStop(0, 'rgba(197, 186, 183, 0.45)');
  rightEdge.addColorStop(1, 'rgba(197, 186, 183, 0)');
  ctx.fillStyle = rightEdge;
  ctx.fillRect(0, 0, size, size);

  const bottomGrd = ctx.createLinearGradient(0, size * 0.65, 0, size);
  bottomGrd.addColorStop(0, 'rgba(184, 202, 206, 0)');
  bottomGrd.addColorStop(1, 'rgba(184, 202, 206, 0.32)');
  ctx.fillStyle = bottomGrd;
  ctx.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1, 1);
  return texture;
}

function createCeramicBumpMap(): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, size, size);

  const imageData = ctx.getImageData(0, 0, size, size);
  const data = imageData.data;
  let seed = 0xdeadbeef;
  const rand = () => {
    seed ^= seed << 13;
    seed ^= seed >> 17;
    seed ^= seed << 5;
    return (seed >>> 0) / 0xffffffff;
  };

  for (let i = 0; i < data.length; i += 4) {
    const noise = Math.floor((rand() - 0.5) * 55);
    const v = Math.min(255, Math.max(0, 128 + noise));
    data[i] = v;
    data[i + 1] = v;
    data[i + 2] = v;
    data[i + 3] = 255;
  }
  ctx.putImageData(imageData, 0, 0);

  for (let j = 0; j < 20; j++) {
    const x = (j * 79 + 31) % size;
    const y = (j * 113 + 53) % size;
    const r = 22 + (j * 23) % 50;
    const bright = 108 + ((j * 37) % 44);
    const grd = ctx.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, `rgba(${bright}, ${bright}, ${bright}, 0.38)`);
    grd.addColorStop(1, 'rgba(128, 128, 128, 0)');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, size, size);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4, 4);
  return texture;
}

// ─── Geometry creators (at real mm dimensions, scaled externally) ─────────────

function createObliqueFrustumGeometry(
  bottomRadius: number,
  topRadius: number,
  height: number,
  segments: number = 64
): THREE.BufferGeometry {
  const dx = bottomRadius - topRadius;
  const hy = height / 2;
  const positions: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i <= segments; i++) {
    const theta = (i / segments) * 2 * Math.PI;
    const c = Math.cos(theta), s = Math.sin(theta);
    positions.push(bottomRadius * c, -hy, bottomRadius * s);
    positions.push(dx + topRadius * c,  hy, topRadius * s);
  }
  for (let i = 0; i < segments; i++) {
    const b0 = i * 2, t0 = b0 + 1, b1 = b0 + 2, t1 = b1 + 1;
    indices.push(b0, t0, b1);
    indices.push(t0, t1, b1);
  }

  const botBase = (segments + 1) * 2;
  positions.push(0, -hy, 0);
  for (let i = 0; i <= segments; i++) {
    const theta = (i / segments) * 2 * Math.PI;
    positions.push(bottomRadius * Math.cos(theta), -hy, bottomRadius * Math.sin(theta));
  }
  for (let i = 0; i < segments; i++) {
    indices.push(botBase, botBase + 1 + i, botBase + 1 + i + 1);
  }

  const topBase = botBase + 1 + (segments + 1);
  positions.push(dx, hy, 0);
  for (let i = 0; i <= segments; i++) {
    const theta = (i / segments) * 2 * Math.PI;
    positions.push(dx + topRadius * Math.cos(theta), hy, topRadius * Math.sin(theta));
  }
  for (let i = 0; i < segments; i++) {
    indices.push(topBase, topBase + 1 + i + 1, topBase + 1 + i);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function createTaperedBoxGeometry(
  bottomWidth: number, bottomLength: number,
  topWidth: number, topLength: number,
  height: number
): THREE.BufferGeometry {
  const hw_b = bottomWidth / 2, hl_b = bottomLength / 2;
  const hw_t = topWidth / 2, hl_t = topLength / 2;
  const hy = height / 2;

  const positions: number[] = [];
  const indices: number[] = [];
  let vi = 0;

  const quad = (
    ax: number, ay: number, az: number,
    bx: number, by: number, bz: number,
    cx: number, cy: number, cz: number,
    dx: number, dy: number, dz: number,
  ) => {
    positions.push(ax, ay, az, bx, by, bz, cx, cy, cz, dx, dy, dz);
    indices.push(vi, vi + 1, vi + 2,  vi, vi + 2, vi + 3);
    vi += 4;
  };

  quad(-hw_b, -hy,  hl_b,   hw_b, -hy,  hl_b,   hw_t,  hy,  hl_t,  -hw_t,  hy,  hl_t);
  quad( hw_b, -hy, -hl_b,  -hw_b, -hy, -hl_b,  -hw_t,  hy, -hl_t,   hw_t,  hy, -hl_t);
  quad( hw_b, -hy,  hl_b,   hw_b, -hy, -hl_b,   hw_t,  hy, -hl_t,   hw_t,  hy,  hl_t);
  quad(-hw_b, -hy, -hl_b,  -hw_b, -hy,  hl_b,  -hw_t,  hy,  hl_t,  -hw_t,  hy, -hl_t);
  quad(-hw_b, -hy, -hl_b,   hw_b, -hy, -hl_b,   hw_b, -hy,  hl_b,  -hw_b, -hy,  hl_b);
  quad(-hw_t,  hy,  hl_t,   hw_t,  hy,  hl_t,   hw_t,  hy, -hl_t,  -hw_t,  hy, -hl_t);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

// ─── Camera controller ────────────────────────────────────────────────────────

function CameraController({ boundingSize }: { boundingSize: number }) {
  const { camera, invalidate } = useThree();
  useEffect(() => {
    const d = Math.max(boundingSize, 0.1);
    const cam = camera as THREE.PerspectiveCamera;
    cam.position.set(d * 1.2, d * 0.4, d * 2.6);
    /* eslint-disable react-hooks/immutability */
    cam.near = d * 0.01;
    cam.far = d * 20;
    /* eslint-enable react-hooks/immutability */
    cam.lookAt(0, 0, 0);
    cam.updateProjectionMatrix();
    invalidate();
  }, [camera, boundingSize, invalidate]);
  return null;
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Preview3DProps {
  materialConfig?: MaterialConfig;
}

export function Preview3D({ materialConfig = LIGHT_CLAY }: Preview3DProps) {
  const { state } = useAppState();
  const debouncedStack = useDebounce(state.stack, 300);
  const debouncedUnit = useDebounce(state.unit, 300);

  const bumpMap = useMemo(() => createCeramicBumpMap(), []);
  const colorMap = useMemo(() => createCeramicColorMap(), []);
  useEffect(() => () => { bumpMap.dispose(); colorMap.dispose(); }, [bumpMap, colorMap]);

  // Parse every stack item
  const parsedItems = useMemo(() =>
    debouncedStack.map(item => ({
      id: item.id,
      shape: item.shape,
      parsed: parseInputs(item.shape, item.inputs, debouncedUnit),
    })),
    [debouncedStack, debouncedUnit]
  );

  // Global scale + Y offsets — fit entire composition into ~3 world units
  const layout = useMemo(() => {
    let totalH = 0;
    let maxR = 0;
    const heights: number[] = [];

    for (const { shape, parsed } of parsedItems) {
      if (!parsed) { heights.push(0); continue; }
      const h = (parsed as Record<string, number>).height ?? 0;
      heights.push(h);
      totalH += h;

      if (shape === 'cone') maxR = Math.max(maxR, (parsed as { radius: number }).radius);
      else if (shape === 'truncatedCone' || shape === 'obliqueFrustum') {
        const p = parsed as { bottomRadius: number; topRadius: number };
        maxR = Math.max(maxR, p.bottomRadius, p.topRadius);
      } else if (shape === 'taperedBox') {
        const p = parsed as { bottomWidth: number; bottomLength: number };
        maxR = Math.max(maxR, p.bottomWidth / 2, p.bottomLength / 2);
      }
    }

    const sc = 3 / Math.max(totalH, maxR * 2, 0.001);
    let yAcc = -totalH / 2;
    const offsets = heights.map(h => {
      const center = yAcc + h / 2;
      yAcc += h;
      return center;
    });

    return { scale: sc, offsets, totalHeight: totalH, maxRadius: maxR };
  }, [parsedItems]);

  // Custom geometries at real mm dimensions — disposed when stack changes
  const customGeos = useMemo(() =>
    parsedItems.map(({ shape, parsed }) => {
      if (!parsed) return null;
      if (shape === 'obliqueFrustum') {
        const p = parsed as { bottomRadius: number; topRadius: number; height: number };
        return createObliqueFrustumGeometry(p.bottomRadius, p.topRadius, p.height);
      }
      if (shape === 'taperedBox') {
        const p = parsed as { bottomWidth: number; bottomLength: number; topWidth: number; topLength: number; height: number };
        return createTaperedBoxGeometry(p.bottomWidth, p.bottomLength, p.topWidth, p.topLength, p.height);
      }
      return null;
    }),
    [parsedItems]
  );

  useEffect(() => () => { customGeos.forEach(g => g?.dispose()); }, [customGeos]);

  const boundingSize = Math.max(layout.totalHeight, layout.maxRadius * 2, 0.1) * layout.scale;

  return (
    <div style={{ height: '100%' }}>
      <div
        className="w-full rounded-md overflow-hidden"
        style={{ backgroundColor: '#EDE4D5', position: 'relative', height: '100%' }}
      >
        <Canvas
          camera={{ position: [0, 1.5, 3.0], fov: 45 }}
          gl={{ antialias: true }}
          frameloop="demand"
        >
          <ambientLight intensity={0.20} color="#d8e4ec" />
          <directionalLight position={[-2, 3.5, 2]} intensity={1.1} color="#fff5ee" />
          <directionalLight position={[2, 0.5, 1]} intensity={0.25} color="#aec3d1" />

          <CameraController boundingSize={boundingSize} />

          <group scale={[layout.scale, layout.scale, layout.scale]}>
            {parsedItems.map(({ id, shape, parsed }, idx) => {
              if (!parsed) return null;
              const yOffset = layout.offsets[idx];
              const p = parsed as Record<string, number>;

              if (shape === 'cone') {
                return (
                  <mesh key={id} position={[0, yOffset, 0]}>
                    <cylinderGeometry args={[0, p.radius, p.height, 64, 1]} />
                    <meshStandardMaterial
                      color={materialConfig.color}
                      roughness={materialConfig.roughness}
                      metalness={materialConfig.metalness}
                      map={colorMap}
                      bumpMap={bumpMap}
                      bumpScale={materialConfig.bumpScale}
                    />
                  </mesh>
                );
              }

              if (shape === 'truncatedCone') {
                return (
                  <mesh key={id} position={[0, yOffset, 0]}>
                    <cylinderGeometry args={[p.topRadius, p.bottomRadius, p.height, 64, 1]} />
                    <meshStandardMaterial
                      color={materialConfig.color}
                      roughness={materialConfig.roughness}
                      metalness={materialConfig.metalness}
                      map={colorMap}
                      bumpMap={bumpMap}
                      bumpScale={materialConfig.bumpScale}
                    />
                  </mesh>
                );
              }

              const customGeo = customGeos[idx];
              if ((shape === 'obliqueFrustum' || shape === 'taperedBox') && customGeo) {
                return (
                  <mesh key={id} position={[0, yOffset, 0]} geometry={customGeo}>
                    <meshStandardMaterial
                      color={materialConfig.color}
                      roughness={materialConfig.roughness}
                      metalness={materialConfig.metalness}
                      map={colorMap}
                      bumpMap={bumpMap}
                      bumpScale={materialConfig.bumpScale}
                    />
                  </mesh>
                );
              }

              return null;
            })}
          </group>

          <OrbitControls
            enableZoom={false}
            enablePan={false}
            minPolarAngle={0.2}
            maxPolarAngle={Math.PI * 0.85}
            target={[0, 0, 0]}
          />
        </Canvas>

        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: `url("${GRAIN_SVG_URI}")`,
            backgroundSize: '200px 200px',
            mixBlendMode: 'overlay',
            opacity: 0.20,
            pointerEvents: 'none',
          }}
        />
      </div>
    </div>
  );
}
