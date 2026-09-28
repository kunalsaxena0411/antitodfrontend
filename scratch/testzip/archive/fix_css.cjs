const fs = require('fs');
const path = require('path');
const p = path.resolve('src/index.css');
const buf = fs.readFileSync(p);

// find first null byte
let firstNullIndex = -1;
for (let i = 0; i < buf.length; i++) {
    if (buf[i] === 0) {
        firstNullIndex = i;
        break;
    }
}

let content;
if (firstNullIndex !== -1) {
    content = buf.slice(0, firstNullIndex).toString('utf8');
} else {
    content = buf.toString('utf8');
}

const newCss = `
.at-investigation-graph-header {
  position: absolute;
  top: 10px;
  right: 11px;
  left: 11px;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: space-between;
  pointer-events: none;
}

.at-investigation-graph-header > div {
  display: flex;
  align-items: center;
  gap: 8px;
}

.at-investigation-graph-header span {
  color: #626a73;
  font-size: 8px;
  font-weight: 700;
  letter-spacing: .08em;
}

.at-investigation-graph-header strong {
  color: #aeb3ba;
  font: 9px/1 "JetBrains Mono", ui-monospace, monospace;
}

.at-investigation-graph-header > span:last-child {
  padding: 4px 7px;
  border: 1px solid #252a30;
  border-radius: 5px;
  background: rgba(11,14,18,.75);
}

.at-investigation-focus-card {
  padding: 13px;
  border: 1px solid #252a31;
  border-radius: 9px;
  background:
    linear-gradient(
      180deg,
      rgba(214,40,40,.035),
      transparent
    ),
    #101317;
}

.at-investigation-focus-card > span:first-child {
  color: #626a73;
  font-size: 8px;
  font-weight: 700;
  letter-spacing: .08em;
  text-transform: uppercase;
}

.at-investigation-focus-card > strong {
  display: block;
  margin-top: 6px;
  color: #e4e6e9;
  font: 600 13px/1.35 "JetBrains Mono", ui-monospace, monospace;
  word-break: break-word;
}

.at-investigation-focus-card > div {
  display: flex;
  gap: 6px;
  margin-top: 11px;
}

.at-investigation-detail-block code {
  display: block;
  margin-top: 7px;
  color: #b7bcc2;
  font: 9px/1.4 "JetBrains Mono", ui-monospace, monospace;
  word-break: break-all;
}

.at-investigation-muted {
  display: block;
  margin-top: 8px;
  color: #666d76;
  font-size: 9px;
}

.at-investigation-inspector-action {
  display: flex;
  width: 100%;
  min-height: 34px;
  align-items: center;
  gap: 7px;
  padding: 0 10px;
  border: 1px solid #292e35;
  border-radius: 7px;
  background: #13161a;
  color: #858c95;
  cursor: pointer;
  font-size: 9px;
  text-align: left;
}

.at-investigation-inspector-action svg:last-child {
  margin-left: auto;
}

.at-investigation-inspector-action:hover {
  background: #181b20;
  color: #e1e3e6;
}

.at-soc-stat-tile {
    display: flex;
    height: 100%;
    flex-direction: column;
    justify-content: space-between;
    padding: 13px;
}

.at-soc-stat-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
}

.at-soc-stat-top > span:first-child {
    color: #6f7680;
    font-size: 9px;
    font-weight: 700;
    letter-spacing: .08em;
    text-transform: uppercase;
}

.at-soc-stat-icon {
    display: inline-flex;
    width: 29px;
    height: 29px;
    align-items: center;
    justify-content: center;
    border: 1px solid #292e35;
    border-radius: 7px;
    background: #121519;
}

.at-soc-stat-value {
    margin-top: 5px;
    color: #e9eaec;
    font-size: 27px;
    font-weight: 650;
    letter-spacing: -.04em;
    line-height: 1;
}

.at-soc-stat-trend {
    display: flex;
    align-items: center;
    gap: 7px;
    margin-top: auto;
    padding-top: 8px;
    color: #545b64;
    font-size: 8px;
}

.at-soc-stat-trend > span:first-child {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    padding: 3px 5px;
    border: 1px solid #252a30;
    border-radius: 5px;
    background: #13161a;
    font-weight: 700;
}

.at-soc-stat-trend .positive {
    color: #7ebc8a;
}

.at-soc-stat-trend .negative {
    color: #df7d81;
}

.at-soc-left-rail {
    position: absolute;
    top: 18px;
    bottom: 18px;
    left: 18px;
    z-index: 10;
    display: flex;
    width: 272px;
    flex-direction: column;
    gap: 9px;
    pointer-events: none;
}

.at-soc-stat-card,
.at-soc-panel {
    pointer-events: auto;
    border: 1px solid #242931;
    border-radius: 9px;
    background: rgba(12,15,19,.94);
    box-shadow: 0 12px 34px rgba(0,0,0,.22);
    backdrop-filter: blur(12px);
}

.at-soc-stat-card {
    height: 104px;
    flex: 0 0 104px;
}

.at-soc-ransom-panel {
    min-height: 0;
    flex: 1 1 auto;
    overflow: hidden;
}

.at-soc-panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-height: 43px;
    padding: 0 12px;
    border-bottom: 1px solid #20252b;
}

.at-soc-panel-header > span:first-child {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: #d4d6da;
    font-size: 9px;
    font-weight: 700;
    letter-spacing: .075em;
    text-transform: uppercase;
}

.at-soc-panel-header > span:first-child svg {
    color: #cf6268;
}

.at-soc-panel-meta {
    color: #535b64;
    font-size: 8px;
}

.at-soc-ransom-summary {
    display: grid;
    grid-template-columns: 1fr 1fr;
    padding: 11px 12px;
    border-bottom: 1px solid #1d2228;
}

.at-soc-ransom-summary div {
    min-width: 0;
}

.at-soc-ransom-summary div + div {
    padding-left: 14px;
    border-left: 1px solid #20252b;
}

.at-soc-ransom-summary span {
    display: block;
    color: #606872;
    font-size: 8px;
    text-transform: uppercase;
}

.at-soc-ransom-summary strong {
    display: block;
    margin-top: 5px;
    color: #e2e4e7;
    font-size: 19px;
    font-weight: 650;
}

.at-soc-ransom-summary strong.danger {
    color: #e5797d;
}

.at-soc-ransom-list {
    min-height: 0;
    padding: 11px 12px;
    overflow: auto;
}

.at-soc-section-label {
    display: block;
    margin-bottom: 7px;
    color: #5f6670;
    font-size: 8px;
    font-weight: 700;
    letter-spacing: .08em;
    text-transform: uppercase;
}

.at-soc-ransom-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    min-height: 51px;
    padding: 8px;
    border: 1px solid #24292f;
    border-radius: 7px;
    background: #101318;
}

.at-soc-ransom-row + .at-soc-ransom-row {
    margin-top: 5px;
}

.at-soc-ransom-row > div {
    min-width: 0;
}

.at-soc-ransom-row strong {
    display: block;
    overflow: hidden;
    color: #cfd2d6;
    font-size: 9px;
    font-weight: 600;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.at-soc-ransom-row span {
    display: block;
    margin-top: 3px;
    color: #7d5357;
    font-size: 8px;
}

.at-soc-ransom-row time {
    flex: 0 0 auto;
    color: #5e656e;
    font-size: 7px;
}

.at-soc-right-rail {
    position: absolute;
    top: 18px;
    right: 18px;
    bottom: 18px;
    z-index: 10;
    display: flex;
    width: 272px;
    flex-direction: column;
    gap: 9px;
    pointer-events: none;
}

.at-soc-right-rail > * {
    pointer-events: auto;
}

.at-soc-ioc-panel {
    height: 214px;
    flex: 0 0 214px;
}

.at-soc-vuln-panel {
    min-height: 0;
    flex: 1 1 auto;
}

.at-soc-header {
    display: flex;
    height: 58px;
    flex: 0 0 58px;
    align-items: center;
    justify-content: space-between;
    gap: 20px;
    padding: 0 18px;
    border-bottom: 1px solid #20242a;
    background: rgba(8,10,13,.95);
    backdrop-filter: blur(16px);
    position: relative;
    z-index: 20;
}

.at-soc-header .font-cyber {
    font-family: Inter,
        -apple-system,
        BlinkMacSystemFont,
        "Segoe UI",
        sans-serif;
}

.at-soc-brand-mark {
    display: inline-flex;
    width: 34px;
    height: 34px;
    align-items: center;
    justify-content: center;
    border: 1px solid rgba(214,40,40,.28);
    border-radius: 9px;
    background: #171114;
    box-shadow: 0 8px 22px rgba(0,0,0,.25);
}

.at-soc-brand-mark span {
    color: #e05d63;
    font-size: 15px;
    font-weight: 750;
}

.at-soc-news-ticker {
    position: relative;
    display: flex;
    width: 100%;
    height: 30px;
    flex: 0 0 30px;
    align-items: center;
    overflow: hidden;
    border-top: 1px solid #20242a;
    background: #080a0d;
}

.at-soc-news-ticker > div:first-child {
    background: #0b0e12 !important;
    border-right-color: #392024 !important;
    box-shadow: 5px 0 15px rgba(0,0,0,.55) !important;
}
`;

fs.writeFileSync(p, content + newCss, 'utf8');
