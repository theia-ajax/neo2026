import { vec3, vec2 } from 'wgpu-matrix'

export interface RenderableOptions {
	storeVertices?: boolean;
	storeIndices?: boolean;
}

export interface Mesh {
	vertices: Float32Array;
	indices: Uint16Array | Uint32Array;
	vertexStride: number;
}

export interface MeshRenderable {
	vertexBuffer: GPUBuffer;
	indexBuffer: GPUBuffer;
	indexCount: number;
}

export function createMeshRenderable(device: GPUDevice, mesh: Mesh, options?: RenderableOptions): MeshRenderable {
	const vertexBufferUsage = options?.storeVertices
		? GPUBufferUsage.VERTEX | GPUBufferUsage.STORAGE
		: GPUBufferUsage.VERTEX;
	const indexBufferUsage = options?.storeIndices
		? GPUBufferUsage.INDEX | GPUBufferUsage.STORAGE
		: GPUBufferUsage.INDEX;

	const vertexBuffer = device.createBuffer({
		size: mesh.vertices.byteLength,
		usage: vertexBufferUsage,
		mappedAtCreation: true,
	});
	new Float32Array(vertexBuffer.getMappedRange()).set(mesh.vertices);
	vertexBuffer.unmap();

	const indexBuffer = device.createBuffer({
		size: mesh.indices.byteLength,
		usage: indexBufferUsage,
		mappedAtCreation: true,
	});
	if (mesh.indices.byteLength === mesh.indices.length * Uint16Array.BYTES_PER_ELEMENT) {
		new Uint16Array(indexBuffer.getMappedRange()).set(mesh.indices);
	}
	else {
		new Uint32Array(indexBuffer.getMappedRange()).set(mesh.indices);
	}
	indexBuffer.unmap();

	return {
		vertexBuffer,
		indexBuffer,
		indexCount: mesh.indices.length,
	};
}