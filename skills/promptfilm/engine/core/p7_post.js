
/* =====================================================================================
   7. FINISHING — HDR render -> motion blur + exposure (+ NaN/Inf clean-up) -> restrained bloom -> ACES tone map -> fine grain
   ===================================================================================== */
const composerTarget = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
const composer = new EffectComposer(renderer, composerTarget);
const renderPass = new RenderPass(scene, camera);
renderPass.clearColor = new THREE.Color(0x000000); renderPass.clearAlpha = 1;
composer.addPass(renderPass);
// motion blur from the camera's own movement over a short shutter in PLAYBACK time (so fast stretches blur more, as a
// real camera would): a radial part (zoom) about the subject and a shift (turn). Always on: it also applies the exposure
// before the bloom, as a sensor would, and turns NaN / Inf into black — one bad pixel would otherwise be blurred by the
// bloom into a flickering black block.
const MBLUR = {
  uniforms: { tDiffuse: { value: null }, uC: { value: new THREE.Vector2(0.5, 0.5) }, uZoom: { value: 0 }, uShift: { value: new THREE.Vector2() }, uAmt: { value: 0 }, uExposure: { value: 1 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform vec2 uC; uniform float uZoom; uniform vec2 uShift; uniform float uAmt; uniform float uExposure; varying vec2 vUv;
    vec3 fix(vec3 c) { return (any(isnan(c)) || any(isinf(c))) ? vec3(0.0) : clamp(c, 0.0, 2.0e4); }
    void main() {
      vec4 base = texture2D(tDiffuse, vUv); base.rgb = fix(base.rgb) * uExposure;
      if (uAmt < 0.001) { gl_FragColor = base; return; }
      vec2 v = (vUv - uC) * uZoom + uShift;                     // screen motion of this pixel during the 'shutter'
      float L = length(v); if (L < 0.0003) { gl_FragColor = base; return; }
      v *= min(1.0, 0.022 / L);                                // at most ~2% of the frame: a fast way back streaks, never smears the picture
      vec3 acc = vec3(0.0); float wsum = 0.0;
      for (int i = 0; i < 12; i++) { float f = (float(i) + 0.5) / 12.0 - 0.5; float w = 1.0 - abs(f) * 1.2;
        acc += fix(texture2D(tDiffuse, vUv - v * f).rgb) * uExposure * w; wsum += w; }
      gl_FragColor = vec4(mix(base.rgb, acc / wsum, uAmt), base.a);
    }`,
};
// optional depth of field: the film defines FILM_DOF = (τ, field) => ({ aperture, maxblur }) in a scene part (p3–p6). The focus is the
// camera target (always at unit distance with the floating origin). A real lens is shallower close up: make aperture grow as field shrinks.
const bokehPass = typeof FILM_DOF === 'function' ? new BokehPass(scene, camera, { focus: 1.0, aperture: 0.0, maxblur: 0.0 }) : null;
if (bokehPass) composer.addPass(bokehPass);
const mblurPass = new ShaderPass(MBLUR);
composer.addPass(mblurPass);
// threshold above lit surfaces: only light sources and hot glows bloom
const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.46, 0.6, 1.6);
composer.addPass(bloom);
composer.addPass(new OutputPass());
const GRAIN = {
  uniforms: { tDiffuse: { value: null }, uSeed: { value: 0 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uSeed; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233)) + uSeed) * 43758.5453); }
    void main(){ vec4 c = texture2D(tDiffuse, vUv); float g = h(gl_FragCoord.xy) - 0.5; gl_FragColor = vec4(c.rgb + g * 0.012, c.a); }`,
};
const grainPass = new ShaderPass(GRAIN);
composer.addPass(grainPass);
// the film can register more things that follow the canvas size (line materials, extra render targets)
const RESIZE_HOOKS = [];
function resizePost(W, H, pr) {
  composer.setPixelRatio(pr);
  composer.setSize(W, H);
  bloom.resolution.set(W * pr / 2, H * pr / 2);
  RESIZE_HOOKS.forEach(f => f(W, H, pr));
}
