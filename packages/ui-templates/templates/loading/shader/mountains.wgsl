// A particle mountain range for the dev-server loading screen.
//
// One draw call: every particle is a quad whose position comes from a ridged
// heightfield sampled in perspective, so the field reads as a range of peaks
// seen at a grazing angle. Nothing here depends on build progress — the screen
// looks the same at one second and at two minutes.
//
// Motion, all continuous loops:
//   · per-particle drift and shimmer
//   · slow luminosity waves crossing the field
//   · a ripple radiating from the lockup
//   · a shockwave while the pointer is over the lockup, phase driven by the CPU

struct Params {
  logoCentre: vec2f,
  logoScale: vec2f,
  resolution: vec2f,
  /** pointer position in canvas space, smoothed */
  pointer: vec2f,
  /** x: shockwave phase 0..1, y: 1 while a wave is travelling */
  wave: vec2f,
  /** x: seconds, y: pointer presence 0..1 */
  misc: vec2f,
  /** x: winter 0..1 — snow on the peaks and falling flakes; y: 1 in light mode */
  season: vec2f,
}
@group(0) @binding(0) var<uniform> params: Params;

const MINT = vec3f(0.0, 0.8627451, 0.5098039);
const MINT_PALE = vec3f(0.6235294, 1.0, 0.8156863);

// Light mode draws the same range as ink on paper. Emitted light becomes
// coverage, and the pipeline blends it over the page instead of adding it to
// the dark. Alpha rather than subtraction, so a crest that many particles
// land on settles on the brand green instead of running away to black.
const INK_SOFT = vec3f(0.6588235, 0.7882353, 0.7294118);
const INK_DEEP = vec3f(0.0, 0.8627451, 0.5098039);
const FLAKE_INK = vec3f(0.5215687, 0.6039216, 0.6588235);
const LUMA = vec3f(0.2126, 0.7152, 0.0722);

// grid of particles
const COLS = 704u;
const ROWS = 260u;
const TERRAIN_COUNT = COLS * ROWS;
// flakes are drawn from the indices past the terrain, so winter costs nothing
// out of season: the draw call is simply shorter
const SNOW = vec3f(0.88, 1.0, 0.96);

// camera
const Z_NEAR = 1.3;
const Z_FAR = 26.0;
const CAM_Y = 2.4;
const FOCAL = 1.3;
const HORIZON = 0.30;

// the two summits that shape the skyline, in screen-x units
const PEAK1_X = -0.28;
const PEAK1_H = 3.2;
const PEAK2_X = 0.62;
const PEAK2_H = 2.2;

fn hash21 (p: vec2f) -> f32 {
  var q = fract(p * vec2f(0.1031, 0.1030));
  q += dot(q, q.yx + 33.33);
  return fract((q.x + q.y) * q.x);
}

