/**
 * ELENA & LUIS - SCRIPT DE BODA (SEGURO)
 * 
 * INSTRUCCIONES DE USO:
 * 1. Copia y pega todo este código en tu editor de Google Apps Script.
 * 2. Cambia el valor de SHEET_NAME si tu pestaña tiene otro nombre.
 * 3. Guarda y dale a "Implementar" > "Nueva implementación".
 * 4. Tipo: "Aplicación web". Acceso: "Cualquier persona".
 * 5. Autoriza los permisos si te los pide.
 * 6. Copia la nueva URL y actualiza el archivo rsvp.html en la línea de APPS_SCRIPT_URL.
 */

const SHEET_NAME = "Respuestas"; // Nombre de la pestaña de tu Google Sheet
const ALLOWED_ORIGIN = "*"; // Acepta cualquier origen

// Opcional: Nombre de pestaña para Rate Limiting
const RATE_LIMIT_SHEET_NAME = "RateLimit";

function doPost(e) {
  try {
    // 1. Validar Headers CORS / Origen
    // Google Apps Script no permite leer headers HTTP libremente, pero podemos intentar forzar 
    // la validación en el cliente o retornar headers seguros.
    const headers = {
      "Access-Control-Allow-Origin": "*", // Apps Script fuerza esto a menudo, pero podemos devolver un JSON limpio.
      "Content-Type": "application/json"
    };

    // 2. Parsear los datos del formulario entrante
    if (!e || !e.postData || !e.postData.contents) {
      return errorResponse("Sin datos");
    }
    const data = JSON.parse(e.postData.contents);

    // 3. Verificación de Honeypot (Anti-Bots)
    // Si el bot rellenó el campo honeypot invisible, simulamos éxito pero no guardamos.
    if (data.honeypot && data.honeypot.trim() !== "") {
      console.warn("Spam detectado - honeypot completado");
      return successResponse();
    }

    // 4. Validación Server-Side Obligatoria
    if (!data.nombre || data.nombre.length < 2) {
      return errorResponse("Nombre inválido o ausente.");
    }
    if (!data.asistencia) {
      return errorResponse("Debe confirmar asistencia.");
    }

    // Validación de formato de email (regex en servidor)
    if (data.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(data.email)) {
        return errorResponse("Formato de email incorrecto.");
      }
    }

    // 5. Rate Limiting Simplificado (Basado en el mismo nombre/email reciente)
    // Para evitar que hagan click 100 veces y llenen el sheet.
    if (isRateLimited(data.nombre, data.email)) {
      return errorResponse("Demasiadas peticiones temporales. Inténtalo de nuevo en unos minutos.");
    }

    // 6. Sanitizar y Guardar Datos
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
    if (!sheet) {
      return errorResponse("Error interno del servidor. Hoja no encontrada.");
    }

    // Limpieza básica de HTML
    const sanitize = (str) => {
      if (!str) return "";
      return String(str).replace(/</g, "&lt;").replace(/>/g, "&gt;");
    };

    const rowData = [
      new Date(), // Timestamp
      sanitize(data.nombre),
      sanitize(data.telefono),
      sanitize(data.email),
      data.asistencia,
      sanitize(data.acompanante),
      sanitize(data.nombre_acompanante),
      sanitize(data.nombres_ninos), // Nombres de los niños
      sanitize(data.alergias),
      sanitize(data.autobus),
      parseInt(data.plazas_bus) || 0,
      sanitize(data.punto_bus),
      sanitize(data.alojamiento),
      sanitize(data.cancion),
      sanitize(data.comentarios),
      sanitize(data.mensaje_no_asiste)
    ];

    sheet.appendRow(rowData);

    // Registro de peticiones para Rate Limiting
    logRequest(data.nombre, data.email);

    return successResponse();

  } catch (error) {
    console.error(error);
    return errorResponse("Ocurrió un error inesperado al procesar tu solicitud.");
  }
}

