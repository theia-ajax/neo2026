var imageDataCanvas: HTMLCanvasElement = undefined;
var imageDataContext: CanvasRenderingContext2D | undefined = undefined;

export function initImageData() {
	if (imageDataContext === undefined) {
		imageDataCanvas = document.createElement("canvas");
		imageDataCanvas.hidden = true;
		var body = document.getElementsByTagName("body")[0];
		body.appendChild(imageDataCanvas);
		imageDataContext = imageDataCanvas.getContext("2d");
	}
}

export default function getImageData(image: ImageBitmap): ImageData {
	if (imageDataContext == undefined) {
		return undefined;
	}

	imageDataCanvas.width = image.width;
	imageDataCanvas.height = image.height;
	imageDataContext.drawImage(image, 0, 0, image.width, image.height);
	return imageDataContext.getImageData(0, 0, image.width, image.height);
}