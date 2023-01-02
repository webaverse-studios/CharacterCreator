import React, { useContext, useEffect, useState } from "react"
import * as THREE from "three"
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader"
import { VRMLoaderPlugin } from "@pixiv/three-vrm"
import useSound from "use-sound"
import cancel from "../../public/ui/selector/cancel.png"
import { addModelData, disposeVRM } from "../library/utils"

import sectionClick from "../../public/sound/section_click.wav"
import tick from "../../public/ui/selector/tick.svg"
import { AudioContext } from "../context/AudioContext"
import { SceneContext } from "../context/SceneContext"

import { LipSync } from '../library/lipsync'

import styles from "./Selector.module.css"



export default function Selector({templateInfo}) {
  const {
    avatar,
    setAvatar,
    currentTraitName,
    currentOptions,
    selectedOptions,
    setSelectedOptions,
    model,
    animationManager,
    setTraitsNecks,
    setTraitsSpines,
    setTraitsLeftEye,
    setTraitsRightEye,
    getAsArray,
    loadTrait
  } = useContext(SceneContext)
  const { isMute } = useContext(AudioContext)

  const [selectValue, setSelectValue] = useState("0")
  const [loadPercentage, setLoadPercentage] = useState(1)

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

  const restrictions = getRestrictions()

  // options are selected by random or start
  useEffect(() => {
    if (selectedOptions.length > 0){
      loadTraitOptions(selectedOptions).then(traits=>{
        let newAvatar = {};
        traits.map((trait)=>{
          newAvatar = {...newAvatar, ...trait}
        })
        setAvatar({...avatar, ...newAvatar})
      })
      setSelectedOptions([]);
    }

  },[selectedOptions])
  // user selects an option
  const selectTraitOption = (option) => {
    // create a null option with current trait name to remove from current avatar
    if (option == null){
      option = {
        item:null,
        trait:templateInfo.traits.find((t) => t.name === currentTraitName)
      }
    }

    loadTraitOptions([option]).then(traits=>{
      let newAvatar = {};
      traits.map((trait)=>{
        newAvatar = {...newAvatar, ...trait}
      })
      setAvatar({...avatar, ...newAvatar})
    })

    return;
  }

  const removeTrait = (traitName) => {
    if (avatar){
      if (avatar[traitName] && avatar[traitName].vrm) {
        disposeVRM(avatar[traitName].vrm)
      }
      avatar[traitName] = {};
    }
  }

  const loadTraitOptions = (options)=>{
    
    options = filterRestrictedOptions(options);

    //validate if there is at least a non null option
    let nullOptions = true;
    options.map((option)=>{
      if(option.item != null)
        nullOptions = false;
    })

    if (nullOptions === true){
        options.map((opt)=>{
          removeTrait(opt.trait.name)
        })
    }

    const baseDir = templateInfo.traitsDirectory
    const promises  = [];

    options.map((option, i)=>{
      if (option.item?.directory != null){
        setSelectValue(option.key)
        const textureDirectories = getAsArray(option.textureTrait?.directory).map((dir)=>baseDir + dir)
        promises[i] = loadTrait(baseDir + option.item.directory, textureDirectories, option.colorTrait?.value, option.item.meshTargets)
      }
      else{
        promises[i] = new Promise((resolve) => {
            resolve(null)
        });
      }
    })
    
    return new Promise((resolve)=>{
      Promise.all(promises).then((vrms)=>{
        console.log("result data is: ", vrms)
        // add models here
        const traitResult = vrms.map((vrm,i)=>{
          // option may come as null, as user may have chosen to remove trait
          const item = options[i].item
          const traitData = options[i].trait
          if (vrm){
            if (animationManager){
              animationManager.startAnimation(vrm)
            }
            addModelData(vrm, {
              cullingLayer: 
                item.cullingLayer != null ? item.cullingLayer: 
                traitData.cullingLayer != null ? traitData.cullingLayer: 
                templateInfo.defaultCullingLayer != null?templateInfo.defaultCullingLayer: -1,
              cullingDistance: 
                item.cullingDistance != null ? item.cullingDistance: 
                traitData.cullingDistance != null ? traitData.cullingDistance:
                templateInfo.defaultCullingDistance != null ? templateInfo.defaultCullingDistance: null,
            })  
            console.log(vrm.data.cullingDistance)

            vrm.scene.traverse((child) => {
      
              // basic setup
              if (child.isBone && child.name == 'neck') { 
                setTraitsNecks(current => [...current , child])
              }
              if (child.isBone && child.name == 'spine') { 
                setTraitsSpines(current => [...current , child])
              }
              if (child.isBone && child.name === 'leftEye') { 
                setTraitsLeftEye(current => [...current , child])
              }
              if (child.isBone && child.name === 'rightEye') { 
                setTraitsRightEye(current => [...current , child])
              }
            })

            // add to scene
            model.add(vrm.scene)
          }
          
          // remove old data
          removeTrait(traitData.name)

          // and return data of new loaded traits
          return {[traitData.name]: {
            traitInfo: item,
            name: item?.name,
            model: vrm?.scene,
            vrm: vrm,
            }
          }
        })
        resolve(traitResult)
      }).catch((e)=>{
        console.error(e)
      })
    })
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

  const [play] = useSound(sectionClick, { volume: 1.0 })

  // if head <Skin templateInfo={templateInfo} avatar={avatar} />

  function ClearTraitButton() {
    // clear the current trait
    return (
      <div
        className={
          !currentTraitName
            ? styles["selectorButtonActive"]
            : styles["selectorButton"]
        }
        onClick={() => {
          selectTraitOption(null)
          !isMute && play()
        }}
      >
        <img
          className={styles["icon"]}
          src={cancel}
          style={{ width: "4em", height: "4em" }}
        />
      </div>
    )
  }
  return (
    !!currentTraitName && (
      <div className={styles["SelectorContainerPos"]}>
        <div className={styles["selector-container"]}>
          <ClearTraitButton />

          {currentOptions.map((option) =>{
            const active = option.key === selectValue
            return(
            <div
              key={option.key}
              className={`${styles["selectorButton"]} ${
                styles["selector-button"]
              } ${ active ? styles["active"] : ""}`}
              onClick={() => {
                !isMute && play()
                selectTraitOption(option)
                setLoadPercentage(1)
              }}
            >
              <img
                className={styles["trait-icon"]}
                style={option.iconHSL ? {filter: "brightness("+((option.iconHSL.l)+0.5)+") hue-rotate("+(option.iconHSL.h * 360)+"deg) saturate("+(option.iconHSL.s * 100)+"%)"} : {}}
                // style={option.iconHSL ? 
                //   `filter: brightness(${option.iconHSL.l}) 
                //   saturate(${option.iconHSL.s * 100}%) 
                //   hue(${option.iconHSL.s * 360}deg);`:""}
                src={`${templateInfo.thumbnailsDirectory}${option.icon}`}
              />
              <img
                src={tick}
                className={
                  avatar[currentTraitName] &&
                  avatar[currentTraitName].id === option.item.id  // todo (pending fix): this only considers the item id and not the subtraits id
                    ? styles["tickStyle"]
                    : styles["tickStyleInActive"]
                }
              />
              {active && loadPercentage > 0 && loadPercentage < 100 && (
                <div className={styles["loading-trait"]}>
                  Loading...
                </div>
              )}
            </div>)
          })}
        </div>
      </div>
    )
  )
}
