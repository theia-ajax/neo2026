import type { Mesh } from "@/render/mesh"
import { vec2, vec3, type Vec2, type Vec3 } from "wgpu-matrix";

const kVertexSizeFloats = 14;
const kVertexSizeBytes = kVertexSizeFloats * 4;

function sampleHeight(imageData: ImageData, x: number, z: number) {
	const r = imageData.data[(z * imageData.width + x) * 4 + 0];
	const g = imageData.data[(z * imageData.width + x) * 4 + 1];
	const b = imageData.data[(z * imageData.width + x) * 4 + 2];
	return (r + g + b) / 3 / 255;
}

function getVertexPos(mesh: Mesh, vertexId: number): Vec3 {
	const offset = vertexId * kVertexSizeFloats;
	return vec3.create(
		mesh.vertices[offset + 0],
		mesh.vertices[offset + 1],
		mesh.vertices[offset + 2]);
}

function getVertexNorm(mesh: Mesh, vertexId: number): Vec3 {
	const offset = vertexId * kVertexSizeFloats;
	return vec3.create(
		mesh.vertices[offset + 3],
		mesh.vertices[offset + 4],
		mesh.vertices[offset + 5]);
}

function getVertexUv(mesh: Mesh, vertexId: number): Vec2 {
	const offset = vertexId * kVertexSizeFloats;
	return vec2.create(
		mesh.vertices[offset + 6],
		mesh.vertices[offset + 7]);
}

function getVertexTangent(mesh: Mesh, vertexId: number): Vec3 {
	const offset = vertexId * kVertexSizeFloats;
	return vec3.create(
		mesh.vertices[offset + 8],
		mesh.vertices[offset + 9],
		mesh.vertices[offset + 10]);
}

function getVertexBitangent(mesh: Mesh, vertexId: number): Vec3 {
	const offset = vertexId * kVertexSizeFloats;
	return vec3.create(
		mesh.vertices[offset + 11],
		mesh.vertices[offset + 12],
		mesh.vertices[offset + 13]);
}

function setVertexNorm(mesh: Mesh, vertexId: number, norm: Vec3) {
	const offset = vertexId * kVertexSizeFloats;
	mesh.vertices[offset + 3] = norm.at(0);
	mesh.vertices[offset + 4] = norm.at(1);
	mesh.vertices[offset + 5] = norm.at(2);
}

function setVertexTangent(mesh: Mesh, vertexId: number, tangent: Vec3) {
	const offset = vertexId * kVertexSizeFloats;
	mesh.vertices[offset + 8] = tangent.at(0);
	mesh.vertices[offset + 9] = tangent.at(1);
	mesh.vertices[offset + 10] = tangent.at(2);
}

function setVertexBitangent(mesh: Mesh, vertexId: number, bitangent: Vec3) {
	const offset = vertexId * kVertexSizeFloats;
	mesh.vertices[offset + 11] = bitangent.at(0);
	mesh.vertices[offset + 12] = bitangent.at(1);
	mesh.vertices[offset + 13] = bitangent.at(2);
}

function setVertex(mesh: Mesh, vertexId: number, pos: Vec3, norm: Vec3, uv: Vec2) {
	const offset = vertexId * kVertexSizeFloats;
	mesh.vertices[offset + 0] = pos.at(0);
	mesh.vertices[offset + 1] = pos.at(1);
	mesh.vertices[offset + 2] = pos.at(2);
	mesh.vertices[offset + 3] = norm.at(0);
	mesh.vertices[offset + 4] = norm.at(1);
	mesh.vertices[offset + 5] = norm.at(2);
	mesh.vertices[offset + 6] = uv.at(0);
	mesh.vertices[offset + 7] = uv.at(1);
}

function setTriangle(mesh: Mesh, triangleId: number, i0: number, i1: number, i2: number) {
	const offset = triangleId * 3;
	mesh.indices[offset + 0] = i0;
	mesh.indices[offset + 1] = i1;
	mesh.indices[offset + 2] = i2;
}

function createTerrainMesh(vertexCount, indexCount, terrainWidth, terrainHeight, scale): Mesh {
	return {
		vertices: new Float32Array(vertexCount * kVertexSizeFloats),
		indices: new Uint32Array(indexCount),
		vertexStride: kVertexSizeBytes,
		meta: {
			terrainWidth: terrainWidth * scale[0] - scale[0],
			terrainHeight: terrainHeight * scale[2] - scale[2],
			nudgeX: 0,
			nudgeZ: 0,
		},
	};
}

export type TerrainShading = 'diffuse' | 'flat';

export interface CreateHeightmapTerrainOptions {
	shading?: TerrainShading,
	scale?: Vec3,
	textureScale?: Vec2,
	textureOffset?: Vec2,
}

export default function createTerrainMeshFromHeightmap(heightmapData: ImageData, options?: CreateHeightmapTerrainOptions, onProgress: (progress: number) => void = () => { }): Mesh {
	console.assert(heightmapData !== null && heightmapData !== undefined);

	const shading = options?.shading ?? 'diffuse';

	switch (shading) {
		case 'diffuse': return createDiffuseTerrainMesh(heightmapData, options, onProgress);
		case 'flat': return createFlatTerrainMesh(heightmapData, options, onProgress);
		default: console.assert(false);
	}
}

