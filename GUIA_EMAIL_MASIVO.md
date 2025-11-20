# 📧 GUÍA DE CONFIGURACIÓN - SISTEMA DE ENVÍO MASIVO DE EMAILS

## 🎯 Descripción General

Se ha implementado un sistema completo de **envío masivo de emails** usando **Nodemailer** con soporte para:
- ✅ Personalización de variables por paciente (`{nombre}`, `{fecha_cita}`, `{doctor}`)
- ✅ Carga dinámica de pacientes desde BD (todos, activos, inactivos)
- ✅ Barra de progreso en tiempo real
- ✅ Envío seguro vía SMTP (Gmail u otro proveedor)
- ✅ Confirmación antes de enviar
- ✅ Reporte de errores

---

## 📁 Archivos Modificados/Creados

### 1. **`.env`** (Nuevo)
```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=tu-email@gmail.com
SMTP_PASSWORD=tu-app-password
SMTP_FROM_NAME=Clínica Sonalia
NODE_ENV=development
```

### 2. **`src/main/email-service.js`** (Nuevo)
Servicio central que maneja:
- Conexión SMTP con Nodemailer
- Reemplazo de variables personalizadas
- Envío individual y masivo
- Manejo de errores y rate limiting

### 3. **`src/main.js`** (Actualizado)
Se agregaron dos **handlers IPC**:
```javascript
// Envío masivo de emails
ipcMain.handle('send-bulk-email', async (event, { recipients, subject, body }) => {...})

// Obtener lista de pacientes
ipcMain.handle('get-patients', async (event, params = {}) => {...})
```

### 4. **`src/preload.js`** (Actualizado)
Se expuso la API de **Electron IPC**:
```javascript
contextBridge.exposeInMainWorld('electronAPI', {
  invoke: (channel, data) => ipcRenderer.invoke(channel, data),
  on: (channel, func) => ipcRenderer.on(channel, (event, ...args) => func(...args)),
})
```

### 5. **`src/renderer/views/crm.html`** (Actualizado)
Nueva sección "Envío Masivo" en la pestaña Email Marketing:
- Selector de grupos de pacientes
- Campos de asunto y mensaje
- Botones para insertar variables
- Barra de progreso de envío
- Vista previa

### 6. **`src/renderer/scripts/crm.js`** (Actualizado)
Lógica frontend para:
- Cargar pacientes según grupo
- Insertar variables en el mensaje
- Envío masivo con confirmación
- Actualización de progreso en tiempo real

---

## ⚙️ CONFIGURACIÓN PASO A PASO

### Paso 1: Configurar Gmail (recomendado)

1. **Ve a tu cuenta de Google:**
   - https://myaccount.google.com/
   - Seguridad → 2-Step Verification (activa si no está)
   - Seguridad → App passwords

2. **Genera una "App Password":**
   - Selecciona "Mail" y "Windows Computer"
   - Copia la contraseña generada (16 caracteres)

3. **Actualiza el archivo `.env`:**
   ```
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=465
   SMTP_USER=tu-email@gmail.com
   SMTP_PASSWORD=contraseña-app-que-generaste
   SMTP_FROM_NAME=Clínica Sonalia
   ```

### Paso 2: Validar que Nodemailer funciona

Abre la terminal en la carpeta del proyecto:
```powershell
# Verifica que Nodemailer está instalado
npm list nodemailer
```

Si no está instalado:
```powershell
npm install nodemailer
```

### Paso 3: Reinicia la app

```powershell
npm run dev
```

---

## 🚀 CÓMO USAR - ENVÍO MASIVO

### Desde la UI:

1. **Abre la app** → `Pacientes` (CRM) → **Email Marketing**

2. **En el panel "Envío Masivo":**
   - **Destinatarios:** Selecciona el grupo (todos, activos, inactivos)
   - **Asunto:** Escribe el asunto del email
   - **Mensaje:** Escribe el cuerpo (puedes usar variables)

3. **Usa variables:**
   - Haz clic en `{nombre}`, `{fecha_cita}` o `{doctor}` para insertarlas
   - Se reemplazarán automáticamente por los datos de cada paciente

4. **Vista Previa:**
   - Haz clic en "Vista Previa" para ver cómo se verá

