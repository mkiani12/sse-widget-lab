import { createServer } from "node:http"; // [cite: 120]
import { URL } from "node:url"; // [cite: 120]

const PORT = 4000; // [cite: 120]

// ──────────────────────────  coin presets  ──────────────────────────
// Extend or modify this list to add more coins with their Persian names,
// symbols, logo URLs and an approximate USD base price used for the mock.
// Real-world usage would source this from an API/db instead.
const COINS = {
  BTC: {
    coinName: "بیت کوین",
    coinSymbol: "BTC",
    coinLogoUrl: "https://s2.coinmarketcap.com/static/img/coins/64x64/1.png",
    basePrice: 93000,
  },
  ETH: {
    coinName: "اتریوم",
    coinSymbol: "ETH",
    coinLogoUrl: "https://s2.coinmarketcap.com/static/img/coins/64x64/1027.png",
    basePrice: 4800,
  },
  DOGE: {
    coinName: "دوج کوین",
    coinSymbol: "DOGE",
    coinLogoUrl: "https://s2.coinmarketcap.com/static/img/coins/64x64/74.png",
    basePrice: 0.2,
  },
};

// Helper function to send SSE events [cite: 121]
function sendEvent(res, data, event = "message") {
  // [cite: 121]
  res.write(`event: ${event}\n`); // [cite: 121]
  res.write(`data: ${JSON.stringify(data)}\n\n`); // [cite: 121, 122]
}

// Common CORS headers [cite: 123]
function corsHeaders(origin = "*") {
  return {
    "Access-Control-Allow-Origin": origin, // Allows all origins
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    Vary: "Origin",
  };
}

function createMockAndSend(res, coinKey = "BTC") {
  const coin = COINS[coinKey] || COINS.BTC;

  // Random percentage change between -0.5 and +0.5
  const priceChange = (Math.random() - 0.5).toFixed(4);

  // Randomize around the coin's base price (±1%)
  const mainPrice =
    coin.basePrice * (1 + (Math.random() * 2 - 1) * 0.01);

  // Very naive conversion to Iranian Toman just for demo (1 USD ≈ 50k Toman)
  const TOMAN_PER_USD = 50000;
  const secondaryPriceFactor = TOMAN_PER_USD * (1 + Math.random() * 0.02);

  const mockData = {
    coinName: coin.coinName,
    coinSymbol: coin.coinSymbol,
    coinLogoUrl: coin.coinLogoUrl,
    priceChangePercent: priceChange,
    mainPriceUsd: mainPrice.toFixed(2),
    secondaryPriceToman: (mainPrice * secondaryPriceFactor).toFixed(0),
    secondaryCurrencySymbol: "تومان",
    footerLogoUrl: KIFPOOL_LOGO_DATA_URL,
  };
  sendEvent(res, mockData);
}

// A simple Base64 encoder for the SVG footer logo (Node.js environment)
function base64Encode(str) {
  return Buffer.from(str).toString("base64");
}

const KIFPOOL_LOGO_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="#5DADE2">
  <path d="M21 6H3C1.89543 6 1 6.89543 1 8V18C1 19.1046 1.89543 20 3 20H21C22.1046 20 23 19.1046 23 18V8C23 6.89543 22.1046 6 21 6ZM21 18H3V8H21V18Z"/>
  <path d="M7 12H17C17.5523 12 18 11.5523 18 11V10C18 9.44772 17.5523 9 17 9H7C6.44772 9 6 9.44772 6 10V11C6 11.5523 6.44772 12 7 12Z"/>
</svg>
`;
const KIFPOOL_LOGO_DATA_URL = `data:image/svg+xml;base64,${base64Encode(
  KIFPOOL_LOGO_SVG
)}`;

createServer((req, res) => {
  // [cite: 123]
  const { pathname, searchParams } = new URL(req.url, `http://${req.headers.host}`); // [cite: 123]

  if (req.method === "OPTIONS") {
    // [cite: 123]
    res.writeHead(204, { ...corsHeaders(), "Access-Control-Max-Age": "86400" }); // [cite: 123]
    res.end(); // [cite: 123]
    return; // [cite: 123]
  }

  if (req.method === "GET" && pathname.startsWith("/stream")) {
    // [cite: 124]
    res.writeHead(200, {
      // [cite: 124]
      ...corsHeaders(), // [cite: 124]
      "Content-Type": "text/event-stream; charset=utf-8", // [cite: 124]
      "Cache-Control": "no-cache", // [cite: 124]
      Connection: "keep-alive", // [cite: 124]
    });

    res.write(": connected\n\n"); // [cite: 124]

    // Determine which coin to stream based on URL param (?symbol=BTC)
    const symbolParam = searchParams.get("symbol")?.toUpperCase() || "BTC";

    setTimeout(() => {
      console.log(`Client connected, starting ${symbolParam} stream.`);
      createMockAndSend(res, symbolParam); // Send initial data
    }, 1000); // Initial delay of 1 second

    const interval = setInterval(() => {
      createMockAndSend(res, symbolParam);
    }, 2000); // Send data every 2 seconds

    req.on("close", () => {
      // [cite: 124]
      clearInterval(interval); // [cite: 124]
      console.log("Client disconnected, stopping stream.");
    });
    return; // [cite: 124]
  }

  res.writeHead(404, {
    // [cite: 125]
    ...corsHeaders(), // [cite: 125]
    "Content-Type": "text/plain; charset=utf-8", // [cite: 125]
  });
  res.end("Not found"); // [cite: 125]
}).listen(
  PORT,
  () =>
    // [cite: 125]
    console.log(`🟢 SSE crypto stream ready → http://localhost:${PORT}/stream?symbol=BTC (or ETH, DOGE, ...)`) // [cite: 125]
);
