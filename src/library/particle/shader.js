const beamVertex = `\       
  uniform vec3 cameraDir;
  uniform vec3 eye;
  
  varying vec3 vWorldPosition;
  varying vec3 vSurfaceNormal;

  varying vec2 vUv;

  void main() {
    vUv = uv;
    vec3 pos = position;
    vSurfaceNormal = normalize(normal);
    vWorldPosition = (modelMatrix * vec4( pos, 1.0 )).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4( pos, 1.0 ); 
  }
`
const beamFragment = `\ 
  uniform float switchItemDuration;
  uniform float switchItemTime;
  uniform vec3 cameraDir;
  uniform vec3 eye;

  uniform sampler2D auraTexture;

  varying vec3 vSurfaceNormal;
  varying vec3 vWorldPosition;
  varying vec2 vUv;
  void main() {

    float noiseUvScale = 0.5;
    vec2 noiseUv = vec2(
      vWorldPosition.x * noiseUvScale * -cameraDir.z + vWorldPosition.z * noiseUvScale * cameraDir.x,
      vWorldPosition.y * noiseUvScale * (switchItemDuration - switchItemTime)
    );
    float aura = texture2D(
      auraTexture, 
      vec2(
        vUv.x * 2.0,
        vUv.y * 1.0 * (switchItemDuration - switchItemTime)
      )
    ).r;
    
    aura = smoothstep(0.0, switchItemTime, aura);
    

    vec3 eyeDirection = normalize(eye - vWorldPosition);
    
    float EdotN = max(0.0, dot(eyeDirection, vSurfaceNormal));
    float rimStrength = 0.7;
    float rim = mix(0.0, 1.0, pow(1. - EdotN, rimStrength));
    float glowIntensity = 2.0;

    vec3 rimColor = mix(vec3(0.00960, 0.833, 0.960), vec3(0., 0., 0.960), rim);
    gl_FragColor.rgb = rimColor * (1. - rim) * glowIntensity;
    float timer = 1. - clamp(switchItemTime, 0.2, 1.0);
    gl_FragColor.a = clamp((1. - rim) * glowIntensity, 0.0, 1.0);
    gl_FragColor.a *= (switchItemDuration - switchItemTime);
    gl_FragColor.a *= clamp(vWorldPosition.y * 5., 0.0, 1.0);
    gl_FragColor *= aura;
  }
`

const pixelVertex = `\       
  uniform vec4 cameraBillboardQuaternion;


  attribute vec2 scales;
  attribute float opacity;
  attribute vec3 positions;

  varying vec2 vUv;
  varying float vOpacity;
  varying vec3 vWorldPosition;

  vec3 rotateVecQuat(vec3 position, vec4 q) {
      vec3 v = position.xyz;
      return v + 2.0 * cross(q.xyz, cross(q.xyz, v) + q.w * v);
  }
  void main() {  
    vUv = uv;
    vOpacity = opacity;
    
    vec3 pos = position;
    pos = rotateVecQuat(pos, cameraBillboardQuaternion);
    pos.xz *= scales.x;
    pos.y *= scales.y;
    pos += positions;
    vec4 modelPosition = modelMatrix * vec4(pos, 1.0);
    vWorldPosition = modelPosition.xyz;
    vec4 viewPosition = viewMatrix * modelPosition;
    vec4 projectionPosition = projectionMatrix * viewPosition;
    gl_Position = projectionPosition;
  }
`
const pixelFragment = `\ 
  varying vec2 vUv;
  varying float vOpacity;
  varying vec3 vWorldPosition;

  void main() {
    float angle = 0.;
    vec2 trig = vec2(cos(angle), sin(angle));
    
    vec2 pos = (vUv - 0.5) * mat2(trig.x, trig.y, -trig.y, trig.x);
    float size = 0.1;
    
    float dist = length(max(abs(pos) - size, 0.));
    float glow = 1. / (dist * 25. + .5);

    gl_FragColor = vec4(glow);
    gl_FragColor.rgb *= vec3(0.00960, 0.833, 0.960);
    if (glow < 0.1 || vWorldPosition.y < 0.) {
      discard;
    }
    gl_FragColor.a *= vOpacity;
  }
`

export {
  beamVertex, beamFragment,
  pixelVertex, pixelFragment,
};