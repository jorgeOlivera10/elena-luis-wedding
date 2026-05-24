# 📋 Sistema de Backup de Datos - Boda Elena & Luis

## 🔒 Resumen
Los datos de los invitados se almacenan en **Google Sheets** mediante Google Apps Script. Este documento explica cómo hacer backup y asegurar la información.

---

## 🗄️ Arquitectura Actual

```
Formulario RSVP → Google Apps Script → Google Sheets ("Respuestas")
                          ↓
                    Rate Limit Sheet ("RateLimit")
```

---

## 📊 Estructura de Datos

### Hoja "Respuestas"
| Columna | Campo |
|---------|-------|
| A | Timestamp |
| B | Nombre |
| C | Teléfono |
| D | Email |
| E | Asistencia (si/no) |
| F | Acompañante (si/no) |
| G | Nombre acompañante |
| H | Número de niños |
| I | Nombres y edades niños |
| J | Alergias |
| K | Autobús |
| L | Plazas bus |
| M | Punto bus |
| N | Alojamiento |
| O | Canción |
| P | Comentarios |
| Q | Mensaje si no asiste |

---

## 🔄 Opciones de Backup

### Opción 1: Backup Manual (Recomendado semanal)
1. Abrir Google Sheets con las respuestas
2. Archivo → Descargar → Microsoft Excel (.xlsx)
3. Guardar en: `backups/respuestas_YYYY-MM-DD.xlsx`
4. También descargar como CSV para compatibilidad

### Opción 2: Backup Automático con Google Apps Script
Añadir esta función al backend:

```javascript
function backupData() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Respuestas");
  const data = sheet.getDataRange().getValues();
  
  // Crear fecha para nombre único
  const date = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd");
  
  // Crear archivo CSV en Google Drive
  const csv = data.map(row => row.join(",")).join("\n");
  const fileName = `backup_respuestas_${date}.csv`;
  
  // Guardar en carpeta específica (crear primero "Backups Boda")
  const folder = DriveApp.getFoldersByName("Backups Boda").next();
  folder.createFile(fileName, csv, MimeType.CSV);
}

// Programar trigger: Editar proyecto → Activadores → Añadir trigger
// Ejecutar: backupData
// Eventos de fuente: Basado en tiempo
// Tipo de activador: Diario (elegir hora, ej: 2:00 AM)
```

### Opción 3: Sincronización con Herramientas Externas
- **Zapier**: Conectar Google Sheets con Dropbox/Drive automáticamente
- **Make (Integromat)**: Flujos de automatización más complejos
- **Google Drive Backup and Sync**: Sincronización local automática

---

## 🛡️ Medidas de Seguridad Recomendadas

1. **Activar autenticación de dos factores** en la cuenta de Google
2. **No compartir** la URL del Apps Script (`APPS_SCRIPT_URL`)
3. **Revisar permisos** del Google Sheets regularmente
4. **Eliminar datos** 30 días después del evento (cumplimiento RGPD ya implementado)

---

## 📧 Notificaciones (Opcional)

Para recibir email cada vez que alguien confirma, añadir al `doPost()`:

```javascript
function sendNotificationEmail(data) {
  const subject = `Nueva confirmación: ${data.nombre}`;
  const body = `
    Nuevo invitado: ${data.nombre}
    Asistencia: ${data.asistencia}
    Acompañantes: ${data.acompanante === 'si' ? data.nombre_acompanante : 'Ninguno'}
    Autobús: ${data.autobus || 'No'}
    Ver en: https://docs.google.com/spreadsheets/d/[ID]/edit
  `;
  
  MailApp.sendEmail('tu-email@gmail.com', subject, body);
}
```

---

## ⚠️ Plan de Contingencia

Si el sistema falla:
1. **Formulario de emergencia**: Preparar formulario de Google Forms como backup
2. **Contacto telefónico**: Añadir número de contacto para confirmaciones por teléfono
3. **Lista manual**: Llevar lista impresa el día de la boda con todas las confirmaciones

---

## 📅 Checklist de Backup

- [ ] Descargar backup inicial antes de enviar invitaciones
- [ ] Configurar backup automático semanal
- [ ] Probar restauración de datos (abrir archivo descargado)
- [ ] Verificar que RateLimit no bloquee invitados legítimos
- [ ] Crear copia final 1 día antes de la boda

---

**Última actualización:** Mayo 2026  
**Responsable:** Jorge (desarrollador)
