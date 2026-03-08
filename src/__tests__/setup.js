/**
 * Setup global para las pruebas
 * Este archivo se ejecuta antes de todas las pruebas
 */

// Mock de console para evitar spam en los tests
global.console = {
    ...console,
    // Mantener error y warn para debugging
    error: jest.fn(),
    warn: jest.fn(),
    // Silenciar logs normales
    log: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
};

// Variables globales para testing
global.testDbPath = ':memory:'; // Base de datos en memoria para tests

// Timeout global para operaciones asíncronas
jest.setTimeout(10000);
