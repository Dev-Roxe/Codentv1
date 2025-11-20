# ✅ CHECKLIST Y TROUBLESHOOTING

## 📋 Checklist Pre-Producción

### ✓ Configuración

- [ ] `.env` creado con SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD
- [ ] `.env` agregado a `.gitignore`
- [ ] `nodemailer` instalado: `npm list nodemailer` muestra versión
- [ ] `dotenv` instalado: `npm list dotenv` muestra versión
- [ ] Credenciales SMTP probadas (conexión exitosa)

### ✓ Archivos

- [ ] `src/main/email-service.js` existe y tiene `sendBulkEmail()`, `sendEmail()`, `verifyConnection()`
- [ ] `src/main.js` tiene handlers IPC: `send-bulk-email`, `get-patients`
- [ ] `src/preload.js` expone `electronAPI.invoke()` y `electronAPI.on()`
- [ ] `src/renderer/views/crm.html` tiene IDs: `emailRecipients`, `emailSubject`, `emailMessage`, `sendBulkEmailBtn`
- [ ] `src/renderer/scripts/crm.js` tiene funciones: `loadPatients()`, `sendBulkEmailBtn` event listener

### ✓ Base de Datos

- [ ] Tabla `pacientes` existe con campos: `id`, `nombre`, `email`, `fecha_nacimiento`, `doctor`
- [ ] Tabla `citas` existe (para filtro activos/inactivos)
- [ ] Al menos 5 pacientes de prueba en BD con emails válidos

### ✓ Funcionalidad

- [ ] App inicia sin errores: `npm run dev`
- [ ] Puedo navegar a CRM → Email Marketing
- [ ] Selector "Destinatarios" muestra opciones
- [ ] Al seleccionar grupo, se carga el contador de pacientes
- [ ] Botón "Enviar Masivo" se habilita cuando hay pacientes
- [ ] Botones de variables {nombre}, {fecha_cita}, {doctor} insertan texto
- [ ] Barra de progreso aparece durante envío
- [ ] Recibo confirmación de éxito/error

---

## 🐛 Troubleshooting

### ❌ Error: "Cannot find module './email-service'"

**Síntomas:**
```
Error: Cannot find module './email-service'
Require stack: - C:\Codentv1\src\main.js
```

**Soluciones:**
1. Verifica que `src/main/email-service.js` EXISTE (no `src/email-service.js`)
2. Verifica la ruta en `main.js`:
   ```javascript
   const { sendBulkEmail, verifyConnection } = require('./main/email-service');
   // ✅ Correcto
   // ❌ require('./email-service') sería incorrecto
   ```
3. Reinicia: `npm run dev`

---

### ❌ Error: "SMTP_USER is undefined"

**Síntomas:**
```
Error: Invalid login: 535 5.7.8 undefined
```

**Soluciones:**
1. Verifica que `.env` existe en la raíz: `ls -la .env`
2. Verifica contenido: `cat .env` (debe tener SMTP_USER=...)
3. Verifica que no hay espacios: `SMTP_USER = email` ❌ vs `SMTP_USER=email` ✅
4. Agrega al inicio de `src/main.js`:
   ```javascript
   require('dotenv').config();
   console.log('SMTP_USER:', process.env.SMTP_USER);
   ```
5. Reinicia

---

### ❌ Error: "smtp.gmail.com connection timeout"

**Síntomas:**
```
Error: connect ETIMEDOUT 74.125.200.108:465
```

**Soluciones:**
1. Verifica conexión a internet
2. Verifica que SMTP_PORT es 465 (no 587 con SMTP_SECURE=true)
3. Verifica firewall no bloquea puerto 465
4. Usa puerto 587 con SMTP_SECURE=false si está disponible
5. Prueba con otro SMTP (Hotmail, SendGrid)

---

### ❌ Error: "Authentication failed"

**Síntomas:**
```
Error: Invalid login: 535 5.7.8 ...
```

**Soluciones (Gmail):**
1. Verifica que generaste "App Password" (NO contraseña normal)
2. Copia exactamente los 16 caracteres sin espacios
3. Verifica que 2FA está activado en tu cuenta Google
4. Ve a https://security.google.com/u/0/settings/security → App passwords
5. Regenera una nueva contraseña

**Soluciones (Otros):**
1. Verifica usuario y contraseña
2. Prueba directo en: https://www.smtper.net/ (tool online)

---

### ❌ Botón "Enviar Masivo" no se habilita

**Síntomas:**
- Selecciono grupo pero botón sigue deshabilitado
- recipientCount muestra error

**Soluciones:**
1. Abre DevTools (Ctrl+Shift+I) → Console
2. Busca errores como:
   ```
   Error loading patients: ...
   ```
3. Si dice "get-patients is not a function":
   - Verifica que `main.js` tiene el handler
   - Reinicia app
4. Si dice "no hay pacientes":
   - Abre BD (SQLite) y verifica que existen
   - Verifica que tienen `email` (no NULL)

---

### ❌ Se envían emails pero con variables sin reemplazar

**Síntomas:**
- Recibo email con: "Hola {nombre}, tu cita..."
- Debería ser: "Hola Juan, tu cita..."

**Soluciones:**
1. En `email-service.js`, verifica `replaceVariables()`:
   ```javascript
   const regex = new RegExp(`\\{${key}\\}`, 'g');  // ✅ Escapa las llaves
   result = result.replace(regex, data[key] || '');
   ```
2. Verifica que en `main.js` se pasan `variables` correctas:
   ```javascript
   await sendEmail({
     to: recipient.email,
     subject,
     body,
     variables: {
       nombre: recipient.nombre,
       fecha_cita: recipient.fecha_cita,
       doctor: recipient.doctor,
     },
   });
   ```
