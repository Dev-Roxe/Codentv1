'use strict';

const { app } = require('electron');
const updateService = require('./src/main/update-service');

require('./src/main');

app.whenReady().then(() => {
  updateService.initialize();
  console.log('[updater] Servicio de autoactualizacion inicializado.');
  setTimeout(() => {
    updateService.checkForUpdatesOnStartup();
  }, 2500);
});
