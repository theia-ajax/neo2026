import { mat4, vec3, type Mat4 } from 'wgpu-matrix';
import terrainWGSL from '@shaders/terrain.wgsl?raw'
import skyboxWGSL from '@shaders/skybox.wgsl?raw'
import instancedTexturedLitWGSL from '@shaders/instancedTexturedLit.wgsl?raw'
import debugLinesWGSL from '@shaders/debugLines.wgsl?raw'
import { getDevicePixelContentBoxSize } from '@/render/rendererUtils';
import { GameState } from '@/gamestate';
import { SampleBuffer } from '@/util';
import { cubePositionNormalUv } from '@/assets/meshes/cube'
import { createMeshRenderable, type MeshRenderable } from './mesh';

// webgpu only supports 1 or 4 and 1 fails with the following error on chrome/windows:
// Cannot set [TextureView of Texture "D3DImageBacking_D3DSharedImage_WebGPUSwapBufferProvider_Pid:11684"] as a resolve target when the color attachment [TextureView of Texture "Render Target Texture"] has a sample count of 1.
const MSAA_SAMPLE_COUNT: number = 4;

export class Renderer {
	public device: GPUDevice;
	private context: GPUCanvasContext;
	private skyboxPipeline: GPURenderPipeline;
	private terrainPipeline: GPURenderPipeline;
	private presentationFormat: GPUTextureFormat;
	private renderTargetTexture: GPUTexture | undefined = undefined;
	private depthTexture: GPUTexture;
	private uniformBuffer: GPUBuffer;
	private skyboxUniformBuffer: GPUBuffer;
	private skyboxBindGroup: GPUBindGroup;
	private terrainBindGroup: GPUBindGroup;
	private modelViewProjection: Mat4;
	private modelView: Mat4;
	private timing: RenderTiming;
	private resizeObserver: ResizeObserver;
	private sampler: GPUSampler;
	private skyboxSampler: GPUSampler;
	private debugPipeline: GPURenderPipeline;
	private debugBindGroup: GPUBindGroup;
	private debugUniformBuffer: GPUBuffer;
	private debugLinesPositionsVertexBuffer: GPUBuffer;
	private debugLinesColorsVertexBuffer: GPUBuffer;
	private debugLinesIndexBuffer: GPUBuffer;
	private debugLinesVertexCount: number;
	private objectsPipeline: GPURenderPipeline;
	private objectsUniformsBuffer: GPUBuffer;
	private objectsInstanceBuffer: GPUBuffer;
	private objectsGlobalsBindGroup: GPUBindGroup;
	private cubeRenderMesh: MeshRenderable;

	setDebugLines(positions: Float32Array, colors: Float32Array) {
		this.debugLinesVertexCount = positions.length / 3;

		this.debugLinesPositionsVertexBuffer = this.device.createBuffer({
			size: positions.byteLength,
			usage: GPUBufferUsage.VERTEX,
			mappedAtCreation: true
		});
		new Float32Array(this.debugLinesPositionsVertexBuffer.getMappedRange()).set(positions);
		this.debugLinesPositionsVertexBuffer.unmap();

		this.debugLinesColorsVertexBuffer = this.device.createBuffer({
			size: colors.byteLength,
			usage: GPUBufferUsage.VERTEX,
			mappedAtCreation: true
		});
		new Float32Array(this.debugLinesColorsVertexBuffer.getMappedRange()).set(colors);
		this.debugLinesColorsVertexBuffer.unmap();

		const indices = new Uint32Array(this.debugLinesVertexCount);
		for (var i = 0; i < this.debugLinesVertexCount; i++) {
			indices[i] = i;
		}

		this.debugLinesIndexBuffer = this.device.createBuffer({
			usage: GPUBufferUsage.INDEX,
			size: indices.byteLength,
			mappedAtCreation: true,
		});
		new Uint32Array(this.debugLinesIndexBuffer.getMappedRange()).set(indices);
		this.debugLinesIndexBuffer.unmap();
	}

