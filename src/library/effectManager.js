import * as THREE from "three"
import { disposeVRM } from "../library/utils"


const textureLoader = new THREE.TextureLoader()
const noiseTexture = textureLoader.load(`/textures/noise4.png`);
noiseTexture.wrapS = noiseTexture.wrapT = THREE.RepeatWrapping;

const uniforms = {
  uTime: {
    value: 0
  },
  dissolveTexture: {
    value: noiseTexture
  },
  eye: {
    value: new THREE.Vector3()
  },
  cameraDir: {
    value: new THREE.Vector3()
  },
  cameraQuaternion: {
    value: new THREE.Quaternion()
  }
};

export class EffectManager{
  constructor () {
    this.cameraDir = new THREE.Vector3();
    this.timer = 0;
    this.fadeOut = false;
    


    this.frameRate = 1000 / 30;
    this.fadeInThreshold = 1;
    this.fadeOutThreshold = 0;
    this.fadeSpeed = 0.02;
    this.fadeCycle = this.frameRate * ((this.fadeInThreshold - this.fadeOutThreshold) / this.fadeSpeed);


    this.update();
  }

  dissolveCustomShader(material) {
    // uniforms.uTime.value = 1;

    material.vertexShader = material.vertexShader.replace(
      `varying vec3 vViewPosition;`,
      `
      varying vec3 vViewPosition;
      varying vec3 vWorldPosition;
      varying vec3 vSurfaceNormal;
      uniform vec4 cameraQuaternion;
      `,
    );
    material.vertexShader = material.vertexShader.replace(
      `void main() {`,
      `
      vec3 rotate_vertex_position(vec3 position, vec4 q) { 
        return position + 2.0 * cross(q.xyz, cross(q.xyz, position) + q.w * position);
      }
      void main() {
        vSurfaceNormal = normalize(normal);
        // vSurfaceNormal = rotate_vertex_position(vSurfaceNormal, cameraQuaternion);
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
      uniform vec3 eye;
      uniform float uTime;
      uniform sampler2D dissolveTexture;
      varying vec3 vWorldPosition;
      varying vec3 vSurfaceNormal;
      
      
      float pat(vec2 uv, float p, float q, float s, float glow){
        float z = cos(p * uv.y / 0.5) + cos(q * uv.y / 2.2);
        z += mod((uTime * 10.0) * 0.5, 5.0);
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
      diffuseColor *= sampledDiffuseColor;
      
      float noiseUvScale = 3.5;
      vec2 noiseUv = vec2(
        vWorldPosition.x * noiseUvScale * -cameraDir.z + vWorldPosition.z * noiseUvScale * cameraDir.x,
        vWorldPosition.y * noiseUvScale - uTime * noiseUvScale
      );
      vec4 noise = texture2D(
        dissolveTexture, 
        noiseUv
      );

      float minStrength = 0.025;
      float noiseStrength = uTime < 1.? pow(1. - uTime, 5.0) + minStrength : minStrength;
      float noiseCutout = textureRemap(noise, vec2(0.0, 1.0), vec2(-noiseStrength, noiseStrength)).r;

      float bottomPosition = 1.1;
      float avatarHeight = 4.0;
      float speed = 0.7;
      float cutoutHeight = ((uTime * speed)) * avatarHeight - bottomPosition;
      
      float limit = noiseCutout + cutoutHeight;
      float border = 0.075;
      
      float upperBound = limit + border;

      vec3 boderColor = vec3(0.0, 0.1, 1.0);
      vec3 boderColor2 = vec3(0.0864, 0.844, 0.960);

      vec3 eyeDirection = normalize(eye - vWorldPosition);
      float grid = texture2D(
        dissolveTexture, 
        vec2(
          vWorldPosition.x * noiseUvScale * -cameraDir.z + vWorldPosition.z * noiseUvScale * cameraDir.x,
          vWorldPosition.y * noiseUvScale
        )
      ).r;
      float gridIntensity = 10.0;
      float EdotN = max(0.0, dot(eyeDirection, normalize(vSurfaceNormal + vec3(grid) * vec3(1.0, gridIntensity * (1. - uTime), 1.0))));
      

      if (uTime < 1.0) {
        if (vWorldPosition.y > limit && vWorldPosition.y < upperBound) {
          float rimStrength = 0.5 * uTime;
          float boaderRim = mix(0.0, 1.0, pow(1. - EdotN, rimStrength));
          float glowIntensity = clamp(100. * (1. - uTime), 20., 100.);

          float distanceToMid = abs((upperBound - vWorldPosition.y) / border - 0.5) * 2.0;
          diffuseColor = vec4(mix(boderColor, boderColor2, 1. - distanceToMid), 1.0);
          float d = pat(noiseUv, 1.0, 2.0, 10.0, 0.35);		
          diffuseColor = diffuseColor * 0.9 / d;
          
          diffuseColor = smoothstep(0., 0.5, diffuseColor);
  
          // vec3 boderRimColor = mix(boderColor, boderColor2, noiseCutout);
          diffuseColor.rgb *= boaderRim * glowIntensity;
        }
        else {
          float rimStrength = 1.0 * uTime;
          float bodyRim = mix(0.0, 1.0, pow(1. - EdotN, rimStrength));
          float glowIntensity = 25. * (1. - uTime);

          diffuseColor.rgb += boderColor * bodyRim * glowIntensity;
          diffuseColor.a = step(vWorldPosition.y, limit);
        }
      }
      

      
      `,
    );

    

    material.uniforms.dissolveTexture = uniforms.dissolveTexture;
    material.uniforms.cameraDir = uniforms.cameraDir;
    material.uniforms.cameraQuaternion = uniforms.cameraQuaternion;
    material.uniforms.eye = uniforms.eye;
    material.uniforms.uTime = uniforms.uTime;
    material.transparent = true;
  }

