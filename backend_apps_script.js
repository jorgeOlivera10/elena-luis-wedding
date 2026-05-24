/**
 * ELENA & LUIS - SCRIPT DE BODA (SIN VALIDACIÓN DE EMAIL)
 * 
 * INSTRUCCIONES:
 * 1. Copia y pega en el editor de Google Apps Script.
 * 2. Asegúrate de que la hoja se llame "Respuestas" (o cambia SHEET_NAME).
 * 3. Implementar > Nueva implementación > Aplicación web.
 * 4. Ejecutar como: Yo, Acceso: Cualquier persona.
 * 5. Autoriza y copia la URL para usarla en rsvp.html.
 */

const SHEET_NAME = "Respuestas";
const RATE_LIMIT_SHEET_NAME = "RateLimit";

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return errorResponse("Sin datos");
    }
    const data = JSON.parse(e.postData.contents);

    if (data.honeypot && data.honeypot.trim() !== "") {
      console.warn("Spam detectado - honeypot completado");
      return successResponse();
    }

    if (!data.nombre || data.nombre.length < 2) {
      return errorResponse("Nombre inválido o ausente.");
    }
    if (!data.asistencia) {
      return errorResponse("Debe confirmar asistencia.");
    }

    const numNinos = parseInt(data.ninos) || 0;
    if (numNinos > 10 || numNinos < 0) {
      return errorResponse("Cantidad de acompañantes infantiles inválida.");
    }

    if (isRateLimited(data.nombre, data.email)) {
      return errorResponse("Demasiadas peticiones. Inténtalo en unos minutos.");
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet) {
      sheet = ss.insertSheet(SHEET_NAME);
      const headers = [
        "Timestamp", "Nombre", "Telefono", "Email", "Asistencia",
        "Acompanante", "NombreAcompanante", "Ninos", "NombresNinos",
        "Alergias", "Autobus", "PlazasBus", "PuntoBus",
        "Alojamiento", "Cancion", "Comentarios", "MensajeNoAsiste"
      ];
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    }

    const sanitize = (str) => {
      if (!str) return "";
      return String(str).replace(/</g, "&lt;").replace(/>/g, "&gt;");
    };

    const asiste = data.asistencia === "si";
    const plazas = asiste ? (parseInt(data.plazas_bus) || 0) : 0;

    const rowData = [
      new Date(),
      sanitize(data.nombre),
      sanitize(data.telefono),
      sanitize(data.email),
      data.asistencia,
      asiste ? (data.acompanante || "") : "",
      asiste ? sanitize(data.nombre_acompanante) : "",
      numNinos,
      asiste ? sanitize(data.nombres_ninos) : "",
      asiste ? sanitize(data.alergias) : "",
      asiste ? (data.autobus || "") : "",
      plazas,
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
  return corsResponse(JSON.stringify({ success: true }));
}

function errorResponse(message) {
  return corsResponse(JSON.stringify({ success: false, message: message }));
}

function corsResponse(dataString) {
  const output = ContentService.createTextOutput(dataString);
  output.setMimeType(ContentService.MimeType.JSON);
  output.setHeader("Access-Control-Allow-Origin", "*");
  output.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  output.setHeader("Access-Control-Allow-Headers", "Content-Type");
  output.setHeader("Access-Control-Max-Age", "86400");
  return output;
}

function doOptions(e) {
  return corsResponse("");
}

function doGet(e) {
  return ContentService.createTextOutput("Acceso denegado.")
    .setMimeType(ContentService.MimeType.TEXT);
}

function logRequest(nombre, email) {
  let ss = SpreadsheetApp.getActiveSpreadsheet();
  let rateSheet = ss.getSheetByName(RATE_LIMIT_SHEET_NAME);
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
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

  const recentRequests = data
    .slice(1)
    .filter(row => new Date(row[0]) > oneHourAgo)
    .filter(row => (nombre && row[1] === nombre) || (email && row[2] === email))
    .length;

  return recentRequests >= 5;
}

function cleanOldRateLimitEntries() {
  let ss = SpreadsheetApp.getActiveSpreadsheet();
  let rateSheet = ss.getSheetByName(RATE_LIMIT_SHEET_NAME);
  if (!rateSheet) return;

  const data = rateSheet.getDataRange().getValues();
  if (data.length <= 1) return;

  const now = new Date();
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  for (let i = data.length - 1; i >= 1; i--) {
    if (new Date(data[i][0]) < twentyFourHoursAgo) {
      rateSheet.deleteRow(i + 1);
    }
  }
}

function createDailyTrigger() {
  const triggers = ScriptApp.getProjectTriggers();
  const existing = triggers.find(t => t.getHandlerFunction() === 'cleanOldRateLimitEntries');
  if (!existing) {
    ScriptApp.newTrigger('cleanOldRateLimitEntries')
      .timeBased()
      .everyDays(1)
      .atHour(3)
      .create();
  }
}