function createDiffuseTerrainMesh(heightmapData: ImageData, options?: CreateHeightmapTerrainOptions, onProgress: (progress: number) => void = () => { }): Mesh {
	const scale = options?.scale ?? vec3.create(1, 1, 1);

	const width = heightmapData.width;
	const height = heightmapData.height;
	const vertexCount = width * height;
	const indexCount = (width - 1) * (height - 1) * 6;

	let heightmapMesh: Mesh = createTerrainMesh(vertexCount, indexCount, width, height, scale);

	let vertexId = 0;
	let triangleId = 0;

	const pushVertex = (pos, norm, uvs) => {
		setVertex(heightmapMesh, vertexId, pos, norm, uvs);
		vertexId++;
	}

	const pushTriangle = (i0, i1, i2) => {
		setTriangle(heightmapMesh, triangleId, i0, i1, i2);
		triangleId++;
	}

	const getPos = (id) => { return getVertexPos(heightmapMesh, id); }
	const getTangent = (id) => { return getVertexTangent(heightmapMesh, id); }
	const setNorm = (id, norm) => { setVertexNorm(heightmapMesh, id, norm); }
	const setTangent = (id, tangent) => { setVertexTangent(heightmapMesh, id, tangent); }
	const setBitangent = (id, bitangent) => { setVertexBitangent(heightmapMesh, id, bitangent); }

	for (let z = 0; z < height; z++) {
		for (let x = 0; x < width; x++) {
			const y = sampleHeight(heightmapData, x, z);
			const vertexPos = vec3.mul(vec3.fromValues(x, y, z), scale);
			const vertexNorm = vec3.fromValues(0, 0, 0);
			const vertexUv = vec2.fromValues(x, z);
			pushVertex(vertexPos, vertexNorm, vertexUv);
		}
		onProgress(z / height / 2);
	}

	for (let z = 0; z < height - 1; z++) {
		for (let x = 0; x < width - 1; x++) {
			const i0 = x + z * width;
			const i1 = i0 + 1;
			const i2 = i0 + width;
			const i3 = i2 + 1;

			const tangent = vec3.normalize(vec3.sub(getPos(i0), getPos(i2)));
			setTangent(i0, tangent);

			pushTriangle(i0, i2, i1);
			pushTriangle(i1, i2, i3);
		}
	}

	const getId = (x, z) => {
		if (x < 0 || z < 0 || x >= width || z >= height) {
			return null;
		}
		return z * width + x;
	}

	for (let z = 0; z < height; z++) {
		for (let x = 0; x < width; x++) {
			const vertexId = getId(x, z);
			const leftId = (x > 0) ? getId(x - 1, z) : vertexId;
			const rightId = (x < width - 1) ? getId(x + 1, z) : vertexId;
			const upId = (z > 0) ? getId(x, z - 1) : vertexId;
			const downId = (z < height - 1) ? getId(x, z + 1) : vertexId;
			const left = getPos(leftId);
			const right = getPos(rightId);
			const up = getPos(upId);
			const down = getPos(downId);
			const a = vec3.sub(right, left);
			const b = vec3.sub(down, up);
			const normal = vec3.normalize(vec3.cross(b, a));
			setNorm(vertexId, normal);
			const bitangent = vec3.cross(normal, getTangent(vertexId));
			setBitangent(vertexId, bitangent);
		}
		onProgress(z / height / 2 + 0.5);
	}

	onProgress(1);

	return heightmapMesh;
}

function createFlatTerrainMesh(heightmapData: ImageData, options?: CreateHeightmapTerrainOptions, onProgress?: (progress: number) => void): Mesh {
	const scale = options?.scale ?? vec3.create(1, 1, 1);

	const width = heightmapData.width;
	const height = heightmapData.height;

	const vertexCount = (width - 1) * (height - 1) * 6;
	const indexCount = vertexCount;

	let heightmapMesh: Mesh = createTerrainMesh(vertexCount, indexCount, width, height);

	let vertexId = 0;
	let triangleId = 0;

	const pushVertex = (pos, norm, uvs) => {
		setVertex(heightmapMesh, vertexId, pos, norm, uvs);
		vertexId++;
	}

	const pushTriangle = (i0, i1, i2) => {
		setTriangle(heightmapMesh, triangleId, i0, i1, i2);
		triangleId++;
	}

	for (let z = 0; z < height - 1; z++) {
		for (let x = 0; x < width - 1; x++) {
			const positions = [
				vec3.fromValues(x, 0, z),
				vec3.fromValues(x + 1, 0, z),
				vec3.fromValues(x, 0, z + 1),
				vec3.fromValues(x + 1, 0, z + 1),
			]
			for (let i in positions) {
				const y = sampleHeight(heightmapData, positions[i].at(0), positions[i].at(2)) * scale.at(1);
				positions[i][1] = y;
			}
			const uvs = [
				vec2.fromValues(x, z),
				vec2.fromValues(x + 1, z),
				vec2.fromValues(x, z + 1),
				vec2.fromValues(x + 1, z + 1),
			]
			const a1 = vec3.sub(positions[2], positions[0]);
			const b1 = vec3.sub(positions[3], positions[0]);
			const norm1 = vec3.normalize(vec3.cross(a1, b1));

			pushVertex(positions[0], norm1, uvs[0]);
			pushVertex(positions[2], norm1, uvs[2]);
			pushVertex(positions[3], norm1, uvs[3]);
			pushTriangle(vertexId - 3, vertexId - 2, vertexId - 1);

			const a2 = vec3.sub(positions[0], positions[1]);
			const b2 = vec3.sub(positions[3], positions[1]);
			const norm2 = vec3.normalize(vec3.cross(a2, b2));

			pushVertex(positions[1], norm2, uvs[1]);
			pushVertex(positions[0], norm2, uvs[0]);
			pushVertex(positions[3], norm2, uvs[3]);
			pushTriangle(vertexId - 3, vertexId - 2, vertexId - 1);

		}

		onProgress(z / (height - 1));
	}

	onProgress(1);

	return heightmapMesh;
}
