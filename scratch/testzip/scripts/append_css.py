import os

css_to_append = """
/* ========================================================================
   Page Components (Dashboard, PageHeader)
   ======================================================================== */

.at-dashboard {
  display: flex;
  flex-direction: column;
  padding: 32px 40px;
  gap: 32px;
  overflow-y: auto;
  height: 100%;
}

.at-page-header {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding-bottom: 24px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.at-page-header-inner {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.at-breadcrumb-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.at-breadcrumbs {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: #888;
}

.at-breadcrumb {
  display: flex;
  align-items: center;
  gap: 6px;
}

.at-breadcrumb .current {
  color: #ededed;
  font-weight: 500;
}

.at-range-control {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: #a3a3a3;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.at-range-control:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #ededed;
}

.at-page-title-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}

.at-page-heading h1 {
  font-size: 24px;
  font-weight: 600;
  color: #ffffff;
  letter-spacing: -0.02em;
  margin: 0 0 6px 0;
}

.at-page-heading p {
  font-size: 14px;
  color: #888;
  margin: 0;
}

/* Dashboard Metrics Grid */
.at-metric-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 16px;
}

.at-metric-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px;
  background: #111111;
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 8px;
  transition: all 0.2s ease;
  cursor: pointer;
}

.at-metric-card:hover {
  background: #151515;
  border-color: rgba(255, 255, 255, 0.12);
  transform: translateY(-1px);
}

.at-metric-card-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.03);
  color: #888;
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.at-metric-card-content {
  flex: 1;
  margin-left: 16px;
}

.at-metric-card-label {
  font-size: 12px;
  color: #888;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  font-weight: 500;
  margin-bottom: 4px;
}

.at-metric-card-value {
  font-size: 28px;
  font-weight: 600;
  color: #fff;
  line-height: 1;
  letter-spacing: -0.02em;
}

.at-metric-card-helper {
  font-size: 12px;
  color: #666;
  margin-top: 6px;
}

.at-metric-card-arrow {
  color: #444;
  transition: color 0.2s ease;
}

.at-metric-card:hover .at-metric-card-arrow {
  color: #888;
}

/* Dashboard Content Grid */
.at-dashboard-grid {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 24px;
}

.at-chart-card {
  background: #111111;
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.at-chart-header {
  padding: 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}

.at-eyebrow {
  display: inline-block;
  font-size: 11px;
  font-weight: 600;
  color: rgba(214, 40, 40, 0.9);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin-bottom: 8px;
}

.at-chart-header h3 {
  font-size: 16px;
  font-weight: 500;
  color: #fff;
  margin: 0 0 4px 0;
}

.at-chart-header p {
  font-size: 13px;
  color: #888;
  margin: 0;
}

.at-chart-legend {
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 12px;
  color: #a3a3a3;
}

.at-chart-legend span {
  display: flex;
  align-items: center;
  gap: 6px;
}

.at-chart-legend i {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.at-chart-legend i.critical { background: #ff4d4d; }
.at-chart-legend i.high { background: #ff9f43; }
.at-chart-legend i.medium { background: #feca57; }

.at-chart-wrap {
  padding: 20px;
  height: 300px;
}

.at-list-card {
  background: #111111;
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 8px;
  padding: 20px;
  display: flex;
  flex-direction: column;
}

.at-list-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}

.at-list-header h3 {
  font-size: 15px;
  font-weight: 500;
  color: #fff;
  margin: 0;
}

.at-list-action {
  font-size: 13px;
  color: #666;
  background: none;
  border: none;
  cursor: pointer;
  transition: color 0.2s;
}

.at-list-action:hover {
  color: #fff;
}

.at-threat-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.at-threat-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.03);
  border-radius: 6px;
  transition: all 0.2s ease;
  cursor: pointer;
}

.at-threat-item:hover {
  background: rgba(255, 255, 255, 0.04);
  border-color: rgba(255, 255, 255, 0.08);
}

.at-threat-item-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 6px;
  background: rgba(214, 40, 40, 0.1);
  color: #ff4d4d;
}

.at-threat-item-content {
  flex: 1;
  min-width: 0;
}

.at-threat-item-title {
  font-size: 14px;
  font-weight: 500;
  color: #ededed;
  margin-bottom: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.at-threat-item-meta {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 12px;
  color: #888;
}

.at-threat-item-meta span {
  display: flex;
  align-items: center;
  gap: 4px;
}

.at-threat-item-score {
  font-size: 13px;
  font-weight: 600;
  color: #ff4d4d;
}

.at-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.at-btn-primary {
  background: #fff;
  color: #000;
  border: 1px solid #fff;
}

.at-btn-primary:hover {
  background: #e5e5e5;
  border-color: #e5e5e5;
}
"""

with open('src/index.css', 'a', encoding='utf-8') as f:
    f.write(css_to_append)

print("Appended dashboard CSS")