	constructor(canvas: HTMLCanvasElement, device: GPUDevice, gameState: GameState) {
		console.log("Creating Renderer");

		this.device = device;
		this.context = canvas.getContext('webgpu') as GPUCanvasContext;
		this.modelViewProjection = mat4.identity();
		this.modelView = mat4.identity();

		this.presentationFormat = navigator.gpu.getPreferredCanvasFormat();
		this.context.configure({
			device,
			format: this.presentationFormat
		});

		this.timing = new RenderTiming(this.device);

		const debugLinesShader = this.device.createShaderModule({ code: debugLinesWGSL });
		this.debugPipeline = this.device.createRenderPipeline({
			label: 'debugLines',
			layout: 'auto',
			vertex: {
				module: debugLinesShader,
				entryPoint: "vertex_main",
				buffers: [
					{
						arrayStride: 4 * 3,
						attributes: [
							{
								shaderLocation: 0,
								offset: 0,
								format: 'float32x3'
							}
						]
					},
					{
						arrayStride: 4 * 4,
						attributes: [
							{
								shaderLocation: 1,
								offset: 0,
								format: 'float32x4'
							}
						]
					}
				]
			},
			fragment: {
				module: debugLinesShader,
				entryPoint: "fragment_main",
				targets: [
					{
						format: this.presentationFormat
					}
				]
			},
			multisample: { count: MSAA_SAMPLE_COUNT },
			primitive: {
				topology: 'line-list',
			},
			depthStencil: {
				depthWriteEnabled: true,
				depthCompare: 'less',
				format: 'depth24plus'
			}
		});
		this.debugUniformBuffer = this.device.createBuffer({
			size: 4 * 4 * 4,
			usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
		});
		this.debugBindGroup = this.device.createBindGroup({
			label: 'debugLines',
			layout: this.debugPipeline.getBindGroupLayout(0),
			entries: [
				{
					binding: 0,
					resource: {
						buffer: this.debugUniformBuffer,
					}
				}
			]
		});

		const skyboxShader = this.device.createShaderModule({ code: skyboxWGSL });
		this.skyboxPipeline = this.device.createRenderPipeline({
			label: 'skybox',
			layout: this.device.createPipelineLayout({
				bindGroupLayouts: [
					this.device.createBindGroupLayout({
						entries: [
							{
								binding: 0,
								visibility: GPUShaderStage.VERTEX,
								buffer: { type: 'uniform' }
							},
							{
								binding: 1,
								visibility: GPUShaderStage.FRAGMENT,
								sampler: {
									type: "filtering"
								}
							},
							{
								binding: 2,
								visibility: GPUShaderStage.FRAGMENT,
								texture: {
									sampleType: "float",
									viewDimension: "cube",
									multisampled: false,
								}
							}
						]
					})
				]
			}),
			vertex: {
				module: skyboxShader,
				entryPoint: "vertex_main",
				buffers: [
					{
						arrayStride: 4 * 4,
						attributes: [
							{
								shaderLocation: 0,
								offset: 0,
								format: 'float32x4',
							},
						]
					}
				]
			},
			fragment: {
				module: skyboxShader,
				entryPoint: "fragment_main",
				targets: [
					{
						format: this.presentationFormat,
					}
				]
			},
			multisample: { count: MSAA_SAMPLE_COUNT },
			primitive: {
				topology: 'triangle-list',
				cullMode: 'front',
			},
			depthStencil: {
				depthWriteEnabled: false,
				depthCompare: 'less',
				format: 'depth24plus',
			}
		});

		const terrainShader = this.device.createShaderModule({
			code: terrainWGSL,
		});
		this.terrainPipeline = this.device.createRenderPipeline({
			label: 'terrain',
			layout: 'auto',
			vertex: {
				module: terrainShader,
				entryPoint: "vertex_main",
				buffers: [
					{
						arrayStride: 14 * 4,
						attributes: [
							{
								shaderLocation: 0,
								offset: 0,
								format: 'float32x3',
							},
							{
								shaderLocation: 1,
								offset: 3 * 4,
								format: 'float32x3',
							},
							{
								shaderLocation: 2,
								offset: 6 * 4,
								format: 'float32x2',
							},
							{
								shaderLocation: 3,
								offset: 8 * 4,
								format: 'float32x3',
							},
							{
								shaderLocation: 4,
								offset: 11 * 4,
								format: 'float32x3',
							},
						]
					}
				]
			},
			fragment: {
				module: terrainShader,
				entryPoint: "fragment_main",
				targets: [
					{
						format: this.presentationFormat,
					},
				],
			},
			multisample: {
				count: MSAA_SAMPLE_COUNT,
			},
			primitive: {
				topology: 'triangle-list',
				cullMode: 'back',
			},
			depthStencil: {
				depthWriteEnabled: true,
				depthCompare: 'less',
				format: 'depth24plus',
			}
		});

		const instancedTexturedLitShader = this.device.createShaderModule({
			label: 'instancedTexturedLit',
			code: instancedTexturedLitWGSL,
		});
		this.objectsPipeline = this.device.createRenderPipeline({
			label: 'objects',
			layout: 'auto',
			vertex: {
				module: instancedTexturedLitShader,
				entryPoint: "vertex_main",
				buffers: [
					{
						arrayStride: 8 * 4,
						attributes: [
							{
								shaderLocation: 0,
								offset: 0,
								format: 'float32x3',
							},
							{
								shaderLocation: 1,
								offset: 12,
								format: 'float32x3',
							},
							{
								shaderLocation: 2,
								offset: 24,
								format: 'float32x2',
							},
						]
					},
					{
						arrayStride: 16 * 4,
						stepMode: 'instance',
						attributes: [
							{
								shaderLocation: 3,
								offset: 0,
								format: 'float32x4',
							},
							{
								shaderLocation: 4,
								offset: 4 * 4,
								format: 'float32x4',
							},
							{
								shaderLocation: 5,
								offset: 8 * 4,
								format: 'float32x4',
							},
							{
								shaderLocation: 6,
								offset: 12 * 4,
								format: 'float32x4',
							},
						]
					}
				]
			},
			fragment: {
				module: instancedTexturedLitShader,
				entryPoint: "fragment_main",
				targets: [
					{
						format: this.presentationFormat,
					}
				]
			},
			multisample: {
				count: MSAA_SAMPLE_COUNT,
			},
			primitive: {
				topology: 'triangle-list',
				cullMode: 'none',
			},
			depthStencil: {
				depthWriteEnabled: true,
				depthCompare: 'less',
				format: 'depth24plus',
			}
		});
		this.cubeRenderMesh = createMeshRenderable(this.device, cubePositionNormalUv);

		this.onCanvasResize(canvas);

		this.sampler = device.createSampler({
			minFilter: 'linear',
			magFilter: 'linear',
			addressModeU: 'repeat',
			addressModeV: 'repeat',
		});

		this.skyboxSampler = device.createSampler({
			minFilter: 'linear',
			magFilter: 'linear',
		});

		this.uniformBuffer = device.createBuffer({
			size: 4 * 4 * 4 * 3 + 16,
			usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
		});

		this.skyboxUniformBuffer = device.createBuffer({
			size: 4 * 4 * 4,
			usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
		});

		this.skyboxBindGroup = this.device.createBindGroup({
			label: 'skybox',
			layout: this.skyboxPipeline.getBindGroupLayout(0),
			entries: [
				{
					binding: 0,
					resource: {
						buffer: this.skyboxUniformBuffer,
					},
				},
				{
					binding: 1,
					resource: this.skyboxSampler,
				},
				{
					binding: 2,
					resource: gameState.skyboxTexture.createView({ dimension: 'cube' }),
				}
			]
		});

		this.terrainBindGroup = this.device.createBindGroup({
			label: 'terrain',
			layout: this.terrainPipeline.getBindGroupLayout(0),
			entries: [
				{
					binding: 0,
					resource: {
						buffer: this.uniformBuffer,
					},
				},
				{
					binding: 1,
					resource: this.sampler,
				},
				{
					binding: 2,
					resource: gameState.terrainTexture.createView(),
				},
				{
					binding: 3,
					resource: gameState.terrainNormalTexture.createView(),
				}
			],
		});

		this.objectsUniformsBuffer = this.device.createBuffer({
			size: 144,
			usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
		});

		const MAX_OBJECTS = 32;

		this.objectsInstanceBuffer = this.device.createBuffer({
			size: 16 * 4 * MAX_OBJECTS,
			usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
		});

		this.objectsGlobalsBindGroup = this.device.createBindGroup({
			label: 'objectsGlobals',
			layout: this.objectsPipeline.getBindGroupLayout(0),
			entries: [
				{
					binding: 0,
					resource: {
						buffer: this.objectsUniformsBuffer,
					}
				}
			]
		})

		const { maxTextureDimension2D } = device.limits;
		this.resizeObserver = new ResizeObserver(([entry]) => {
			const { width, height } = getDevicePixelContentBoxSize(entry);
			canvas.width = Math.max(1, Math.min(width, maxTextureDimension2D));
			canvas.height = Math.max(1, Math.min(height, maxTextureDimension2D));
			this.onCanvasResize(canvas);
		});
		this.resizeObserver.observe(canvas);
	}

