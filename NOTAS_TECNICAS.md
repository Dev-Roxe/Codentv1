# 🛠️ NOTAS TÉCNICAS - SISTEMA DE ENVÍO MASIVO

## 🏗️ Arquitectura

```
┌─────────────────────────────────────────────────────────┐
│                    ELECTRON APP                         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌──────────────────────────────────────────────────┐  │
│  │ RENDERER (Frontend - React/HTML/JS)              │  │
│  │ ┌────────────────────────────────────────────┐   │  │
│  │ │ crm.html - UI de envío masivo              │   │  │
│  │ │ crm.js   - Lógica de frontend              │   │  │
│  │ │ preload.js - Bridge de IPC                 │   │  │
│  │ └────────────────────────────────────────────┘   │  │
│  │                      │                            │  │
│  │                      │ IPC Invoke                 │  │
│  │                      ↓                            │  │
│  │  electronAPI.invoke('send-bulk-email', {...})    │  │
│  │  electronAPI.invoke('get-patients', {...})       │  │
│  │                      │                            │  │
│  └──────────────────────┼────────────────────────────┘  │
│                         │                               │
│  ┌──────────────────────┼────────────────────────────┐  │
│  │ MAIN (Backend - Node.js)                         │  │
│  │                      │                            │  │
│  │                      ↓                            │  │
│  │  ipcMain.handle('send-bulk-email', ...)  ◄──────┤  │
│  │  ipcMain.handle('get-patients', ...)     ◄──────┤  │
│  │                      │                            │  │
│  │                      ├─→ email-service.js         │  │
│  │                      │   ├─ sendBulkEmail()      │  │
│  │                      │   ├─ sendEmail()          │  │
│  │                      │   └─ verifyConnection()   │  │
│  │                      │                            │  │
│  │                      ├─→ database.js              │  │
│  │                      │   └─ get pacientes        │  │
│  │                      │                            │  │
│  │                      ↓                            │  │
│  │              Nodemailer (SMTP)                   │  │
│  │                      │                            │  │
│  │                      ↓                            │  │
│  │          smtp.gmail.com:465                      │  │
│  │                      │                            │  │
│  │                      ↓                            │  │
│  │         Gmail / Proveedor SMTP                   │  │
│  │                                                   │  │
│  └───────────────────────────────────────────────────┘  │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## 💾 Flujo de Datos

### 1. Carga de Pacientes

```
Usuario selecciona grupo
       ↓
crm.js: loadPatients(group)
       ↓
electronAPI.invoke('get-patients', { group })
       ↓
main.js: ipcMain.handle('get-patients', ...)
       ↓
database.js: db.all(query)
       ↓
Retorna array: [{ id, nombre, email, fecha_nacimiento, doctor }, ...]
       ↓
crm.js: actualiza UI y enable botón
```

### 2. Envío Masivo

```
Usuario completa form y clica "Enviar Masivo"
       ↓
crm.js: sendBulkEmailBtn.addEventListener('click', async () => {...})
       ↓
Prepara:
{
  recipients: [
    { email: 'juan@mail.com', nombre: 'Juan', ... },
    { email: 'maria@mail.com', nombre: 'María', ... },
    ...
  ],
  subject: 'Recordatorio {nombre}',
  body: 'Hola {nombre}, tu cita es {fecha_cita}'
}
       ↓
electronAPI.invoke('send-bulk-email', { recipients, subject, body })
       ↓
main.js: ipcMain.handle('send-bulk-email', ...)
       ↓
email-service.js: sendBulkEmail({ recipients, subject, body, onProgress })
       ↓
Para cada recipient:
  - replaceVariables(subject, recipient) → 'Recordatorio Juan'
  - replaceVariables(body, recipient) → 'Hola Juan, tu cita es 2025-11-25'
  - Nodemailer: transporter.sendMail(...)
  - onProgress(i+1, total) → envia a mainWindow.webContents.send('email-progress', ...)
  - Delay 100ms (rate limiting)
       ↓
Retorna: { success, sent, failed, results }
       ↓
crm.js: recibe resultado y actualiza UI
       ↓
Usuario ve: "✅ Enviado: 324/324"
```

---

## 🔄 Variables Personalizadas

### Reemplazo Dinámico

```javascript
// email-service.js
function replaceVariables(template, data) {
  let result = template;
  Object.keys(data).forEach(key => {
    const regex = new RegExp(`\\{${key}\\}`, 'g');
    result = result.replace(regex, data[key] || '');
  });
  return result;
}