/** Retorna un JSON de error al JS del navegador */
function errorResponse(message) {
  return ContentService.createTextOutput(JSON.stringify({
    success: false,
    message: message
  })).setMimeType(ContentService.MimeType.JSON)
  .setHeaders({
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
}

/** Retorna un JSON de éxito al JS del navegador */
function successResponse() {
  return ContentService.createTextOutput(JSON.stringify({
    success: true
  })).setMimeType(ContentService.MimeType.JSON)
  .setHeaders({
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
}

/** Maneja peticiones OPTIONS (preflight CORS) */
function doOptions() {
  return ContentService.createTextOutput('')
    .setMimeType(ContentService.MimeType.JSON)
    .setHeaders({
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
}

/** Sistema de Rate Limiting Básico en Apps Script */
function logRequest(nombre, email) {
  let ss = SpreadsheetApp.getActiveSpreadsheet();
  let rateSheet = ss.getSheetByName(RATE_LIMIT_SHEET_NAME);

  // Si no existe la pestaña RateLimit, la creamos (solo se ejecuta 1 vez)
  if (!rateSheet) {
    rateSheet = ss.insertSheet(RATE_LIMIT_SHEET_NAME);
    rateSheet.appendRow(["Timestamp", "Nombre", "Email"]);
  }

  rateSheet.appendRow([new Date(), nombre || "Anon", email || "Anon"]);
}

function isRateLimited(nombre, email) {
  let ss = SpreadsheetApp.getActiveSpreadsheet();
  let rateSheet = ss.getSheetByName(RATE_LIMIT_SHEET_NAME);
  if (!rateSheet) return false;

  const data = rateSheet.getDataRange().getValues();
  if (data.length <= 1) return false;

  const now = new Date();
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const recentRequests = data
    .slice(1)
    .filter(row => new Date(row[0]) > twentyFourHoursAgo)
    .filter(row => (nombre && row[1] === nombre) || (email && row[2] === email))
    .length;

  return recentRequests >= 3;
}

/**
 * Elimina registros de rate limiting con más de 24 horas de antigüedad.
 * Ejecutar una vez al día mediante un trigger programado.
 */
function cleanOldRateLimitEntries() {
  let ss = SpreadsheetApp.getActiveSpreadsheet();
  let rateSheet = ss.getSheetByName(RATE_LIMIT_SHEET_NAME);
  if (!rateSheet) return;

  const data = rateSheet.getDataRange().getValues();
  if (data.length <= 1) return;

  const now = new Date();
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const rowsToDelete = [];
  for (let i = data.length - 1; i >= 1; i--) {
    const reqDate = new Date(data[i][0]);
    if (reqDate < twentyFourHoursAgo) {
      rowsToDelete.push(i + 1);
    }
  }

  rowsToDelete.forEach(rowIndex => rateSheet.deleteRow(rowIndex));
}

/**
 * Crea un trigger diario para ejecutar cleanOldRateLimitEntries.
 * Ejecutar esta función manualmente una vez en el editor de Apps Script.
 */
function createDailyTrigger() {
  const triggers = ScriptApp.getProjectTriggers();
  const existingTrigger = triggers.find(t => t.getHandlerFunction() === 'cleanOldRateLimitEntries');

  if (existingTrigger) {
    Logger.log('El trigger diario ya existe.');
    return;
  }

  ScriptApp.newTrigger('cleanOldRateLimitEntries')
    .timeBased()
    .everyDays(1)
    .atHour(3)
    .create();

  Logger.log('Trigger diario creado exitosamente. Se ejecutará todos los días a las 3 AM.');
}

// Para evitar problemas con métodos GET o preflight OPTIONS
function doGet(e) {
  return ContentService.createTextOutput("Acceso denegado.")
    .setMimeType(ContentService.MimeType.TEXT);
}

function doOptions(e) {
  return ContentService.createTextOutput("")
    .setMimeType(ContentService.MimeType.TEXT);
}
