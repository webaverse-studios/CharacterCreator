import * as THREE from "three"

class ScreenshotCamera{
    constructor(fov, width, height, scene){
        this.container = document.createElement("div");
        //this.sceneRTT = new THREE.Scene()
        this.sceneRTT = scene
        this.cameraRTT = new THREE.PerspectiveCamera(fov,width/height)
        this.lookAt = new THREE.Vector3(0,0,0)

        this.sceneRTT.add(this.cameraRTT)
        

        this.rtTexture = new THREE.WebGLRenderTarget(width, height);
        this.rtTexture.texture.encoding = THREE.sRGBEncoding;

        // const material = new THREE.MeshBasicMaterial({
        //     side: THREE.DoubleSide,
        //     transparent: true,
        //     opacity: 1,
        //     color: new THREE.Color(1, 1, 1),
        // });
        // const plane = new THREE.PlaneGeometry(width, height);
        // const quad = new THREE.Mesh(plane, material);
        // this.sceneRTT.add(quad);

        const renderer = new THREE.WebGLRenderer();
        renderer.setPixelRatio(1);
        renderer.setSize(width, height);
        renderer.setClearColor(new THREE.Color(1, 1, 1), 1);
        renderer.autoClear = false;

        this.renderer = renderer

        this.container.appendChild(renderer.domElement);
    }

    setLookAt(x,y,z){
        this.lookAt.set(x,y,z)
    }
    setPosition(x,y,z){
        this.cameraRTT.position.set(x,y,z)
    }

    screenshotBlob(){
        //return blob
    }
    screenshotDownload(){
        //downloadScreenshot
    }
    _screenshot(){
        //just take the screenshot
    }

}