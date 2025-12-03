document.addEventListener('DOMContentLoaded', () => {
	const information = document.getElementById('info');
	if (!information) return;

	const versions = window.versions || { chrome: () => 'unknown', node: () => 'unknown', electron: () => 'unknown' };
	information.innerText = `This app is using Chrome (v${versions.chrome()}), Node.js (v${versions.node()}), and Electron (v${versions.electron()})`;
});

const root = document.documentElement; // o document.body

function toggleDark() {
	root.classList.toggle('dark');
	// opcional: guardar preferencia
	localStorage.setItem(
		'theme',
		root.classList.contains('dark') ? 'dark' : 'light'
	);
}

// Al cargar la app, recuperar preferencia
const saved = localStorage.getItem('theme');
if (saved === 'dark') root.classList.add('dark');
if (saved === 'light') root.classList.remove('dark');
