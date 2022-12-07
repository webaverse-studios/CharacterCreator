import Stack from "@mui/material/Stack"
import React, { useEffect, useState } from "react"

import useSound from 'use-sound';
import gsap from 'gsap';
import shuffle from "../ui/traits/shuffle.png"
import webaMark from "../ui/traits/webaMark.png"
import optionClick from "../sound/option_click.wav"
import {useMuteStore, useHideStore, useRandomFlag, useCategory, useTemplateInfo, useControls} from '../store'

import {SideMenu, LineDivision, MenuOption, MenuImg, MenuTitle, ShuffleOption} from '../styles/Editor.styled'

export default function Editor() {
  const isMute = useMuteStore((state) => state.isMute)
  const sethidden = useHideStore((state) =>state.sethidden)
  const ishide = useHideStore((state) =>state.ishidden)
  const category = useCategory((state) => state.category);
  const setCategory = useCategory((state) => state.setCategory);
  const setRandomFlag = useRandomFlag((state) => state.setRandomFlag)
  const templateInfo = useTemplateInfo((state) => state.templateInfo)
  const controls = useControls((state) => state.controls)
  const [ inverse, setInverse ] = useState(false)
  //const [itemClicked, setItemClicked] = useState(true)
  //var optionArr = [];
  useEffect(()=> {
    sethidden(false);
  }, [category])

  const [play] = useSound(
    optionClick,
    { volume: 1.0 }
  );

  const selectOption = (option:any) =>{
    if (option.name == category){ 
      if (ishide) sethidden(false);
      else sethidden (true);
    }
    else sethidden(false);

    if (option.name != category)
      moveCamera(option.cameraTarget);
    setCategory(option.name)
    
    !isMute && play();
  }

  const moveCamera = (value:any) => {
    if (value){
      setInverse(!inverse);

      gsap.to(controls.target,{
        y:value.height,
        duration: 1,
      })

      gsap.fromTo(controls,
        {
          maxDistance:controls.getDistance(),
          minDistance:controls.getDistance(),
          minPolarAngle:controls.getPolarAngle(),
          minAzimuthAngle:controls.getAzimuthalAngle(),
          maxAzimuthAngle:controls.getAzimuthalAngle(),
        },
        {
          maxDistance:value.distance,
          minDistance:value.distance,
          minPolarAngle:(Math.PI / 2 - 0.11),
          minAzimuthAngle: inverse ? -0.78 : 0.78,
          maxAzimuthAngle: inverse ? -0.78 : 0.78,
          duration: 1,
        }
      ).then(()=>{
        controls.minPolarAngle = 0;
        controls.minDistance = 0.5;
        controls.maxDistance = 2.0;
        controls.minAzimuthAngle = Infinity;
        controls.maxAzimuthAngle = Infinity;
      })
    }
  }

  return(
  <SideMenu>
    <Stack alignItems="center"> 
        
        <MenuTitle>
          <MenuImg src={webaMark} />
        </MenuTitle>

        <LineDivision bottom = {'20px'}/>

        { templateInfo.selectionTraits && templateInfo.selectionTraits.map(item => (
          // improve id
          <MenuOption 
            onClick = {()=>{selectOption(item)}} 
            selected = {category === item.name}
            key = {"i" + templateInfo.id + item.id}>  
            <MenuImg src = {templateInfo.traitIconsDirectory + item.icon} />
          </MenuOption>
        ))}

        <LineDivision top = {'20px'}/>

        <ShuffleOption 
          onClick={() => {
            setRandomFlag(0);
            !isMute && play();
          }}>
          <MenuImg src = {shuffle} />
        </ShuffleOption>
    </Stack>
  </SideMenu>);
}
