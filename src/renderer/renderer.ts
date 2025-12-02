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
import { quitIfWebGPUNotAvailable } from '@/renderer/renderer_utils';

export async function initRenderer(canvas: HTMLCanvasElement) {
	const adapter = await navigator.gpu?.requestAdapter({
		featureLevel: 'compatibility',
	}) as GPUAdapter;
	const device = await adapter?.requestDevice() as GPUDevice;
	quitIfWebGPUNotAvailable(adapter, device);
	return new Renderer(canvas, adapter, device)
}

export class Renderer {
	private adapter: GPUAdapter;
	private device: GPUDevice;
	private context: GPUCanvasContext;
	private pipeline: GPURenderPipeline;
	private renderPassDescriptor: GPURenderPassDescriptor;
	private depthTexture: GPUTexture;
	private vertexBuffer: GPUBuffer;
	private uniformBuffer: GPUBuffer;
	private uniformBindGroup: GPUBindGroup;
	private modelViewProjection: Mat4;

	constructor(canvas: HTMLCanvasElement, adapter: GPUAdapter, device: GPUDevice) {
		this.adapter = adapter;
		this.device = device;
		this.context = canvas.getContext('webgpu') as GPUCanvasContext;
		this.modelViewProjection = mat4.create();

		const presentationFormat = navigator.gpu.getPreferredCanvasFormat();
		this.context.configure({
			device,
			format: presentationFormat
		});

		this.vertexBuffer = this.device.createBuffer({
			size: cubeVertexArray.byteLength,
			usage: GPUBufferUsage.VERTEX,
			mappedAtCreation: true
		});
		new Float32Array(this.vertexBuffer.getMappedRange()).set(cubeVertexArray);
		this.vertexBuffer.unmap();

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
						format: presentationFormat,
					},
				],
			},
			primitive: {
				topology: 'triangle-list',
				cullMode: 'back',
			},
			depthStencil: {
				depthWriteEnabled: true,
				depthCompare: 'less',
				format: 'depth24plus'
			}
		});

		this.depthTexture = this.device.createTexture({
			size: [canvas.width, canvas.height],
			format: 'depth24plus',
			usage: GPUTextureUsage.RENDER_ATTACHMENT,
		});

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

		this.renderPassDescriptor = {
			colorAttachments: [
				{
					view: undefined,
					clearValue: [0.1, 0.1, 0.1, 1.0],
					loadOp: 'clear',
					storeOp: 'store',
				},
			],
			depthStencilAttachment: {
				view: this.depthTexture.createView(),
				depthClearValue: 1.0,
				depthLoadOp: 'clear',
				depthStoreOp: 'store',
			},
		}
	}

	public draw(time: number) {
		const aspect = this.context.canvas.width / this.context.canvas.height;
		const projection = mat4.perspective((2 * Math.PI) / 5, aspect, 1, 100.0);
		const view = mat4.identity();
		mat4.translate(view, vec3.fromValues(0, 0, -4), view);

		const model = mat4.rotate(mat4.identity(), vec3.create(0, 1, 0), time);

		mat4.multiply(projection, mat4.multiply(view, model), this.modelViewProjection);

		this.device.queue.writeBuffer(
			this.uniformBuffer,
			0,
			this.modelViewProjection.buffer,
			this.modelViewProjection.byteOffset,
			this.modelViewProjection.byteLength);

		const commandEncoder = this.device.createCommandEncoder();
		const canvasView = this.context.getCurrentTexture().createView();

		this.renderPassDescriptor.colorAttachments[0].view = this.context.getCurrentTexture().createView();

		const passEncoder = commandEncoder.beginRenderPass(this.renderPassDescriptor);
		passEncoder.setPipeline(this.pipeline);
		passEncoder.setBindGroup(0, this.uniformBindGroup);
		passEncoder.setVertexBuffer(0, this.vertexBuffer);
		passEncoder.draw(cubeVertexCount);
		passEncoder.end();

		this.device.queue.submit([commandEncoder.finish()]);
	}

	public onCanvasResize(canvas: HTMLCanvasElement) {

	}
}