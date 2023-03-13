import { AnimationMixer, Vector3} from 'three'
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader"
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader"
import { addModelData } from "./utils";

// make a class that hold all the informarion
const fbxLoader = new FBXLoader();
const gltfLoader = new GLTFLoader();
const interpolationTime = 0.2;

const getRandomInt = (max) => {
  return Math.floor(Math.random() * max);
}

class AnimationControl {
  constructor(animationManager, scene, animations, curIdx, lastIdx){
    this.mixer = new AnimationMixer(scene);
    this.actions = [];
    this.to = null;
    this.from = null;
    this.animationManager = null;
    this.animationManager = animationManager;
    animations[0].tracks.map((track, index) => {
      if(track.name === "neck.quaternion" || track.name === "spine.quaternion"){
        animations[0].tracks.splice(index, 1)
      }
    })
    // animations[0].tracks.splice(9, 2);
    this.actions = [];
    for (let i =0; i < animations.length;i++){
      this.actions.push(this.mixer.clipAction(animations[i]));
    }

    this.to = this.actions[curIdx]
    
    if (lastIdx != -1){
      this.from = this.actions[lastIdx];
      this.from.reset();
      this.from.time = animationManager.getFromActionTime();
      this.from.play();

      this.to.weight = animationManager.getWeightIn();
      this.from.weight = animationManager.getWeightOut();
    }

    this.actions[curIdx].reset();
    this.actions[curIdx].time = animationManager.getToActionTime();
    this.actions[curIdx].play();
  }

  reset() {
    this.mixer.setTime(0);
    this.to.paused = true;
  }

  resume() {
    this.to.paused = false;
  }

  dispose(){
    this.animationManager.disposeAnimation(this);
    //console.log("todo dispose animation control")
  }
}

export class AnimationManager{
  constructor (offset){
    this.lastAnimID = null;
    this.curAnimID = null;
    this.mainControl = null;
    this.animationControl  = null;
    this.animations = null;
    this.weightIn = NaN; // note: can't set null, because of check `null < 1` will result `true`.
    this.weightOut = NaN;
    this.offset = null;
    this.lastAnimID = -1;
    this.curAnimID = 0;
    this.animationControls = [];
    this.started = false;
    if (offset){
      this.offset = new Vector3(
        offset[0],
        offset[1],
        offset[2]
      );
    }
    setInterval(() => {
      this.update();
    }, 1000/30);
  }
  async loadAnimations(path){
    const loader = path.endsWith('.fbx') ? fbxLoader : gltfLoader;
    const anim = await loader.loadAsync(path);
    // offset hips
    this.animations = anim.animations;
    if (this.offset)
      this.offsetHips();


    this.mainControl = new AnimationControl(this, anim, anim.animations, this.curAnimID, this.lastAnimID)
    this.animationControls.push(this.mainControl)
  
  }

  enableScreenshot() {
    this.animationControls.forEach(control => {
      control.reset()
    }); 
  }

  disableScreenshot() {
    this.animationControls.forEach(control => {
      control.resume()
    }); 
  }

  offsetHips(){
    this.animations.forEach(anim => {
      for (let i =0; i < anim.tracks.length; i++){
        const track = anim.tracks[i];
        if (track.name === "hips.position"){
          for (let j = 0; j < track.values.length/3 ; j++){
            const base = j*3;
            track.values[base] = track.values[base] + this.offset.x;
            track.values[base + 1] = track.values[base + 1] + this.offset.y;
            track.values[base + 2] = track.values[base + 2] + this.offset.z;
          }
        }
      }
    });
  }

  startAnimation(vrm){
    //return
    if (!this.animations) {
      console.warn("no animations were preloaded, ignoring");
      return
    }
    const animationControl = new AnimationControl(this, vrm.scene, this.animations, this.curAnimID, this.lastAnimID)
    this.animationControls.push(animationControl);

    addModelData(vrm , {animationControl});

    if (this.started === false){
      this.started = true;
      this.animRandomizer(this.animations[this.curAnimID].duration);
    }
  }
  
  getFromActionTime(){
    return this.mainControl.actions[this.lastAnimID].time;
  }

  getToActionTime(){
    return this.mainControl ? this.mainControl.actions[this.curAnimID].time : 0.1;
  }

  getWeightIn(){
    return this.weightIn;
  }

  getWeightOut(){
    return this.weightOut;
  }
  
  disposeAnimation(targetAnimControl){
    if (targetAnimControl != null){
      const ind = this.animationControls.indexOf(targetAnimControl);
      if (ind != -1)
        this.animationControls.splice(ind,1);
    }
  }

  dispose(){
    this.animationControls.forEach(animControl => {
      animControl.dispose()
    });
    //console.log("todo dispose animations")
  }

  animRandomizer(yieldTime){
    setTimeout(() => {
      this.lastAnimID = this.curAnimID;
      this.curAnimID = getRandomInt(this.animations.length);
      if (this.curAnimID != this.lastAnimID){
        
        this.animationControls.forEach(animControl => {
  
          animControl.from = animControl.actions[this.lastAnimID];
          animControl.to = animControl.actions[this.curAnimID];
  
          this.weightIn = 0;
          this.weightOut = 1;
          
          animControl.to.play();
          animControl.to.reset();
        })
      }
      this.animRandomizer(this.animations[this.curAnimID].duration - interpolationTime);
    }, (yieldTime * 1000));
  }

  update(){
    if (this.mainControl) {
      this.animationControls.forEach(animControl => {
        if (animControl.from != null) {
          animControl.from.weight = this.weightOut;
        }
        if (animControl.to != null) {
          animControl.to.weight = this.weightIn;
        }

        animControl.mixer.update(1/30);
      });

      if (this.weightIn < 1) {
        this.weightIn += 1/(30*interpolationTime);
      }
      else this.weightIn = 1;  
  
      if (this.weightOut > 0) this.weightOut -= 1/(30*interpolationTime);
      else this.weightOut = 0;
    }
  }
}