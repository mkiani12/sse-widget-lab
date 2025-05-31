import { SSEBaseWidget } from "./sse-base-widget.js"; // Assuming sse-base-widget.js is in the same directory or path is correct

/**
 * Helper function to convert numbers to Persian (Farsi) numeral strings.
 * @param {number|string} n The number to convert.
 * @param {Intl.NumberFormatOptions} options Intl.NumberFormat options.
 * @returns {string} Formatted number string or original if not a number.
 */
function toPersianNum(n, options = {}) {
  const num = Number(n);
  if (isNaN(num)) return String(n); // Return original if not a valid number
  return num.toLocaleString("fa-IR", options);
}

/**
 * <crypto-price-widget> - Shows live cryptocurrency price data via SSE.
 * Expected event payload:
 * {
 * "coinName": "بیت کوین",
 * "coinSymbol": "BTC",
 * "coinLogoUrl": "url_to_logo.png",
 * "priceChangePercent": 0.62,
 * "mainPriceUsd": 93340.32,
 * "secondaryPriceToman": 7469122800,
 * "secondaryCurrencySymbol": "تومان",
 * "footerText": "کیف پول من",
 * "footerLogoUrl": "url_to_footer_logo.svg"
 * }
 */
export class CryptoPriceWidget extends SSEBaseWidget {
  constructor() {
    super();
    this._hasCryptoStyle = false; // Flag to ensure styles are injected once

    // Set default SSE URL if not provided via attribute
    if (!this.hasAttribute("sse-url")) {
      this.sseUrl = "http://localhost:4000/stream";
    }
  }

  connectedCallback() {
    if (!this._hasCryptoStyle) {
      const css = /* css */ `
        @import url('https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;500;700&display=swap');

        :host {
          border: 1px solid #6D7385 !important;
          border-radius: 8px !important;
          background: radial-gradient(circle at 50% -30%, #1D236C 0%, #000212 100%) !important;
          box-shadow: 0 4px 8px rgba(0,0,0,.2), 0 10px 20px rgba(0,0,0,.25) !important;
          overflow: hidden !important;
          min-width: 302px !important;
          padding: 12px 24px !important;
          font-family: 'Vazirmatn', system-ui, sans-serif !important;
          color: #EAEAEA !important;
        }

        /* Hide the default status indicator dot from base widget */
        .indicator {
          display: none !important;
        }

        .data {
          font-family: 'Vazirmatn', system-ui, sans-serif !important; /* Ensure font override */
          text-align: center !important;
          padding: 0 !important; /* Reset base padding if any, control with internal elements */
          color: #EAEAEA !important; /* Default text color for children */
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 8px; /* Spacing between elements */
        }

        .crypto-header {
          display: flex;
          align-items: center;
          justify-content: center; /* Centered header */
          gap: 10px;
          margin-bottom: 10px;
          margin-left: auto;
          margin-right: auto;
        }
        .coin-logo {
          width: 24px;
          height: 24px;
          border-radius: 50%;
        }
        .coin-name-container {
          display: flex;
          align-items: center; /* Align text to the start (left for LTR, right for RTL) */
          text-align: right; /* For Persian text */
        }
        .coin-name {
          font-size: 12px; /* Adjusted size */
          font-weight: 700;
          color: #FFFFFF;
        }
        .coin-symbol {
          font-size: 10px; /* Adjusted size */
          color: #BFBFBF;
          text-transform: uppercase;
          margin-right: 8px; /* Space between name and symbol */
        }

        .price-change-container {
          text-align: right;
          display: flex;
          align-items: center; /* Center the price change */
          margin-bottom: 8px;
        }

        .price-change-label{
          font-size: 12px; /* Adjusted size */
          color: #FFF;
        }

        .price-change {
          font-size: 12px; /* Adjusted size */
          font-weight: 700;
          border-radius: 4px;
          margin-right: 8px;
          direction: ltr; /* Keep percentage and arrow LTR */
        }
        .price-change.positive {
          color: #00A66A; /* Green for positive */
        }
        .price-change.negative {
          color: #E74C3C; /* Red for negative */
        }

        .main-price {
          font-size: 24px; /* Adjusted size */
          font-weight: 700;
          color: #FFFFFF;
          line-height: 1.1;
          margin-bottom: 4px;
        }

        .secondary-price {
          font-size: 14px; /* Adjusted size */
          color: #fff;
        }

        .widget-footer {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          margin-top: 10px;
          margin-left: auto;
          margin-right: auto;
        }
        .footer-logo {
          width: 20px; /* Adjusted size */
          height: 20px;
        }
        .footer-text {
          font-size: 0.85rem; /* Adjusted size */
          color: #999999;
        }

        .data.status-loading {
          opacity: .6 !important;
        }
        .data.status-error {
          opacity: .8 !important;
        }
      `;

      // Define the check for adoptedStyleSheets support directly here
      const canAdoptSheets =
        typeof CSSStyleSheet !== "undefined" &&
        "replaceSync" in CSSStyleSheet.prototype &&
        "adoptedStyleSheets" in Document.prototype;

      if (canAdoptSheets) {
        const sheet = new CSSStyleSheet();
        sheet.replaceSync(css);
        this.shadowRoot.adoptedStyleSheets = [
          ...this.shadowRoot.adoptedStyleSheets,
          sheet,
        ];
      } else {
        const style = document.createElement("style");
        style.textContent = css;
        this.shadowRoot.append(style);
      }
      this._hasCryptoStyle = true;
    }
    super.connectedCallback();
  }

