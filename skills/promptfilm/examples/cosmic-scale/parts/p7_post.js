
/* =====================================================================================
   7. FINISHING — HDR render -> restrained bloom -> ACES tone map -> fine grain (fixed pattern, loop-periodic seed)
   ===================================================================================== */
const composerTarget = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
const composer = new EffectComposer(renderer, composerTarget);
const renderPass = new RenderPass(scene, camera);
renderPass.clearColor = new THREE.Color(0x000000); renderPass.clearAlpha = 1;
composer.addPass(renderPass);
// motion blur from the camera's own movement between two instants 1/40 s apart (always on: it also applies the camera's
// exposure before the bloom, as a sensor would, and cleans NaN / Inf from the bloom's input); a radial part (zoom) about the
// subject and a shift (turn); computed from the timeline, so it is the same on every loop
const MBLUR = {
  uniforms: { tDiffuse: { value: null }, uC: { value: new THREE.Vector2(0.5, 0.5) }, uZoom: { value: 0 }, uShift: { value: new THREE.Vector2() }, uAmt: { value: 0 }, uExposure: { value: 1 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform vec2 uC; uniform float uZoom; uniform vec2 uShift; uniform float uAmt; uniform float uExposure; varying vec2 vUv;
    // (also a safety net for the bloom that follows: a NaN or Inf pixel would be blurred into a black block)
    vec3 fix(vec3 c) { return (any(isnan(c)) || any(isinf(c))) ? vec3(0.0) : clamp(c, 0.0, 2.0e4); }
    void main() {
      vec4 base = texture2D(tDiffuse, vUv); base.rgb = fix(base.rgb) * uExposure;
      if (uAmt < 0.001) { gl_FragColor = base; return; }
      vec2 v = (vUv - uC) * uZoom + uShift;                     // screen motion of this pixel during the 'shutter'
      float L = length(v); if (L < 0.0008) { gl_FragColor = base; return; }
      v *= min(1.0, 0.035 / L);
      vec3 acc = vec3(0.0); float wsum = 0.0;
      for (int i = 0; i < 12; i++) { float f = (float(i) + 0.5) / 12.0 - 0.5; float w = 1.0 - abs(f) * 1.2;
        acc += fix(texture2D(tDiffuse, vUv - v * f).rgb) * uExposure * w; wsum += w; }
      gl_FragColor = vec4(mix(base.rgb, acc / wsum, uAmt), base.a);
    }`,
};
const mblurPass = new ShaderPass(MBLUR);
composer.addPass(mblurPass);
const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.46, 0.6, 1.6);   // threshold above lit planet surfaces (their glow is drawn in proportion to them): stars and hot glows bloom   // threshold above lit planets (their glow is drawn in proportion to them): stars and hot glows bloom
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
function resizePost(s, pr) {
  composer.setPixelRatio(pr);
  composer.setSize(s, s);
  bloom.resolution.set(s * pr / 2, s * pr / 2);
  volRT.setSize(Math.round(s * pr / 2), Math.round(s * pr / 2));
  LINE_MATS.forEach(m => { m.resolution.set(s * pr, s * pr); if (m.userData.w === undefined) m.userData.w = m.linewidth; m.linewidth = m.userData.w * pr; });
}