	public draw(gameState: GameState) {
		const aspect = this.context.canvas.width / this.context.canvas.height;
		const projection = mat4.perspective(70 * Math.PI / 180.0, aspect, 0.01, 1000.0);
		const view = gameState.camera.view;

		const viewProjection = mat4.multiply(projection, view);
		const skyboxViewProjection = mat4.multiply(projection, gameState.camera.viewNoTranslation());


		this.device.queue.writeBuffer(
			this.skyboxUniformBuffer,
			0,
			skyboxViewProjection.buffer,
			skyboxViewProjection.byteOffset,
			skyboxViewProjection.byteLength
		);

		this.device.queue.writeBuffer(
			this.debugUniformBuffer,
			0,
			viewProjection.buffer,
			viewProjection.byteOffset,
			viewProjection.byteLength
		);



		const model = gameState.terrain.getModelMatrix(gameState);

		mat4.multiply(view, model, this.modelView);
		mat4.multiply(projection, this.modelView, this.modelViewProjection);

		const timeArray = new Float32Array(4);
		timeArray[0] = gameState.time.elapsedSec;
		timeArray[1] = gameState.time.elapsedSec;
		timeArray[2] = gameState.time.elapsedSec;
		timeArray[3] = gameState.time.elapsedSec;
		this.device.queue.writeBuffer(this.uniformBuffer, 48 * 4, timeArray.buffer, timeArray.byteOffset, timeArray.byteLength);

		this.device.queue.writeBuffer(
			this.uniformBuffer,
			0,
			model.buffer,
			model.byteOffset,
			model.byteLength);
		this.device.queue.writeBuffer(
			this.uniformBuffer,
			16 * 4,
			view.buffer,
			view.byteOffset,
			view.byteLength);
		this.device.queue.writeBuffer(
			this.uniformBuffer,
			32 * 4,
			projection.buffer,
			projection.byteOffset,
			projection.byteLength);

		{
			this.device.queue.writeBuffer(
				this.objectsUniformsBuffer,
				0,
				view.buffer,
				view.byteOffset,
				view.byteLength);
			this.device.queue.writeBuffer(
				this.objectsUniformsBuffer,
				16 * 4,
				projection.buffer,
				projection.byteOffset,
				projection.byteLength);
			this.device.queue.writeBuffer(
				this.objectsUniformsBuffer,
				32 * 4,
				timeArray.buffer,
				timeArray.byteOffset,
				timeArray.byteLength);
		}

		const commandEncoder = this.device.createCommandEncoder();

		const renderTargetView = this.renderTargetTexture.createView();
		const depthView = this.depthTexture.createView();

		const renderPassDescriptor: GPURenderPassDescriptor = {
			colorAttachments: [
				{
					view: renderTargetView,
					resolveTarget: this.context.getCurrentTexture().createView(),
					clearValue: [1.0, 0.0, 1.0, 1.0],
					loadOp: 'clear',
					storeOp: 'store',
				},
			],
			depthStencilAttachment: {
				view: depthView,
				depthClearValue: 1.0,
				depthLoadOp: 'clear',
				depthStoreOp: 'store',
			},
			timestampWrites: {
				querySet: this.timing.querySet,
				beginningOfPassWriteIndex: 0,
				endOfPassWriteIndex: 1,
			},
		};

		const renderPass = commandEncoder.beginRenderPass(renderPassDescriptor);
		{
			renderPass.setPipeline(this.skyboxPipeline);
			renderPass.setBindGroup(0, this.skyboxBindGroup);
			renderPass.setVertexBuffer(0, gameState.skyboxRenderMesh.vertexBuffer);
			renderPass.draw(gameState.skyboxRenderMesh.vertexCount);
		}

		if (this.debugLinesVertexCount !== undefined) {
			renderPass.setPipeline(this.debugPipeline);
			renderPass.setBindGroup(0, this.debugBindGroup);
			renderPass.setVertexBuffer(0, this.debugLinesPositionsVertexBuffer);
			renderPass.setVertexBuffer(1, this.debugLinesColorsVertexBuffer);
			renderPass.setIndexBuffer(this.debugLinesIndexBuffer, "uint32");
			renderPass.drawIndexed(this.debugLinesVertexCount);
			// renderPass.draw(this.debugLinesVertexCount);
		}

		{
			renderPass.setPipeline(this.objectsPipeline);
			renderPass.setBindGroup(0, this.objectsGlobalsBindGroup);
			renderPass.setVertexBuffer(0, this.cubeRenderMesh.vertexBuffer);
			renderPass.setVertexBuffer(1, this.objectsInstanceBuffer);
			renderPass.setIndexBuffer(this.cubeRenderMesh.indexBuffer, 'uint16');
			renderPass.drawIndexed(this.cubeRenderMesh.indexCount, 1);
		}

		if (gameState.terrain.renderMesh) {
			renderPass.setPipeline(this.terrainPipeline);
			renderPass.setBindGroup(0, this.terrainBindGroup);
			renderPass.setVertexBuffer(0, gameState.terrain.renderMesh.vertexBuffer);
			renderPass.setIndexBuffer(gameState.terrain.renderMesh.indexBuffer, "uint32");
			renderPass.drawIndexed(gameState.terrain.renderMesh.indexCount);
		}

		renderPass.end();

		this.timing.start(commandEncoder);
		const commandBuffer = commandEncoder.finish();
		this.device.queue.submit([commandBuffer]);
		this.timing.finish();
	}

