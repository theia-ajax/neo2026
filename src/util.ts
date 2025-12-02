export class SampleBuffer {
	samplesBuffer: Array<number>;
	index: number = 0;
	maxIndex: number = 0;
	slowAverage: number = 0;

	constructor(count: number)
	{
		this.samplesBuffer = new Array(count).fill(0);
	}

	public record(sample: number) {
		this.samplesBuffer[this.index] = sample;
		this.index = (this.index + 1) % this.samplesBuffer.length;
		this.maxIndex = Math.max(this.index, this.maxIndex);
		if (this.index == 0) {
			this.slowAverage = this.average();
		}
	}

	public average(): number {
		var sum: number = 0;
		for (var i = 0; i < this.maxIndex; i++) {
			sum += this.samplesBuffer[i];
		}
		return sum / this.maxIndex;
	}

	public max(): number {
		var maxValue: number = Number.MIN_VALUE;
		for (var i = 0; i < this.maxIndex; i++) {
			if (this.samplesBuffer[i] > maxValue) {
				maxValue = this.samplesBuffer[i];
			}
		}
		return maxValue;
	}

	public min(): number {
		var minValue: number = Number.MAX_VALUE;
		for (var i = 0; i < this.maxIndex; i++) {
			if (this.samplesBuffer[i] < minValue) {
				minValue = this.samplesBuffer[i];
			}
		}
		return minValue;
	}
}