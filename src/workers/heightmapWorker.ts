import createTerrainMeshFromHeightmap, { type CreateHeightmapTerrainOptions } from '@/assets/meshes/heightmapTerrain';
import type { Mesh } from '@/render/mesh';

export interface GenerateTerrainMeshMessage {
	image: ImageData,
	options?: CreateHeightmapTerrainOptions,
}

export interface TerrainMeshGenerationCompleteMessage {
	mesh: Mesh,
}

export interface TerrainMeshGenerationProgressMessage {
	progress: number;
}

self.onmessage = (e) => {
	const id = e.data.id;
	const image = e.data.image;
	const options = e.data.options;
	const mesh = createTerrainMeshFromHeightmap(
		image,
		options,
		(progress) => {
			postMessage({
				id: id,
				progress: progress
			});
		});

	postMessage({
		id: id,
		mesh: mesh,
		onComplete: e.data.onComplete,
	});
}