  playFadeOut() {
    this.fadeOut = true;
    uniforms.uTime.value = this.fadeInThreshold;
  }
  
  update() {
    setInterval(() => {
      // // uniforms.uTime.value = Math.abs(Math.cos(performance.now() / 1500));
      // this.timer = uniforms.uTime.value;
      // // uniforms.uTime.value = performance.now() / 1000;
      
      if (this.fadeOut) {
        if (uniforms.uTime.value > this.fadeOutThreshold) {
          uniforms.uTime.value -= this.fadeSpeed;
        }
        else {
          this.fadeOut = false;
          uniforms.uTime.value = this.fadeOutThreshold;
        }
      }
      else {
        if (uniforms.uTime.value < this.fadeInThreshold) {
          uniforms.uTime.value += this.fadeSpeed;
        }
      }
      if (this.camera) {
        this.cameraDir.set(0, 0, -1);
        this.cameraDir.applyQuaternion(this.camera.quaternion);
        this.cameraDir.normalize();
        uniforms.cameraDir.value.copy(this.cameraDir);
        uniforms.cameraQuaternion.value.copy(this.camera.quaternion);
        uniforms.eye.value.copy(this.camera.position);
      }
      
    
    }, this.frameRate);
  }
}

// uniforms.uTime.value = 0;

// material.vertexShader = material.vertexShader.replace(
//   `varying vec3 vViewPosition;`,
//   `
//   varying vec3 vViewPosition;
//   varying vec3 vWorldPosition;
//   varying vec3 vSurfaceNormal;
//   uniform vec4 cameraQuaternion;
//   `,
// );
// material.vertexShader = material.vertexShader.replace(
//   `void main() {`,
//   `
//   vec3 rotate_vertex_position(vec3 position, vec4 q) { 
//     return position + 2.0 * cross(q.xyz, cross(q.xyz, position) + q.w * position);
//   }
//   void main() {
//     vSurfaceNormal = normalize(normal);
//     // vSurfaceNormal = rotate_vertex_position(vSurfaceNormal, cameraQuaternion);
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
//   uniform vec3 cameraDir;
//   uniform vec3 eye;
//   uniform float uTime;
//   uniform sampler2D dissolveTexture;
//   varying vec3 vWorldPosition;
//   varying vec3 vSurfaceNormal;
  
  
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
//   diffuseColor *= sampledDiffuseColor;
  
//   float noiseUvScale = 3.5;
//   vec2 noiseUv = vec2(
//     vWorldPosition.x * noiseUvScale * -cameraDir.z + vWorldPosition.z * noiseUvScale * cameraDir.x,
//     vWorldPosition.y * noiseUvScale - uTime * noiseUvScale
//   );
//   vec4 noise = texture2D(
//     dissolveTexture, 
//     noiseUv
//   );

//   float minStrength = 0.025;
//   float noiseStrength = uTime < 1.? pow(1. - uTime, 4.0) + minStrength : minStrength;
//   float noiseCutout = textureRemap(noise, vec2(0.0, 1.0), vec2(-noiseStrength, noiseStrength)).r;

//   float bottomPosition = 1.0;
//   float avatarHeight = 3.9;
//   float speed = 0.7;
//   float cutoutHeight = ((uTime * speed)) * avatarHeight - bottomPosition;
  
//   float limit = noiseCutout + cutoutHeight;
//   float border = 0.06;
  
//   float upperBound = limit + border;

//   vec3 boderColor = vec3(0.0, 0.1, 1.0);
//   vec3 boderColor2 = vec3(0.990, 0.752, 0.851);

//   vec3 eyeDirection = normalize(eye - vWorldPosition);
//   float grid = texture2D(
//     dissolveTexture, 
//     vec2(
//       vWorldPosition.x * noiseUvScale * -cameraDir.z + vWorldPosition.z * noiseUvScale * cameraDir.x,
//       vWorldPosition.y * noiseUvScale
//     )
//   ).r;
//   float gridIntensity = 15.0;
//   float EdotN = max(0.0, dot(eyeDirection, normalize(vSurfaceNormal + vec3(grid) * vec3(1.0, gridIntensity * (1. - uTime), 1.0))));
  

//   if (uTime < 1.) {
//     if (vWorldPosition.y > limit && vWorldPosition.y < upperBound) {
//       float rimStrength = 0.5 * uTime;
//       float boaderRim = mix(0.0, 1.0, pow(1. - EdotN, rimStrength));
//       float glowIntensity = clamp(100. * (1. - uTime), 20., 100.);

//       diffuseColor.rgb += boderColor * boaderRim * glowIntensity;
//     }
//     else {
//       float rimStrength = 1.0 * uTime;
//       float bodyRim = mix(0.0, 1.0, pow(1. - EdotN, rimStrength));
//       float glowIntensity = 50. * (1. - uTime);

//       diffuseColor.rgb += boderColor * bodyRim * glowIntensity;
//       diffuseColor.a = step(vWorldPosition.y, limit);
//     }
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