	public onCanvasResize(canvas: HTMLCanvasElement) {
		this.renderTargetTexture?.destroy();
		this.depthTexture?.destroy();

		this.renderTargetTexture = this.device.createTexture({
			label: "Render Target Texture",
			sampleCount: MSAA_SAMPLE_COUNT,
			size: [canvas.width, canvas.height],
			format: this.presentationFormat,
			usage: GPUTextureUsage.RENDER_ATTACHMENT,
		});

		this.depthTexture = this.device.createTexture({
			size: [canvas.width, canvas.height],
			sampleCount: MSAA_SAMPLE_COUNT,
			format: 'depth24plus',
			usage: GPUTextureUsage.RENDER_ATTACHMENT,
		});
	}

	public get gpuSample() { return this.timing.gpuSample; }
}

class RenderTiming {
	querySet: GPUQuerySet;
	resolveBuffer: GPUBuffer;
	resultBuffer: GPUBuffer;
	gpuSample: SampleBuffer;

	constructor(device: GPUDevice) {
		this.gpuSample = new SampleBuffer(60);

		this.querySet = device.createQuerySet({
			type: 'timestamp',
			count: 2,
		});

		this.resolveBuffer = device.createBuffer({
			size: this.querySet.count * 8, // uint64 per querySet
			usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC,
		});
		this.resultBuffer = device.createBuffer({
			size: this.resolveBuffer.size,
			usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
		});
	}

	public start(commandEncoder: GPUCommandEncoder) {
		commandEncoder.resolveQuerySet(this.querySet, 0, this.querySet.count, this.resolveBuffer, 0);
		if (this.resultBuffer.mapState === 'unmapped') {
			commandEncoder.copyBufferToBuffer(this.resolveBuffer, 0, this.resultBuffer, 0, this.resultBuffer.size);
		}
	}

	public finish() {
		if (this.resultBuffer.mapState === 'unmapped') {
			this.resultBuffer.mapAsync(GPUMapMode.READ).then(() => {
				const times = new BigUint64Array(this.resultBuffer.getMappedRange());
				this.gpuSample.record(Number(times[1] - times[0]));
				this.resultBuffer.unmap();
			});
		}
	}
}
