/**
 * Webhook server — lightweight HTTP listener for Zerion transaction notifications.
 *
 * Uses Node.js built-in `http` module — zero dependencies.
 *
 * Verification implements the exact Zerion-documented flow:
 *   1. Read x-timestamp, x-signature, x-certificate-url headers
 *   2. Validate certificate URL domain (must be *.zerion.io)
 *   3. Build signing string: `${timestamp}\n${rawBody}\n`
 *   4. Fetch certificate from URL (cached)
 *   5. Verify RSA-SHA256 signature using crypto.createVerify("SHA256")
 *
 * Valid webhooks are passed to an onTrigger callback.
 * The server returns 200 immediately and processes async.
 */

import { createServer } from "node:http";
import { createVerify } from "node:crypto";
import { logAuditEvent } from "./audit-log.js";

const TRUSTED_CERT_DOMAIN = ".zerion.io";
const certCache = new Map();

/**
 * Validate that the certificate URL is on a trusted Zerion domain.
 * Prevents SSRF attacks.
 * @param {string} certUrl
 * @returns {boolean}
 */
export function isValidCertificateUrl(certUrl) {
  try {
    const url = new URL(certUrl);
    return url.hostname.endsWith(TRUSTED_CERT_DOMAIN) && url.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Fetch a certificate from URL with caching.
 * @param {string} certUrl
 * @returns {Promise<string>} PEM certificate
 */
async function fetchCertificate(certUrl) {
  if (certCache.has(certUrl)) return certCache.get(certUrl);

  if (!isValidCertificateUrl(certUrl)) {
    throw new Error(`Untrusted certificate domain: ${certUrl}`);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  const res = await fetch(certUrl, { signal: controller.signal });
  clearTimeout(timer);

  if (!res.ok) throw new Error(`Failed to fetch certificate: ${res.status}`);
  const pem = await res.text();
  certCache.set(certUrl, pem);
  return pem;
}

/**
 * Verify a webhook request signature.
 * @param {string} timestamp - x-timestamp header
 * @param {string} rawBody   - raw request body string
 * @param {string} signature - x-signature header (base64)
 * @param {string} certUrl   - x-certificate-url header
 * @returns {Promise<boolean>}
 */
export async function verifyWebhookSignature(timestamp, rawBody, signature, certUrl) {
  if (!timestamp || !rawBody || !signature || !certUrl) return false;

  let pem;
  try {
    pem = await fetchCertificate(certUrl);
  } catch (err) {
    // If cert fetch failed, try clearing cache and re-fetching (rotation)
    certCache.delete(certUrl);
    try {
      pem = await fetchCertificate(certUrl);
    } catch {
      return false;
    }
  }

  const signingString = `${timestamp}\n${rawBody}\n`;
  const verifier = createVerify("SHA256");
  verifier.update(signingString);

  try {
    return verifier.verify(pem, signature, "base64");
  } catch {
    return false;
  }
}

/**
 * Start the webhook HTTP server.
 * @param {object} options
 * @param {number} options.port - port to listen on
 * @param {Function} options.onTrigger - callback(webhookPayload) when valid webhook received
 * @param {boolean} options.skipVerification - skip signature verification (testing only)
 * @returns {Promise<object>} { server, close() }
 */
export function startWebhookServer({ port, onTrigger, skipVerification = false }) {
  return new Promise((resolve, reject) => {
    const server = createServer(async (req, res) => {
      // Health check
      if (req.method === "GET" && req.url === "/health") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ status: "ok", ts: new Date().toISOString() }));
        return;
      }

      // Only accept POST /webhook
      if (req.method !== "POST" || !req.url.startsWith("/webhook")) {
        res.writeHead(404);
        res.end();
        return;
      }

      // Collect raw body
      const chunks = [];
      req.on("data", (chunk) => chunks.push(chunk));
      req.on("end", async () => {
        const rawBody = Buffer.concat(chunks).toString("utf8");

        // Return 200 immediately (Zerion expects fast responses)
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ received: true }));

        // Extract verification headers
        const timestamp = req.headers["x-timestamp"];
        const signature = req.headers["x-signature"];
        const certUrl = req.headers["x-certificate-url"];

        // Verify signature (unless testing)
        if (!skipVerification) {
          const valid = await verifyWebhookSignature(timestamp, rawBody, signature, certUrl);
          if (!valid) {
            logAuditEvent("webhook_rejected", {
              reason: "invalid_signature",
              timestamp,
              certUrl,
            });
            process.stderr.write("[webhook] Rejected: invalid signature\n");
            return;
          }
        }

        // Parse payload
        let payload;
        try {
          payload = JSON.parse(rawBody);
        } catch (err) {
          logAuditEvent("webhook_error", { reason: "invalid_json", error: err.message });
          return;
        }

        // Check for rollback (deleted flag)
        if (payload.data?.attributes?.deleted === true) {
          logAuditEvent("webhook_rollback", {
            address: payload.data?.attributes?.address,
          });
          process.stderr.write("[webhook] Transaction rollback received — skipping\n");
          return;
        }

        logAuditEvent("trigger_received", {
          source: "webhook",
          address: payload.data?.attributes?.address,
          notificationId: payload.data?.id,
          subscriptionId: payload.data?.relationships?.subscription?.id,
        });

        // Fire trigger callback
        try {
          await onTrigger(payload);
        } catch (err) {
          logAuditEvent("trigger_error", { error: err.message });
          process.stderr.write(`[webhook] Trigger handler error: ${err.message}\n`);
        }
      });
    });

    server.on("error", (err) => {
      reject(err);
    });

    server.listen(port, () => {
      process.stderr.write(`[webhook] Listening on port ${port}\n`);
      resolve({
        server,
        close: () => new Promise((res) => server.close(res)),
      });
    });
  });
}
