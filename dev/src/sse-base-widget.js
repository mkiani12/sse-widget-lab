/**
 * @license MIT © 2025 Your Name/Company
 * SSEBaseWidget v2.2.2 — boilerplate Web Component for Server-Sent Events.
 * Works in plain HTML, Vue 3, React 18+, Svelte, etc.
 */

/* ──────────────────────────  shared constants & utils  ───────────────────────── */

export const tagName = "sse-base-widget"; // element tag exposed to users

const BASE_CSS = /* css */ `
  :host {
    display:block;
    padding:var(--widget-padding,10px);
    border:var(--widget-border,1px solid #ccc);
    border-radius:var(--widget-radius,6px);
    font:var(--widget-font,14px/1.45 system-ui,sans-serif);
    background:var(--widget-bg,#fff);
    color:var(--widget-fg,#333);
    position:relative;
    min-height:var(--widget-min-h,30px);
    box-sizing:border-box;
  }
  :host([hidden]){display:none}

  .data{padding:var(--widget-data-pad,8px);word-break:break-word}
  .data.status-loading   {color:var(--widget-loading,#666);opacity:.8}
  .data.status-error     {color:var(--widget-error,#c00)}
  .data.status-warn      {color:var(--widget-warn,#b5830f)}
  .data.status-connected {color:var(--widget-ok,#080)}

  .indicator{
    position:absolute;top:6px;right:6px;width:8px;height:8px;
    border-radius:50%;background:var(--indicator,#ccc);transition:background .3s
  }
  .indicator.connected  {background:#090}
  .indicator.error      {background:#c00}
  .indicator.connecting {background:#f90;animation:pulse 1s infinite}

  @keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}
`;

const jitter = (val, range = 0.1) =>
  val * (1 + (Math.random() * 2 - 1) * range);
const supportsAdopted =
  typeof CSSStyleSheet !== "undefined" &&
  "replace" in CSSStyleSheet.prototype &&
  "adoptedStyleSheets" in Document.prototype;

/* ─────────────────────────────────  main class  ──────────────────────────────── */

export class SSEBaseWidget extends HTMLElement {
  /* ===== observed attributes ===== */
  static observedAttributes = [
    "sse-url",
    "with-credentials",
    "reconnect",
    "reconnect-delay",
    "max-reconnect-delay",
    "max-reconnect-attempts",
    "placeholder-text",
    "error-message",
    "debug",
    "animate-updates",
  ];

  /* ===== shared stylesheet ===== */
  static #sheet = supportsAdopted
    ? (() => {
        const sheet = new CSSStyleSheet();
        sheet.replaceSync(BASE_CSS);
        return sheet;
      })()
    : null;