// Ejemplo:
replaceVariables('Hola {nombre}, tu cita es {fecha_cita}', {
  nombre: 'Juan',
  fecha_cita: '2025-11-25',
  doctor: 'Dra. María'
});
// Retorna: 'Hola Juan, tu cita es 2025-11-25'
```

### Soportadas:
- `{nombre}` - Nombre del paciente
- `{fecha_cita}` - Fecha de cita (o nacimiento si no existe)
- `{doctor}` - Médico asignado

**Para agregar más:**
1. Agregar campo a `SELECT` en `get-patients` handler
2. Pasar el campo en el objeto `recipients`
3. Usar `{nuevo_campo}` en el template

---

## 📡 IPC Handlers

### send-bulk-email

```javascript
ipcMain.handle('send-bulk-email', async (event, { recipients, subject, body }))
```

**Parámetros:**
- `recipients` (Array): [{ email, nombre, fecha_cita, doctor, ... }, ...]
- `subject` (String): Asunto con variables opcionales
- `body` (String): Cuerpo con variables opcionales

**Retorna:**
```javascript
{
  success: true/false,
  sent: number,       // Enviados correctamente
  failed: number,     // Errores
  results: [
    { email: 'juan@mail.com', status: 'enviado' | 'error', error?: string }
  ]
}
```

### get-patients

```javascript
ipcMain.handle('get-patients', async (event, params = {}))
```

**Parámetros:**
```javascript
{
  group: 'all' | 'active' | 'inactive'  // Todos / Últimos 6 meses / Sin citas 6+ meses
}
```

**Retorna:**
```javascript
[
  {
    id: 1,
    nombre: 'Juan Pérez',
    email: 'juan@mail.com',
    fecha_nacimiento: '1990-05-15',
    doctor: 'Dra. María López'
  },
  ...
]
```

---

## 🔐 Configuración SMTP

### Gmail (Recomendado)

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=tu-email@gmail.com
SMTP_PASSWORD=xyzabc123def4567  # App Password (16 caracteres)
SMTP_FROM_NAME=Clínica Sonalia
```

**Pasos:**
1. Activar 2FA en Google
2. Generar "App Password"
3. Copiar en `.env`

### Otros Proveedores

**Outlook/Hotmail:**
```env
SMTP_HOST=smtp-mail.outlook.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=tu-email@outlook.com
SMTP_PASSWORD=tu-contraseña
```

**Zoho:**
```env
SMTP_HOST=smtp.zoho.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=tu-email@zoho.com
SMTP_PASSWORD=tu-contraseña
```

**SendGrid (API):**
```env
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=apikey
SMTP_PASSWORD=SG.xxxxxxxxxxxxxxxxxxxx
```

---

## 🚨 Manejo de Errores

### Rate Limiting

```javascript
// Delay 100ms entre emails para evitar bloqueos
await new Promise(resolve => setTimeout(resolve, 100));
```

Ajusta si necesitas más rápido (pero SMTP puede rechazar).

### Reintentos (NO implementado aún)

Para versión futura:
```javascript
async function sendEmailWithRetry(params, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      return await sendEmail(params);
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise(r => setTimeout(r, 2000 * i)); // Exponential backoff
    }
  }
}
```

---

## 📊 Monitoreo de Progreso

### Frontend escucha evento

```javascript
// crm.js
window.electronAPI.on('email-progress', (data) => {
  const percentage = (data.current / data.total) * 100;
  emailProgress.style.width = `${percentage}%`;
  emailStatusText.textContent = `Enviando: ${data.current}/${data.total}...`;
});
```

### Backend envía evento

```javascript
// main.js
const result = await sendBulkEmail({
  recipients,
  subject,
  body,
  onProgress: (current, total) => {
    if (mainWindow) {
      mainWindow.webContents.send('email-progress', { current, total });
    }
  },
});
```

---

## 🧪 Testing

### Test unitario (propuesto)

```javascript
// test-email.js
const { sendBulkEmail, replaceVariables } = require('./src/main/email-service');

// Test 1: Variables
const template = 'Hola {nombre}, tu cita es {fecha_cita}';
const result = replaceVariables(template, { nombre: 'Juan', fecha_cita: '2025-11-25' });
assert(result === 'Hola Juan, tu cita es 2025-11-25');

// Test 2: Conexión SMTP
const connected = await verifyConnection();
assert(connected === true);

console.log('✅ Todos los tests pasaron');
```

**Ejecutar:**
```powershell
node test-email.js
```

---

## 📝 Logs y Debugging

### Ver logs del main process

Terminal donde corre `npm run dev`:
```
[IPC db-run] SQL: SELECT ... params: [...]
[IPC db-run] OK lastID: 1 changes: 1
✅ Conexión SMTP verificada correctamente
```

### Activar logs en renderer

```javascript
// crm.js
console.log('Enviando emails...', { recipients, subject, body });
```

Abre: DevTools en Electron (Ctrl+Shift+I) → Console

---

## ⚡ Performance

### Tamaños Máximos Recomendados

| Métrica | Recomendado | Máximo |
|---------|------------|--------|
| Destinatarios por envío | 100-500 | 1000 |
| Longitud del email | < 1MB | 5MB |
| Asunto | < 100 chars | 255 |
| Delay entre emails | 100ms | 500ms |

### Optimizaciones Futuras

1. **Batch SMTP:** Agrupar múltiples destinatarios en BCC (más rápido)
2. **Cola de Jobs:** Usar `bull` o `bree` para encolar envíos
3. **Compresión:** Comprimir template HTML grande
4. **Caching:** Cachear lista de pacientes entre envíos

---

## 🔗 Referencias

- **Nodemailer:** https://nodemailer.com/
- **Electron IPC:** https://www.electronjs.org/docs/api/ipc-main
- **Gmail App Passwords:** https://support.google.com/accounts/answer/185833
- **SQLite3 npm:** https://github.com/mapbox/node-sqlite3

---

**Última actualización:** 2025-11-20
**Versión:** 1.0.0
