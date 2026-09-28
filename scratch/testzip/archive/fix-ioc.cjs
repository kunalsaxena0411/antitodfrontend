const fs = require('fs');
const p = 'c:/Users/rishi/ANTI AI/ANTI-TODE/Xyberah-redesign/src/index.css';
let d = fs.readFileSync(p, 'utf8');

const append = `

/* IOC MANAGER FIXES */
.at-ioc-query-row input[type="search"] {
  background: transparent;
  border: none;
  color: var(--at-text);
  outline: none;
  flex: 1;
  font-family: inherit;
  font-size: inherit;
}

.at-ioc-filter-control select {
  background: var(--at-surface);
  border: 1px solid var(--at-border);
  color: var(--at-text);
  outline: none;
  padding: 4px 6px;
  border-radius: 4px;
}

.at-ioc-observation-grid>div span,
.at-ioc-metadata-grid>div span {
  display: block;
  margin-bottom: 4px;
  color: var(--at-disabled);
  font-size: 9px;
  text-transform: uppercase;
}

.at-ioc-observation-grid>div code,
.at-ioc-metadata-grid>div code {
  display: block;
  color: var(--at-text);
  font: 10px/1.3 "JetBrains Mono", ui-monospace, monospace;
}

.at-ioc-value {
  display: block;
}

.at-ioc-type-label {
  display: block;
  margin-top: 2px;
}
`;

fs.writeFileSync(p, d + append, 'utf8');
console.log('Appended IOC CSS fixes');
