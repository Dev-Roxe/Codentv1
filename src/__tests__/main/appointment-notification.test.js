const mockSendEmail = jest.fn();

jest.mock('../../main/google/gmail-service', () => ({
    sendEmail: mockSendEmail
}));

const { sendAppointmentNotification } = require('../../main/appointment-notification');

describe('Appointment Notification Service', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('sendAppointmentNotification', () => {
        test('sends the notification successfully with full appointment data', async () => {
            mockSendEmail.mockResolvedValue(true);

            const appointmentData = {
                patientEmail: 'paciente@example.com',
                patientName: 'Juan Perez',
                appointmentDate: '2026-02-10',
                appointmentTime: '10:00',
                reason: 'Limpieza dental',
                dentistName: 'Dr. Garcia',
                duration: 30
            };

            const result = await sendAppointmentNotification(appointmentData);

            expect(result).toBe(true);
            expect(mockSendEmail).toHaveBeenCalledTimes(1);
            expect(mockSendEmail).toHaveBeenCalledWith(
                expect.objectContaining({
                    to: 'paciente@example.com',
                    subject: 'Cita Agendada - Confirmacion',
                    html: expect.stringContaining('Juan Perez')
                })
            );
        });

        test('includes appointment details in the confirmation email body', async () => {
            mockSendEmail.mockResolvedValue(true);

            await sendAppointmentNotification({
                patientEmail: 'test@example.com',
                patientName: 'Maria Lopez',
                appointmentDate: '2026-03-15',
                appointmentTime: '14:30',
                reason: 'Revision general',
                dentistName: 'Dra. Martinez',
                duration: 45
            });

            const emailCall = mockSendEmail.mock.calls[0][0];
            expect(emailCall.html).toContain('Maria Lopez');
            expect(emailCall.html).toContain('14:30');
            expect(emailCall.html).toContain('Revision general');
            expect(emailCall.html).toContain('Dra. Martinez');
            expect(emailCall.html).toContain('Cita Agendada');
            expect(emailCall.html).not.toContain('Ã');
            expect(emailCall.html).not.toContain('ðŸ');
        });

        test('builds the cancellation template when the appointment is cancelled', async () => {
            mockSendEmail.mockResolvedValue(true);

            await sendAppointmentNotification({
                patientEmail: 'test@example.com',
                patientName: 'Laura Gomez',
                appointmentDate: '2026-04-20',
                appointmentTime: '09:15',
                reason: 'Consulta',
                dentistName: 'Dr. Ruiz',
                notificationType: 'cancelado'
            });

            const emailCall = mockSendEmail.mock.calls[0][0];
            expect(emailCall.subject).toBe('Cita Cancelada - Aviso');
            expect(emailCall.html).toContain('Cita Cancelada');
            expect(emailCall.html).toContain('su cita fue cancelada');
            expect(emailCall.html).toContain('contactenos para asignarle una nueva fecha');
        });

        test('builds the no-show template when the appointment is marked as no show', async () => {
            mockSendEmail.mockResolvedValue(true);

            await sendAppointmentNotification({
                patientEmail: 'test@example.com',
                patientName: 'Mario Torres',
                appointmentDate: '2026-05-11',
                appointmentTime: '12:00',
                reason: 'Ortodoncia',
                dentistName: 'Dra. Leon',
                notificationType: 'no-asiste'
            });

            const emailCall = mockSendEmail.mock.calls[0][0];
            expect(emailCall.subject).toBe('Inasistencia de Cita - Aviso');
            expect(emailCall.html).toContain('Inasistencia Registrada');
            expect(emailCall.html).toContain('no asistida');
            expect(emailCall.html).toContain('desea reagendar');
        });

        test('returns false when the patient email is missing', async () => {
            const result = await sendAppointmentNotification({
                patientEmail: null,
                patientName: 'Juan Perez',
                appointmentDate: '2026-02-10',
                appointmentTime: '10:00',
                reason: 'Limpieza dental'
            });

            expect(result).toBe(false);
            expect(mockSendEmail).not.toHaveBeenCalled();
        });

        test('returns false when the patient email is empty', async () => {
            const result = await sendAppointmentNotification({
                patientEmail: '',
                patientName: 'Juan Perez',
                appointmentDate: '2026-02-10',
                appointmentTime: '10:00',
                reason: 'Limpieza dental'
            });

            expect(result).toBe(false);
            expect(mockSendEmail).not.toHaveBeenCalled();
        });

        test('returns false when the email service fails', async () => {
            mockSendEmail.mockRejectedValue(new Error('Gmail service error'));

            const result = await sendAppointmentNotification({
                patientEmail: 'paciente@example.com',
                patientName: 'Juan Perez',
                appointmentDate: '2026-02-10',
                appointmentTime: '10:00',
                reason: 'Limpieza dental'
            });

            expect(result).toBe(false);
            expect(mockSendEmail).toHaveBeenCalled();
        });

        test('works without optional professional and duration data', async () => {
            mockSendEmail.mockResolvedValue(true);

            const result = await sendAppointmentNotification({
                patientEmail: 'paciente@example.com',
                patientName: 'Ana Torres',
                appointmentDate: '2026-02-20',
                appointmentTime: '09:00',
                reason: 'Consulta'
            });

            expect(result).toBe(true);
            expect(mockSendEmail).toHaveBeenCalled();
        });

        test('keeps the generated HTML well formed', async () => {
            mockSendEmail.mockResolvedValue(true);

            await sendAppointmentNotification({
                patientEmail: 'test@example.com',
                patientName: 'Carlos Ruiz',
                appointmentDate: '2026-04-01',
                appointmentTime: '16:00',
                reason: 'Ortodoncia',
                dentistName: 'Dr. Sanchez'
            });

            const emailCall = mockSendEmail.mock.calls[0][0];
            expect(emailCall.html).toContain('<');
            expect(emailCall.html).toContain('>');
            expect(emailCall.html).toContain('style=');
            expect(emailCall.to).toBe('test@example.com');
            expect(emailCall.subject).toBeTruthy();
        });

        test('normalizes accented and mojibake data to safe ASCII text', async () => {
            mockSendEmail.mockResolvedValue(true);

            const result = await sendAppointmentNotification({
                patientEmail: 'test@example.com',
                patientName: 'JosÃƒ© MarÃƒÂ­a Ãƒâ€˜oÃƒÂ±o',
                appointmentDate: '2026-05-01',
                appointmentTime: '11:00',
                reason: 'ExtracciÃƒÂ³n & Limpieza',
                dentistName: 'Dr. PÃƒ©rez-GarcÃƒÂ­a'
            });

            expect(result).toBe(true);
            expect(mockSendEmail).toHaveBeenCalled();

            const emailCall = mockSendEmail.mock.calls[0][0];
            expect(emailCall.html).toContain('Jose Maria Nono');
            expect(emailCall.html).toContain('Extraccion &amp; Limpieza');
            expect(emailCall.html).toContain('Dr. Perez-Garcia');
        });
    });
});
