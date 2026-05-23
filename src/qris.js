"use strict";

const CRC_TAG = "63";
const AMOUNT_TAG = "54";
const COUNTRY_TAG = "58";
const INITIATION_METHOD_TAG = "01";
const DYNAMIC_INITIATION_METHOD = "12";

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

  for (let i = 0; i < input.length; i += 1) {
    crc ^= input.charCodeAt(i) << 8;

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

module.exports = {
  crc16CcittFalse,
  isValidCrc,
  normalizeAmount,
  parseTlv,
  serializeTlv,
  toDynamicQris,
};
