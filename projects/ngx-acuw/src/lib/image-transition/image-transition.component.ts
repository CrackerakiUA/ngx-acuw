import { AfterViewInit, Component, ElementRef, HostListener, Input, ViewChild } from '@angular/core';
import * as THREE from 'three';
import { TextureLoader } from 'three';
import { RxjsTween } from '../tween/rxjs-tween';
import { ImageTransitionShaders } from './shaders/imageTransitionShaders';

@Component({
  selector: 'lib-image-transition',
  templateUrl: './image-transition.component.html',
  styleUrls: ['./image-transition.component.css']
})
export class ImageTransitionComponent implements AfterViewInit {

  @Input() imageUrls: string[] = new Array<string>();

  @Input()
  get imageSize(): string { return this._imageSize; };
  set imageSize(imageSize: string) {
    this._imageSize = imageSize;
    if (this.mesh != null) {
      this.resize();
    }
  }

  @Input() toggleTransitionDirection: boolean = true;

  @Input() transitionDuration: number = 1000;

  @Input()
  get transitionType(): string { return this._transitionType; };
  set transitionType(transitionType: string) {
    this._transitionType = transitionType;
    if (this.material != null) {
      this.setShaderProperties();
    }
  }

  @Input()
  get scaleX(): number { return this._scaleX; };
  set scaleX(scaleX: number) {
    this._scaleX = scaleX;
    if (this.material != null) {
      this.setShaderProperties();
    }
  }

  @Input()
  get scaleY(): number { return this._scaleY; };
  set scaleY(scaleY: number) {
    this._scaleY = scaleY;
    if (this.material != null) {
      this.setShaderProperties();
    }
  }

  @Input()
  get width(): number { return this._width; };
  set width(width: number) {
    this._width = width;
    if (this.material != null) {
      this.setShaderProperties();
    }
  }

  @Input()
  get intensity(): number { return this.intensity; };
  set intensity(intensity: number) {
    this._intensity = intensity;
    if (this.material != null) {
      this.setShaderProperties();
    }
  }

  private _imageSize: string = 'cover';
  private _transitionType: string = 'split';
  private _intensity: number = 40.0;
  private _scaleX: number = 50.0;
  private _scaleY: number = 50.0;
  private _width: number = 0.5

  private renderer: THREE.WebGLRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  private scene: THREE.Scene = new THREE.Scene();
  private camera!: THREE.PerspectiveCamera;
  private mesh!: THREE.Mesh;
  private material!: THREE.ShaderMaterial;
  private textures: THREE.Texture[] = new Array<THREE.Texture>();
  private currentImage: number = 0;
  private tranistionOngoing: boolean = false;
  private shaders: ImageTransitionShaders = new ImageTransitionShaders();

  @ViewChild('threejsContainer') threejsContainer!: ElementRef;

  constructor() { }

  ngAfterViewInit() {
    // Init camera
    this.camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.001, 1000);
    this.camera.position.set(0, 0, 2);

    // Create scene
    this.scene = new THREE.Scene();

    // Init Mesh
    if (this.imageUrls.length < 2) {
      throw new Error('At least two images are required');
    }
    this.initMesh();

    // Init renderer
    const canvasWidth = this.threejsContainer.nativeElement.clientWidth;
    const canvasHeight = this.threejsContainer.nativeElement.clientHeight;
    this.renderer.setSize(canvasWidth, canvasHeight);

    this.threejsContainer.nativeElement.appendChild(this.renderer.domElement);

