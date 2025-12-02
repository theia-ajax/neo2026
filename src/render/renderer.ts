import { mat4, vec3, type Mat4 } from 'wgpu-matrix';
import {
	cubeVertexArray,
	cubeVertexSize,
	cubeUVOffset,
	cubePositionOffset,
	cubeVertexCount,
} from '@meshes/cube';
import basicVertWGSL from '@shaders/basic.vert.wgsl?raw'
import vertexPositionColorWGSL from '@shaders/vertexPositionColor.frag.wgsl?raw'
import { 
	quitIfFeaturesNotAvailable,
	quitIfWebGPUNotAvailable,
	getDevicePixelContentBoxSize
} from '@/render/renderer_utils';
import type { GameState } from '@/gamestate.ts';
import * as debug from "@/debug/debug.ts"
import { SampleBuffer } from '@/util';

export async function initRenderer(canvas: HTMLCanvasElement) {
	const adapter = await navigator.gpu?.requestAdapter({
		featureLevel: 'compatibility',
	}) as GPUAdapter;
	quitIfFeaturesNotAvailable(adapter, ['timestamp-query']);
	const device = await adapter?.requestDevice({
		requiredFeatures: [
			'timestamp-query'
		]
	}) as GPUDevice;
	quitIfWebGPUNotAvailable(adapter, device);
	return new Renderer(canvas, adapter, device)
}

// webgpu only supports 1 or 4 and 1 fails with the following error on chrome/windows:
// Cannot set [TextureView of Texture "D3DImageBacking_D3DSharedImage_WebGPUSwapBufferProvider_Pid:11684"] as a resolve target when the color attachment [TextureView of Texture "Render Target Texture"] has a sample count of 1.
const MSAA_SAMPLE_COUNT: number = 4;

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

export class Renderer {
	private adapter: GPUAdapter;
	private device: GPUDevice;
	private context: GPUCanvasContext;
	private pipeline: GPURenderPipeline;
	private presentationFormat: GPUTextureFormat;
	private renderTargetTexture: GPUTexture | undefined = undefined;
	private depthTexture: GPUTexture;
	private vertexBuffer: GPUBuffer;
	private uniformBuffer: GPUBuffer;
	private uniformBindGroup: GPUBindGroup;
	private modelViewProjection: Mat4;
	private timing: RenderTiming;
	private resizeObserver: ResizeObserver;

	constructor(canvas: HTMLCanvasElement, adapter: GPUAdapter, device: GPUDevice) {
		this.adapter = adapter;
		this.device = device;
		this.context = canvas.getContext('webgpu') as GPUCanvasContext;
		this.modelViewProjection = mat4.create();

		this.presentationFormat = navigator.gpu.getPreferredCanvasFormat();
		this.context.configure({
			device,
			format: this.presentationFormat
		});

		this.vertexBuffer = this.device.createBuffer({
			size: cubeVertexArray.byteLength,
			usage: GPUBufferUsage.VERTEX,
			mappedAtCreation: true
		});
		new Float32Array(this.vertexBuffer.getMappedRange()).set(cubeVertexArray);
		this.vertexBuffer.unmap();

		this.timing = new RenderTiming(this.device);

		this.pipeline = this.device.createRenderPipeline({
			layout: 'auto',
			vertex: {
				module: this.device.createShaderModule({
					code: basicVertWGSL,
				}),
				buffers: [
					{
						arrayStride: cubeVertexSize,
						attributes: [
							{
								shaderLocation: 0,
								offset: cubePositionOffset,
								format: 'float32x4',
							},
							{
								shaderLocation: 1,
								offset: cubeUVOffset,
								format: 'float32x2',
							}
						]
					}
				]
			},
			fragment: {
				module: this.device.createShaderModule({
					code: vertexPositionColorWGSL,
				}),
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

		this.onCanvasResize(canvas);

		this.uniformBuffer = device.createBuffer({
			size: 4 * 16,
			usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
		});

		this.uniformBindGroup = this.device.createBindGroup({
			layout: this.pipeline.getBindGroupLayout(0),
			entries: [
				{
					binding: 0,
					resource: {
						buffer: this.uniformBuffer,
					},
				},
			],
		});

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
		const projection = mat4.perspective((2 * Math.PI) / 5, aspect, 1, 100.0);
		const view = mat4.identity();
		mat4.translate(view, vec3.fromValues(0, 0, -4), view);

		const model = mat4.rotate(mat4.identity(), vec3.create(0, 1, 0), gameState.state);

		mat4.multiply(projection, mat4.multiply(view, model), this.modelViewProjection);

		this.device.queue.writeBuffer(
			this.uniformBuffer,
			0,
			this.modelViewProjection.buffer,
			this.modelViewProjection.byteOffset,
			this.modelViewProjection.byteLength);

		const commandEncoder = this.device.createCommandEncoder();

		const renderTargetView = this.renderTargetTexture.createView();
		const depthView = this.depthTexture.createView();

		const renderPassDescriptor: GPURenderPassDescriptor = {
			colorAttachments: [
				{
					view: renderTargetView,
					resolveTarget: this.context.getCurrentTexture().createView(),
					clearValue: [0.1, 0.1, 0.1, 1.0],
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

		const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
		passEncoder.setPipeline(this.pipeline);
		passEncoder.setBindGroup(0, this.uniformBindGroup);
		passEncoder.setVertexBuffer(0, this.vertexBuffer);
		passEncoder.draw(cubeVertexCount);
		passEncoder.end();

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

