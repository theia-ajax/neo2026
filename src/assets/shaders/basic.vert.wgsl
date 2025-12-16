struct Uniforms {
	modelViewProjectionMatrix: mat4x4f,
}
@group(0) @binding(0) var<uniform> uniforms : Uniforms;

struct VertexOutput {
	@builtin(position) Position : vec4f,
	@location(0) fragUV : vec2f,
	@location(1) fragPosition : vec4f,
}

@vertex
fn main(
	@location(0) position : vec3f,
	@location(1) normal: vec3f,
	@location(2) uv : vec2f
) -> VertexOutput {
	var output : VertexOutput;
	output.Position = uniforms.modelViewProjectionMatrix * vec4(position, 1.0);
	output.fragUV = uv;
	output.fragPosition = vec4(position, 1.0);
	return output;
}