  /* ===== ctor ===== */
  constructor() {
    super();
    this.attachShadow({ mode: "open" });

    // styling
    if (supportsAdopted) {
      this.shadowRoot.adoptedStyleSheets = [SSEBaseWidget.#sheet];
    } else {
      const st = document.createElement("style");
      st.textContent = BASE_CSS;
      this.shadowRoot.append(st);
    }

    // element skeleton
    this.shadowRoot.innerHTML += /* html */ `
      <div class="indicator" part="indicator"></div>
      <slot name="header"></slot>
      <div class="data status-loading" part="data"></div>
      <slot name="footer"></slot>
    `;

    /** @type {EventSource|null}   */ this._es = null;
    /** @type {HTMLDivElement}     */ this._dataEl =
      this.shadowRoot.querySelector(".data");
    /** @type {HTMLDivElement}     */ this._indicatorEl =
      this.shadowRoot.querySelector(".indicator");
    /** @type {number|null}        */ this._retryTimer = null;
    /** @type {number}             */ this._retryCount = 0;

    // runtime config (synced via attribute setters)
    this._cfg = Object.seal({
      sseUrl: "",
      withCredentials: false,
      reconnect: true,
      reconnectDelay: 1000,
      maxReconnectDelay: 30000,
      maxReconnectAttempts: Infinity,
      placeholderText: "Waiting for data…",
      errorMessage: "Connection error. Retrying…",
      debug: false,
      animateUpdates: false,
    });
  }

  /* ─────────────  attribute ⇄ property reflection helpers  ───────────── */

  #boolAttr(name, val) {
    val ? this.setAttribute(name, "") : this.removeAttribute(name);
  }
  #numAttr(name, fallback) {
    return Number(this.getAttribute(name) ?? fallback);
  }

  // string
  get sseUrl() {
    return this._cfg.sseUrl;
  }
  set sseUrl(v) {
    v ? this.setAttribute("sse-url", v) : this.removeAttribute("sse-url");
  }

  // booleans
  get withCredentials() {
    return this.hasAttribute("with-credentials");
  }
  set withCredentials(v) {
    this.#boolAttr("with-credentials", v);
  }

  get reconnect() {
    return (
      !this.hasAttribute("reconnect") ||
      this.getAttribute("reconnect") !== "false"
    );
  }
  set reconnect(v) {
    this.setAttribute("reconnect", v ? "true" : "false");
  }

  get debug() {
    return this.hasAttribute("debug");
  }
  set debug(v) {
    this.#boolAttr("debug", v);
  }

  get animateUpdates() {
    return this.hasAttribute("animate-updates");
  }
  set animateUpdates(v) {
    this.#boolAttr("animate-updates", v);
  }

  // numbers
  get reconnectDelay() {
    return this.#numAttr("reconnect-delay", this._cfg.reconnectDelay);
  }
  set reconnectDelay(v) {
    this.setAttribute("reconnect-delay", String(v));
  }

  get maxReconnectDelay() {
    return this.#numAttr("max-reconnect-delay", this._cfg.maxReconnectDelay);
  }
  set maxReconnectDelay(v) {
    this.setAttribute("max-reconnect-delay", String(v));
  }

  get maxReconnectAttempts() {
    return this.#numAttr(
      "max-reconnect-attempts",
      this._cfg.maxReconnectAttempts
    );
  }
  set maxReconnectAttempts(v) {
    this.setAttribute("max-reconnect-attempts", String(v));
  }

  /* ───────────────────────────── lifecycle ───────────────────────────── */

  connectedCallback() {
    this.#syncAllAttrs();
    this.#renderPlaceholder();

    if (this._cfg.sseUrl) this.#connect();

    // network listeners
    this._onlineH = () =>
      (this._cfg.debug && console.info("[SSE] online")) || this.reconnectNow();
    this._offlineH = () =>
      (this._cfg.debug && console.info("[SSE] offline")) ||
      this.#updateStatus("error");
    window.addEventListener("online", this._onlineH);
    window.addEventListener("offline", this._offlineH);

    this.#emit("sse-connected");
  }

  disconnectedCallback() {
    this.#cleanup();
    window.removeEventListener("online", this._onlineH);
    window.removeEventListener("offline", this._offlineH);
    this.#emit("sse-disconnected");
  }

  attributeChangedCallback(name, oldVal, newVal) {
    if (oldVal === newVal) return;

    switch (name) {
      case "sse-url":
        this._cfg.sseUrl = newVal ?? "";
        this.reconnectNow();
        break;

      case "with-credentials":
        this._cfg.withCredentials = this.withCredentials;
        this.reconnectNow();
        break;

      case "reconnect":
        this._cfg.reconnect = this.reconnect;
        break;

      case "debug":
        this._cfg.debug = this.debug;
        break;

      case "animate-updates":
        this._cfg.animateUpdates = this.animateUpdates;
        break;

      case "reconnect-delay":
        this._cfg.reconnectDelay = this.reconnectDelay;
        break;

      case "max-reconnect-delay":
        this._cfg.maxReconnectDelay = this.maxReconnectDelay;
        break;

      case "max-reconnect-attempts":
        this._cfg.maxReconnectAttempts = this.maxReconnectAttempts;
        break;

      case "placeholder-text":
        this._cfg.placeholderText = newVal ?? "";
        this.#renderPlaceholder();
        break;

      case "error-message":
        this._cfg.errorMessage = newVal ?? "";
        break;
    }
  }

  /* ───────────────────────────── public API ──────────────────────────── */

  /** Manually force a reconnect (resets retry counter) */
  reconnectNow() {
    this._retryCount = 0;
    this.#cleanup(false);
    if (this._cfg.sseUrl) this.#connect();
  }

  /** Permanently close the stream and disable auto-reconnect */
  disconnect() {
    this._cfg.reconnect = false;
    this.#cleanup();
  }

  get connectionStatus() {
    return this.getAttribute("connection-status") ?? "disconnected";
  }
  get config() {
    return { ...this._cfg };
  } // shallow clone

  /* ─────────────────────────── internal helpers ───────────────────────── */

  #syncAllAttrs() {
    for (const attr of SSEBaseWidget.observedAttributes) {
      const v = this.getAttribute(attr);
      if (v !== null) this.attributeChangedCallback(attr, null, v);
    }
  }

  /* ---------- connection management ---------- */

  #connect() {
    if (this._es) return;

    this.#updateStatus("connecting");

    try {
      this._es = new EventSource(
        this._cfg.sseUrl,
        this._cfg.withCredentials ? { withCredentials: true } : undefined
      );

      this._es.onopen = () => {
        this._retryCount = 0;
        this.#updateStatus("connected");
        this.#emit("sse-open");
      };

      this._es.onmessage = async (ev) => {
        const processed = await this.processData(ev);
        this.#handleData(processed);
        this.#emit("sse-data", processed);
      };

      this._es.onerror = (err) => this.#handleError(err);
    } catch (err) {
      this.#handleError(err);
    }
  }

  #cleanup(resetCounter = true) {
    if (this._retryTimer) {
      clearTimeout(this._retryTimer);
      this._retryTimer = null;
    }

    if (this._es) {
      this._es.onopen = this._es.onmessage = this._es.onerror = null;
      this._es.close();
      this._es = null;
    }

    if (resetCounter) this._retryCount = 0;
    this.#updateStatus("disconnected");
  }

  #handleError(err) {
    this.#updateStatus("error");
    this.#log("error", "SSE error", err);
    this.#emit("sse-error", { error: err });

    if (!this._cfg.reconnect) return;
    if (this._retryCount >= this._cfg.maxReconnectAttempts) return;

    const base = Math.min(
      this._cfg.reconnectDelay * 2 ** this._retryCount,
      this._cfg.maxReconnectDelay
    );
    const delay = jitter(base, 0.25);

    this._retryCount += 1;
    this._retryTimer = setTimeout(() => {
      this._retryTimer = null;
      this.#cleanup(false); // keep retry counter
      this.#connect();
    }, delay);
  }

  /* ---------- rendering ---------- */

  #updateStatus(status) {
    this.setAttribute("connection-status", status);
    if (this._indicatorEl) {
      this._indicatorEl.className = `indicator ${status}`;
    }
    if (status === "connecting") {
      this.#renderPlaceholder("loading");
    } else if (status === "error") {
      this.#renderText(this._cfg.errorMessage, "error");
    }
  }

  #renderPlaceholder(state = "loading") {
    this.#renderText(this._cfg.placeholderText, state);
  }

  #renderText(html, cls = "data") {
    if (!this._dataEl) return;

    if (this._cfg.animateUpdates) {
      this._dataEl.style.opacity = "0";
      setTimeout(() => {
        this._dataEl.innerHTML = html;
        this._dataEl.className = `data status-${cls}`;
        this._dataEl.style.opacity = "1";
      });
    } else {
      this._dataEl.innerHTML = html;
      this._dataEl.className = `data status-${cls}`;
    }
  }

  /* ---------- overridable hooks ---------- */

  /**
   * Optional preprocessing hook — override in subclasses.
   * @param {MessageEvent<string>} ev
   * @returns {Promise<{ data:string, id:string, type:string, timestamp:number }>}
   */
  async processData(ev) {
    return {
      data: ev.data,
      id: ev.lastEventId,
      type: ev.type,
      timestamp: Date.now(),
    };
  }

  /**
   * Default data renderer — subclasses should override.
   * @param {{data:string}} param0
   */
  #handleData({ data }) {
    this.#renderText(`<pre>${this.#escape(data)}</pre>`);
  }

  /* ---------- utilities ---------- */

  #log(level, ...args) {
    if (this._cfg.debug || level === "error")
      console[level]("[SSEBaseWidget]", ...args);
  }

  #emit(name, detail = {}) {
    this.dispatchEvent(
      new CustomEvent(name, { detail, bubbles: true, composed: true })
    );
  }

  #escape(str) {
    const div = document.createElement("div");
    div.textContent = String(str);
    return div.innerHTML;
  }
}

/* ─────────────  auto-define when loaded via CDN <script type=module>  ─────────── */

if (typeof window !== "undefined" && !customElements.get(tagName)) {
  customElements.define(tagName, SSEBaseWidget);
  window.SSEBaseWidget = SSEBaseWidget; // optional global for UMD users
}
