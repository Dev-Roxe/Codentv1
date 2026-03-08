const { app } = require('electron');
console.log('ELECTRON ABI:', process.versions.modules);
app.quit();
