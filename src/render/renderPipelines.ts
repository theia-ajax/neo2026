import defaultShaderWGSL from '@shaders/default.wgsl?raw'

const MSAA_SAMPLE_COUNT = 4;

export function getDefaultRenderPipelineDescriptor(device: GPUDevice, format: GPUTextureFormat): GPURenderPipelineDescriptor {
	return {
		layout: device.createPipelineLayout({
			bindGroupLayouts: [
				device.createBindGroupLayout({
					entries: [
						{
							binding: 0,
							visibility: GPUShaderStage.VERTEX,
							buffer: { type: "uniform" },
						},
						{
							binding: 1,
							visibility: GPUShaderStage.VERTEX,
							buffer: { type: "uniform" },
						},
					]
				}),
				device.createBindGroupLayout({
					entries: [
						{
							binding: 0,
							visibility: GPUShaderStage.VERTEX,
							buffer: { type: "uniform" },
						},
					]
				}),
				device.createBindGroupLayout({
					entries: [
						{
							binding: 0,
							visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
							buffer: { type: "uniform" },
						},
					]
				}),
				device.createBindGroupLayout({
					entries: [
						{
							binding: 0,
							visibility: GPUShaderStage.FRAGMENT,
							sampler: {
								type: "filtering",
							},
						},
						{
							binding: 1,
							visibility: GPUShaderStage.FRAGMENT,
							texture: {
								sampleType: "float",
								viewDimension: "2d",
								multisampled: false,
							}
						},
					]
				}),
			],
		}),
		vertex: {
			module: device.createShaderModule({
				code: defaultShaderWGSL,
			}),
			entryPoint: "vertex_main",
			buffers: [
				{
					arrayStride: 32,
					stepMode: "vertex",
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
						}
					]
				}
			],
		},
		fragment: {
			module: device.createShaderModule({
				code: defaultShaderWGSL,
			}),
			entryPoint: "fragment_main",
			targets: [
				{
					format: format,
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
	}
}
