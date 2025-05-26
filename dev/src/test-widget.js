import { SSEBaseWidget } from "./sse-base-widget.js";

/**
 * <clock-widget> – shows a live digital clock fed via SSE.
 * Expected event payload: { "timestamp": "2025-01-01T12:34:56.789Z" }
 */
export class ClockWidget extends SSEBaseWidget {
  constructor() {
    super();
    this._hasClockStyle = false;
  }

  /* inject stylesheet once connected so it sits AFTER the base sheet */
  connectedCallback() {
    if (!this._hasClockStyle) {
      const css = /* css */ `
        /* ─────────── card restyle ─────────── */
        :host {
          border: none !important;            /* remove base 1px solid */
          border-radius: 16px !important;
          background: radial-gradient(
              circle at 25% 25%,
              #ff9a9e 0%,
              #fad0c4 100%
            ) !important;
          box-shadow:
            0 2px 4px rgba(0,0,0,.1),
            0 6px 10px rgba(0,0,0,.15);
          overflow: hidden;                  /* clip indicator glow */
          position: relative;
          min-width: 180px;
        }

        /* subtle glass overlay */
        :host::before {
          content: "";
          position: absolute;
          inset: 0;
          background: rgba(255,255,255,.05);
          pointer-events: none;
        }

        /* status indicator tweaks */
        .indicator {
          top: 10px;
          right: 10px;
          width: 10px;
          height: 10px;
          box-shadow: 0 0 6px currentColor;
        }
        .indicator.connected  { background:#2ecc71; }
        .indicator.error      { background:#e74c3c; }
        .indicator.connecting { background:#f1c40f; }

        /* ─────────── digital clock text ─────────── */
        @import url("https://fonts.googleapis.com/css2?family=Share+Tech+Mono&display=swap");

        .data {
          font-family: 'Share Tech Mono', 'Courier New', monospace !important;
          text-align: center !important;
          padding: 26px 18px !important;
          color: #ffffff;
          text-shadow:
            0 0 4px rgba(0,0,0,.5),
            0 0 7px rgba(0,0,0,.35);
        }

        .data .time {
          font-size: 3.2rem;
          line-height: 1.1;
          letter-spacing: .05em;
        }
        .data .date {
          font-size: 1rem;
          opacity: .8;
          margin-top: .25em;
        }

        /* hide placeholder/loading in a subtle way */
        .data.status-loading {
          opacity: .6;
        }
      `;

      /* Modern browsers – put a sheet AFTER the base sheet */
      if (
        typeof CSSStyleSheet !== "undefined" &&
        "replaceSync" in CSSStyleSheet.prototype
      ) {
        const sheet = new CSSStyleSheet();
        sheet.replaceSync(css);
        this.shadowRoot.adoptedStyleSheets = [
          ...this.shadowRoot.adoptedStyleSheets,
          sheet,
        ];
      } else {
        /* Fallback: append <style> so it's parsed after earlier sheets */
        const style = document.createElement("style");
        style.textContent = css;
        this.shadowRoot.append(style);
      }

      this._hasClockStyle = true;
    }
    super.connectedCallback();
  }

  /**
   * Convert incoming JSON → { data:string } understood by SSEBaseWidget.
   * If the payload is malformed we throw, letting the base widget
   * fall back to its error handling.
   * @param {MessageEvent<string>} ev
   * @returns {{ data: string }}
   */
  async processData(ev) {
    try {
      const { timestamp } = JSON.parse(ev.data);
      const dateObj = new Date(timestamp);
      if (isNaN(dateObj)) throw new Error("Invalid timestamp");

      const timeStr = dateObj.toLocaleTimeString();
      const dateStr = dateObj.toLocaleDateString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
      });

      /* Return HTML with separate spans for time and date */
      return {
        data: `<span class="time">${timeStr}</span><br/><span class="date">${dateStr}</span>`,
      };
    } catch (err) {
      // log for debugging; re-throw so base widget shows error state
      this._cfg?.debug && console.error("[ClockWidget] bad payload", err);
      throw err;
    }
  }
}

customElements.define("clock-widget", ClockWidget);
