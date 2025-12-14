export default class Singleton<T> {
	private instance_: T;

	constructor(instance: T) {
		this.instance_ = instance;
	}

	public get instance() {
		return this.instance_;
	}
}
