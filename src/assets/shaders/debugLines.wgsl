@group(0) @binding(0) var<uniform> viewProjectionMatrix: mat4x4f;

struct VertexOutput {
	@builtin(position) position: vec4f,
	@location(0) color: vec4f,
}

@vertex
fn vertex_main(
	@location(0) position: vec3f,
	@location(1) color: vec4f
) -> VertexOutput {
	var output: VertexOutput;
	output.position = viewProjectionMatrix * vec4(position, 1.0);
	output.color = color;
	return output;
}

@fragment
fn fragment_main(input: VertexOutput) -> @location(0) vec4f {
	return input.color;
}