import { type Mesh, type MeshRenderable } from '@/render/mesh'
import type { Terrain } from '@/terrain';
import type { Vec3 } from 'wgpu-matrix';

interface Camera {
	position: Vec3;
	yaw: number;
}

export class GameState {
	public state: number = 0;
	public camera: Camera;
	public terrain: Terrain;
	public texture: GPUTexture;
	public renderMesh: MeshRenderable;
}
