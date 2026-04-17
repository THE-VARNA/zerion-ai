/**
 * Zerion API HTTP client — native fetch + Basic Auth + x402 pay-per-call.
 */

import { API_BASE } from "../util/constants.js";
import { getApiKey } from "../config.js";
import { getX402Fetch } from "./x402.js";

export function basicAuthHeader(key) {
  return `Basic ${Buffer.from(`${key}:`).toString("base64")}`;
}

export async function fetchAPI(pathname, params = {}, useX402 = false) {
  const apiKey = useX402 ? null : getApiKey();
  if (!useX402 && !apiKey) {
    const err = new Error(
      "ZERION_API_KEY is required. Get one at https://developers.zerion.io\n" +
      "Alternatively, use --x402 for pay-per-call (no API key needed)."
    );
    err.code = "missing_api_key";
    throw err;
  }

  const url = new URL(`${API_BASE}${pathname}`);
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    url.searchParams.set(key, String(value));
  }

  const headers = { Accept: "application/json" };

  if (!useX402) {
    headers.Authorization = basicAuthHeader(apiKey);
  }

  const fetchFn = useX402 ? await getX402Fetch() : fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);
  const response = await fetchFn(url, { headers, signal: controller.signal });
  clearTimeout(timer);

  const text = await response.text();
  let payload;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = { _rawText: text.slice(0, 500) };
  }

  if (!response.ok) {
    const err = new Error(
      `Zerion API error: ${response.status} ${response.statusText}`
    );
    err.code = "api_error";
    err.status = response.status;
    err.response = payload;
    throw err;
  }

  return payload;
}

// --- Wallet endpoints ---

export async function getPortfolio(address, options = {}) {
  return fetchAPI(`/wallets/${encodeURIComponent(address)}/portfolio`, {
    currency: options.currency || "usd",
  }, options.useX402);
}

export async function getPositions(address, options = {}) {
  const params = {
    "filter[positions]": options.positionFilter || "no_filter",
    currency: "usd",
    sort: "value",
  };
  if (options.chainId) params["filter[chain_ids]"] = options.chainId;
  return fetchAPI(`/wallets/${encodeURIComponent(address)}/positions/`, params, options.useX402);
}

export async function getPnl(address, options = {}) {
  return fetchAPI(`/wallets/${encodeURIComponent(address)}/pnl`, {}, options.useX402);
}

export async function getTransactions(address, options = {}) {
  const params = {
    "page[size]": options.limit || 10,
    currency: "usd",
  };
  if (options.chainId) params["filter[chain_ids]"] = options.chainId;
  return fetchAPI(`/wallets/${encodeURIComponent(address)}/transactions/`, params, options.useX402);
}

// --- Fungibles endpoints ---

export async function searchFungibles(query, options = {}) {
  const params = {
    "filter[search_query]": query,
    currency: "usd",
    sort: "-market_data.market_cap",
    "page[size]": options.limit || 10,
  };
  if (options.chainId) params["filter[chain_ids]"] = options.chainId;
  return fetchAPI("/fungibles/", params, options.useX402);
}

export async function getFungible(fungibleId, options = {}) {
  return fetchAPI(`/fungibles/${fungibleId}`, {}, options.useX402);
}

// --- Chain endpoints ---

export async function getChains(options = {}) {
  return fetchAPI("/chains/", {}, options.useX402);
}

export async function getGasPrices(chainId, options = {}) {
  return fetchAPI("/gas/", {
    "filter[chain_id]": chainId || "ethereum",
  }, options.useX402);
}

// --- Swap endpoints ---

export async function getSwapOffers(params, options = {}) {
  return fetchAPI("/swap/offers/", params, options.useX402);
}

export async function getSwapFungibles(inputChainId, outputChainId, options = {}) {
  return fetchAPI("/swap/fungibles/", {
    "input[chain_id]": inputChainId || "ethereum",
    "output[chain_id]": outputChainId || "ethereum",
    direction: "both",
  }, options.useX402);
}

// --- Wallet-set endpoints ---

export async function getWalletSetPortfolio(addresses, options = {}) {
  return fetchAPI("/wallet-sets/portfolio", {
    addresses: addresses.join(","),
    currency: options.currency || "usd",
    "filter[positions]": options.positionFilter || "only_simple",
  }, options.useX402);
}

export async function getWalletSetPositions(addresses, options = {}) {
  const params = {
    addresses: addresses.join(","),
    "filter[positions]": options.positionFilter || "only_simple",
    currency: options.currency || "usd",
    sort: "value",
  };
  if (options.chainIds) params["filter[chain_ids]"] = options.chainIds;
  return fetchAPI("/wallet-sets/positions/", params, options.useX402);
}

export async function getWalletSetTransactions(addresses, options = {}) {
  return fetchAPI("/wallet-sets/transactions/", {
    addresses: addresses.join(","),
    "page[size]": options.limit || 10,
    currency: options.currency || "usd",
  }, options.useX402);
}

// --- Transaction subscription endpoints ---

export async function createTxSubscription(callbackUrl, walletAddresses, chainIds = []) {
  const apiKey = getApiKey();
  if (!apiKey) {
    const err = new Error("ZERION_API_KEY is required for subscriptions.");
    err.code = "missing_api_key";
    throw err;
  }

  const body = {
    callback_url: callbackUrl,
    addresses: walletAddresses,
  };
  if (chainIds.length > 0) body.chain_ids = chainIds;

  const url = `${API_BASE}/tx-subscriptions`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: basicAuthHeader(apiKey),
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
    signal: controller.signal,
  });
  clearTimeout(timer);

  const payload = await response.json();
  if (!response.ok) {
    const err = new Error(`Subscription creation failed: ${response.status}`);
    err.code = "subscription_error";
    err.response = payload;
    throw err;
  }
  return payload;
}

export async function listTxSubscriptions(options = {}) {
  return fetchAPI("/tx-subscriptions", {}, options.useX402);
}

export async function deleteTxSubscription(subscriptionId, options = {}) {
  const apiKey = getApiKey();
  if (!apiKey) {
    const err = new Error("ZERION_API_KEY is required.");
    err.code = "missing_api_key";
    throw err;
  }

  const url = `${API_BASE}/tx-subscriptions/${encodeURIComponent(subscriptionId)}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);

  const response = await fetch(url, {
    method: "DELETE",
    headers: {
      Authorization: basicAuthHeader(apiKey),
      Accept: "application/json",
    },
    signal: controller.signal,
  });
  clearTimeout(timer);

  if (!response.ok && response.status !== 204) {
    const err = new Error(`Subscription deletion failed: ${response.status}`);
    err.code = "subscription_error";
    throw err;
  }
  return { deleted: true, id: subscriptionId };
}
