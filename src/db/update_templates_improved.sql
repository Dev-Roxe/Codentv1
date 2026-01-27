-- Script para actualizar plantillas de email predeterminadas en el CRM
-- Versión mejorada con textos más profesionales y efectivos

-- Actualizar plantillas existentes
UPDATE crm_templates SET 
  asunto = '¡Bienvenido/a a nuestra familia dental! 🦷',
  contenido = 'Estimado/a {nombre},

¡Es un placer darte la bienvenida a nuestra clínica dental!

Queremos agradecerte por confiar en nosotros para cuidar de tu salud bucal. En nuestro consultorio, nos dedicamos a brindarte una atención personalizada y de calidad, siempre con el objetivo de que luzcas tu mejor sonrisa.

El Dr./Dra. {doctor} y todo nuestro equipo estamos comprometidos con tu bienestar y comodidad en cada visita.

📍 Nuestros horarios de atención:
• Lunes a Viernes: 9:00 AM - 7:00 PM
• Sábados: 9:00 AM - 2:00 PM

💬 ¿Tienes alguna pregunta o necesitas agendar tu próxima cita?
No dudes en contactarnos, estamos aquí para ayudarte.

¡Esperamos verte pronto y comenzar juntos este camino hacia una sonrisa saludable!

Saludos cordiales,
El equipo de tu clínica dental',
  fecha_actualizacion = datetime('now')
WHERE nombre = '🎉 Bienvenida a Nuevos Pacientes' AND es_predeterminada = 1;

-- 2. Recordatorio de Cita
UPDATE crm_templates SET 
  asunto = 'Recordatorio: Tu cita dental está próxima 📅',
  contenido = 'Hola {nombre},

Te recordamos que tienes una cita programada en nuestra clínica:

📅 Fecha y hora: {fecha_cita}
👨‍⚕️ Atención con: Dr./Dra. {doctor}

📋 Recomendaciones para tu visita:
• Llega 10 minutos antes para completar cualquier papeleo necesario
• Si estás tomando algún medicamento, por favor infórmanos
• Trae tu identificación y tarjeta de seguro (si aplica)

⚠️ Importante: Si necesitas cancelar o reprogramar, te pedimos que nos avises con al menos 24 horas de anticipación para poder ofrecer ese espacio a otro paciente.

Si tienes alguna duda o consulta antes de tu cita, no dudes en contactarnos.

¡Te esperamos!

Atentamente,
El equipo de la clínica',
  fecha_actualizacion = datetime('now')
WHERE nombre = '⏰ Recordatorio de Cita' AND es_predeterminada = 1;

-- 3. Seguimiento Post-Tratamiento
UPDATE crm_templates SET 
  asunto = '¿Cómo te sientes después de tu visita? 💙',
  contenido = 'Hola {nombre},

Esperamos que te encuentres muy bien después de tu reciente tratamiento con el Dr./Dra. {doctor}.

Tu bienestar es muy importante para nosotros, por eso queremos asegurarnos de que tu recuperación esté siendo satisfactoria. Es completamente normal experimentar algo de sensibilidad durante los primeros días, pero si tienes alguna molestia o inquietud, estamos disponibles para atenderte.

💡 Cuidados recomendados:
• Mantén una excelente higiene bucal, cepillando suavemente
• Evita alimentos muy duros, calientes o pegajosos por unos días
• Si experimentas dolor intenso, inflamación o sangrado, contáctanos de inmediato

🩺 Recuerda: Tu salud bucal es nuestra prioridad. No dudes en llamarnos si necesitas orientación o tienes alguna pregunta.

Estamos aquí para ti en todo momento.

¡Cuídate mucho!

Con aprecio,
El equipo de la clínica',
  fecha_actualizacion = datetime('now')
WHERE nombre = '💊 Seguimiento Post-Tratamiento' AND es_predeterminada = 1;

-- 4. Promoción Especial
UPDATE crm_templates SET 
  asunto = '✨ Oferta exclusiva para ti: Blanqueamiento dental con descuento',
  contenido = 'Hola {nombre},

