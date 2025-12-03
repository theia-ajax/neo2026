@group(0) @binding(1) var fragSampler: sampler;
@group(0) @binding(2) var fragTexture: texture_2d<f32>;

@fragment
fn main(
	@location(0) fragUV: vec2f,
	@location(1) fragPosition: vec4f
) -> @location(0) vec4f {
	return textureSample(fragTexture, fragSampler, fragUV);
}
