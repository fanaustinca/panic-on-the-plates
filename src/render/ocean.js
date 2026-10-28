// Gerstner-wave ocean: the vertex shader sums directional trochoidal waves (with analytic
// normals), the fragment shader does Fresnel sky reflection, subsurface tint in the crests,
// a sun glint, crest foam and a foam collar where the water meets the hull.
// heightAt() evaluates the same sum on the CPU so the ship can ride the swell.
import * as THREE from 'three';

const TAU = Math.PI * 2;

/** waves: [dirX, dirZ, wavelength, steepness, speedScale] */
const PRESETS = {
  sea: [[1, 0.25, 9, 0.22, 1], [0.7, 0.7, 5.5, 0.2, 1], [-0.3, 1, 3.6, 0.18, 1], [0.95, -0.4, 2.2, 0.16, 1], [0.2, 0.9, 1.4, 0.12, 1], [-0.8, 0.5, 13, 0.14, 1]],
  calm: [[1, 0.2, 7, 0.1, 0.8], [0.6, 0.8, 4, 0.09, 0.8], [-0.4, 1, 2.5, 0.08, 0.8], [0.9, -0.3, 1.5, 0.06, 0.8]],
};

const vert = /* glsl */`
uniform float uTime;
uniform vec4 uW[6];
uniform float uSpd[6];
uniform int uN;
varying vec3 vWorld;
varying vec3 vNormal;
varying float vCrest;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vec3 p = wp.xyz;
  vec3 g = vec3(0.0);
  vec3 tangent = vec3(1.0, 0.0, 0.0), binormal = vec3(0.0, 0.0, 1.0);
  float crest = 0.0;
  for (int i = 0; i < 6; i++) {
    if (i >= uN) break;
    vec2 d = normalize(uW[i].xy);
    float L = uW[i].z, steep = uW[i].w;
    float k = 6.2831853 / L;
    float c = sqrt(9.8 / k) * uSpd[i];
    float a = steep / k;
    float f = k * (dot(d, wp.xz) - c * uTime);
    float cf = cos(f), sf = sin(f);
    g.x += d.x * a * cf; g.y += a * sf; g.z += d.y * a * cf;
    tangent += vec3(-d.x * d.x * steep * sf, d.x * steep * cf, -d.x * d.y * steep * sf);
    binormal += vec3(-d.x * d.y * steep * sf, d.y * steep * cf, -d.y * d.y * steep * sf);
    crest += max(0.0, sf) * steep;
  }
  p += g;
  vNormal = normalize(cross(binormal, tangent));
  vWorld = p;
  vCrest = crest;
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}`;