fn noise2 (p: vec2f) -> f32 {
  let i = floor(p);
  let f = fract(p);
  let u = f * f * (3.0 - 2.0 * f);
  let a = hash21(i);
  let b = hash21(i + vec2f(1.0, 0.0));
  let c = hash21(i + vec2f(0.0, 1.0));
  let d = hash21(i + vec2f(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

// `shape` flattens the relief on narrow screens. A summit covers the same
// fraction of screen height whatever the aspect, but far fewer pixels of width
// in portrait, so without this the peaks turn into needles.
fn terrain (x: f32, z: f32, u: f32, shape: f32) -> f32 {
  // ridged noise stretched along the view axis gives crest lines that flow
  // into the distance rather than a lumpy field
  var q = vec2f(x * 0.30, z * 0.085);
  var r = 0.0;
  var amp = 0.55;
  let rot = mat2x2f(1.6, 1.2, -1.2, 1.6);
  for (var i = 0; i < 5; i++) {
    r += amp * (1.0 - abs(2.0 * noise2(q) - 1.0));
    q = rot * q;
    amp *= 0.55;
  }
  var h = pow(max(r, 0.0), 1.5) * 2.6;
  h *= 0.70 + 0.60 * noise2(vec2f(x * 0.05, z * 0.05) + 7.0);
  // two designed summits, far enough back to break the horizon
  let rise = smoothstep(3.0, 9.0, z);
  h += rise * PEAK1_H * max(0.0, 1.0 - abs(u - PEAK1_X) * 3.2);
  h += rise * PEAK2_H * max(0.0, 1.0 - abs(u - PEAK2_X) * 3.6);
  return max(h, 0.0) * shape;
}

struct Particle {
  @builtin(position) position: vec4f,
  @location(0) local: vec2f,
  /** dark: emitted colour, w unused. light: ink colour, w its coverage. */
  @location(1) tint: vec4f,
}

fn quadCorner (corner: u32) -> vec2f {
  let quad = array<vec2f, 6>(
    vec2f(-1.0, -1.0), vec2f(1.0, -1.0), vec2f(-1.0, 1.0),
    vec2f(-1.0, 1.0), vec2f(1.0, -1.0), vec2f(1.0, 1.0),
  );
  let corners = quad;
  return corners[corner];
}

// A flake drifting down the screen, in its own parallax layer. Independent of
// the terrain: it lives in screen space and wraps around forever.
fn flake (id: u32, corner: u32, t: f32, resolution: vec2f, centre: vec2f, logoH: f32, aspect: f32, light: f32) -> Particle {
  let fi = f32(id - TERRAIN_COUNT);
  let r1 = hash21(vec2f(fi, 1.7));
  let r2 = hash21(vec2f(fi, 5.3));
  let r3 = hash21(vec2f(fi, 9.1));
  // near flakes are bigger, brighter and fall faster
  let depth = 0.30 + r3 * 0.70;

  let x = (r1 * 2.4 - 1.2) + sin(t * (0.25 + r2 * 0.35) + r1 * 40.0) * 0.05 * depth;
  let y = 1.2 - fract(r2 + t * (0.020 + r3 * 0.035)) * 2.5;
  var pos = vec2f(x, y);

  // flakes thin out over the lockup so they never sit on the wordmark
  let toCentre = vec2f((pos.x - centre.x) * aspect, pos.y - centre.y);
  let clear = abs(toCentre / vec2f(logoH * 7.0, logoH * 3.2));
  let clearing = 0.25 + 0.75 * smoothstep(0.5, 1.2, pow(pow(clear.x, 3.0) + pow(clear.y, 3.0), 1.0 / 3.0));

  let twinkle = 0.75 + 0.25 * sin(t * (1.1 + r1 * 2.0) + r2 * 30.0);
  let sizePx = (0.55 + depth * 1.5) * (resolution.y / 900.0);
  let offset = quadCorner(corner);

  let amount = (0.16 + 0.48 * depth) * twinkle * clearing * params.season.x;

  var out: Particle;
  out.position = vec4f(pos + offset * sizePx * 2.0 / resolution, 0.5, 1.0);
  out.local = offset;
  // white flakes cannot show on paper, so in light mode they are drawn as the
  // cool grey a flake reads as against a bright sky
  out.tint = select(vec4f(SNOW * amount, 1.0), vec4f(FLAKE_INK, amount * 1.6), light > 0.5);
  return out;
}

@vertex fn vs_main (@builtin(vertex_index) index: u32) -> Particle {
  let id = index / 6u;
  let corner = index % 6u;
  let t = params.misc.x;
  let resolution = max(params.resolution, vec2f(1.0));
  let aspect = max(resolution.x / resolution.y, 0.5);
  let winter = params.season.x;
  let light = params.season.y;

  // the lockup centre is needed by both the terrain and the flakes
  let logoH0 = max(params.logoScale.y, 0.01);
  let centre0 = vec2f(
    params.logoCentre.x * 2.0 - 1.0 + logoH0 * 2.5 / aspect,
    1.0 - 2.0 * params.logoCentre.y,
  );
  if (id >= TERRAIN_COUNT) {
    return flake(id, corner, t, resolution, centre0, logoH0, aspect, light);
  }

  let col = id % COLS;
  let row = id / COLS;

  let seed = vec2f(f32(col), f32(row));
  let jitterX = hash21(seed) - 0.5;
  let jitterY = hash21(seed + 17.0) - 0.5;
  let rnd = hash21(seed + 41.0);

  // screen-x is fixed per column; depth is biased so the near field is denser
  let u = ((f32(col) + jitterX) / f32(COLS)) * 2.3 - 1.15;
  let v = clamp((f32(row) + jitterY) / f32(ROWS), 0.0, 1.0);
  let z = mix(Z_NEAR, Z_FAR, pow(v, 1.5));
  // widen the field of view and flatten the range as the window narrows, so a
  // phone shows a range rather than a row of spikes
  let shape = clamp(aspect / 1.6, 0.5, 1.0);
  let tanX = max(aspect, 0.95) / FOCAL;
  let xw = u * z * tanX;

  var h = terrain(xw, z, u, shape);
  h += (noise2(vec2f(xw * 1.6, z * 1.6)) - 0.5) * 0.05 * shape;

  // shading from the surface itself: one fixed light, plus a convexity term
  // that picks out the crests
  let e = 0.22;
  let hxp = terrain(xw + e, z, u, shape);
  let hxm = terrain(xw - e, z, u, shape);
  let hzp = terrain(xw, z + e, u, shape);
  let normal = normalize(vec3f(-(hxp - hxm) / (2.0 * e), 1.0, -(hzp - h) / e));
  let lightDir = normalize(vec3f(-0.12, 0.60, -0.42));
  let diffuse = pow(max(dot(normal, lightDir), 0.0), 1.3);
  let crest = smoothstep(0.0, 1.5, (2.0 * h - hxp - hxm) / (e * e) * 0.2);

  let sy = (h - CAM_Y) / z * FOCAL + HORIZON;

  // nearer ridges hide what lies behind them, which is what makes the skyline
  var occluded = 0.0;
  for (var k = 1; k <= 4; k++) {
    let zs = Z_NEAR + (z - Z_NEAR) * f32(k) / 5.0;
    let hs = terrain(u * zs * tanX, zs, u, shape);
    occluded = max(occluded, step(sy + 0.012, (hs - CAM_Y) / zs * FOCAL + HORIZON));
  }

  // the lockup sits in a clearing so it always reads on plain black. Its centre
  // is right of the icon slot: the official mark is 128 units wide for a
  // 48-unit icon, so the middle is 1.25 icon-heights along.
  let logoH = logoH0;
  let toCentre = vec2f((u - centre0.x) * aspect, sy - centre0.y);
  let distance = length(toCentre);
  // The clearing has to read as haze, not as a hole cut out of the scene, so
  // it fades over a long distance and its edge is broken up by noise. A
  // squircle rather than an ellipse: the lockup is a wide, short block (half of
  // it is 4 logo-heights wide and 1 tall here), which an ellipse fits poorly.
  let clear = abs(toCentre / vec2f(logoH * 8.0, logoH * 3.6));
  let clearEdge = pow(pow(clear.x, 3.0) + pow(clear.y, 3.0), 1.0 / 3.0)
    + (noise2(vec2f(xw * 0.55, z * 0.55)) - 0.5) * 0.30;
  let clearing = smoothstep(0.46, 1.30, clearEdge);

  // ambient ripple, always running
  let ripplePhase = fract(t * 0.30);
  let rippleRadius = ripplePhase * 2.4;
  let rippleWidth = 0.16 + ripplePhase * 0.25;
  let ripple = exp(-((distance - rippleRadius) * (distance - rippleRadius)) / (rippleWidth * rippleWidth))
    * (1.0 - smoothstep(0.55, 0.95, ripplePhase))
    * smoothstep(0.0, 0.05, ripplePhase);

  // shockwave from hovering the lockup; phase comes from the CPU so a wave
  // always finishes travelling once fired
  let hoverPhase = params.wave.x;
  let hoverRadius = hoverPhase * 1.7;
  let hoverWidth = 0.09 + hoverPhase * 0.20;
  let shock = exp(-((distance - hoverRadius) * (distance - hoverRadius)) / (hoverWidth * hoverWidth))
    * (1.0 - smoothstep(0.55, 1.0, hoverPhase))
    * smoothstep(0.0, 0.04, hoverPhase)
    * params.wave.y;

  let fog = exp(-(z - Z_NEAR) * 0.075) * smoothstep(1.0, 0.86, v);
  let nearFade = smoothstep(Z_NEAR, 2.6, z);
  // in winter the snowline drops a long way and the caps turn properly white
  let snowline = 2.6 - winter * 1.7;
  let snow = smoothstep(snowline, snowline + 1.0 - winter * 0.45, h);
  let shimmer = 0.88 + 0.12 * sin(t * (0.7 + rnd * 1.4) + rnd * 31.0);
  let grain = 0.88 + 0.24 * noise2(vec2f(xw * 3.0, z * 3.0));

  // a fifth of the particles pulse on their own cycle, so the field never
  // settles into a repeating pattern
  let pulses = step(0.82, hash21(seed + 63.0));
  let pulse = pow(0.5 + 0.5 * sin(t * (0.5 + rnd * 1.1) + rnd * 61.0), 6.0);

  // two slow noise waves drifting across the field
  let waveA = noise2(vec2f(xw * 0.22 - t * 0.20, z * 0.22)) - 0.5;
  let waveB = noise2(vec2f(xw * 0.55 + t * 0.09, z * 0.55 - t * 0.14)) - 0.5;
  let wave = 1.0 + waveA * 0.24 + waveB * 0.16;

  // snow throws light back, so the caps read brighter as well as whiter
  let lit = diffuse * 0.18 + crest * (0.34 + diffuse * 0.45) + snow * (0.06 + winter * 0.30);
  let brightness = (0.008 + lit * grain)
    * fog * nearFade * wave * shimmer
    * (1.0 + pulse * (0.18 + pulses * 1.1))
    * (1.0 + ripple * 0.75 + shock * 3.0);
  var tint = mix(MINT * 0.75, MINT_PALE, clamp(crest + snow * 0.5, 0.0, 1.0));
  tint = mix(tint, SNOW, winter * snow) * brightness;

  let glint = step(0.993, rnd) * diffuse * (0.5 + 0.5 * sin(t * 2.0 + rnd * 47.0));
  tint += vec3f(0.85, 1.0, 0.93) * glint * fog * 0.55;

  // the pointer stirs nearby dust
  let pointer = vec2f((params.pointer.x - 0.5) * 2.0, (0.5 - params.pointer.y) * 2.0);
  let toPointer = vec2f((u - pointer.x) * aspect, sy - pointer.y);
  let excite = smoothstep(0.55, 0.0, length(toPointer)) * params.misc.y;
  let push = normalize(toPointer + vec2f(0.0001, 0.0)) * excite * (0.006 + 0.010 * rnd);
  tint *= 1.0 + excite * 1.3;

  // Light mode reuses every lighting term above and only reinterprets it: how
  // much light a particle emits becomes how much ink it lays down. Taking the
  // luminance keeps the two themes at matching density, and the crests that go
  // palest on black carry the brand green on paper. Snow is the one term that
  // has to invert — a white cap can only read on paper by leaving it bare.
  var out: Particle;
  if (light > 0.5) {
    // lifted, since faint dust that reads fine against black all but vanishes
    // against white
    let coverage = pow(clamp(dot(tint, LUMA) * 2.2, 0.0, 1.0), 0.8) * (1.0 - winter * snow * 0.6);
    let ink = mix(INK_SOFT, INK_DEEP, clamp(crest * 1.15 + snow * 0.3, 0.0, 1.0));
    out.tint = vec4f(ink, coverage * (1.0 - occluded) * clearing);
  } else {
    out.tint = vec4f(tint * (1.0 - occluded) * clearing, 1.0);
  }

  // particles float around their anchor, more freely up close
  let floatAmp = (0.0015 + (1.0 - v) * 0.006) * (1.0 + excite * 2.5);
  let drift = vec2f(
    sin(t * (0.35 + rnd * 0.5) + rnd * 40.0),
    cos(t * (0.28 + rnd * 0.45) + rnd * 23.0) * 1.4,
  ) * floatAmp;

  // the shockwave shoves particles outward as it passes
  let shockPush = vec2f(toCentre.x / max(distance, 0.02) / aspect, toCentre.y / max(distance, 0.02)) * shock * 0.045;

  let sizePx = clamp(16.0 / z, 0.65, 1.9)
    * (0.75 + 0.5 * hash21(seed + 27.0))
    * (1.0 + glint * 0.25 + ripple * 0.20 + shock * 0.75);
  let quad = array<vec2f, 6>(
    vec2f(-1.0, -1.0), vec2f(1.0, -1.0), vec2f(-1.0, 1.0),
    vec2f(-1.0, 1.0), vec2f(1.0, -1.0), vec2f(1.0, 1.0),
  );
  let corners = quad;
  let offset = corners[corner];

  out.position = vec4f(
    vec2f(u, sy) + drift + push + shockPush + offset * sizePx * 2.0 / resolution,
    0.5,
    1.0,
  );
  out.local = offset;
  return out;
}

@fragment fn fs_main (@location(0) local: vec2f, @location(1) tint: vec4f) -> @location(0) vec4f {
  return vec4f(tint.rgb * smoothstep(1.0, 0.45, length(local)), 1.0);
}

// Light mode's counterpart: the same particle, premultiplied so it composites
// over the page. Where the dark theme piles light up towards white, this
// settles on the ink colour however much dust lands on it.
@fragment fn fs_light (@location(0) local: vec2f, @location(1) tint: vec4f) -> @location(0) vec4f {
  let alpha = tint.a * smoothstep(1.0, 0.45, length(local));
  return vec4f(tint.rgb * alpha, alpha);
}
