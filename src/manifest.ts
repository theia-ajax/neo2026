import type { AssetManifest } from "@/assets/assetDatabase";

export const GlobalAssetManifest: AssetManifest = {
	assets: [
		{
			name: "heightmap",
			type: "image",
			url: new URL('textures/smallheightmap.png', import.meta.url),
		},
		{
			name: "heightmap_phys",
			type: "image",
			url: new URL('textures/smallheightmap_64.png', import.meta.url),
		},
		{
			name: "largeheightmap",
			type: "image",
			url: new URL('textures/height.png', import.meta.url),
		},
		{
			name: "grass_1_diffuse",
			type: "image",
			url: new URL('textures/Color Maps/grass_1.png', import.meta.url),
		},
		{
			name: "grass_1_normal",
			type: "image",
			url: new URL('textures/Normal Maps/grass_1_normal.png', import.meta.url),
		},
		{
			name: "roots_1_diffuse",
			type: "image",
			url: new URL('textures/Color Maps/water_3.png', import.meta.url),
		},
		{
			name: "roots_1_normal",
			type: "image",
			url: new URL('textures/Normal Maps/water_3_normal.png', import.meta.url),
		},
		{
			name: "ceiling_1_diffuse",
			type: "image",
			url: new URL('textures/Color Maps/hl_office_complex_style_drop_ceiling_1.png', import.meta.url),
		},
		{
			name: "ceiling_1_normal",
			type: "image",
			url: new URL('textures/Normal Maps/hl_office_complex_style_drop_ceiling_1_normal.png', import.meta.url),
		},
		{
			name: "skybox01_px",
			type: "image",
			url: new URL('textures/skyboxes/skybox01_px.png', import.meta.url),
		},
		{
			name: "skybox01_nx",
			type: "image",
			url: new URL('textures/skyboxes/skybox01_nx.png', import.meta.url),
		},
		{
			name: "skybox01_py",
			type: "image",
			url: new URL('textures/skyboxes/skybox01_py.png', import.meta.url),
		},
		{
			name: "skybox01_ny",
			type: "image",
			url: new URL('textures/skyboxes/skybox01_ny.png', import.meta.url),
		},
		{
			name: "skybox01_pz",
			type: "image",
			url: new URL('textures/skyboxes/skybox01_pz.png', import.meta.url),
		},
		{
			name: "skybox01_nz",
			type: "image",
			url: new URL('textures/skyboxes/skybox01_nz.png', import.meta.url),
		},

	]
}