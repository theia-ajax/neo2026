@group(0) @binding(1) var fragSampler: sampler;
@group(0) @binding(2) var fragTexture: texture_2d<f32>;

@fragment
fn main(
	@location(0) fragUV: vec2f,
	@location(1) fragPosition: vec4f
) -> @location(0) vec4f {
	var textureColor: vec4f = textureSample(fragTexture, fragSampler, fragUV / 32);
	// return textureColor;
	return mix(vec4f(0, 0, 0, 1), textureColor, fragPosition.y);
}