5. **Envía:**
   - Haz clic en "Enviar Masivo"
   - Confirma el número de pacientes
   - Observa la barra de progreso

### Ejemplo de flujo:

```
Destinatarios: Todos los pacientes (324 seleccionados)
Asunto: Recordatorio de tu cita dental

Mensaje:
Hola {nombre},

Te recordamos tu próxima cita: {fecha_cita}
Tu doctor: {doctor}

¡Te esperamos!

Clínica Sonalia
```

**Resultado:**
```
Email 1:
Subject: Recordatorio de tu cita dental
To: juan@email.com
Body: Hola Juan,
       Te recordamos tu próxima cita: 2025-11-25
       Tu doctor: Dra. María López
       ¡Te esperamos!
       Clínica Sonalia

Email 2:
Subject: Recordatorio de tu cita dental
To: maria@email.com
Body: Hola María,
       Te recordamos tu próxima cita: 2025-12-01
       Tu doctor: Dr. Carlos Ruiz
       ¡Te esperamos!
       Clínica Sonalia
```

---

## 🔧 SOLUCIÓN DE PROBLEMAS

### ❌ "No se pudo conectar al servidor SMTP"

**Causa:** Las credenciales son incorrectas o Gmail tiene seguridad activada.

**Solución:**
1. Verifica que la "App Password" sea correcta en `.env`
2. Asegúrate de tener 2-Step Verification activado
3. Intenta nuevamente

### ❌ "Error: SMTP_USER is undefined"

**Causa:** Las variables de `.env` no se cargaron.

**Solución:**
1. Verifica que existe `.env` en la raíz del proyecto
2. Reinicia la app: `npm run dev`

### ❌ "No hay pacientes en este grupo"

**Causa:** No hay pacientes en la BD con los criterios seleccionados.

**Solución:**
1. Ve a la sección **Pacientes** y agrega algunos
2. Asegúrate de que tengan email en sus datos
3. Vuelve a intentar

### ❌ El email se ve extraño (sin saltos de línea)

**Solución:** En el mensaje usa `\n` o simplemente presiona Enter. El sistema convierte automáticamente a HTML.

---

## 📊 ESTRUCTURA DE BD REQUERIDA

El sistema espera:

```sql
-- Tabla pacientes
CREATE TABLE IF NOT EXISTS pacientes (
  id INTEGER PRIMARY KEY,
  nombre TEXT,
  email TEXT,
  fecha_nacimiento TEXT,
  doctor TEXT,
  ...
);

-- Tabla citas (para filtrar activos/inactivos)
CREATE TABLE IF NOT EXISTS citas (
  id INTEGER PRIMARY KEY,
  paciente_id INTEGER,
  fecha TEXT,
  ...
);
```

**Nota:** Si ya tienes estas tablas, el sistema funcionará automáticamente.

---

## 🔐 SEGURIDAD

⚠️ **IMPORTANTE:**

1. **Nunca hagas commit del `.env`** a Git
2. Agrega `.env` a `.gitignore`:
   ```
   echo .env >> .gitignore
   ```
3. La contraseña "App Password" de Gmail **no es la contraseña normal** (es más segura)
4. En producción, considera usar variables de entorno del sistema

---

## 📈 PRÓXIMAS MEJORAS SUGERIDAS

1. **Historial de campañas:** Guardar cada envío en BD
2. **Plantillas HTML:** Permitir HTML en los emails
3. **Adjuntos:** Soportar archivos adjuntos
4. **Programación:** Agendar envíos para después
5. **Analytics:** Ver tasas de entrega, aperturas, clicks
6. **SMS:** Integrar Twilio u similar para SMS masivos
7. **A/B Testing:** Probar diferentes asuntos

---

## 📞 REFERENCIA RÁPIDA

| Función | Archivo | Línea |
|---------|---------|-------|
| Servicio SMTP | `src/main/email-service.js` | Toda |
| Handlers IPC | `src/main.js` | ~180+ |
| UI Envío | `src/renderer/views/crm.html` | ~270-315 |
| Lógica Frontend | `src/renderer/scripts/crm.js` | Toda |
| API Electron | `src/preload.js` | ~50-55 |

---

**¡Listo! Tu sistema de envío masivo de emails está operativo.** 🎉
