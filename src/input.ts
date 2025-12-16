
export default interface Input {
	readonly buttons: {
		readonly action: number,
		readonly sprint: number,
	},
	readonly axes: {
		readonly move_x: number,
		readonly move_y: number,
		readonly move_z: number,
		readonly turn: number,
	},
}

interface ButtonKeyBinding {
	button: string;
}

interface AxisKeyBinding {
	axis: string;
	value: number;
}

export type InputHandler = () => Input;

export function createInputHandler(window: Window, canvas: HTMLCanvasElement): InputHandler {
	const keyState: Record<string, boolean> = {}

	const buttons = {
		action: 0,
		sprint: 0,
	}
	const axes = {
		move_x: 0,
		move_y: 0,
		move_z: 0,
		turn: 0,
	}

	const buttonKeyBindings: Record<string, ButtonKeyBinding> = {
		Space: { button: 'action' },
		ShiftLeft: { button: 'sprint' },
	}

	const axisKeyBindings: Record<string, AxisKeyBinding> = {
		KeyW: { axis: 'move_y', value: 1 },
		KeyS: { axis: 'move_y', value: -1 },
		KeyA: { axis: 'move_x', value: -1 },
		KeyD: { axis: 'move_x', value: 1 },
		ArrowUp: { axis: 'move_z', value: 1},
		ArrowDown: { axis: 'move_z', value: -1},
		ArrowLeft: { axis: 'turn', value: -1 },
		ArrowRight: { axis: 'turn', value: 1 },
	}

	const applyButtonKeyBinding = (binding: ButtonKeyBinding, pressed: boolean) => {
		buttons[binding.button] += pressed ? 1 : -1;
	}

	const applyAxisKeyBinding = (axis: AxisKeyBinding, pressed: boolean) => {
		axes[axis.axis] += pressed ? axis.value : -axis.value;
	}

	const setKeyboardInput = (ev: KeyboardEvent, pressed: boolean) => {
		const buttonBinding = buttonKeyBindings[ev.code];
		const axisBinding = axisKeyBindings[ev.code];

		
		if (buttonBinding !== undefined && !ev.repeat) {
			applyButtonKeyBinding(buttonBinding, pressed);
			ev.preventDefault();
			ev.stopPropagation();
		}
		if (axisBinding !== undefined && !ev.repeat) {
			let shouldApply = true;
			// prevents cases where a key was held before the page was loaded so there was never an initial keydown event.
			// on keyup checks that we've previously stored that the key was down
			if (!pressed && !keyState[ev.code]) {
				shouldApply = false;
			}
			if (shouldApply) {
				applyAxisKeyBinding(axisBinding, pressed);
			}
			ev.preventDefault();
			ev.stopPropagation();
		}

		if (!ev.repeat) {
			keyState[ev.code] = pressed;
		}
	}

	window.addEventListener('keydown', (ev) => setKeyboardInput(ev, true));
	window.addEventListener('keyup', (ev) => setKeyboardInput(ev, false));

	return () => {
		const out = {
			buttons,
			axes,
			keyState,
		};
		return out;
	}
}

export class InputSystem {

}