import { createServer } from "node:http";
import { URL } from "node:url";

const PORT = 4000;

/* A helper function to send SSE events */
function sendEvent(res, data, event = "message") {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

/** Common CORS headers we want on EVERY response */
function corsHeaders(origin = "*") {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    Vary: "Origin",
  };
}

createServer((req, res) => {
  const { pathname } = new URL(req.url, `http://${req.headers.host}`);

  /* ─────────────  Handle OPTIONS pre-flight  ───────────── */
  if (req.method === "OPTIONS") {
    res.writeHead(204, { ...corsHeaders(), "Access-Control-Max-Age": "86400" });
    res.end();
    return;
  }

  /* ─────────────  Accept /stream requests  ───────────── */
  if (req.method === "GET" && pathname.startsWith("/stream")) {
    res.writeHead(200, {
      ...corsHeaders(),
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });

    // Send an initial comment to keep the connection open
    res.write(": connected\n\n");

    // Send timestamp events every second
    const interval = setInterval(() => {
      sendEvent(res, { timestamp: new Date().toISOString() });
    }, 1000);

    // Clean up on client disconnect
    req.on("close", () => clearInterval(interval));
    return;
  }

  /* ─────────────  Everything else → 404  ───────────── */
  res.writeHead(404, {
    ...corsHeaders(),
    "Content-Type": "text/plain; charset=utf-8",
  });
  res.end("Not found");
}).listen(PORT, () =>
  console.log(`🟢 SSE stream ready → http://localhost:${PORT}/stream`)
);
