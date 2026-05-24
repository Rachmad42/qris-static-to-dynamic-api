"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { isValidCrc, parseTlv, toDynamicQris } = require("../src/qris");

const STATIC_QRIS =
  "00020101021126570011ID.DANA.WWW011893600915311570466202091157046620303UMI51440014ID.CO.QRIS.WWW0215ID10210639999940303UMI5204481453033605802ID5915RD STORE.ONLINE6015Kab. Kulon Prog6105556536304E19A";

test("validates a static QRIS payload", () => {
  const fields = parseTlv(STATIC_QRIS);

  assert.equal(isValidCrc(STATIC_QRIS), true);
  assert.equal(fields.find((field) => field.id === "01")?.value, "11");
  assert.equal(fields.find((field) => field.id === "58")?.value, "ID");
  assert.equal(fields.find((field) => field.id === "59")?.value, "RD STORE.ONLINE");
});

test("converts a static QRIS payload into a dynamic QRIS payload with amount", () => {
  const dynamicQris = toDynamicQris(STATIC_QRIS, 15000);
  const fields = parseTlv(dynamicQris);

  assert.equal(isValidCrc(dynamicQris), true);
  assert.equal(fields.find((field) => field.id === "01")?.value, "12");
  assert.equal(fields.find((field) => field.id === "54")?.value, "15000");
  assert.equal(fields.at(-1)?.id, "63");
});
