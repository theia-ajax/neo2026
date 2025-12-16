import { mat4, vec3, type Mat4, type Vec3 } from 'wgpu-matrix';
import { createMeshRenderable, type Mesh, type MeshRenderable } from "@/render/mesh";
import createHeightmapMesh from '@/assets/meshes/heightmap';
import type { GameState } from './gamestate';

export class Terrain {
	mesh: Mesh;
	renderMesh: MeshRenderable;
	position: Vec3;
	scale: Vec3;
	width: number;
	depth: number;

	initFromHeightmap(device: GPUDevice, image: ImageBitmap) {
		this.mesh = createHeightmapMesh(image);
		this.renderMesh = createMeshRenderable(device, this.mesh);

		this.width = image.width;
		this.depth = image.height;

		this.position = vec3.create(-this.width / 2, 0, -this.depth / 2);
		this.scale = vec3.create(1, 50, 1);
	}

	sampleHeight(x: number, z: number): number {
		// todo translate and scale sample position

		if (x < 0 || z < 0 || x > this.width || z > this.depth) {
			return 0;
		}

		let tileX = Math.floor(x / this.width);
		let tileY = Math.floor(z / this.depth);

		let tlVertId = tileX + tileY * this.width;
		let trVertId = tlVertId + 1;
		let blVertId = tlVertId + this.width;
		let brVertId = blVertId + 1;




		return 0;
	}

	getModelMatrix(gameState: GameState): Mat4 {

		let model = mat4.translate(mat4.rotate(mat4.scale(mat4.translate(mat4.identity(), vec3.create(0, -25, 0)), this.scale), vec3.create(0, 1, 0), gameState.state * 0.1), this.position);
		return model;
	}
}
