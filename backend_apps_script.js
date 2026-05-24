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
const ALLOWED_ORIGIN = "https://entreviñasymontañas.com"; // Tu dominio real

// Opcional: Nombre de pestaña para Rate Limiting
const RATE_LIMIT_SHEET_NAME = "RateLimit";

function doPost(e) {
  try {
    // 1. Parsear los datos del formulario entrante
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

    // Validación de excesos (ej: no más de 10 niños)
    const numNinos = parseInt(data.ninos) || 0;
    if (numNinos > 10 || numNinos < 0) {
      return errorResponse("Cantidad de acompañantes infantiles inválida.");
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
      numNinos,
      sanitize(data.nombres_ninos), // Nombres y edades de los niños
      sanitize(data.alergias),
      parseInt(data.menus_infantiles) || 0,
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
  })).setMimeType(ContentService.MimeType.JSON);
}

/** Retorna un JSON de éxito al JS del navegador */
function successResponse() {
  return ContentService.createTextOutput(JSON.stringify({
    success: true
  })).setMimeType(ContentService.MimeType.JSON);
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

  // Borrar registros antiguos para no llenar la pestaña (ej: más de 20 min de antigüedad)
  const data = rateSheet.getDataRange().getValues();
  if (data.length <= 1) return false;

  const now = new Date();
  const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000); // 30 minutos

  const recentRequests = data
    .slice(1)
    .filter(row => new Date(row[0]) > thirtyMinutesAgo)
    .filter(row => (nombre && row[1] === nombre) || (email && row[2] === email))
    .length;

  // Si ha enviado más de 3 peticiones en 30 minutos con el mismo nombre/email, bloqueamos
  return recentRequests >= 3;
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
