"use strict";

const { Jimp } = require("jimp");
const jsQR = require("jsqr");

function stripDataUrlPrefix(base64) {
  return base64.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, "");
}

function imageBufferFromBase64(imageBase64) {
  if (typeof imageBase64 !== "string" || imageBase64.trim() === "") {
    throw new Error("imageBase64 must be a non-empty base64 string.");
  }

  return Buffer.from(stripDataUrlPrefix(imageBase64.trim()), "base64");
}

async function detectQrFromImageBuffer(imageBuffer) {
  if (!Buffer.isBuffer(imageBuffer) || imageBuffer.length === 0) {
    throw new Error("Image buffer must not be empty.");
  }

  const image = await Jimp.read(imageBuffer);
  const { data, width, height } = image.bitmap;
  const clampedData = new Uint8ClampedArray(
    data.buffer,
    data.byteOffset,
    data.byteLength
  );
  const result = jsQR(clampedData, width, height);

  if (!result) {
    throw new Error("No QR code was detected in the image.");
  }

  return {
    text: result.data,
    location: result.location,
  };
}

async function detectQrFromBase64(imageBase64) {
  return detectQrFromImageBuffer(imageBufferFromBase64(imageBase64));
}

module.exports = {
  detectQrFromBase64,
  detectQrFromImageBuffer,
  imageBufferFromBase64,
};
