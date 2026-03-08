/**
 * Pruebas Unitarias para el Servicio de Notificaciones de Citas
 * 
 * Estas pruebas verifican el funcionamiento correcto del módulo
 * appointment-notification.js
 */

// Mock del servicio de Gmail
const mockSendEmail = jest.fn();
jest.mock('../../main/google/gmail-service', () => ({
    sendEmail: mockSendEmail
}));

const { sendAppointmentNotification } = require('../../main/appointment-notification');

describe('Appointment Notification Service', () => {

    beforeEach(() => {
        // Limpiar todos los mocks antes de cada prueba
        jest.clearAllMocks();
    });

    describe('sendAppointmentNotification', () => {

        test('debe enviar notificación exitosamente con todos los datos', async () => {
            mockSendEmail.mockResolvedValue(true);

            const appointmentData = {
                patientEmail: 'paciente@example.com',
                patientName: 'Juan Pérez',
                appointmentDate: '2026-02-10',
                appointmentTime: '10:00',
                reason: 'Limpieza dental',
                dentistName: 'Dr. García',
                duration: 30
            };

            const result = await sendAppointmentNotification(appointmentData);

            expect(result).toBe(true);
            expect(mockSendEmail).toHaveBeenCalledTimes(1);
            expect(mockSendEmail).toHaveBeenCalledWith(
                expect.objectContaining({
                    to: 'paciente@example.com',
                    subject: expect.stringContaining('Cita'),
                    html: expect.stringContaining('Juan Pérez')
                })
            );
        });

        test('debe incluir todos los detalles de la cita en el email', async () => {
            mockSendEmail.mockResolvedValue(true);

            const appointmentData = {
                patientEmail: 'test@example.com',
                patientName: 'María López',
                appointmentDate: '2026-03-15',
                appointmentTime: '14:30',
                reason: 'Revisión general',
                dentistName: 'Dra. Martínez',
                duration: 45
            };

            await sendAppointmentNotification(appointmentData);

            const emailCall = mockSendEmail.mock.calls[0][0];
            expect(emailCall.html).toContain('María López');
            expect(emailCall.html).toContain('14:30');
            expect(emailCall.html).toContain('Revisión general');
            expect(emailCall.html).toContain('Dra. Martínez');
        });

        test('debe retornar false cuando falta el email del paciente', async () => {
            const appointmentData = {
                patientEmail: null,
                patientName: 'Juan Pérez',
                appointmentDate: '2026-02-10',
                appointmentTime: '10:00',
                reason: 'Limpieza dental'
            };

            const result = await sendAppointmentNotification(appointmentData);

            expect(result).toBe(false);
            expect(mockSendEmail).not.toHaveBeenCalled();
        });

        test('debe retornar false cuando el email está vacío', async () => {
            const appointmentData = {
                patientEmail: '',
                patientName: 'Juan Pérez',
                appointmentDate: '2026-02-10',
                appointmentTime: '10:00',
                reason: 'Limpieza dental'
            };

            const result = await sendAppointmentNotification(appointmentData);

            expect(result).toBe(false);
            expect(mockSendEmail).not.toHaveBeenCalled();
        });

        test('debe manejar errores del servicio de email correctamente', async () => {
            mockSendEmail.mockRejectedValue(new Error('Gmail service error'));

            const appointmentData = {
                patientEmail: 'paciente@example.com',
                patientName: 'Juan Pérez',
                appointmentDate: '2026-02-10',
                appointmentTime: '10:00',
                reason: 'Limpieza dental'
            };

            const result = await sendAppointmentNotification(appointmentData);

            expect(result).toBe(false);
            expect(mockSendEmail).toHaveBeenCalled();
        });

        test('debe funcionar sin datos opcionales (dentista, duración)', async () => {
            mockSendEmail.mockResolvedValue(true);

            const appointmentData = {
                patientEmail: 'paciente@example.com',
                patientName: 'Ana Torres',
                appointmentDate: '2026-02-20',
                appointmentTime: '09:00',
                reason: 'Consulta'
            };

            const result = await sendAppointmentNotification(appointmentData);

            expect(result).toBe(true);
            expect(mockSendEmail).toHaveBeenCalled();
        });

        test('debe formatear correctamente el HTML del email', async () => {
            mockSendEmail.mockResolvedValue(true);

            const appointmentData = {
                patientEmail: 'test@example.com',
                patientName: 'Carlos Ruiz',
                appointmentDate: '2026-04-01',
                appointmentTime: '16:00',
                reason: 'Ortodoncia',
                dentistName: 'Dr. Sánchez'
            };

            await sendAppointmentNotification(appointmentData);

            const emailCall = mockSendEmail.mock.calls[0][0];

            // Verificar que el HTML está bien formado
            expect(emailCall.html).toContain('<');
            expect(emailCall.html).toContain('>');
            expect(emailCall.html).toContain('style=');

            // Verificar estructura del email
            expect(emailCall.to).toBe('test@example.com');
            expect(emailCall.subject).toBeTruthy();
        });

        test('debe manejar caracteres especiales en los datos', async () => {
            mockSendEmail.mockResolvedValue(true);

            const appointmentData = {
                patientEmail: 'test@example.com',
                patientName: 'José María Ñoño',
                appointmentDate: '2026-05-01',
                appointmentTime: '11:00',
                reason: 'Extracción & Limpieza',
                dentistName: 'Dr. Pérez-García'
            };

            const result = await sendAppointmentNotification(appointmentData);

            expect(result).toBe(true);
            expect(mockSendEmail).toHaveBeenCalled();

            const emailCall = mockSendEmail.mock.calls[0][0];
            expect(emailCall.html).toContain('José María Ñoño');
            expect(emailCall.html).toContain('Extracción & Limpieza');
        });
    });
});