  /**
   * Convert incoming JSON to the HTML structure for the crypto widget.
   * @param {MessageEvent<string>} ev The SSE message event.
   * @returns {Promise<{html: string}>} Object containing the HTML string.
   */
  async processData(ev) {
    try {
      const payload = JSON.parse(ev.data);
      const {
        coinName = "N/A",
        coinSymbol = "",
        coinLogoUrl = "",
        priceChangePercent = 0,
        mainPriceUsd = 0,
        secondaryPriceToman = 0,
        secondaryCurrencySymbol = "",
        footerLogoUrl = "",
      } = payload;

      const priceChangeNum = parseFloat(priceChangePercent);
      const priceChangeClass = priceChangeNum >= 0 ? "positive" : "negative";
      const priceChangeArrow = priceChangeNum >= 0 ? "▲" : "▼";

      const html = `
        <div class="crypto-header">
          <img src="${coinLogoUrl}" alt="${coinSymbol} logo" class="coin-logo">
          <div class="coin-name-container">
            <span class="coin-name">${coinName}</span>
            <span class="coin-symbol">${coinSymbol}</span>
          </div>
        </div>
        <div class="price-change-container">
          <span class="price-change-label">قیمت بیت کوین</span>
          <div class="price-change ${priceChangeClass}">
            ${priceChangeArrow} ${toPersianNum(Math.abs(priceChangeNum), {
        style: "percent",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}
          </div>
        </div>
        <div class="main-price">$${toPersianNum(mainPriceUsd, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}</div>
        <div class="secondary-price">${toPersianNum(
          secondaryPriceToman
        )} ${secondaryCurrencySymbol}</div>
        <div class="widget-footer">
          <img src="${footerLogoUrl}" alt="Footer logo" class="footer-logo">
          <span class="footer-text">کیف پول من</span>
        </div>
      `;
      return { html };
    } catch (err) {
      if (this._cfg?.debug) {
        console.error(
          "[CryptoPriceWidget] Error processing data:",
          err,
          ev.data
        );
      }
      throw err; // Re-throw for base widget to handle and display error message
    }
  }
}

customElements.define("crypto-price-widget", CryptoPriceWidget);

if (typeof window !== "undefined") {
  window.CryptoPriceWidget = CryptoPriceWidget;
}
