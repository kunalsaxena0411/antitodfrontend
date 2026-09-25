import os

css_to_append = """
/* ========================================================================
   Honeypot Logs Layout
   ======================================================================== */

.at-honeypot-logs {
  display: flex;
  flex-direction: column;
  padding: 32px 40px;
  gap: 24px;
  height: 100%;
  overflow: hidden;
}

.at-stream-layout {
  display: flex;
  gap: 24px;
  flex: 1;
  min-height: 0;
}

.at-stream-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: #111111;
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 8px;
  overflow: hidden;
}

.at-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  background: #131313;
}

.at-toolbar-left,
.at-toolbar-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.at-search-input {
  display: flex;
  align-items: center;
  background: #000;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  padding: 0 12px;
  height: 32px;
  width: 260px;
}

.at-search-input input {
  background: transparent;
  border: none;
  outline: none;
  color: #fff;
  font-size: 13px;
  width: 100%;
  margin-left: 8px;
}

.at-search-input input::placeholder {
  color: #666;
}

.at-btn-ghost {
  background: transparent;
  color: #888;
  border: 1px solid transparent;
}

.at-btn-ghost:hover {
  background: rgba(255, 255, 255, 0.05);
  color: #ededed;
}

/* Log Table */
.at-log-table-wrap {
  flex: 1;
  overflow: auto;
}

.at-log-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.at-log-table th {
  position: sticky;
  top: 0;
  background: #151515;
  color: #888;
  font-weight: 500;
  text-align: left;
  padding: 12px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  z-index: 10;
}

.at-log-table td {
  padding: 10px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.03);
  color: #ededed;
}

.at-log-table tbody tr {
  cursor: pointer;
  transition: background 0.15s ease;
}

.at-log-table tbody tr:hover {
  background: rgba(255, 255, 255, 0.03);
}

.at-log-table tbody tr.selected {
  background: rgba(214, 40, 40, 0.1);
}

.severity-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
}

.severity-badge.critical {
  background: rgba(255, 77, 77, 0.15);
  color: #ff4d4d;
}

.severity-badge.high {
  background: rgba(255, 159, 67, 0.15);
  color: #ff9f43;
}

.severity-badge.medium {
  background: rgba(254, 202, 87, 0.15);
  color: #feca57;
}

.severity-badge.low {
  background: rgba(255, 255, 255, 0.1);
  color: #a3a3a3;
}

/* Inspector */
.at-inspector {
  width: 400px;
  background: #111111;
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.at-inspector-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  background: #131313;
}

.at-inspector-header h2 {
  font-size: 16px;
  font-weight: 500;
  color: #fff;
  margin: 0 0 8px 0;
}

.at-inspector-id {
  font-family: ui-monospace, monospace;
  font-size: 12px;
  color: #888;
}

.at-inspector-content {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}

.at-prop-group {
  margin-bottom: 24px;
}

.at-prop-group h3 {
  font-size: 11px;
  font-weight: 600;
  color: rgba(214, 40, 40, 0.9);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin: 0 0 12px 0;
}

.at-prop-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.at-prop {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.at-prop-label {
  font-size: 11px;
  color: #888;
  text-transform: uppercase;
}

.at-prop-val {
  font-size: 13px;
  color: #ededed;
  font-weight: 500;
}

.at-prop-val.mono {
  font-family: ui-monospace, monospace;
}

.at-terminal-block {
  background: #000;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 6px;
  padding: 12px;
}

.at-terminal-block code {
  font-family: ui-monospace, monospace;
  font-size: 12px;
  color: #4ade80;
  white-space: pre-wrap;
  word-break: break-all;
}

.at-inspector-actions {
  padding: 20px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  display: flex;
  gap: 12px;
}

.at-btn-block {
  width: 100%;
  justify-content: center;
}
"""

with open('src/index.css', 'a', encoding='utf-8') as f:
    f.write(css_to_append)

print("Appended honeypot logs CSS")
