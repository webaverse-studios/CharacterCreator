import * as THREE from "three"

const textureLoader = new THREE.TextureLoader()
const noiseTexture = textureLoader.load(`/textures/noise.png`);
noiseTexture.wrapS = noiseTexture.wrapT = THREE.RepeatWrapping;


const uniforms = {
  uTime: {
    value: 0
  },
  dissolveTexture: {
    value: noiseTexture
  },
};

export class EffectManager{
  constructor () {
    
    this.update();
  }

  dissolveCustomShader(material) {

    // material.vertexShader = material.vertexShader.replace(
    //   `varying vec3 vViewPosition;`,
    //   `
    //   varying vec3 vViewPosition;
    //   varying vec3 vWorldPosition;
    //   `,
    // );
    
    material.fragmentShader = material.fragmentShader.replace(
      `uniform vec3 litFactor;`,
      `
      uniform vec3 litFactor;
      uniform float uTime;
      uniform sampler2D dissolveTexture;
      
      float pat(vec2 uv, float p, float q, float s, float glow){
        float z = cos(p * uv.y / 0.5) + cos(q * uv.y / 2.2);
        z += mod((uTime * 10.0 + uv.x * s * 10. + uv.y * s * 10.) * 0.5, 5.0);
        float dist = abs(z) * (0.1 / glow);
        return dist;
      }
      `,
    );
    material.fragmentShader = material.fragmentShader.replace(
      `diffuseColor *= sampledDiffuseColor;`,
      `
      float noiseUvScale = 0.3;
      float noise = texture2D(dissolveTexture, mapUv * noiseUvScale).r;
      float freq = 1.0;
      float border = 0.05;
      float limit = abs(cos(uTime * freq));
      // float limit = 0.5;
      vec3 boderColor = vec3(0.3, 0., 1.0);
      vec3 boderColor2 = vec3(0.990, 0.752, 0.851);

      if (noise < limit && noise > limit - border) {
        float distanceToMid = abs(((limit - noise) / border) - 0.5) * 2.;
        diffuseColor = vec4(mix(boderColor, boderColor2, 1. - distanceToMid), 1.0);

        float d = pat(mapUv * noiseUvScale, 1.0, 2.0, 10.0, 0.35);		
        diffuseColor = diffuseColor * 0.5 / d;
        
        diffuseColor = smoothstep(0.18, 0.5, diffuseColor);
      }
      else {
        diffuseColor *= sampledDiffuseColor;
        diffuseColor.a = step(limit - border, noise);
      }
      `,
    );
    
    material.fragmentShader = material.fragmentShader.replace(
      `col += totalEmissiveRadiance;`,
      `
      if (noise < limit && noise > limit - border) {
        col = diffuseColor.rgb;
      }
      else {
        col += totalEmissiveRadiance;
      }
      
      `,
    );

    
    
    // console.log(material.vertexShader)

    material.uniforms.dissolveTexture = uniforms.dissolveTexture;
    material.uniforms.uTime = uniforms.uTime;
    material.transparent = true;
  }
  
  update() {
    setInterval(() => {

      uniforms.uTime.value = performance.now() / 1000;

    
    }, 1000/30);
  }
}
