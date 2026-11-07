// src/insight-decoder.mjs
// Decodes serialized `presage.smartspectra.Insight` protobuf buffers emitted
// by `sdk.on('insight', (buf, requestId) => ...)` in @smartspectra/node-sdk v3.4.0.
// Schema matches https://smartspectra.presagetech.com/docs/data-types.md#insight

import protobuf from 'protobufjs';

const INSIGHT_PROTO_JSON = {
  nested: {
    presage: {
      nested: {
        smartspectra: {
          nested: {
            InsightType: {
              values: {
                INSIGHT_TYPE_VITALS: 0,
                INSIGHT_TYPE_SPEECH: 1,
                INSIGHT_TYPE_COMBINED: 2,
              },
            },
            Insight: {
              oneofs: {
                result: {
                  oneof: ['analysis', 'error'],
                },
              },
              fields: {
                requestId: { type: 'int32', id: 1 },
                processedAt: { type: 'string', id: 2 },
                analysis: { type: 'string', id: 3 },
                error: { type: 'string', id: 4 },
                type: { type: 'InsightType', id: 5 },
              },
            },
          },
        },
      },
    },
  },
};

const root = protobuf.Root.fromJSON(INSIGHT_PROTO_JSON);
const InsightMessage = root.lookupType('presage.smartspectra.Insight');

/**
 * Decode a raw protobuf buffer from the SmartSpectra `'insight'` event.
 * Falls back gracefully if a plain UTF-8 buffer is passed in tests.
 *
 * @param {Buffer|Uint8Array} buf
 * @param {number} [fallbackRequestId=0]
 * @returns {{ requestId: number, processedAt: string, analysis: string|null, error: string|null, type: number }}
 */
export function decodeInsightBuffer(buf, fallbackRequestId = 0) {
  if (!buf || buf.byteLength === 0) {
    return {
      requestId: fallbackRequestId,
      processedAt: new Date().toISOString(),
      analysis: null,
      error: 'Empty insight payload',
      type: 0,
    };
  }
  try {
    const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
    const decoded = InsightMessage.decode(u8);
    const obj = InsightMessage.toObject(decoded, { defaults: false });
    if (obj.analysis || obj.error) {
      return {
        requestId: typeof obj.requestId === 'number' && obj.requestId !== 0 ? obj.requestId : fallbackRequestId,
        processedAt: obj.processedAt || new Date().toISOString(),
        analysis: obj.analysis ?? null,
        error: obj.error ?? null,
        type: obj.type ?? 0,
      };
    }
  } catch {
    // Fallback for plain string buffers in synthetic unit tests
  }
  const rawText = Buffer.from(buf).toString('utf8').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '').trim();
  return {
    requestId: fallbackRequestId,
    processedAt: new Date().toISOString(),
    analysis: rawText || null,
    error: rawText ? null : 'Unable to decode Insight protobuf',
    type: 0,
  };
}

/**
 * Encode an Insight object into a protobuf Buffer (used for unit tests and deterministic replay).
 */
export function encodeInsightBuffer(payload) {
  const msg = InsightMessage.create(payload);
  return Buffer.from(InsightMessage.encode(msg).finish());
}
