/**
 * ELENA & LUIS - BODA (VERSIÓN FINAL CORREGIDA)
 */

const SHEET_NAME = "Respuestas";
const RATE_LIMIT_SHEET_NAME = "RateLimit";
const RATE_LIMIT_WINDOW_MINUTES = 30;
const RATE_LIMIT_MAX_REQUESTS = 5;

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return errorResponse("Sin datos");
    }
    const data = JSON.parse(e.postData.contents);

    if (data.honeypot && data.honeypot.trim() !== "") {
      return successResponse();
    }

    if (!data.nombre || data.nombre.length < 2) {
      return errorResponse("Nombre inválido o ausente.");
    }
    if (!data.asistencia) {
      return errorResponse("Debe confirmar asistencia.");
    }

    if (data.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(data.email)) {
        return errorResponse("Formato de email incorrecto.");
      }
    }

    if (isRateLimited(data.nombre, data.email)) {
      return errorResponse("Demasiadas peticiones. Inténtalo en " + RATE_LIMIT_WINDOW_MINUTES + " minutos.");
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet) {
      sheet = ss.insertSheet(SHEET_NAME);
      const headers = [
        "Timestamp", "Nombre", "Telefono", "Email", "Asistencia",
        "Acompanante", "NombreAcompanante", "Ninos", "NombresNinos",
        "Alergias", "MenusInfantiles", "Autobus", "PlazasBus",
        "PuntoBus", "Alojamiento", "Cancion", "Comentarios", "MensajeNoAsiste"
      ];
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    }

    const sanitize = (str) => {
      if (!str) return "";
      return String(str).replace(/</g, "&lt;").replace(/>/g, "&gt;");
    };

    const asiste = data.asistencia === "si";

    const rowData = [
      new Date(),
      sanitize(data.nombre),
      sanitize(data.telefono),
      sanitize(data.email),
      data.asistencia,
      asiste ? (data.acompanante || "") : "",
      asiste ? sanitize(data.nombre_acompanante) : "",
      asiste ? (parseInt(data.ninos) || 0) : 0,
      asiste ? sanitize(data.nombres_ninos) : "",
      asiste ? sanitize(data.alergias) : "",
      asiste ? (parseInt(data.menus_infantiles) || 0) : 0,
      asiste ? (data.autobus || "") : "",
      asiste ? (parseInt(data.plazas_bus) || 0) : 0,
      asiste ? (data.punto_bus || "") : "",
      asiste ? (data.alojamiento || "") : "",
      asiste ? sanitize(data.cancion) : "",
      asiste ? sanitize(data.comentarios) : "",
      !asiste ? sanitize(data.mensaje_no_asiste) : ""
    ];

    sheet.appendRow(rowData);
    logRequest(data.nombre, data.email);

    return successResponse();
  } catch (error) {
    console.error(error);
    return errorResponse("Error interno: " + error.toString());
  }
}

function successResponse() {
  return buildJsonResponse({ success: true });
}

function errorResponse(message) {
  return buildJsonResponse({ success: false, message: message });
}

function buildJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON)
    .setHeaders({
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
}

function doOptions(e) {
  return buildJsonResponse({});
}

function doGet(e) {
  return ContentService.createTextOutput("Acceso denegado.")
    .setMimeType(ContentService.MimeType.TEXT);
}

function logRequest(nombre, email) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(RATE_LIMIT_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(RATE_LIMIT_SHEET_NAME);
    sheet.appendRow(["Timestamp", "Nombre", "Email"]);
  }
  sheet.appendRow([new Date(), nombre || "Anon", email || "Anon"]);
}

function isRateLimited(nombre, email) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(RATE_LIMIT_SHEET_NAME);
  if (!sheet) return false;

  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return false;

  const now = new Date();
  const windowStart = new Date(now.getTime() - RATE_LIMIT_WINDOW_MINUTES * 60 * 1000);

  const recentRequests = data
    .slice(1)
    .filter(row => new Date(row[0]) > windowStart)
    .filter(row => (nombre && row[1] === nombre) || (email && row[2] === email))
    .length;

  return recentRequests >= RATE_LIMIT_MAX_REQUESTS;
}