const frag = /* glsl */`
uniform float uTime;
uniform vec3 uDeep, uShallow, uSky, uHorizon, uFoam, uSun, uFogColor;
uniform vec3 uSunDir;
uniform float uFogNear, uFogFar, uFoamAmt;
uniform vec4 uHull;   // centre x, centre z, half length, half beam (world units)
uniform vec2 uBowStern; // how far the bow / stern taper reaches beyond the half length
uniform float uRoll;
varying vec3 vWorld;
varying vec3 vNormal;
varying float vCrest;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { s += a * noise(p); p *= 2.07; a *= 0.5; } return s; }

// signed distance to the hull's waterline outline (rounded box with a pointed bow)
float hullDist(vec2 q) {
  q -= uHull.xy;
  float hl = uHull.z, hb = uHull.w;
  float x = q.x, z = abs(q.y);
  float beam = hb;
  if (x > hl) beam = hb * sqrt(max(0.0, 1.0 - pow((x - hl) / uBowStern.x, 2.0)));
  if (x < -hl) beam = hb * sqrt(max(0.0, 1.0 - pow((-hl - x) / uBowStern.y, 2.0)));
  float inX = (x > hl + uBowStern.x || x < -hl - uBowStern.y) ? 1.0 : 0.0;
  float dz = z - beam;
  float dx = max(x - (hl + uBowStern.x), (-hl - uBowStern.y) - x);
  return inX > 0.5 ? max(dx, dz) : dz;
}

void main() {
  vec3 n = normalize(vNormal);
  // ripples: perturb the normal with scrolling noise
  vec2 rp = vWorld.xz * 1.6;
  float e = 0.08;
  float h0 = fbm(rp + uTime * vec2(0.35, 0.22));
  float hx = fbm(rp + vec2(e, 0.0) + uTime * vec2(0.35, 0.22));
  float hz = fbm(rp + vec2(0.0, e) + uTime * vec2(0.35, 0.22));
  n = normalize(n + vec3(h0 - hx, 0.0, h0 - hz) * 1.6);

  vec3 V = normalize(cameraPosition - vWorld);
  float fres = 0.02 + 0.98 * pow(1.0 - max(dot(n, V), 0.0), 5.0);
  vec3 R = reflect(-V, n);
  vec3 sky = mix(uHorizon, uSky, clamp(R.y * 1.6, 0.0, 1.0));
  // water body: deeper colour looking straight down, lighter through thin crests
  float sss = clamp(vCrest * 2.2 + (vWorld.y + 0.2) * 0.9, 0.0, 1.0);
  vec3 body = mix(uDeep, uShallow, sss * 0.85);
  float diff = max(dot(n, uSunDir), 0.0);
  body *= 0.55 + 0.6 * diff;
  vec3 col = mix(body, sky, fres);
  // sun glint
  float spec = pow(max(dot(R, uSunDir), 0.0), 180.0);
  col += uSun * spec * 2.4;
  // crest foam, broken up by noise
  float fn = fbm(vWorld.xz * 2.3 + uTime * 0.3);
  float streak = smoothstep(0.45, 0.8, fbm(vWorld.xz * vec2(5.0, 2.2) + uTime * 0.25));
  float foam = smoothstep(0.66, 0.92, vCrest + (fn - 0.5) * 0.3) * (0.35 + 0.65 * streak) * uFoamAmt;
  // foam collar + wake around the hull
  if (uHull.z > 0.0) {
    float d = hullDist(vWorld.xz);
    float band = 1.0 - smoothstep(0.0, 0.35 + fn * 0.55, d);
    band *= step(-0.05, d);
    float lace = smoothstep(0.35, 0.75, fbm(vWorld.xz * 3.5 - uTime * vec2(0.6, 0.1)));
    foam = max(foam, band * (0.45 + lace * 0.55));
  }
  col = mix(col, uFoam * (0.75 + 0.35 * diff), clamp(foam, 0.0, 1.0));
  // distance fog towards the horizon colour
  float dist = length(cameraPosition - vWorld);
  col = mix(col, uFogColor, smoothstep(uFogNear, uFogFar, dist));
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export function makeOcean({ size = 160, seg = 220, preset = 'sea', deep = 0x0a3a5c, shallow = 0x1f8aa0, sky = 0x9fd4ff, horizon = 0xdff2ff, foam = 0xf4fbff, sun = 0xfff2d8, sunDir = [-0.4, 0.8, 0.45], fog = 0xbfe3ff, fogNear = 40, fogFar = 110, hull = null, y = 0, ampScale = 1 } = {}) {
  const waves = PRESETS[preset].map(([dx, dz, L, st, sp]) => [dx, dz, L, st * ampScale, sp]);
  const uniforms = {
    uTime: { value: 0 },
    uW: { value: waves.map((w) => new THREE.Vector4(w[0], w[1], w[2], w[3])) },
    uSpd: { value: waves.map((w) => w[4]) },
    uN: { value: waves.length },
    uDeep: { value: new THREE.Color(deep) }, uShallow: { value: new THREE.Color(shallow) },
    uSky: { value: new THREE.Color(sky) }, uHorizon: { value: new THREE.Color(horizon) },
    uFoam: { value: new THREE.Color(foam) }, uSun: { value: new THREE.Color(sun) },
    uSunDir: { value: new THREE.Vector3(...sunDir).normalize() },
    uFogColor: { value: new THREE.Color(fog) }, uFogNear: { value: fogNear }, uFogFar: { value: fogFar },
    uFoamAmt: { value: 1 },
    uHull: { value: hull ? new THREE.Vector4(hull.cx, hull.cz, hull.hl, hull.hb) : new THREE.Vector4(0, 0, 0, 0) },
    uBowStern: { value: new THREE.Vector2(hull ? hull.bow : 1, hull ? hull.stern : 1) },
    uRoll: { value: 0 },
  };
  // pad wave arrays to the shader's fixed size
  while (uniforms.uW.value.length < 6) { uniforms.uW.value.push(new THREE.Vector4(1, 0, 1, 0)); uniforms.uSpd.value.push(0); }
  const material = new THREE.ShaderMaterial({ uniforms, vertexShader: vert, fragmentShader: frag });
  const geom = new THREE.PlaneGeometry(size, size, seg, seg);
  geom.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(geom, material);
  mesh.position.y = y;
  mesh.frustumCulled = false;

  /** Water surface height (relative to the ocean's rest level) at world x/z, time t. */
  function heightAt(x, z, t) {
    // Gerstner waves displace horizontally too; one fixed-point step is plenty for bobbing
    let px = x, pz = z;
    for (let it = 0; it < 2; it++) {
      let gx = 0, gz = 0;
      for (const [dx0, dz0, L, st, sp] of waves) {
        const dl = Math.hypot(dx0, dz0), dx = dx0 / dl, dz = dz0 / dl;
        const k = TAU / L, c = Math.sqrt(9.8 / k) * sp, a = st / k;
        const f = k * (dx * px + dz * pz - c * t);
        gx += dx * a * Math.cos(f); gz += dz * a * Math.cos(f);
      }
      px = x - gx; pz = z - gz;
    }
    let h = 0;
    for (const [dx0, dz0, L, st, sp] of waves) {
      const dl = Math.hypot(dx0, dz0), dx = dx0 / dl, dz = dz0 / dl;
      const k = TAU / L, c = Math.sqrt(9.8 / k) * sp, a = st / k;
      h += a * Math.sin(k * (dx * px + dz * pz - c * t));
    }
    return h;
  }

  return {
    mesh, uniforms, heightAt,
    update(t) { uniforms.uTime.value = t; },
  };
}
