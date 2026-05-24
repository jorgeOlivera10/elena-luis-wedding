/**
 * ELENA & LUIS - BODA (CON LOGS DETALLADOS)
 */

const SHEET_NAME = "Respuestas";
const RATE_LIMIT_SHEET_NAME = "RateLimit";
const RATE_LIMIT_WINDOW_MINUTES = 30;
const RATE_LIMIT_MAX_REQUESTS = 5;

function doPost(e) {
  console.log("🚀 [INICIO] doPost ejecutado");

  try {
    if (!e || !e.postData || !e.postData.contents) {
      console.error("❌ [ERROR] No hay postData.contents");
      return errorResponse("Sin datos");
    }
    console.log("📥 [RAW] Contenido crudo:", e.postData.contents);

    const data = JSON.parse(e.postData.contents);
    console.log("📦 [PARSED] Datos recibidos:", JSON.stringify(data));

    if (data.honeypot && data.honeypot.trim() !== "") {
      console.log("🕵️ [HONEYPOT] Activado");
      return successResponse();
    }

    if (!data.nombre || data.nombre.length < 2) {
      console.warn("⚠️ [VALID] Nombre inválido:", data.nombre);
      return errorResponse("Nombre inválido o ausente.");
    }
    if (!data.asistencia) {
      console.warn("⚠️ [VALID] Asistencia no seleccionada");
      return errorResponse("Debe confirmar asistencia.");
    }
    console.log("✅ [VALID] Asistencia =", data.asistencia);

    if (data.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(data.email)) {
        console.warn("⚠️ [VALID] Email incorrecto:", data.email);
        return errorResponse("Formato de email incorrecto.");
      }
    }

    if (isRateLimited(data.nombre, data.email)) {
      console.warn("⏱️ [RATE] Límite excedido para", data.nombre);
      return errorResponse("Demasiadas peticiones. Inténtalo en " + RATE_LIMIT_WINDOW_MINUTES + " minutos.");
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    console.log("📊 [SHEET] Spreadsheet:", ss.getName());

    let sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet) {
      console.log("📄 [SHEET] Creando hoja 'Respuestas'...");
      sheet = ss.insertSheet(SHEET_NAME);
      const headers = [
        "Timestamp", "Nombre", "Telefono", "Email", "Asistencia",
        "Acompanante", "NombreAcompanante", "Ninos", "NombresNinos",
        "Alergias", "MenusInfantiles", "Autobus", "PlazasBus",
        "PuntoBus", "Alojamiento", "Cancion", "Comentarios", "MensajeNoAsiste"
      ];
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    } else {
      console.log("📊 [SHEET] Columnas actuales:", sheet.getLastColumn());
    }

    const sanitize = (str) => {
      if (!str) return "";
      return String(str).replace(/</g, "&lt;").replace(/>/g, "&gt;");
    };

    const asiste = data.asistencia === "si";
    console.log("🧩 [LOGIC] asiste =", asiste);

    const ninosNum = asiste ? (parseInt(data.ninos) || 0) : 0;
    const menus = asiste ? (parseInt(data.menus_infantiles) || 0) : 0;
    const plazas = asiste ? (parseInt(data.plazas_bus) || 0) : 0;

    const rowData = [
      new Date(),
      sanitize(data.nombre),
      sanitize(data.telefono),
      sanitize(data.email),
      data.asistencia,
      asiste ? (data.acompanante || "") : "",
      asiste ? sanitize(data.nombre_acompanante) : "",
      ninosNum,
      asiste ? sanitize(data.nombres_ninos) : "",
      asiste ? sanitize(data.alergias) : "",
      menus,
      asiste ? (data.autobus || "") : "",
      plazas,
      asiste ? (data.punto_bus || "") : "",
      asiste ? (data.alojamiento || "") : "",
      asiste ? sanitize(data.cancion) : "",
      asiste ? sanitize(data.comentarios) : "",
      !asiste ? sanitize(data.mensaje_no_asiste) : ""
    ];

    console.log("✅ [BUILD] rowData:", JSON.stringify(rowData));

    sheet.appendRow(rowData);
    console.log("🎉 [APPEND] Fila añadida con éxito");

    logRequest(data.nombre, data.email);
    console.log("✅ [FIN] Devolviendo success");

    return successResponse();

  } catch (error) {
    console.error("💥 [EXCEPCIÓN]:", error.toString());
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
  const output = ContentService.createTextOutput("");
  output.setMimeType(ContentService.MimeType.TEXT);
  output.setHeader("Access-Control-Allow-Origin", "*");
  output.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  output.setHeader("Access-Control-Allow-Headers", "Content-Type");
  output.setHeader("Access-Control-Max-Age", "86400");
  return output;
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
