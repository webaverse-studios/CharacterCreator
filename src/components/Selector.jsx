import React, { useContext, useEffect, useState } from "react"
import * as THREE from "three"
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader"
import { VRMLoaderPlugin } from "@pixiv/three-vrm"
import cancel from "../../public/ui/selector/cancel.png"
import { addModelData, disposeVRM } from "../library/utils"
import { computeBoundsTree, disposeBoundsTree, acceleratedRaycast, SAH } from 'three-mesh-bvh';
import {ViewContext} from "../context/ViewContext"
import tick from "../../public/ui/selector/tick.svg"
import { AudioContext } from "../context/AudioContext"
import { SceneContext } from "../context/SceneContext"
import { SoundContext } from "../context/SoundContext"
import {
  renameVRMBones,
  createFaceNormals,
  createBoneDirection,
} from "../library/utils"
import { LipSync } from '../library/lipsync'
import { getAsArray } from "../library/utils"
import { cullHiddenMeshes } from "../library/utils"

import styles from "./Selector.module.css"
import { TokenBox } from "./token-box/TokenBox"
import { LanguageContext } from "../context/LanguageContext"


THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
THREE.BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree;
THREE.Mesh.prototype.raycast = acceleratedRaycast;

export default function Selector({confirmDialog, templateInfo, animationManager, blinkManager, lookatManager, isNewClass, effectManager, selectClass}) {
  const {
    avatar,
    setAvatar,
    currentTraitName,
    currentOptions,
    selectedOptions,
    setSelectedOptions,
    model,
    setLipSync,
    mousePosition,
    removeOption,
    saveUserSelection,
    setIsChangingWholeAvatar,
  } = useContext(SceneContext)
  const {
    playSound
  } = useContext(SoundContext)
  const { isMute } = useContext(AudioContext)
  const {isLoading, setIsLoading} = useContext(ViewContext)

  // Translate hook
  const { t } = useContext(LanguageContext)

  const [selectValue, setSelectValue] = useState("0")
  const [, setLoadPercentage] = useState(1)
  const [restrictions, setRestrictions] = useState(null)
  const [currentTrait, setCurrentTrait] = useState(new Map());
  const [vrm1Warn, setVrm1Warn1] = useState(true);

  const updateCurrentTraitMap = (k,v) => {
    setCurrentTrait(currentTrait.set(k,v));
  }
  const resetCurrentTraitMap = () => {
    setCurrentTrait(new Map());
  }
  
  useEffect(() => {
    setRestrictions(getRestrictions());

  },[templateInfo])

  const getRestrictions = () => {

    const traitRestrictions = templateInfo.traitRestrictions
    const typeRestrictions = {};

    for (const prop in traitRestrictions){

      // create the counter restrcitions traits
      getAsArray(traitRestrictions[prop].restrictedTraits).map((traitName)=>{

        // check if the trait restrictions exists for the other trait, if not add it
        if (traitRestrictions[traitName] == null) traitRestrictions[traitName] = {}
        // make sure to have an array setup, if there is none, create a new empty one
        if (traitRestrictions[traitName].restrictedTraits == null) traitRestrictions[traitName].restrictedTraits = []

        // finally merge existing and new restrictions
        traitRestrictions[traitName].restrictedTraits = [...new Set([
          ...traitRestrictions[traitName].restrictedTraits ,
          ...[prop]])]  // make sure to add prop as restriction
      })

      // do the same for the types
      getAsArray(traitRestrictions[prop].restrictedTypes).map((typeName)=>{
        //notice were adding the new data to typeRestrictions and not trait
        if (typeRestrictions[typeName] == null) typeRestrictions[typeName] = {}
        //create the restricted trait in this type
        if (typeRestrictions[typeName].restrictedTraits == null) typeRestrictions[typeName].restrictedTraits = []

        typeRestrictions[typeName].restrictedTraits = [...new Set([
          ...typeRestrictions[typeName].restrictedTraits ,
          ...[prop]])]  // make sure to add prop as restriction
      })
    }

    // now merge defined type to type restrictions
    for (const prop in templateInfo.typeRestrictions){
      // check if it already exsits
      if (typeRestrictions[prop] == null) typeRestrictions[prop] = {}
      if (typeRestrictions[prop].restrictedTypes == null) typeRestrictions[prop].restrictedTypes = []
      typeRestrictions[prop].restrictedTypes = [...new Set([
        ...typeRestrictions[prop].restrictedTypes ,
        ...getAsArray(templateInfo.typeRestrictions[prop])])]  

      // now that we have setup the type restrictions, lets counter create for the other traits
      getAsArray(templateInfo.typeRestrictions[prop]).map((typeName)=>{
        // prop = boots
        // typeName = pants
        if (typeRestrictions[typeName] == null) typeRestrictions[typeName] = {}
        if (typeRestrictions[typeName].restrictedTypes == null) typeRestrictions[typeName].restrictedTypes =[]
        typeRestrictions[typeName].restrictedTypes = [...new Set([
          ...typeRestrictions[typeName].restrictedTypes ,
          ...[prop]])]  // make sure to add prop as restriction
      })
    }

    return {
      traitRestrictions,
      typeRestrictions
    }
  }

  const loadSelectedOptions = (opts) => {
    loadOptions(opts).then((loadedData)=>{
      let newAvatar = {};
      loadedData.map((data)=>{
        newAvatar = {...newAvatar, ...itemAssign(data)}
      })
      const finalAvatar = {...avatar, ...newAvatar}
      setTimeout(() => {
        if (Object.keys(finalAvatar).length > 0) {
          cullHiddenMeshes(finalAvatar)
        }
        !isMute && playSound('characterLoad',300);
      }, effectManager.transitionTime);
      setAvatar(finalAvatar)
    })
  }

  // options are selected by random or start
  useEffect(() => {
    if (selectedOptions.length > 0){
      setIsChangingWholeAvatar(true);
      if (selectedOptions.length > 1){
        effectManager.setTransitionEffect('fade_out_avatar');
        effectManager.playFadeOutEffect();
        resetCurrentTraitMap();
      }

      loadSelectedOptions(selectedOptions)
      setSelectedOptions([]);
    }

  },[selectedOptions])

  const loadCustom = (file) => {
    const url = URL.createObjectURL(file);
    const option = {
      
      item:{
        id:"custom_" + currentTraitName,
        name:"Custom " + currentTraitName,
        directory:url
      },
      trait:templateInfo.traits.find((t) => t.name === currentTraitName)
    }
    effectManager.setTransitionEffect('switch_item');
    loadOptions([option], false, false, false).then((loadedData)=>{
      URL.revokeObjectURL(url);
      if (loadedData[0].models[0]?.userData?.gltfExtensions?.VRMC_vrm){
        let newAvatar = {};
        loadedData.map((data)=>{
          newAvatar = {...newAvatar, ...itemAssign(data)}
        })
        const finalAvatar = {...avatar, ...newAvatar}
        setTimeout(() => {
          if (Object.keys(finalAvatar).length > 0) {
            cullHiddenMeshes(finalAvatar)
          }
        }, effectManager.transitionTime);
        setAvatar(finalAvatar)
      }
      else{

        console.log("Only vrm1 file supported")
      }
    })
  }

  const promptUpload = async () => {
    if (vrm1Warn){
      confirmDialog("Supports only VRM1 files", (val)=>{
        setVrm1Warn1(!val);
        if (val)
          uploadTrait()
      })
    }
    else{
      uploadTrait();
    }
  }

  const uploadTrait = async() =>{
      var input = document.createElement('input');
      input.type = 'file';
      input.accept=".vrm"

      input.onchange = e => { 
        var file = e.target.files[0]; 
        if (file.name.endsWith(".vrm")){
          loadCustom(file)
        }
      }
      input.click();
  }
  // user selects an option
  const selectTraitOption = (option) => {
    const addOption  = option != null
    if (isLoading) return;

    if (option == null){
      option = {
        item:null,
        trait:templateInfo.traits.find((t) => t.name === currentTraitName)
      }
    }
    else {
      if (currentTrait.get(option.trait.trait) === option.key) {
        return;
      }
    }
    
    if (option.avatarIndex != null){
      if(isNewClass(option.avatarIndex)){
        selectClass(option.avatarIndex)
      }
      return
    }

    effectManager.setTransitionEffect('switch_item');

    option.selected = true

    loadOptions(getAsArray(option),addOption).then((loadedData)=>{
      let newAvatar = {};
      loadedData.map((data)=>{
        newAvatar = {...newAvatar, ...itemAssign(data)}
      })
      
      const finalAvatar = {...avatar, ...newAvatar}
      setTimeout(() => {
        if (Object.keys(finalAvatar).length > 0) {
          cullHiddenMeshes(finalAvatar)
        }
      }, effectManager.transitionTime);
      setAvatar(finalAvatar)
    })

    return;
  }

  
  
  // load options first
  const loadOptions = (options, filterRestrictions = true, useTemplateBaseDirectory = true, saveUserSel = true) => {
  //const loadOptions = (options, filterRestrictions = true) => {
    for (const option of options) {
      updateCurrentTraitMap(option.trait.trait, option.key)
    }
    // filter options by restrictions

    if (filterRestrictions)
      options = filterRestrictedOptions(options);

    //save selection to local storage
    if (saveUserSel)
      saveUserSelection(templateInfo.name, options)

    // validate if there is at least a non null option
    let nullOptions = true;
    options.map((option)=>{
      if(option.item != null)
        nullOptions = false;
    })
    if (nullOptions === true){
      return new Promise((resolve) => {
        resolve(options)
      });
    }

    setIsLoading(true);

    //create the manager for all the options
    const loadingManager = new THREE.LoadingManager()

    //create a gltf loader for the 3d models
    const gltfLoader = new GLTFLoader(loadingManager)
    gltfLoader.register((parser) => {
      return new VRMLoaderPlugin(parser)
    })

    // and a texture loaders for all the textures
    const textureLoader = new THREE.TextureLoader(loadingManager)
    loadingManager.onProgress = function(url, loaded, total){
      setLoadPercentage(Math.round(loaded/total * 100 ))
    }
    // return a promise, resolve = once everything is loaded
    return new Promise((resolve) => {

      // resultData will hold all the results in the array that was given this function
      const resultData = [];
      loadingManager.onLoad = function (){
        setLoadPercentage(0)
        resolve(resultData);
        setIsLoading(false)
      };
      loadingManager.onError = function (url){
        console.warn("error loading " + url)
      }
      loadingManager.onProgress = function(url, loaded, total){
        setLoadPercentage(Math.round(loaded/total * 100 ))
      }

      const baseDir = useTemplateBaseDirectory ? templateInfo.traitsDirectory : ""// (maybe set in loading manager)

      // load necesary assets for the options
      options.map((option, index)=>{
        if (option.selected){
          setSelectValue(option.key)
        }
        if (option == null){
          resultData[index] = null;
          return;
        }
        // load model trait
        const loadedModels = [];
        getAsArray(option?.item?.directory).map((modelDir, i) => {
          gltfLoader.loadAsync (baseDir + modelDir).then((mod) => {
            loadedModels[i] = mod;
          })
        })
        
        // load texture trait
        const loadedTextures = [];
        getAsArray(option?.textureTrait?.directory).map((textureDir, i)=>{
          textureLoader.load(baseDir + textureDir,(txt)=>{
            txt.flipY = false;
            loadedTextures[i] = (txt)
          })
        })

        // and just create colors
        const loadedColors = [];
        getAsArray(option?.colorTrait?.value).map((colorValue, i)=>{
          loadedColors[i] = new THREE.Color(colorValue);
        })
        resultData[index] = {
          item:option?.item,
          trait:option?.trait,
          textureTrait:option?.textureTrait,
          colorTrait:option?.colorTrait,
          models:loadedModels,          
          textures:loadedTextures, 
          colors:loadedColors      
        }
      })
    });
  }

  const filterRestrictedOptions = (options) =>{
    let removeTraits = [];
    for (let i =0; i < options.length;i++){
      const option = options[i];
      
     //if this option is not already in the remove traits list then:
     if (!removeTraits.includes(option.trait.name)){
        const typeRestrictions = restrictions?.typeRestrictions;
        // type restrictions = what `type` cannot go wit this trait or this type
        if (typeRestrictions){
          getAsArray(option.item?.type).map((t)=>{
            //combine to array
            removeTraits = [...new Set([
              ...removeTraits , // get previous remove traits
              ...findTraitsWithTypes(getAsArray(typeRestrictions[t]?.restrictedTypes)),  //get by restricted traits by types coincidence
              ...getAsArray(typeRestrictions[t]?.restrictedTraits)])]  // get by restricted trait setup

          })
        }

        // trait restrictions = what `trait` cannot go wit this trait or this type
        const traitRestrictions = restrictions?.traitRestrictions;
        if (traitRestrictions){
          removeTraits = [...new Set([
            ...removeTraits,
            ...findTraitsWithTypes(getAsArray(traitRestrictions[option.trait.name]?.restrictedTypes)),
            ...getAsArray(traitRestrictions[option.trait.name]?.restrictedTraits),

          ])]
        }
      }
    }

    // now update uptions
    removeTraits.forEach(trait => {
      let removed = false;
      updateCurrentTraitMap(trait, null);
      
      for (let i =0; i < options.length;i++){
        // find an option with the trait name 
        if (options[i].trait?.name === trait){
          options[i] = {
            item:null,
            trait:templateInfo.traits.find((t) => t.name === trait)
          }
          removed = true;
          break;
        }
      }
      // if no option setup was found, add a null option to remove in case user had it added before
      if (!removed){
        options.push({
          item:null,
          trait:templateInfo.traits.find((t) => t.name === trait)
        })
      }
    });
   
    return options;
  }

  const findTraitsWithTypes = (types) => {
    const typeTraits = [];
    for (const prop in avatar){
      for (let i = 0; i < types.length; i++){
        const t = types[i]
       
        if (avatar[prop].traitInfo?.type?.includes(t)){
          typeTraits.push(prop);
          break;
        }
      }
    }
    return typeTraits;
  }

  // once loaded, assign
  const itemAssign = (itemData) => {
    const item = itemData.item;
    const traitData = itemData.trait;
    const textureItem= itemData.textureTrait;
    const colorItem = itemData.colorTrait;
    const models = itemData.models;
    const textures = itemData.textures;
    const colors = itemData.colors;

    // null section (when user selects to remove an option)
    if ( item == null) {
      // if avatar exists and trait exsits, remove it
      if (avatar){
        if ( avatar[traitData.name] && avatar[traitData.name].vrm ){
          setTimeout(() => {
            disposeVRM(avatar[traitData.name].vrm)
          }, effectManager.transitionTime)
          
        }
      }
      // always return an empty trait here when receiving null item
      return {
        [traitData.name]: {}
      }
    }

    // save an array of mesh targets
    const meshTargets = [];
    
   
    // add culling data to each model TODO,  if user defines target culling meshes set them before here
    // models are vrm in some cases!, beware
    let vrm = null
    
    models.map((m)=>{
      // basic vrm setup (only if model is vrm)
      vrm = m.userData.vrm;
      
      if (getAsArray(templateInfo.lipSyncTraits).indexOf(traitData.trait) !== -1)
        setLipSync(new LipSync(vrm));
      renameVRMBones(vrm)

      if (getAsArray(templateInfo.blinkerTraits).indexOf(traitData.trait) !== -1)
        blinkManager.addBlinker(vrm)

      lookatManager.addVRM(vrm)

      // animation setup section
      // play animations on this vrm  TODO, letscreate a single animation manager per traitInfo, as model may change since it is now a trait option
      animationManager.startAnimation(vrm)

      // mesh target setup section
      if (item.meshTargets){
        getAsArray(item.meshTargets).map((target) => {
          const mesh = vrm.scene.getObjectByName ( target )
          if (mesh?.isMesh) meshTargets.push(mesh);
        })
      }
      
      const cullingIgnore = getAsArray(item.cullingIgnore)
      const cullingMeshes = [];

      vrm.scene.traverse((child) => {
        
        // mesh target setup secondary swection
        if (!item.meshTargets && child.isMesh) meshTargets.push(child);

        // basic setup
        child.frustumCulled = false
        if (child.isMesh) {
          if (child.material.length){
            effectManager.setCustomShader(child.material[0]);
            effectManager.setCustomShader(child.material[1]);
          }
          else{
            effectManager.setCustomShader(child.material);
          }
          // if a mesh is found in name to be ignored, dont add it to target cull meshes
          if (cullingIgnore.indexOf(child.name) === -1)
            cullingMeshes.push(child)

          if (child.geometry.boundsTree == null)
            child.geometry.computeBoundsTree({strategy:SAH});

          createFaceNormals(child.geometry)
          if (child.isSkinnedMesh) createBoneDirection(child)
        }
      })

      // culling layers setup section
      addModelData(vrm, {
        cullingLayer: 
          item.cullingLayer != null ? item.cullingLayer: 
          traitData.cullingLayer != null ? traitData.cullingLayer: 
          templateInfo.defaultCullingLayer != null?templateInfo.defaultCullingLayer: -1,
        cullingDistance: 
          item.cullingDistance != null ? item.cullingDistance: 
          traitData.cullingDistance != null ? traitData.cullingDistance:
          templateInfo.defaultCullingDistance != null ? templateInfo.defaultCullingDistance: null,
        maxCullingDistance:
          item.maxCullingDistance != null ? item.maxCullingDistance: 
          traitData.maxCullingDistance != null ? traitData.maxCullingDistance:
          templateInfo.maxCullingDistance != null ? templateInfo.maxCullingDistance: Infinity,
        cullingMeshes
      })  
    })

    // once the setup is done, assign them
    meshTargets.map((mesh, index)=>{
      
      if (textures){
        const txt = textures[index] || textures[0]
        if (txt != null){
          //const mat = mesh.material.length ? mesh.material[0] : 
          mesh.material[0].map = txt
          mesh.material[0].shadeMultiplyTexture = txt
        }
      }
      if (colors){
        const col = colors[index] || colors[0]
        if (col != null){
          mesh.material[0].uniforms.litFactor.value = col
          mesh.material[0].uniforms.shadeColorFactor.value = new THREE.Color( col.r*0.8, col.g*0.8, col.b*0.8 )
        }
      }
    })

    // if there was a previous loaded model, remove it (maybe also remove loaded textures?)
    if (avatar){
      if (avatar[traitData.name] && avatar[traitData.name].vrm) {
        //if (avatar[traitData.name].vrm != vrm)  // make sure its not the same vrm as the current loaded
        setTimeout(() => {
          disposeVRM(avatar[traitData.name].vrm)
          // // play avatar fade in effect
          // !effectManager.getTransitionEffect('switch_item') && effectManager.playFadeInEffect();
        }, effectManager.transitionTime)

      }
    }
    
    if(vrm) {
      const m = vrm.scene;
      m.visible = false;
      // add the now model to the current scene
      model.add(m)
      animationManager.update(); // note: update animation to prevent some frames of T pose at start.
      setTimeout(() => {
        // update the joint rotation of the new trait
        const event = new Event('mousemove');
        event.x = mousePosition.x;
        event.y = mousePosition.y;
        window.dispatchEvent(event);

        m.visible = true;

        // play transition effect
        if (effectManager.getTransitionEffect('switch_item')) {
          effectManager.playSwitchItemEffect();
          // !isMute && playSound('switchItem');
        }
        else {
          effectManager.playFadeInEffect();
        } 
      }, effectManager.transitionTime)
    }

    // and then add the new avatar data
    // to do, we are now able to load multiple vrm models per options, set the options to include vrm arrays
    return {
      [traitData.name]: {
        traitInfo: item,
        textureInfo: textureItem,
        colorInfo: colorItem,
        name: item.name,
        model: vrm && vrm.scene,
        vrm: vrm,
      }
    }
  }


  // if head <Skin templateInfo={templateInfo} avatar={avatar} />

  function TraitTitle(props) {
    return (
      props.title && (
        <div className={styles["traitTitleWrap"]}>
          <div className={styles["topLine"]} />
          <div className={styles["traitTitle"]}>{props.title}</div>
        </div>
      )
    )
  }

  function ClearTraitButton() {
    // clear the current trait
    const isSelected = currentTrait.get(currentTraitName) ? true : false;
    return removeOption ? (
      <div
        key={"no-trait"}
        className={`${styles["selectorButton"]} ${styles["selector-button"]} ${
          !currentTraitName ? styles["active"] : ""
        }`}
        onClick={() => {
          if (effectManager.getTransitionEffect('normal')) {
            selectTraitOption(null) 
            setSelectValue("")
            effectManager.setTransitionEffect('normal');
          }
        }}
      >
        <TokenBox
          size={56}
          resolution={2048}
          numFrames={128}
          id="head"
          icon={cancel}
          rarity={!isSelected ? "mythic" : "none"}
        />
      </div>
    ) : (
      <></>
    )
  }
  
  return (
    !!currentTraitName && (
      
      <div className={styles["SelectorContainerPos"]}>
       
        <TraitTitle title={t(`editor.${currentTraitName}`)} />
        <div className={styles["bottomLine"]} />
        <div className={styles["scrollContainer"]}>
          <div className={styles["selector-container"]}>
            <ClearTraitButton />
            {currentOptions.map((option) => {
              let active = option.key === selectValue
              if (currentTrait.size === 0) {
                active = false;
              }
              else {
                active = currentTrait.get(option.trait.trait) === option.key;
              }
              return (
                <div
                  key={option.key}
                  className={`${styles["selectorButton"]} ${
                    styles["selector-button"]
                  } ${active ? styles["active"] : ""}`}
                  onClick={() => {
                    if (effectManager.getTransitionEffect('normal')){
                      selectTraitOption(option)
                      setLoadPercentage(1)
                    }
                  }}
                >
                  <TokenBox
                    size={56}
                    resolution={2048}
                    numFrames={128}
                    icon={option.icon}
                    rarity={active ? "mythic" : "none"}
                    style={
                      option.iconHSL
                        ? {
                            filter:
                              "brightness(" +
                              (option.iconHSL.l + 0.5) +
                              ") hue-rotate(" +
                              option.iconHSL.h * 360 +
                              "deg) saturate(" +
                              option.iconHSL.s * 100 +
                              "%)",
                          }
                        : {}
                    }
                  />
                  <img
                    src={tick}
                    className={
                      avatar[currentTraitName] &&
                      avatar[currentTraitName].id === option.item.id // todo (pending fix): this only considers the item id and not the subtraits id
                        ? styles["tickStyle"]
                        : styles["tickStyleInActive"]
                    }
                  />
                  {/*{active && loadPercentage > 0 && loadPercentage < 100 && (
                    // TODO: Fill up background from bottom as loadPercentage increases
                  )}*/}
                </div>
              )
            })}
          </div>
        </div>
        <div className={styles["uploadContainer"]}>
          
          <div 
            className={styles["uploadButton"]}
            onClick={() => {promptUpload()}}>
            <div> 
              Upload </div>
          </div>
          
        </div>
      </div>
    )
  )
}