import React, { Fragment, Suspense, useContext, useEffect, useState } from "react"

import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader"
import { AppMode, ViewContext } from "../context/ViewContext"
import Scene from "./Scene"

import ChatComponent from "./ChatComponent"
import Editor from "./Editor"

import { AnimationManager } from "../library/animationManager"
import { getAsArray } from "../library/utils"
import ARButton from "./ARButton"
import Background from "./Background"
import ChatButton from "./ChatButton"
import { UserMenu } from "./UserMenu"

import Logo from "./Logo"

// dynamically import the manifest
const assetImportPath = import.meta.env.VITE_ASSET_PATH + "/manifest.json"

async function fetchManifest () {
  const manifest = localStorage.getItem("manifest")
  if (manifest) {
    return JSON.parse(manifest)
  }
  const response = await fetch(assetImportPath)
  const data = await response.json()
  localStorage.setItem("manifest", JSON.stringify(data))
  return data
}

async function fetchScene () {
      // load environment
      const modelPath = "/3d/Platform.glb";

      const loader = new GLTFLoader();
      // load the modelPath
      const gltf = await loader.loadAsync(modelPath);
      return gltf.scene
}

async function fetchAnimation(templateInfo){
    // create an animation manager for all the traits that will be loaded
    const newAnimationManager = new AnimationManager(templateInfo.offset)
    await newAnimationManager.loadAnimations(templateInfo.animationPath)
    return newAnimationManager
}

async function fetchAll() {
  const manifest = await fetchManifest()
  const sceneModel = await fetchScene()

  // check if templateIndex is set in localStorage
  // if not, set it to a random index
  let templateIndex = localStorage.getItem("templateIndex")

  if (!templateIndex) {
    templateIndex = Math.floor(Math.random() * manifest.length)
    localStorage.setItem("templateIndex", templateIndex)
  } else {
    templateIndex = parseInt(templateIndex)
  }
  const templateInfo = manifest[templateIndex]

  const animationManager = await fetchAnimation(templateInfo)

  // check if initialTraits is set in localStorage
  // if not, set it to a random index
  let initialTraits = localStorage.getItem("initialTraits")
  if (!initialTraits) {
    initialTraits = initialTraits = [...new Set([...getAsArray(templateInfo.requiredTraits), ...getAsArray(templateInfo.randomTraits)])]
    localStorage.setItem("initialTraits", JSON.stringify(initialTraits))
  } else {
    initialTraits = JSON.parse(initialTraits)
  }

  return {
    manifest,
    sceneModel,
    templateInfo,
    animationManager,
    initialTraits
  }
}

const fetchData = () => {
  let status, result

  const manifestPromise = fetchAll()
  // const modelPromise = fetchModel()
  const suspender = manifestPromise.then(
    (r) => {
      status = "success"
      result = r
    },
    (e) => {
      status = "error"
      result = e
    }
  )

  return {
    read() {
      if (status === "error") {
        throw result
      } else if (status === "success") {
        return result
      }
      throw suspender
    }
  }
}

const resource = fetchData()

export default function App() {
  const {manifest, sceneModel, templateInfo, initialTraits, animationManager} = resource.read()

  const { currentAppMode } = useContext(ViewContext)
  const {avatar} = useContext(ViewContext)

  const [hideUi, setHideUi] = useState(false)

// detect a double tap on the screen or a mouse click
// switch the UI on and off
let lastTap = 0
useEffect(() => {
  const handleTap = () => {
    const now = new Date().getTime()
    const timesince = now - lastTap
    if (timesince < 300) {
      setHideUi(!hideUi)
    }
    lastTap = now
  }
  window.addEventListener("touchend", handleTap)
  window.addEventListener("click", handleTap)
  return () => {
    window.removeEventListener("touchend", handleTap)
    window.removeEventListener("click", handleTap)
  }
}, [hideUi])

return (
  <Fragment>
      <Background />
      <Logo />
        <Scene manifest={manifest} sceneModel={sceneModel} initialTraits={initialTraits} templateInfo={templateInfo} />
        {!hideUi &&
          <Fragment>
          <ChatButton />
        <ARButton />
        <UserMenu />
        {currentAppMode === AppMode.CHAT && <ChatComponent />}
        {currentAppMode === AppMode.APPEARANCE && <Editor animationManager={animationManager} initialTraits={initialTraits} templateInfo={templateInfo} />}
          </Fragment>
      }
    </Fragment>
  )
}