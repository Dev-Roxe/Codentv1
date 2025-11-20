# 📧 SISTEMA DE ENVÍO MASIVO DE EMAILS - QUICK REFERENCE

## 🚀 COMENZAR EN 2 MINUTOS

### 1️⃣ Configura Gmail
```
Settings → Security → 2-Step Verification → ON
Settings → Security → App passwords → Genera nueva → Copia
```

### 2️⃣ Actualiza `.env`
```env
SMTP_USER=tu-email@gmail.com
SMTP_PASSWORD=xxxxxxxxxxxxxxxx  # 16 caracteres que copiaste
```

### 3️⃣ Reinicia
```powershell
npm run dev
```

### 4️⃣ Usa
App → Pacientes → Email Marketing → Selecciona grupo → Envía

---

## 📂 ARCHIVOS CLAVE

| Archivo | Qué Hace |
|---------|----------|
| `.env` | Credenciales SMTP |
| `src/main/email-service.js` | Lógica de emails |
| `src/renderer/scripts/crm.js` | UI frontend |
| `src/renderer/views/crm.html` | Formulario |
| `GUIA_EMAIL_MASIVO.md` | **Lee esto primero** |

---

## 🔥 PROBLEMAS COMUNES

| Error | Solución |
|-------|----------|
| "Cannot find module" | Verifica rutas en `require()` |
| "SMTP_USER undefined" | Copia `.env`, reinicia |
| "Connection timeout" | Port debe ser 465 (o 587) |
| "Auth failed" | Usa App Password (no contraseña normal) |
| "Sin pacientes" | BD debe tener tabla `pacientes` con emails |

---

## 📖 DOCUMENTACIÓN

- **GUIA_EMAIL_MASIVO.md** ← Cómo usar
- **NOTAS_TECNICAS.md** ← Arquitectura profunda
- **CHECKLIST_TROUBLESHOOTING.md** ← Errores + tests
- **RESUMEN_EJECUTIVO.md** ← Overview completo

---

## 💾 ESTRUCTURA DE BD REQUERIDA

```sql
CREATE TABLE pacientes (
  id INTEGER PRIMARY KEY,
  nombre TEXT,
  email TEXT,
  fecha_nacimiento TEXT,
  doctor TEXT
);
```

---

## ⚙️ VARIABLES DISPONIBLES

- `{nombre}` → Nombre del paciente
- `{fecha_cita}` → Fecha (o nacimiento)
- `{doctor}` → Médico asignado

---

## 🧪 TEST RÁPIDO

```powershell
# Verifica instalación
npm list nodemailer

# Verifica .env
cat .env

# Inicia
npm run dev
```

---

**¡Listo! Ahora abre `GUIA_EMAIL_MASIVO.md` para instrucciones detalladas.** 📖
