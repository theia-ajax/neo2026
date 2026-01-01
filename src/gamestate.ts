import { type Mesh, type MeshRenderable } from '@/render/mesh'
import type { Terrain } from '@/terrain';
import type { Vec3 } from 'wgpu-matrix';
import type { GameTime } from '@/game';
import type { AutoOrbitCameraController, Camera, CameraController, CameraControllerType, TankCameraController } from '@/render/camera';
import type Input from '@/input';

export class GameState {
	public time: GameTime;
	public camera: Camera;
	public cameraController: CameraController;
	public input: Input;
	public skyboxRenderMesh: MeshRenderable;
	public skyboxTexture: GPUTexture;
	public terrain: Terrain;
	public terrainTexture: GPUTexture;
	public terrainNormalTexture: GPUTexture;
	public terrainRenderMesh: MeshRenderable;

	public cameraControllers: Map<CameraControllerType, CameraController> = new Map<CameraControllerType, CameraController>();

	public get orbitCameraController() { return this.cameraControllers['orbit']; }
	public set orbitCameraController(v: AutoOrbitCameraController) { this.cameraControllers['orbit'] = v; }
	public get tankCameraController() { return this.cameraControllers['tank']; }
	public set tankCameraController(v: TankCameraController) { this.cameraControllers['tank'] = v; }
}
