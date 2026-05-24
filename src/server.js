"use strict";

const http = require("http");
const { toDynamicQris, isValidCrc, normalizeAmount } = require("./qris");

const PORT = Number(process.env.PORT || 3000);
const MAX_BODY_SIZE = 5 * 1024 * 1024;

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  response.end(JSON.stringify(payload));
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";

    request.on("data", (chunk) => {
      body += chunk;

      if (body.length > MAX_BODY_SIZE) {
        request.destroy();
        reject(new Error("Request body is too large."));
      }
    });

    request.on("end", () => {
      if (!body) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error("Request body must be valid JSON."));
      }
    });

    request.on("error", reject);
  });
}

async function handleRequest(request, response) {
  const url = new URL(request.url, `http://${request.headers.host}`);

  if (request.method === "OPTIONS") {
    sendJson(response, 204, {});
    return;
  }

  if (request.method === "GET" && url.pathname === "/health") {
    sendJson(response, 200, { ok: true });
    return;
  }

  if (request.method === "POST" && url.pathname === "/qris/dynamic") {
    try {
      const body = await readJsonBody(request);
      const amount = normalizeAmount(body.amount);
      const dynamicQris = toDynamicQris(body.qris, body.amount);

      sendJson(response, 200, {
        ok: true,
        data: {
          qris: dynamicQris,
          amount,
          crcValid: isValidCrc(dynamicQris),
        },
      });
    } catch (error) {
      sendJson(response, 400, {
        ok: false,
        error: error.message,
      });
    }

    return;
  }

  sendJson(response, 404, {
    ok: false,
    error: "Endpoint not found.",
  });
}

const server = http.createServer((request, response) => {
  handleRequest(request, response).catch((error) => {
    sendJson(response, 500, {
      ok: false,
      error: error.message,
    });
  });
});

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`QRIS API is running at http://localhost:${PORT}`);
  });
}

module.exports = server;
