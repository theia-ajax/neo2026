import type { Mesh } from "@/render/mesh"
import { vec2, vec3 } from "wgpu-matrix";
import getImageData from "@/assets/imageData";

export default function createHeightmapMesh(heightmapImage: ImageBitmap): Mesh {
	const vertexCount = heightmapImage.width * heightmapImage.height;
	const indexCount = (heightmapImage.width - 1) * (heightmapImage.height - 1) * 6;

	let heightmapMesh: Mesh = {
		vertices: new Float32Array(vertexCount * 8),
		indices: new Uint32Array(indexCount),
		vertexStride: 8 * 4,
	};

	const height = 10.0;

	const imageData = getImageData(heightmapImage);

	let vertexId = 0;
	for (let z = 0; z < imageData.height; z++) {
		for (let x = 0; x < imageData.width; x++) {
			const r = imageData.data[(z * imageData.width + x) * 4 + 0];
			const g = imageData.data[(z * imageData.width + x) * 4 + 1];
			const b = imageData.data[(z * imageData.width + x) * 4 + 2];
			const y = (r + g + b) / 3 / 255;
			const vertexPos = vec3.fromValues(x - imageData.width / 2, y, z - imageData.height / 2);
			const vertexNorm = vec3.fromValues(0, 1, 0); // FIX
			const vertexUv = vec2.fromValues(x, z);

			heightmapMesh.vertices[vertexId * 8 + 0] = vertexPos.at(0);
			heightmapMesh.vertices[vertexId * 8 + 1] = vertexPos.at(1);
			heightmapMesh.vertices[vertexId * 8 + 2] = vertexPos.at(2);
			heightmapMesh.vertices[vertexId * 8 + 3] = vertexNorm.at(0);
			heightmapMesh.vertices[vertexId * 8 + 4] = vertexNorm.at(1);
			heightmapMesh.vertices[vertexId * 8 + 5] = vertexNorm.at(2);
			heightmapMesh.vertices[vertexId * 8 + 6] = vertexUv.at(0);
			heightmapMesh.vertices[vertexId * 8 + 7] = vertexUv.at(1);

			vertexId++;
		}
	}

	let triangleId = 0;
	for (let z = 0; z < imageData.height - 1; z++) {
		for (let x = 0; x < imageData.width - 1; x++) {
			let i0 = x + z * imageData.width;
			let i1 = i0 + 1;
			let i2 = i1 + imageData.width;

			let i3 = i0;
			let i4 = i2;
			let i5 = i0 + imageData.width;

			heightmapMesh.indices[triangleId * 3 + 0] = i0;
			heightmapMesh.indices[triangleId * 3 + 1] = i1;
			heightmapMesh.indices[triangleId * 3 + 2] = i2;
			triangleId++
			heightmapMesh.indices[triangleId * 3 + 0] = i3;
			heightmapMesh.indices[triangleId * 3 + 1] = i4;
			heightmapMesh.indices[triangleId * 3 + 2] = i5;
			triangleId++
		}
	}

	return heightmapMesh;
}