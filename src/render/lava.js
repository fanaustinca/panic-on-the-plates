// Molten lava: domain-warped flowing magma under a drifting crust of cooled basalt plates
// (Voronoi cells) whose cracks glow. HDR colours so the tonemapper gives it a real glow.
// `fall` mode maps the same shader onto a vertical sheet for lavafalls.
import * as THREE from 'three';

const vert = /* glsl */`
uniform float uTime;
uniform float uFall;
varying vec3 vWorld;
varying vec2 vUv;
void main() {
  vUv = uv;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  if (uFall < 0.5) {
    // slow heaving swell
    wp.y += sin(wp.x * 0.45 + uTime * 0.7) * 0.06 + sin(wp.z * 0.6 - uTime * 0.5) * 0.05;
  }
  vWorld = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

const frag = /* glsl */`
uniform float uTime;
uniform float uFall;
uniform vec3 uFogColor;
uniform float uFogNear, uFogFar;
uniform vec2 uHole; // half extents of the island (no need to draw detail under it)
varying vec3 vWorld;
varying vec2 vUv;

vec2 hash2(vec2 p) { p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3))); return fract(sin(p) * 43758.5453); }
float hash(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 15731.743); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { s += a * noise(p); p = p * 2.03 + 17.1; a *= 0.5; } return s; }
// distance to the nearest Voronoi edge (F2 - F1), and the cell id
vec3 voronoi(vec2 x) {
  vec2 n = floor(x), f = fract(x);
  float d1 = 8.0, d2 = 8.0; vec2 id = vec2(0.0);
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec2 g = vec2(float(i), float(j));
    vec2 o = hash2(n + g);
    o = 0.5 + 0.42 * sin(uTime * 0.15 + 6.2831 * o);
    vec2 r = g + o - f;
    float d = dot(r, r);
    if (d < d1) { d2 = d1; d1 = d; id = n + g; } else if (d < d2) d2 = d;
  }
  return vec3(sqrt(d2) - sqrt(d1), id);
}

vec3 heatColor(float h) {
  // black-body-ish ramp, HDR at the top
  vec3 c = mix(vec3(0.25, 0.01, 0.0), vec3(1.0, 0.18, 0.0), smoothstep(0.0, 0.35, h));
  c = mix(c, vec3(1.35, 0.42, 0.04), smoothstep(0.35, 0.75, h));
  c = mix(c, vec3(1.9, 1.15, 0.4), smoothstep(0.8, 1.0, h));
  return c;
}

void main() {
  vec2 p;
  vec2 flow;
  if (uFall > 0.5) { p = vec2(vUv.x * 2.5, vUv.y * 9.0 + uTime * 1.1); flow = vec2(0.0); }
  else { p = vWorld.xz * 0.32; flow = vec2(uTime * 0.025, uTime * 0.012); }
  // domain warp for the molten flow
  vec2 q = vec2(fbm(p + flow), fbm(p + vec2(5.2, 1.3) - flow));
  vec2 r = vec2(fbm(p + 3.0 * q + vec2(1.7, 9.2) + uTime * 0.04), fbm(p + 3.0 * q + vec2(8.3, 2.8) - uTime * 0.03));
  float molten = fbm(p * 1.4 + 2.5 * r);
  // where the crust has broken open into rivers of bright lava
  float open = smoothstep(0.46, 0.7, fbm(p * 0.55 + r * 0.8 + vec2(uTime * 0.01, 0.0)));
  if (uFall > 0.5) open = 0.75 + 0.25 * molten;
  // crust plates drift with the flow
  vec3 vc = voronoi(p * 1.7 + r * 1.8);
  float fine = voronoi(p * 5.5 + r).x; // hairline cracks inside the plates
  float edge = vc.x;
  float plateShade = hash(vc.yz);
  float crack = max(1.0 - smoothstep(0.0, 0.1 + 0.14 * open, edge), (1.0 - smoothstep(0.0, 0.05, fine)) * 0.45 * (1.0 - plateShade * 0.6));
  float pulse = 0.5 + 0.5 * sin(uTime * 1.3 + plateShade * 6.28 + molten * 4.0);
  float heat = clamp(molten * 0.75 + open * 0.45 + 0.1 * pulse - 0.1, 0.0, 1.0);
  vec3 lava = heatColor(heat);
  // crust: dark cooled basalt, a little warmer near cracks, rough highlights
  vec3 crust = mix(vec3(0.035, 0.022, 0.02), vec3(0.09, 0.05, 0.04), plateShade);
  crust += vec3(0.5, 0.08, 0.0) * smoothstep(0.35, 0.0, edge) * 0.35;
  crust *= 0.8 + 0.4 * noise(p * 14.0);
  float crustAmt = (1.0 - open) * (1.0 - crack);
  vec3 col = mix(lava, crust, crustAmt);
  // glowing seams on top of the crust
  col += heatColor(0.45 + 0.35 * pulse) * crack * (1.0 - open) * 0.8;
  float dist = length(cameraPosition - vWorld);
  col = mix(col, uFogColor, smoothstep(uFogNear, uFogFar, dist) * 0.85);
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export function makeLava({ size = 160, seg = 120, y = -1.8, fall = false, w = 1, h = 1, fog = 0x2a0a06, fogNear = 30, fogFar = 90 } = {}) {
  const uniforms = {
    uTime: { value: 0 }, uFall: { value: fall ? 1 : 0 },
    uFogColor: { value: new THREE.Color(fog) }, uFogNear: { value: fogNear }, uFogFar: { value: fogFar },
    uHole: { value: new THREE.Vector2(0, 0) },
  };
  const material = new THREE.ShaderMaterial({ uniforms, vertexShader: vert, fragmentShader: frag });
  let geom;
  if (fall) geom = new THREE.PlaneGeometry(w, h, 1, 1);
  else { geom = new THREE.PlaneGeometry(size, size, seg, seg); geom.rotateX(-Math.PI / 2); }
  const mesh = new THREE.Mesh(geom, material);
  if (!fall) mesh.position.y = y;
  mesh.frustumCulled = false;
  return { mesh, uniforms, update(t) { uniforms.uTime.value = t; } };
}
