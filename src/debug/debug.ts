
var debugPanelElement: HTMLElement = document.getElementById("debug");
var debugMessages: Array<string> = [];

function getDebugPanel(): HTMLElement {
	if (debugPanelElement === undefined) {
		debugPanelElement = document.getElementById("debug");
	}
	return debugPanelElement;
}

export function log(message: string) {
	debugMessages.push(message);
}

export function flush() {
	const panel = getDebugPanel();

	if (panel != null) {
		var htmlString = "";
		for (var i in debugMessages) {
			var message = debugMessages[i];
			htmlString = htmlString + message + "<br />";
		}
		panel.innerHTML = htmlString;
	}
	debugMessages.length = 0;
}

export function setVisible(visible: boolean) {
	const panel = getDebugPanel();
	if (panel != null)
		panel.hidden = !visible;
}

export function getVisible() { return !getDebugPanel()?.hidden; }