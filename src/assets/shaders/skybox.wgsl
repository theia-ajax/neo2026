struct Uniforms {
	modelViewProjectionMatrix: mat4x4f,
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var skyboxSampler: sampler;
@group(0) @binding(2) var skyboxTexture: texture_cube<f32>;

struct VertexOutput {
	@builtin(position) Position: vec4f,
	@location(0) skyboxPosition: vec4f,
}

@vertex
fn vertex_main(
	@location(0) position: vec4f,
) -> VertexOutput {
	var output: VertexOutput;
	output.Position = uniforms.modelViewProjectionMatrix * position;
	output.skyboxPosition = 0.5 * (position + vec4(1.0, 1.0, 1.0, 1.0));
	return output;
}

@fragment
fn fragment_main(
	@location(0) skyboxPosition: vec4f,
) -> @location(0) vec4f {
	var skyboxVec = skyboxPosition.xyz - vec3(0.5);
	skyboxVec.z *= -1;
	return textureSample(skyboxTexture, skyboxSampler, skyboxVec);
}