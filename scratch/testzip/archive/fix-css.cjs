const fs = require('fs');
const p = 'c:/Users/rishi/ANTI AI/ANTI-TODE/Xyberah-redesign/src/index.css';
let d = fs.readFileSync(p, 'utf8');

const regex = /\.at-news-row\s*\{[\s\S]*?\.at-news-row\.selected\s*\{[\s\S]*?\}/;

const replacement = `.at-news-table th {
  padding: 10px 14px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  background: #111;
  color: #888;
  font-size: 10px;
  text-transform: uppercase;
}

.at-news-table td {
  padding: 14px;
  vertical-align: top;
  border-bottom: 1px solid rgba(255, 255, 255, 0.03);
}

.at-news-table tbody tr {
  cursor: pointer;
  transition: background 0.15s ease;
}

.at-news-table tbody tr:hover {
  background: rgba(255, 255, 255, 0.03);
}

.at-news-table tbody tr.active {
  background: rgba(214, 40, 40, 0.1);
}`;

if (regex.test(d)) {
  d = d.replace(regex, replacement);
  fs.writeFileSync(p, d, 'utf8');
  console.log('Successfully replaced .at-news-row CSS');
} else {
  console.log('Could not find .at-news-row block');
}