    this.animate();
  }

  private initMesh() {
    // Create geometry
    const geometry = new THREE.PlaneBufferGeometry(1, 1, 2, 2);

    // Load texture of the first image
    var promises: Promise<any>[] = new Array<Promise<any>>();
    var promise1 = new Promise(resolve => {
      var loader = new TextureLoader();
      this.textures.push(loader.load(this.imageUrls[0], resolve));
    });
    promises.push(promise1);
    // Load texture of the second image
    var promise2 = new Promise(resolve => {
      var loader = new TextureLoader();
      this.textures.push(loader.load(this.imageUrls[1], resolve));
    });
    promises.push(promise2);

    Promise.all(promises).then(() => {

      this.material = new THREE.ShaderMaterial({
        side: THREE.DoubleSide,
        uniforms: {
          time: { value: 0 },
          progress: { value: 0 },
          border: { value: 0 },
          intensity: { value: 50.0 },
          scaleX: { value: 40.0 },
          scaleY: { value: 40.0 },
          transition: { value: 40.0 },
          swipe: { value: 0 },
          width: { value: 0.5 },
          radius: { value: 0 },
          texture1: { value: this.textures[0] },
          texture2: { value: this.textures[1] },
          resolution1: { value: new THREE.Vector4() },
          resolution2: { value: new THREE.Vector4() }
        },
        //wireframe: true,
        vertexShader: this.shaders.vertex
      });

      this.setShaderProperties();
      this.mesh = new THREE.Mesh(geometry, this.material);

      this.scene.add(this.mesh);

      this.resize();
    });
  }

  private setShaderProperties() {
    switch (this.transitionType) {
      case 'split':
        this.material.uniforms.intensity.value = this._intensity;
        this.material.fragmentShader = this.shaders.splitTransitionFrag;
        break;
      case 'fade':
        this.material.fragmentShader = this.shaders.fadeFrag;
        break;
      case 'noise':
        this.material.uniforms.scaleX.value = this._scaleX;
        this.material.uniforms.scaleY.value = this._scaleY;
        this.material.uniforms.width.value = this._width;
        this.material.fragmentShader = this.shaders.noiseFrag;
        break;
      default:
        break;
    }

    this.material.needsUpdate = true;
  }

  animate(): void {
    this.renderer.render(this.scene, this.camera);
    window.requestAnimationFrame(() => this.animate());
  }

  @HostListener('window:resize') resize(): void {
    const containerWidth = this.threejsContainer.nativeElement.offsetWidth;
    const containerHeight = this.threejsContainer.nativeElement.offsetHeight;
    this.renderer.setSize(containerWidth, containerHeight);
    this.camera.aspect = containerWidth / containerHeight;

    this.updateTextureResolution(0);
    this.updateTextureResolution(1);

    const dist = this.camera.position.z;
    const height = 1;
    this.camera.fov = 2 * (180 / Math.PI) * Math.atan(height / (2 * dist));

    this.mesh.scale.x = this.camera.aspect;
    this.mesh.scale.y = 1;

    this.camera.updateProjectionMatrix();
  }

  updateTextureResolution(textureNumber: number) {
    const texture = textureNumber == 0 ? this.textures[0] : this.textures[1];
    const containerWidth = this.threejsContainer.nativeElement.offsetWidth;
    const containerHeight = this.threejsContainer.nativeElement.offsetHeight;

    // Adapt the size of the image
    const imageAspect = texture.image.height / texture.image.width;
    const containerAspect = containerHeight / containerWidth;
    let a1; let a2;
    if (this.imageSize === 'cover') {
      if (containerAspect > imageAspect) {
        a1 = (containerWidth / containerHeight) * imageAspect;
        a2 = 1;
      } else {
        a1 = 1;
        a2 = (containerHeight / containerWidth) / imageAspect;
      }
    } else if (this.imageSize === 'contain') {
      if (containerAspect < imageAspect) {
        a1 = (containerWidth / containerHeight) * imageAspect;
        a2 = 1;
      } else {
        a1 = 1;
        a2 = (containerHeight / containerWidth) / imageAspect;
      }
    }

    if (textureNumber == 0) {
      this.material.uniforms.resolution1.value.x = containerWidth;
      this.material.uniforms.resolution1.value.y = containerHeight;
      this.material.uniforms.resolution1.value.z = a1;
      this.material.uniforms.resolution1.value.w = a2;
    } else {
      this.material.uniforms.resolution2.value.x = containerWidth;
      this.material.uniforms.resolution2.value.y = containerHeight;
      this.material.uniforms.resolution2.value.z = a1;
      this.material.uniforms.resolution2.value.w = a2;
    }
  }

  next(): void {
    if (this.tranistionOngoing) {
      return;
    }

    this.tranistionOngoing = true;
    // Decide if progress should go from "0 to 1" or "1 to 0"
    const res = this.currentImage % 2;
    // Update the number of the current shown image
    if (this.currentImage < this.imageUrls.length - 1) {
      this.currentImage = this.currentImage + 1;
    } else {
      this.currentImage = 0;
    }
    // Define the next image
    var nextImage: number = 0;
    if (this.currentImage < this.imageUrls.length - 1) {
      nextImage = this.currentImage + 1;
    }
    if(this.toggleTransitionDirection == true){
      if (res == 0) {
        RxjsTween.createTween(RxjsTween.linear, 0, 1, this.transitionDuration).subscribe(val => {
          this.material.uniforms.progress.value = val;
        }, null, () => {
          this.tranistionOngoing = false;
          new Promise(resolve => {
            var loader = new TextureLoader();
            this.textures[0] = loader.load(this.imageUrls[nextImage], resolve);
          }).then(() => {
            this.material.uniforms.texture1.value = this.textures[0];
            this.updateTextureResolution(0);
          });
        });
      } else {
        RxjsTween.createTween(RxjsTween.linear, 1, 0, this.transitionDuration).subscribe(val => {
          this.material.uniforms.progress.value = val;
        }, null, () => {
          this.tranistionOngoing = false;
          new Promise(resolve => {
            var loader = new TextureLoader();
            this.textures[1] = loader.load(this.imageUrls[nextImage], resolve);
          }).then(() => {
            this.material.uniforms.texture2.value = this.textures[1];
            this.updateTextureResolution(1);
          });
        });
      }
    }else{
      RxjsTween.createTween(RxjsTween.linear, 0, 1, this.transitionDuration).subscribe(val => {
        this.material.uniforms.progress.value = val;
      }, null, () => {
        this.tranistionOngoing = false;
        this.textures[0] = this.textures[1];
        this.material.uniforms.texture1.value = this.textures[0];
        this.updateTextureResolution(0);
        this.material.uniforms.progress.value = 0;
        new Promise(resolve => {
          var loader = new TextureLoader();
          this.textures[1] = loader.load(this.imageUrls[nextImage], resolve);
        }).then(() => {
          this.material.uniforms.texture2.value = this.textures[1];
          this.updateTextureResolution(1);
        });
      });
    }
  }
}