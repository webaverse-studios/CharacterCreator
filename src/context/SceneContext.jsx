import React, { createContext, useEffect, useState } from "react"
import * as THREE from "three"
import { cullHiddenMeshes } from "../library/utils"
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader"
import { VRMLoaderPlugin } from "@pixiv/three-vrm"
import {
  renameVRMBones,
  createFaceNormals,
  createBoneDirection,
} from "../library/utils"
import { computeBoundsTree, disposeBoundsTree, acceleratedRaycast, SAH } from 'three-mesh-bvh';

export const SceneContext = createContext()

THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
THREE.BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree;
THREE.Mesh.prototype.raycast = acceleratedRaycast;

export const SceneProvider = (props) => {

  const gltfLoader = new GLTFLoader()
  gltfLoader.register((parser) => {
    return new VRMLoaderPlugin(parser)
  })

  function getAsArray(target){
    if (target == null) return []
    return Array.isArray(target) ? target : [target]
  }

  // returns a vrm file with attached textures/colors to target meshes or all child meshes if null
  async function loadTrait(modelFile, textureFiles, colors, meshTargetNames){

    //create a loading manager for this trait
    const loadManager = new THREE.LoadingManager()
    const gltfLoad = new GLTFLoader(loadManager)
    gltfLoad.register((parser) => {
      return new VRMLoaderPlugin(parser)
    })  
    const txtrLoader = new THREE.TextureLoader(loadManager)
    
    // promise will fullfill when all assets necessary for this traits are loaded
    return new Promise((resolve) => {

      // resultData will hold all the results in the array that was given this function
      const resultData = {
        vrm:null,          
        textures:[], 
        colors:[]    
      }
      

      loadManager.onLoad = function (){

        // find mesh targets if defined, if not, grab all children 
        const meshTargets = [];
        if (meshTargetNames!= null){
          getAsArray(meshTargetNames).map((target) => {
            const mesh = resultData.vrm.scene.getObjectByName ( target )
            if (mesh?.isMesh) meshTargets.push(mesh);
          })
        }
        else{
          resultData.vrm.scene.traverse((child)=>{
            if (child.isMesh)meshTargets.push(child);
          })
        }

        // then assign the textures/colors by array order
        meshTargets.map((mesh, index)=>{
          if (resultData.textures.length > 0){
            const txt = resultData.textures[index] || resultData.textures[0]
            if (txt != null){
              mesh.material[0].map = txt
              mesh.material[0].shadeMultiplyTexture = txt
            }
          }
          if (resultData.colors.length > 0){
            const col = resultData.colors[index] || resultData.colors[0]
            if (col != null){
              mesh.material[0].uniforms.litFactor.value = col
              mesh.material[0].uniforms.shadeColorFactor.value = new THREE.Color( col.r*0.8, col.g*0.8, col.b*0.8 )
            }
          }
        })

        // and return only the loaded vrm
        resolve(resultData.vrm);
        
      }
      
      loadManager.onError = function (url){
        console.warn("error loading " + url)
      }

      // load model
      gltfLoad.load(modelFile,(m)=>{
        const vrm = m.userData.vrm
        renameVRMBones(vrm)
  
        vrm.scene?.traverse((child) => {
          child.frustumCulled = false
  
          if (child.isMesh) {
            createFaceNormals(child.geometry)
            if (child.isSkinnedMesh) createBoneDirection(child)
            child.geometry.computeBoundsTree({strategy:SAH});
          }
        })
        resultData.vrm = vrm
      })  

      // load textures
      getAsArray(textureFiles).map((textureDir, i)=>{
        txtrLoader.load(textureDir,(txt)=>{
          txt.flipY = false;
          resultData.textures[i] = txt
        })
      })
        
      // load colors
      getAsArray(colors).map((colorValue, i)=>{
        console.log(colorValue)
        resultData.colors[i] = new THREE.Color(colorValue);
      })
        
    })
  }

  async function loadModel(file, onProgress) {
    return gltfLoader.loadAsync(file, onProgress).then((model) => {
      const vrm = model.userData.vrm
      renameVRMBones(vrm)

      vrm.scene?.traverse((child) => {
        child.frustumCulled = false

        if (child.isMesh) {
          createFaceNormals(child.geometry)
          if (child.isSkinnedMesh) createBoneDirection(child)
          child.geometry.computeBoundsTree({strategy:SAH});
        }
      })
      return vrm
    })
  }

  const [template, setTemplate] = useState(null)
  const [scene, setScene] = useState(new THREE.Scene())   
  const [currentTraitName, setCurrentTraitName] = useState(null)
  const [currentOptions, setCurrentOptions] = useState([])
  const [model, setModel] = useState(null)
  const [animationManager, setAnimationManager] = useState(null)
  const [camera, setCamera] = useState(null)

  const [selectedOptions, setSelectedOptions] = useState([])
  const [selectedRandomTraits, setSelectedRandomTraits] = React.useState([])

  const [colorStatus, setColorStatus] = useState("")
  const [traitsNecks, setTraitsNecks] = useState([])
  const [traitsSpines, setTraitsSpines] = useState([])
  const [traitsLeftEye, setTraitsLeftEye] = useState([])
  const [traitsRightEye, setTraitsRightEye] = useState([])
  const [skinColor, setSkinColor] = useState(new THREE.Color(1, 1, 1))
  const [avatar, _setAvatar] = useState(null);

  const [lipSync, setLipSync] = useState(null);
  
  const setAvatar = (state) => {
    _setAvatar(state)
  }
  useEffect(()=>{
   
    if (avatar){
     if(Object.keys(avatar).length > 0){
        cullHiddenMeshes(avatar)
     }
    }
  },[avatar])

  const [currentTemplate, setCurrentTemplate] = useState(null)
  return (
    <SceneContext.Provider
      value={{
        getAsArray,
        lipSync,
        setLipSync,
        scene,
        setScene,

        loadModel,
        loadTrait,
        
        currentTraitName,
        setCurrentTraitName,
        currentOptions,
        setCurrentOptions,
        setSelectedOptions,
        selectedOptions,
        setSelectedRandomTraits,
        selectedRandomTraits,
        model,
        setModel,
        animationManager,
        setAnimationManager,
        camera,
        setCamera,
        colorStatus,
        setColorStatus,
        skinColor,
        setSkinColor,
        avatar,
        setAvatar,
        currentTemplate,
        setCurrentTemplate,
        template,
        setTemplate,
        traitsNecks,
        setTraitsNecks,
        traitsSpines,
        setTraitsSpines,
        traitsLeftEye,
        setTraitsLeftEye,
        traitsRightEye,
        setTraitsRightEye
      }}
    >
      {props.children}
    </SceneContext.Provider>
  )
}
