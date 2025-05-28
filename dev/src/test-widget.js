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
  }

  connectedCallback() {
    if (!this._hasCryptoStyle) {
      const css = /* css */ `
        @import url('https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;500;700&display=swap');

        :host {
          border: none !important;
          border-radius: 12px !important;
          background: #181A2A !important; /* Dark background like the image */
          box-shadow: 0 4px 8px rgba(0,0,0,.2), 0 10px 20px rgba(0,0,0,.25) !important;
          overflow: hidden !important;
          min-width: 280px !important;
          padding: 20px !important;
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
          align-items: center;
          gap: 8px; /* Spacing between elements */
        }

        .crypto-header {
          display: flex;
          align-items: center;
          justify-content: center; /* Centered header */
          gap: 10px;
          margin-bottom: 10px;
        }
        .coin-logo {
          width: 32px;
          height: 32px;
          border-radius: 50%;
        }
        .coin-name-container {
          display: flex;
          flex-direction: column; /* Stack name and symbol */
          align-items: flex-start; /* Align text to the start (left for LTR, right for RTL) */
          text-align: right; /* For Persian text */
        }
        .coin-name {
          font-size: 1.3rem; /* Adjusted size */
          font-weight: 700;
          color: #FFFFFF;
        }
        .coin-symbol {
          font-size: 0.9rem; /* Adjusted size */
          color: #AAAAAA;
          text-transform: uppercase;
        }

        .price-change {
          font-size: 1rem; /* Adjusted size */
          font-weight: 700;
          padding: 2px 8px;
          border-radius: 4px;
          margin-bottom: 4px;
          direction: ltr; /* Keep percentage and arrow LTR */
        }
        .price-change.positive {
          color: #2ECC71; /* Green for positive */
        }
        .price-change.negative {
          color: #E74C3C; /* Red for negative */
        }

        .main-price {
          font-size: 2.6rem; /* Adjusted size */
          font-weight: 700;
          color: #FFFFFF;
          line-height: 1.1;
          margin-bottom: 4px;
        }

        .secondary-price {
          font-size: 0.95rem; /* Adjusted size */
          color: #B0B0B0;
          margin-bottom: 10px;
        }

        .widget-footer {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          margin-top: 10px;
          opacity: 0.8;
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
        footerText = "",
        footerLogoUrl = "",
      } = payload;

      const priceChangeNum = parseFloat(priceChangePercent);
      const priceChangeClass = priceChangeNum >= 0 ? "positive" : "negative";
      const priceChangeArrow = priceChangeNum >= 0 ? "▲" : "▼";

      const html = `
        <div class="crypto-header">
          <div class="coin-name-container">
            <span class="coin-name">${coinName}</span>
            <span class="coin-symbol">${coinSymbol}</span>
          </div>
          <img src="${coinLogoUrl}" alt="${coinSymbol} logo" class="coin-logo">
        </div>
        <div class="price-change ${priceChangeClass}">
          ${priceChangeArrow} ${toPersianNum(Math.abs(priceChangeNum), {
        style: "percent",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}
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
          <span class="footer-text">${footerText}</span>
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
