document.addEventListener('DOMContentLoaded', () => {
	const information = document.getElementById('info');
	if (!information) return;

	const versions = window.versions || { chrome: () => 'unknown', node: () => 'unknown', electron: () => 'unknown' };
	information.innerText = `This app is using Chrome (v${versions.chrome()}), Node.js (v${versions.node()}), and Electron (v${versions.electron()})`;
});