"use strict";

const CRC_TAG = "63";
const AMOUNT_TAG = "54";
const COUNTRY_TAG = "58";
const INITIATION_METHOD_TAG = "01";
const DYNAMIC_INITIATION_METHOD = "12";
const MAX_BODY_SIZE = 5 * 1024 * 1024;

function parseTlv(payload) {
  if (typeof payload !== "string" || payload.trim() === "") {
    throw new Error("QRIS must be a non-empty string.");
  }

  const input = payload.trim();
  const fields = [];
  let index = 0;

  while (index < input.length) {
    const id = input.slice(index, index + 2);
    const lengthText = input.slice(index + 2, index + 4);

    if (!/^\d{2}$/.test(id) || !/^\d{2}$/.test(lengthText)) {
      throw new Error(`Invalid TLV format at position ${index}.`);
    }

    const length = Number(lengthText);
    const valueStart = index + 4;
    const valueEnd = valueStart + length;

    if (valueEnd > input.length) {
      throw new Error(`Tag ${id} value length exceeds QRIS length.`);
    }

    fields.push({
      id,
      value: input.slice(valueStart, valueEnd),
    });

    index = valueEnd;
  }

  return fields;
}

function serializeTlv(fields) {
  return fields
    .map(({ id, value }) => {
      const text = String(value);
      const length = text.length;

      if (length > 99) {
        throw new Error(`Tag ${id} value is too long.`);
      }

      return `${id}${String(length).padStart(2, "0")}${text}`;
    })
    .join("");
}

function normalizeAmount(amount) {
  if (amount === null || amount === undefined || amount === "") {
    throw new Error("Amount is required.");
  }

  const numericAmount =
    typeof amount === "number" ? amount : Number(String(amount).trim());

  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    throw new Error("Amount must be a number greater than 0.");
  }

  if (numericAmount > 9999999999999) {
    throw new Error("Amount is too large.");
  }

  if (Number.isInteger(numericAmount)) {
    return String(numericAmount);
  }

  return numericAmount.toFixed(2).replace(/\.?0+$/, "");
}

function crc16CcittFalse(input) {
  let crc = 0xffff;

  for (let index = 0; index < input.length; index += 1) {
    crc ^= input.charCodeAt(index) << 8;

    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
      crc &= 0xffff;
    }
  }

  return crc.toString(16).toUpperCase().padStart(4, "0");
}

function upsertField(fields, id, value, beforeId) {
  const existingIndex = fields.findIndex((field) => field.id === id);

  if (existingIndex >= 0) {
    fields[existingIndex] = { id, value };
    return fields;
  }

  const beforeIndex = fields.findIndex((field) => field.id === beforeId);

  if (beforeIndex >= 0) {
    fields.splice(beforeIndex, 0, { id, value });
    return fields;
  }

  fields.push({ id, value });
  return fields;
}

function toDynamicQris(staticQris, amount) {
  const amountText = normalizeAmount(amount);
  const fields = parseTlv(staticQris).filter((field) => field.id !== CRC_TAG);

  upsertField(
    fields,
    INITIATION_METHOD_TAG,
    DYNAMIC_INITIATION_METHOD,
    AMOUNT_TAG
  );
  upsertField(fields, AMOUNT_TAG, amountText, COUNTRY_TAG);

  const withoutCrc = serializeTlv(fields);
  const crcInput = `${withoutCrc}${CRC_TAG}04`;
  const crc = crc16CcittFalse(crcInput);

  return `${crcInput}${crc}`;
}

function isValidCrc(qris) {
  const fields = parseTlv(qris);
  const crcField = fields[fields.length - 1];

  if (!crcField || crcField.id !== CRC_TAG || crcField.value.length !== 4) {
    return false;
  }

  const payloadWithoutCrcValue = qris.trim().slice(0, -4);
  return crc16CcittFalse(payloadWithoutCrcValue) === crcField.value.toUpperCase();
}

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

  if (request.method === "POST" && url.pathname === "/qris/detect") {
    return jsonResponse(
      {
        ok: false,
        error:
          "QR image detection is not available on the Cloudflare Worker build. Use the text QRIS input or run the Node.js API for image detection.",
      },
      501
    );
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
