

export const Mathx = {
	deg2Rad: Math.PI / 180.0,
	rad2Deg: 180.0 / Math.PI,
	clamp: (v, low, high) => { return Math.min(Math.max(v, low), high); }
}