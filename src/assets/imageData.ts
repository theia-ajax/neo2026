var imageDataCanvas: HTMLCanvasElement = undefined;
var imageDataContext: CanvasRenderingContext2D | undefined = undefined;

export function initImageData() {
	if (imageDataContext === undefined) {
		imageDataCanvas = document.createElement("canvas");
		imageDataCanvas.hidden = true;

		var body = document.getElementsByTagName("body")[0];
		body.appendChild(imageDataCanvas);
		imageDataContext = imageDataCanvas.getContext("2d", { willReadFrequently: true });
	}
}

export default function getImageData(image: ImageBitmap): ImageData {
	if (imageDataContext == undefined) {
		return undefined;
	}

	const getImageDataStart = performance.now();
	imageDataCanvas.width = image.width;
	imageDataCanvas.height = image.height;
	imageDataContext.drawImage(image, 0, 0, image.width, image.height);
	let result = imageDataContext.getImageData(0, 0, image.width, image.height);
	const getImageDataDuration = performance.now() - getImageDataStart;
	console.log(`getImageData duration: ${getImageDataDuration / 1000.0}s`);

	return result;
}