3. Reinicia app y reintenta

---

### ❌ Progreso se queda en 0%

**Síntomas:**
- Clico "Enviar" pero barra no avanza
- Se queda enviando todo el tiempo

**Soluciones:**
1. Verifica que `onProgress` callback se llama en `email-service.js`
2. Verifica que `mainWindow.webContents.send()` está en `main.js`
3. En DevTools (Ctrl+Shift+I), ve a "Warnings" para IPC errors
4. Aumenta el delay si es muy rápido:
   ```javascript
   await new Promise(r => setTimeout(r, 500)); // Cambiar de 100 a 500
   ```

---

### ❌ "No hay pacientes en este grupo"

**Síntomas:**
- Selecciono "Todos los pacientes"
- Muestra: "📊 No hay pacientes en este grupo"

**Soluciones:**
1. En terminal, ve a SQLite:
   ```powershell
   sqlite3 src/db/database.db
   SELECT COUNT(*) FROM pacientes;
   SELECT nombre, email FROM pacientes LIMIT 5;
   ```
2. Si no hay, agrega de prueba:
   ```sql
   INSERT INTO pacientes (nombre, email, fecha_nacimiento, doctor)
   VALUES ('Juan Pérez', 'juan@test.com', '1990-05-15', 'Dra. María');
   ```
3. Si hay pero no aparecen:
   - Verifica que tienen `email` (no NULL)
   - Verifica query en `main.js` `get-patients` handler
4. Reinicia app

---

### ❌ Email llega pero se ve con caracteres raros

**Síntomas:**
- Acentos convertidos: "Clínica" → "Cl&#237;nica"
- Saltos de línea no funcionan

**Soluciones:**
1. En `email-service.js`, verifica charset:
   ```javascript
   html: personalizedBody.replace(/\n/g, '<br>'),
   ```
2. Agrega headers en `transporter.sendMail()`:
   ```javascript
   mailOptions = {
     ...
     html: personalizedBody,
     textEncoding: 'utf-8',
   };
   ```
3. En `.env`, verifica encoding:
   - Abre `.env` con VS Code
   - Bottom-right: "UTF-8 with BOM" → cambiar a "UTF-8"

---

### ❌ Se envían solo a algunos pacientes (error silencioso)

**Síntomas:**
- Resultado dice: "Enviados: 150/300"
- No aparecen errores

**Soluciones:**
1. Abre Terminal → DevTools Console (F12)
2. Busca líneas de error (rojo)
3. En `email-service.js`, verifica que `failed` se incrementa:
   ```javascript
   catch (error) {
     failed++;
     results.push({ email: recipient.email, status: 'error', error: error.message });
   }
   ```
4. Aumenta logs:
   ```javascript
   console.log(`[Email ${i}] Enviando a ${recipient.email}...`);
   ```
5. Reinicia y prueba nuevamente

---

### ❌ App se reinicia después de enviar emails

**Síntomas:**
- Envío completado
- App se cierra/recarga
- Pierdo la sesión

**Soluciones:**
1. No es normal - probablemente exception no capturada
2. Abre DevTools → Console
3. Busca errores como "Uncaught"
4. En `crm.js`, verifica try/catch:
   ```javascript
   try {
     const result = await window.electronAPI.invoke(...);
   } catch (error) {
     console.error('Error:', error);
     alert(`Error: ${error.message}`);
   }
   ```
5. Reporta el error específico

---

## 🧪 Tests Manuales Recomendados

### Test 1: Verificar conexión SMTP

```javascript
// En terminal, crea test-email.js:
require('dotenv').config();
const { verifyConnection } = require('./src/main/email-service');

(async () => {
  const ok = await verifyConnection();
  console.log(ok ? '✅ SMTP OK' : '❌ SMTP Failed');
  process.exit(ok ? 0 : 1);
})();

// Ejecutar:
// node test-email.js
```

### Test 2: Enviar email de prueba

```javascript
// test-single-email.js
require('dotenv').config();
const { sendEmail } = require('./src/main/email-service');

(async () => {
  const result = await sendEmail({
    to: 'tu-email@test.com',
    subject: 'Test desde Nodemailer',
    body: 'Este es un email de prueba.\n\nClínica Sonalia',
    variables: { nombre: 'Test User' },
  });
  
  console.log(result);
  process.exit(result.success ? 0 : 1);
})();

// Ejecutar:
// node test-single-email.js
```

### Test 3: Envío masivo de prueba

```javascript
// test-bulk-email.js
require('dotenv').config();
const { sendBulkEmail } = require('./src/main/email-service');

(async () => {
  const recipients = [
    { email: 'usuario1@test.com', nombre: 'Usuario 1' },
    { email: 'usuario2@test.com', nombre: 'Usuario 2' },
  ];

  const result = await sendBulkEmail({
    recipients,
    subject: 'Hola {nombre}',
    body: 'Email a {nombre}',
    onProgress: (curr, total) => console.log(`${curr}/${total}`),
  });

  console.log(result);
  process.exit(result.success ? 0 : 1);
})();

// Ejecutar:
// node test-bulk-email.js
```

---

## 📞 Support

Si los troubleshoots no resuelven:

1. Revisa **GUIA_EMAIL_MASIVO.md** para conceptos
2. Revisa **NOTAS_TECNICAS.md** para arquitectura
3. Abre DevTools (F12) en la app
4. Captura el error completo
5. Intenta con otro SMTP (Gmail → Outlook) para aislar

---

**Última actualización:** 2025-11-20
