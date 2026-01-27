-- Script para insertar plantillas de email predeterminadas en el CRM
-- Estas plantillas son editables pero no eliminables

-- Limpiar plantillas predeterminadas existentes (si las hay)
DELETE FROM crm_templates WHERE es_predeterminada = 1;

-- 1. Plantilla de Bienvenida a Nuevos Pacientes
INSERT INTO crm_templates (nombre, asunto, contenido, tipo, es_predeterminada, fecha_creacion, fecha_actualizacion)
VALUES (
  '🎉 Bienvenida a Nuevos Pacientes',
  '¡Bienvenido/a a nuestra clínica dental! 🦷',
  'Hola {nombre},

¡Bienvenido/a a nuestra familia dental! Estamos muy contentos de que hayas elegido nuestro consultorio para cuidar de tu salud bucal.

En nuestra clínica nos comprometemos a brindarte la mejor atención personalizada. El Dr./Dra. {doctor} y todo nuestro equipo estamos aquí para ayudarte a mantener una sonrisa saludable y radiante.

📍 Horarios de atención:
Lunes a Viernes: 9:00 AM - 7:00 PM
Sábados: 9:00 AM - 2:00 PM

📞 Si tienes alguna pregunta o necesitas agendar una cita, no dudes en contactarnos.

¡Esperamos verte pronto!

Saludos cordiales,
El equipo de la clínica',
  'email',
  1,
  datetime('now'),
  datetime('now')
);

-- 2. Plantilla de Recordatorio de Cita
INSERT INTO crm_templates (nombre, asunto, contenido, tipo, es_predeterminada, fecha_creacion, fecha_actualizacion)
VALUES (
  '⏰ Recordatorio de Cita',
  'Recordatorio: Tu cita dental el {fecha_cita}',
  'Hola {nombre},

Este es un recordatorio amistoso de tu próxima cita dental:

📅 Fecha y hora: {fecha_cita}
👨‍⚕️ Con: Dr./Dra. {doctor}

Por favor, ten en cuenta:
• Llega 10 minutos antes de tu cita
• Si has tomado antibióticos recientemente, infórmanos
• Si necesitas cancelar o reprogramar, avísanos con al menos 24 horas de anticipación

Si tienes alguna pregunta o necesitas hacer algún cambio, no dudes en contactarnos.

¡Te esperamos!

Saludos,
El equipo de la clínica',
  'email',
  1,
  datetime('now'),
  datetime('now')
);

-- 3. Plantilla de Seguimiento Post-Tratamiento
INSERT INTO crm_templates (nombre, asunto, contenido, tipo, es_predeterminada, fecha_creacion, fecha_actualizacion)
VALUES (
  '💊 Seguimiento Post-Tratamiento',
  '¿Cómo te sientes después de tu tratamiento?',
  'Hola {nombre},

Esperamos que te encuentres bien después de tu reciente visita con el Dr./Dra. {doctor}.

Queremos asegurarnos de que tu recuperación va bien y que no tienes ninguna molestia. Es normal experimentar algo de sensibilidad en los primeros días, pero si tienes alguna pregunta o inquietud, estamos aquí para ayudarte.

💡 Recomendaciones importantes:
• Mantén una buena higiene bucal
• Evita alimentos muy duros o pegajosos durante los primeros días
• Si sientes dolor intenso o inflamación, contáctanos de inmediato

Tu salud bucal es nuestra prioridad. No dudes en llamarnos si necesitas algo.

¡Cuídate mucho!

Saludos cordiales,
El equipo de la clínica',
  'email',
  1,
  datetime('now'),
  datetime('now')
);

-- 4. Plantilla de Promoción Especial
INSERT INTO crm_templates (nombre, asunto, contenido, tipo, es_predeterminada, fecha_creacion, fecha_actualizacion)
VALUES (
  '✨ Promoción Especial',
  '✨ Oferta especial en blanqueamiento dental - ¡Solo por tiempo limitado!',
  'Hola {nombre},

¡Tenemos una oferta especial solo para ti! 🎁

🦷 BLANQUEAMIENTO DENTAL PROFESIONAL
Precio especial: ¡20% de descuento!

Consigue una sonrisa más blanca y brillante con nuestro tratamiento de blanqueamiento profesional. Resultados visibles desde la primera sesión.

✅ Beneficios:
• Tratamiento seguro y efectivo
• Resultados duraderos
• Atención personalizada

⏰ Oferta válida hasta fin de mes
📞 Agenda tu cita ahora y aprovecha este descuento exclusivo

¡No dejes pasar esta oportunidad de lucir tu mejor sonrisa!

Saludos,
El equipo de la clínica',
  'email',
  1,
  datetime('now'),
  datetime('now')
);

-- 5. Plantilla de Felicitación de Cumpleaños
INSERT INTO crm_templates (nombre, asunto, contenido, tipo, es_predeterminada, fecha_creacion, fecha_actualizacion)
VALUES (
  '🎂 Felicitación de Cumpleaños',
  '¡Feliz cumpleaños {nombre}! 🎉',
  'Querido/a {nombre},

¡Feliz cumpleaños! 🎉🎂

En este día tan especial, todo el equipo de la clínica dental queremos desearte lo mejor. Esperamos que tu día esté lleno de alegría, sonrisas y momentos inolvidables.

🎁 Como regalo de cumpleaños, tenemos un descuento especial del 15% en cualquier tratamiento que realices durante este mes.

Gracias por confiar en nosotros para cuidar de tu sonrisa. Es un placer tenerte como parte de nuestra familia dental.

¡Que tengas un día maravilloso!

Con cariño,
El equipo de la clínica',
  'email',
  1,
  datetime('now'),
  datetime('now')
);

-- 6. Plantilla de Reactivación de Pacientes Inactivos
INSERT INTO crm_templates (nombre, asunto, contenido, tipo, es_predeterminada, fecha_creacion, fecha_actualizacion)
VALUES (
  '💌 Reactivación de Pacientes',
  'Te extrañamos en nuestra clínica dental',
  'Hola {nombre} {apellido},

¡Hace tiempo que no te vemos! Esperamos que te encuentres muy bien.

Queremos recordarte la importancia de mantener revisiones dentales regulares para prevenir problemas futuros y mantener tu sonrisa saludable. Las revisiones periódicas nos permiten detectar cualquier problema a tiempo.

🦷 ¿Sabías que se recomienda una revisión dental cada 6 meses?

Nos encantaría volver a verte y asegurarnos de que tu salud bucal está en perfectas condiciones.

🎁 Como incentivo especial, tenemos un 10% de descuento en tu próxima limpieza dental si agendas tu cita este mes.

📞 Contáctanos para agendar tu cita. ¡Estamos aquí para ti!

Te extrañamos,
El equipo de la clínica',
  'email',
  1,
  datetime('now'),
  datetime('now')
);

-- Verificar que se insertaron correctamente
SELECT id, nombre, tipo, es_predeterminada FROM crm_templates WHERE es_predeterminada = 1;
