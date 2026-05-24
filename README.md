# Static to Dynamic QRIS API

A lightweight Node.js API for converting static QRIS payloads into dynamic QRIS payloads with a transaction amount.

## Requirements

- Node.js 18 or newer.
- npm.

## Installation

```bash
git clone https://github.com/Rachmad42/qris-static-to-dynamic-api.git
cd qris-static-to-dynamic-api
npm install
```

## Run

```bash
npm start
```

The API runs on:

```text
http://localhost:3000
```

Use a custom port:

```bash
PORT=8080 npm start
```

## API Endpoints

### Health Check

```http
GET /health
```

Response:

```json
{
  "ok": true
}
```

### Convert Static QRIS to Dynamic QRIS

```http
POST /qris/dynamic
Content-Type: application/json
```

Request body:

```json
{
  "qris": "000201010211...6304XXXX",
  "amount": 15000
}
```

Success response:

```json
{
  "ok": true,
  "data": {
    "qris": "000201010212...540515000...6304ABCD",
    "amount": "15000",
    "crcValid": true
  }
}
```

Error response:

```json
{
  "ok": false,
  "error": "Amount must be a number greater than 0."
}
```

Example with `curl`:

```bash
curl -X POST http://localhost:3000/qris/dynamic \
  -H "Content-Type: application/json" \
  -d "{\"qris\":\"000201010211...6304XXXX\",\"amount\":15000}"
```

## Project Structure

```text
.
|-- package.json
|-- package-lock.json
`-- src
    |-- qris.js
    `-- server.js
```

## Core Files

- `src/qris.js` contains QRIS TLV parsing, serialization, amount normalization, dynamic QRIS conversion, and CRC validation.
- `src/server.js` exposes the HTTP API endpoints.

## How QRIS Conversion Works

1. Parse the QRIS payload as EMV TLV data.
2. Remove the old CRC tag `63`.
3. Set tag `01` to `12` for dynamic QRIS.
4. Add or update amount tag `54`.
5. Serialize the TLV payload.
6. Recalculate CRC16 CCITT-FALSE.
7. Append the new CRC tag `63`.

## Notes

- This project validates QRIS CRC format, but it does not verify merchant ownership or payment settlement.
- Use this API with valid QRIS payloads from trusted sources.
- QR image scanning is handled in the website frontend.
- Maximum JSON body size is 5 MB.

## License

MIT
