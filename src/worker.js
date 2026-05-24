"use strict";

import qris from "./qris.js";

const { isValidCrc, normalizeAmount, toDynamicQris } = qris;
const MAX_BODY_SIZE = 5 * 1024 * 1024;

function jsonResponse(payload, status = 200) {
  return new Response(status === 204 ? null : JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

async function readJsonBody(request) {
  const contentLength = Number(request.headers.get("content-length") || 0);

  if (contentLength > MAX_BODY_SIZE) {
    throw new Error("Request body is too large.");
  }

  const bodyText = await request.text();

  if (bodyText.length > MAX_BODY_SIZE) {
    throw new Error("Request body is too large.");
  }

  if (!bodyText) {
    return {};
  }

  try {
    return JSON.parse(bodyText);
  } catch {
    throw new Error("Request body must be valid JSON.");
  }
}

async function handleRequest(request) {
  const url = new URL(request.url);

  if (request.method === "OPTIONS") {
    return jsonResponse({}, 204);
  }

  if (request.method === "GET" && url.pathname === "/health") {
    return jsonResponse({ ok: true });
  }

  if (request.method === "POST" && url.pathname === "/qris/dynamic") {
    try {
      const body = await readJsonBody(request);
      const amount = normalizeAmount(body.amount);
      const dynamicQris = toDynamicQris(body.qris, body.amount);

      return jsonResponse({
        ok: true,
        data: {
          qris: dynamicQris,
          amount,
          crcValid: isValidCrc(dynamicQris),
        },
      });
    } catch (error) {
      return jsonResponse(
        {
          ok: false,
          error: error.message,
        },
        400
      );
    }
  }

  return jsonResponse(
    {
      ok: false,
      error: "Endpoint not found.",
    },
    404
  );
}

export default {
  fetch(request) {
    return handleRequest(request).catch((error) =>
      jsonResponse(
        {
          ok: false,
          error: error.message,
        },
        500
      )
    );
  },
};
