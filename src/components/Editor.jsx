import React, { Fragment, useEffect, useContext } from "react"

import shuffle from "../../public/ui/traits/shuffle.svg"
import { AudioContext } from "../context/AudioContext"
import { SceneContext } from "../context/SceneContext"
import { SoundContext } from "../context/SoundContext"
import { getAsArray } from "../library/utils"
import {
  getClassOptions,
  getRandomizedTemplateOptions,
  getTraitOptions
} from "../library/option-utils"

import styles from "./Editor.module.css"
import Selector from "./Selector"
import { TokenBox } from "./token-box/TokenBox"
import { LanguageContext } from "../context/LanguageContext"


export default function Editor({confirmDialog,animationManager, blinkManager, lookatManager, effectManager, fetchNewModel}) {
  const {manifest, currentTraitName, setCurrentTraitName, awaitDisplay, setCurrentOptions, setSelectedOptions, setAwaitDisplay, setRemoveOption, loadUserSelection, templateInfo, moveCamera} = useContext(SceneContext);
  
  const { isMute } = useContext(AudioContext)

  // Translate hook
  const { t } = useContext(LanguageContext)

  const {
    playSound
  } = useContext(SoundContext)

  const [cameraFocused, setCameraFocused] = React.useState(false)

  // options are selected by random or start
  useEffect(() => {
    if (awaitDisplay){
      setSelectedOptions(
        loadUserSelection(templateInfo.name)
        || getRandomizedTemplateOptions(templateInfo)
      )
        setAwaitDisplay(false)
    }
    setCurrentTraitName(null)
  }, [templateInfo])


  const selectOption = (option) => {
    !isMute && playSound('optionClick');
    if (option.name === currentTraitName) {
      if (cameraFocused) {
        moveCamera({ targetY: option.cameraTarget.height, distance: option.cameraTarget.distance})
        setCameraFocused(false)
      } else {
        moveCamera({ targetY: 0.8, distance: 3.2 })
        setCameraFocused(true)
      }
      setCurrentTraitName(null)
      return
    }

    setRemoveOption(
      getAsArray(templateInfo.requiredTraits).indexOf(option.name) === -1,
    )
    moveCamera({ targetY: option.cameraTarget.height, distance: option.cameraTarget.distance})
    setCurrentOptions(getTraitOptions(option, templateInfo))
    setCurrentTraitName(option.name)
  }
  const selectClassOption = () => {
    setRemoveOption(false)
    setCurrentOptions(getClassOptions(manifest))
    setCurrentTraitName("_class")
  }
  
  const isNewClass = (templateIndex) => {
    return templateInfo != manifest[templateIndex]
  }

  const selectClass = (ind) => {
    fetchNewModel(ind)
  }

  function MenuTitle(props) {
    return (
      props.title && (
        <div className={styles["mainTitleWrap"]}>
          <div className={styles["topLine"]} />
          <div className={styles["mainTitle"]}>{props.title}</div>
        </div>
      )
    )
  }

  return (
    <Fragment>
      <div className={styles["SideMenu"]}>
        <MenuTitle title={t("editor.title")} />
        <div className={styles["bottomLine"]} />
        <div className={styles["scrollContainer"]}>
          <div className={styles["selector-container"]}>
            {templateInfo.traits &&
              templateInfo.traits.map((item, index) => (
                <div key={index} className={styles["selectorButton"]}>
                  <TokenBox
                    size={56}
                    resolution={2048}
                    numFrames={128}
                    icon={templateInfo.traitIconsDirectorySvg + item.iconSvg}
                    rarity={currentTraitName !== item.name ? "none" : "mythic"}
                    onClick={() => {
                      selectOption(item)
                    }}
                  />
                </div>
              ))}
          </div>
        </div>
      </div>
      <Selector confirmDialog = {confirmDialog} animationManager={animationManager} templateInfo={templateInfo} blinkManager = {blinkManager} lookatManager = {lookatManager} effectManager = {effectManager} selectClass = {selectClass} isNewClass = {isNewClass}/>
    </Fragment>
  )
}
