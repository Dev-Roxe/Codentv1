module.exports = {
  // Entorno de testing
  testEnvironment: 'node',

  // Directorios de pruebas
  testMatch: [
    '**/src/__tests__/**/*.test.js',
    '**/src/**/*.test.js'
  ],

  // Archivos a ignorar
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/dist_installer/',
    '/build/'
  ],

  // Configuración de cobertura
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/renderer/**/*.js', // Excluir renderer por ahora
    '!src/**/*.test.js',
    '!src/__tests__/**',
    '!node_modules/**'
  ],

  // Umbrales de cobertura
  coverageThreshold: {
    global: {
      branches: 50,
      functions: 50,
      lines: 50,
      statements: 50
    }
  },

  // Directorio de reportes de cobertura
  coverageDirectory: 'coverage',

  // Formatos de reporte
  coverageReporters: ['text', 'lcov', 'html'],

  // Setup files
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.js'],

  // Timeout para pruebas (ms)
  testTimeout: 10000,

  // Verbose output
  verbose: true,

  // Forzar salida después de las pruebas para evitar cuelgues
  forceExit: true,

  // Detectar handles abiertos
  detectOpenHandles: false
};
