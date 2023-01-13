import * as THREE from "three"


const textureLoader = new THREE.TextureLoader()
const noiseTexture = textureLoader.load(`/textures/noise2.jpg`);
noiseTexture.wrapS = noiseTexture.wrapT = THREE.RepeatWrapping;

const uniforms = {
  uTime: {
    value: 0
  },
  dissolveTexture: {
    value: noiseTexture
  },
  cameraDir: {
    value: new THREE.Vector3()
  },
};

export class EffectManager{
  constructor () {
    this.cameraDir = new THREE.Vector3();
    this.update();
  }

  dissolveCustomShader(material) {
    uniforms.uTime.value = 0;

    material.vertexShader = material.vertexShader.replace(
      `varying vec3 vViewPosition;`,
      `
      varying vec3 vViewPosition;
      varying vec3 vWorldPosition;
      `,
    );
    material.vertexShader = material.vertexShader.replace(
      `#include <worldpos_vertex>`,
      `
      #include <worldpos_vertex>
      vWorldPosition = (modelMatrix * vec4( transformed, 1.0 )).xyz;
      `,
    );
    
    material.fragmentShader = material.fragmentShader.replace(
      `uniform vec3 litFactor;`,
      `
      uniform vec3 litFactor;
      uniform vec3 cameraDir;
      uniform float uTime;
      uniform sampler2D dissolveTexture;
      varying vec3 vWorldPosition;
      
      float pat(vec2 uv, float p, float q, float s, float glow){
        float z = cos(p * uv.y / 0.5) + cos(q * uv.y / 2.2);
        z += mod((uTime * 10.0 + uv.x * s * 10. + uv.y * s * 10.) * 0.5, 5.0);
        float dist = abs(z) * (0.1 / glow);
        return dist;
      }
      vec4 textureRemap(vec4 In, vec2 InMinMax, vec2 OutMinMax) {
        return OutMinMax.x + (In - InMinMax.x) * (OutMinMax.y - OutMinMax.x) / (InMinMax.y - InMinMax.x);
      }
      `,
    );
    material.fragmentShader = material.fragmentShader.replace(
      `diffuseColor *= sampledDiffuseColor;`,
      `
      float noiseUvScale = 5.0;
      vec4 noise = texture2D(dissolveTexture, 
        vec2(
          vWorldPosition.x * noiseUvScale * -cameraDir.z + vWorldPosition.z * noiseUvScale * -cameraDir.x,
          vWorldPosition.y * noiseUvScale
        )
      );

      float noiseStrength = 0.025;
      float noiseCutout = textureRemap(noise, vec2(0.0, 1.0), vec2(-noiseStrength, noiseStrength)).r;

      float bottomPosition = 0.7;
      float avatarHeight = 3.1;
      float speed = 0.7;
      float cutoutHeight = ((uTime * speed)) * avatarHeight - bottomPosition;
      // float cutoutHeight = abs(cos(uTime * speed)) * avatarHeight - bottomPosition;
      
      float limit = noiseCutout + cutoutHeight;
      float border = 0.1;
      
      float upperBound = limit + border;

      if (vWorldPosition.y > limit && vWorldPosition.y < upperBound) {
        vec3 boderColor = vec3(0.3, 0., 1.0);
        vec3 boderColor2 = vec3(0.990, 0.752, 0.851);

        
        float distanceToMid = abs((upperBound - vWorldPosition.y) / border - 0.5) * 2.0;
        diffuseColor = vec4(mix(boderColor, boderColor2, 1. - distanceToMid), 1.0);
        // float d = pat(vWorldPosition.xy * noiseUvScale, 1.0, 2.0, 10.0, 0.35);		
        // diffuseColor = diffuseColor * 0.5 / d;
        
        diffuseColor = smoothstep(0.18, 0.5, diffuseColor);
        
      }
      else {
        diffuseColor *= sampledDiffuseColor;
        diffuseColor.a = step(vWorldPosition.y, limit);
      }
      `,
    );

    material.fragmentShader = material.fragmentShader.replace(
      `col += totalEmissiveRadiance;`,
      `
      if (vWorldPosition.y > limit && vWorldPosition.y < upperBound) {
        col = diffuseColor.rgb;
      }
      else {
        col += totalEmissiveRadiance;
      }
      
      `,
    );

    // material.vertexShader = material.vertexShader.replace(
    //   `varying vec3 vViewPosition;`,
    //   `
    //   varying vec3 vViewPosition;
    //   varying vec3 vWorldPosition;
    //   `,
    // );
    // material.vertexShader = material.vertexShader.replace(
    //   `#include <worldpos_vertex>`,
    //   `
    //   #include <worldpos_vertex>
    //   vWorldPosition = (modelMatrix * vec4( transformed, 1.0 )).xyz;
    //   `,
    // );
    
    // material.fragmentShader = material.fragmentShader.replace(
    //   `uniform vec3 litFactor;`,
    //   `
    //   uniform vec3 litFactor;
    //   uniform float uTime;
    //   uniform sampler2D dissolveTexture;
    //   varying vec3 vWorldPosition;
      
    //   float pat(vec2 uv, float p, float q, float s, float glow){
    //     float z = cos(p * uv.y / 0.5) + cos(q * uv.y / 2.2);
    //     z += mod((uTime * 10.0 + uv.x * s * 10. + uv.y * s * 10.) * 0.5, 5.0);
    //     float dist = abs(z) * (0.1 / glow);
    //     return dist;
    //   }
    //   vec4 textureRemap(vec4 In, vec2 InMinMax, vec2 OutMinMax) {
    //     return OutMinMax.x + (In - InMinMax.x) * (OutMinMax.y - OutMinMax.x) / (InMinMax.y - InMinMax.x);
    //   }
    //   `,
    // );
    // material.fragmentShader = material.fragmentShader.replace(
    //   `diffuseColor *= sampledDiffuseColor;`,
    //   `
    //   float noiseUvScale = 0.3;
    //   vec4 noise = texture2D(dissolveTexture, mapUv * noiseUvScale);
    
    //   float noiseStrength = 0.55;
    //   float noiseCutout = textureRemap(noise, vec2(0.0, 1.0), vec2(-noiseStrength, noiseStrength)).r;
    
    //   float bottomPosition = 0.7;
    //   float avatarHeight = 3.1;
    //   float speed = 0.7;
    //   float cutoutHeight = ((uTime * speed)) * avatarHeight - bottomPosition;
    //   // float cutoutHeight = abs(cos(uTime * speed)) * avatarHeight - bottomPosition;
      
    //   float limit = noiseCutout + cutoutHeight;
    //   float border = 0.1;
      
    //   float upperBound = limit + border;
    
    //   if (vWorldPosition.y > limit && vWorldPosition.y < upperBound) {
    //     vec3 boderColor = vec3(0.3, 0., 1.0);
    //     vec3 boderColor2 = vec3(0.990, 0.752, 0.851);
    
        
    //     float distanceToMid = abs((upperBound - vWorldPosition.y) / border - 0.5) * 2.0;
    //     diffuseColor = vec4(mix(boderColor, boderColor2, 1. - distanceToMid), 1.0);
    //     float d = pat(mapUv * noiseUvScale, 1.0, 2.0, 10.0, 0.35);		
    //     diffuseColor = diffuseColor * 0.5 / d;
        
    //     diffuseColor = smoothstep(0.18, 0.5, diffuseColor);
        
    //   }
    //   else {
    //     diffuseColor *= sampledDiffuseColor;
    //     diffuseColor.a = step(vWorldPosition.y, limit);
    //   }
    //   `,
    // );
    
    // material.fragmentShader = material.fragmentShader.replace(
    //   `col += totalEmissiveRadiance;`,
    //   `
    //   if (vWorldPosition.y > limit && vWorldPosition.y < upperBound) {
    //     col = diffuseColor.rgb;
    //   }
    //   else {
    //     col += totalEmissiveRadiance;
    //   }
      
    //   `,
    // );

    material.uniforms.dissolveTexture = uniforms.dissolveTexture;
    material.uniforms.cameraDir = uniforms.cameraDir;
    material.uniforms.uTime = uniforms.uTime;
    material.transparent = true;
  }
  
  update() {
    setInterval(() => {
      uniforms.uTime.value += 0.01;
      // uniforms.uTime.value = performance.now() / 1000;
      if (this.camera) {
        this.cameraDir.set(0, 0, -1);
        this.cameraDir.applyQuaternion(this.camera.quaternion);
        this.cameraDir.normalize();
        uniforms.cameraDir.value.copy(this.cameraDir);
      }
      
    
    }, 1000/30);
  }
}
