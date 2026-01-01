import { mat4, vec3, type Mat4, type Vec3 } from 'wgpu-matrix';
import { createMeshRenderable, type Mesh, type MeshRenderable } from "@/render/mesh";
import type { GameState } from './gamestate';

export class Terrain {
	mesh: Mesh;
	renderMesh: MeshRenderable;
	position: Vec3;
	rotation: number;
	scale: Vec3;
	width: number;
	length: number;

	constructor() {
		this.position = vec3.create(0, 0, 0);
		this.rotation = 0;
		this.scale = vec3.create(1, 1, 1);
	}

	initFromHeightmapMesh(device: GPUDevice, mesh: Mesh) {
		this.mesh = mesh;
		this.renderMesh = createMeshRenderable(device, this.mesh);

		this.width = mesh.meta?.terrainWidth;
		this.length = mesh.meta?.terrainHeight;

		this.position = vec3.create(-this.width / 2 + mesh.meta?.nudgeX, 0, -this.length / 2 + mesh.meta?.nudgeZ);
	}

	sampleHeight(x: number, z: number): number {
		// todo translate and scale sample position


		if (x < 0 || z < 0 || x > this.width || z > this.length) {
			return 0;
		}

		let tileX = Math.floor(x / this.width);
		let tileY = Math.floor(z / this.length);

		let tlVertId = tileX + tileY * this.width;
		let trVertId = tlVertId + 1;
		let blVertId = tlVertId + this.width;
		let brVertId = blVertId + 1;


		return 0;
	}

	getModelMatrix(): Mat4 {
		let model =
			mat4.translate(mat4.
				rotate(
					mat4.scale(
						mat4.identity(),
						this.scale),
					vec3.create(0, 1, 0),
					this.rotation),
				this.position);

		return model;
	}
}