¡Tenemos una excelente noticia para ti! 🎁

Como paciente valorado de nuestra clínica, queremos ofrecerte una promoción especial:

🦷 BLANQUEAMIENTO DENTAL PROFESIONAL
✨ 20% de descuento exclusivo

Consigue una sonrisa más blanca, brillante y radiante con nuestro tratamiento de blanqueamiento profesional. Utilizamos tecnología de última generación para garantizar resultados visibles desde la primera sesión.

✅ Beneficios de nuestro tratamiento:
• Procedimiento seguro y supervisado por especialistas
• Resultados duraderos y naturales
• Atención personalizada y seguimiento post-tratamiento
• Sin dolor ni sensibilidad excesiva

⏰ Promoción válida hasta fin de mes
📞 Agenda tu cita ahora y aprovecha este descuento exclusivo

No dejes pasar esta oportunidad de lucir la sonrisa que siempre has deseado. ¡Nuestro equipo está listo para ayudarte!

Saludos cordiales,
El equipo de la clínica',
  fecha_actualizacion = datetime('now')
WHERE nombre = '✨ Promoción Especial' AND es_predeterminada = 1;

-- 5. Felicitación de Cumpleaños
UPDATE crm_templates SET 
  asunto = '¡Feliz cumpleaños {nombre}! 🎉🎂',
  contenido = 'Querido/a {nombre},

¡Feliz cumpleaños! 🎉🎂✨

En este día tan especial, todo el equipo de la clínica dental queremos enviarte nuestros mejores deseos. Esperamos que tu día esté lleno de alegría, amor, sonrisas y momentos inolvidables junto a tus seres queridos.

Agradecemos profundamente tu confianza y lealtad. Es un verdadero placer ser parte de tu cuidado dental y verte sonreír en cada visita.

🎁 Regalo especial de cumpleaños:
Como muestra de nuestro aprecio, queremos regalarte un 15% de descuento en cualquier tratamiento que realices durante este mes. ¡Es nuestro regalo para ti!

Gracias por permitirnos cuidar de tu sonrisa. Eres parte importante de nuestra familia dental.

¡Que tengas un día maravilloso y un año lleno de salud y felicidad!

Con mucho cariño,
El equipo de la clínica 💙',
  fecha_actualizacion = datetime('now')
WHERE nombre = '🎂 Felicitación de Cumpleaños' AND es_predeterminada = 1;

-- 6. Reactivación de Pacientes Inactivos
UPDATE crm_templates SET 
  asunto = '¡Te extrañamos! Es momento de cuidar tu sonrisa 😊',
  contenido = 'Hola {nombre} {apellido},

¡Hace tiempo que no sabemos de ti! Esperamos que te encuentres muy bien.

Nos gustaría recordarte que tu salud bucal es fundamental para tu bienestar general. Las revisiones dentales periódicas son esenciales para:

✅ Prevenir problemas antes de que se conviertan en algo mayor
✅ Mantener tus dientes y encías saludables
✅ Detectar cualquier anomalía a tiempo
✅ Conservar tu sonrisa radiante y saludable

🦷 Dato importante: Los odontólogos recomiendan una revisión dental cada 6 meses para mantener una salud bucal óptima.

Nos encantaría volver a verte y asegurarnos de que todo está en perfectas condiciones. Tu bienestar es nuestra prioridad.

🎁 Oferta especial de reactivación:
Como incentivo para que vuelvas a visitarnos, te ofrecemos un 10% de descuento en tu próxima limpieza dental si agendas tu cita este mes.

📞 Contáctanos hoy mismo para programar tu cita. ¡Estamos aquí para ti!

Te extrañamos y esperamos verte pronto.

Con aprecio,
El equipo de la clínica',
  fecha_actualizacion = datetime('now')
WHERE nombre = '💌 Reactivación de Pacientes' AND es_predeterminada = 1;

-- Verificar actualizaciones
SELECT id, nombre, asunto FROM crm_templates WHERE es_predeterminada = 1 ORDER BY id;
