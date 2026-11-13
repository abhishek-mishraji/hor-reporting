# 08 — UI Design System & Component Guidelines

A production-grade design specification for the **HOR Stores Client Reporting Dashboard**. 
This document defines the visual hierarchy, token architecture, color palettes, typography, interactive states, and component contracts modeled after modern fintech and enterprise standards (Stripe, Linear, Vercel Geist).

---

## 1. Design Philosophy: "Editorial Calm & Retail Precision"

Store owners and operations managers rely on this dashboard to review day-to-day revenue, verify cash drops, audit voids, and balance fuel and lottery sales. The UI must inspire confidence through clarity, speed, and restraint:

1. **Zero Logical Deviation**: All data transformations, number formatting (integer cents, milli-gallons, half-up rounding), API contracts, and vendor routing are preserved 100% without alteration.
2. **Tabular Numerics Everywhere**: Financial numbers, counts, and dates strictly utilize `font-variant-numeric: tabular-nums` and monospace font stacks to guarantee vertical decimal alignment across columns.
3. **Restrained Semantic Palette**: Color is reserved for actionable status (success, warning, alert) and structural branding. The interface avoids saturated decorative fills, maintaining high visual comfort across extended usage.
4. **Information Architecture (Inverted Pyramid)**:
   - **Command Bar (Global Context)**: Store picker, active date window, real-time sync status, theme switcher, and profile.
   - **Verdict Row (Executive KPI Summary)**: Key revenue drivers (Merchandise Net, Fuel Gallons/Sales, Lottery Net, Customer Count) calculated directly from loaded rows.
   - **Filter & Customization Toolbar**: Search, department filtering, toggle switches, column preferences, and CSV exports.
   - **Workhorse Data Grid**: Sticky headers, collapsible subtotals, right-aligned monetary values, and row hover indicators.
   - **Transaction Receipt Inspector**: Deep-dive drilldown presented as an itemized digital retail receipt.

---

## 2. Token Architecture & Surface Ladders

The design system uses a strict CSS custom property hierarchy supporting both **Light Mode** (clean paper/alabaster surfaces) and **Dark Mode** (deep obsidian/slate surfaces).

### 2.1 Surface Ladders

| Layer | Light Mode Token | Hex | Dark Mode Token | Hex | Purpose |
|---|---|---|---|---|---|
| **App Canvas** | `--bg-app` | `#f8fafc` | `--bg-app` | `#090d16` | Underlying viewport backdrop |
| **Card / Surface** | `--bg-card` | `#ffffff` | `--bg-card` | `#0f172a` | Primary data cards, tables, modal containers |
| **Subtle Surface** | `--bg-subtle` | `#f1f5f9` | `--bg-subtle` | `#1e293b` | Table headers, control wells, active tabs |
| **Hover Surface** | `--bg-hover` | `#e2e8f0` | `--bg-hover` | `#334155` | Table row hover, menu item hover |
| **Border Subtle** | `--border-subtle` | `#e2e8f0` | `--border-subtle` | `#1e293b` | Divider hairlines, table gridlines |
| **Border Strong** | `--border-strong` | `#cbd5e1` | `--border-strong` | `#334155` | Card borders, interactive input strokes |

### 2.2 Semantic & Brand Palette

```css
/* Brand Core */
--brand-primary: #4f46e5;         /* Indigo 600 */
--brand-primary-hover: #4338ca;   /* Indigo 700 */
--brand-subtle: #eef2ff;          /* Indigo 50 (Dark: #1e1b4b) */
--brand-glow: rgba(79, 70, 229, 0.15);

/* Semantic Indicators */
--status-success: #10b981;        /* Emerald 500 */
--status-success-bg: #ecfdf5;     /* Emerald 50 (Dark: #064e3b) */
--status-warning: #f59e0b;        /* Amber 500 */
--status-warning-bg: #fffbeb;     /* Amber 50 (Dark: #451a03) */
--status-danger: #ef4444;         /* Red 500 */
--status-danger-bg: #fef2f2;      /* Red 50 (Dark: #450a0a) */
--status-info: #0284c7;           /* Sky 600 */
--status-info-bg: #f0f9ff;        /* Sky 50 (Dark: #082f49) */
```

### 2.3 Typography Scale

* **Font Families**:
  * Sans: `'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`
  * Tabular / Code: `'JetBrains Mono', 'SFMono-Regular', Menlo, Consolas, monospace`
* **Scale**:
  * Display / KPI Numbers: `1.5rem (24px)` to `1.75rem (28px)`, weight `700`, line-height `1.1`
  * Section Headers (H3): `1.0625rem (17px)`, weight `600`, tracking `-0.01em`
  * Body Text: `0.875rem (14px)`, weight `400` / `500`, line-height `1.5`
  * Table Cells / Numbers: `0.8125rem (13px)`, weight `500`, tabular alignment
  * Micro / Badges: `0.6875rem (11px)` to `0.75rem (12px)`, weight `600`, uppercase tracking `0.04em`

---

## 3. Component Design Specifications

### 3.1 Command Bar & Header (`Layout.jsx`)
* **Layout**: Sticky top navigation bar (`z-index: 40`) with subtle backdrop blur (`backdrop-filter: blur(8px)`).
* **Brand Block**: Clean gradient monogram badge ("HOR") with subtle glow, paired with "Store Reports" label.
* **Store Selector**: Custom select element with store name and location identifier.
* **Date Presets & Inputs**: Native date inputs formatted cleanly alongside a sync/refresh button with rotational feedback during data fetching.
* **User Profile & Theme Toggle**:
  * User avatar badge with name and role.
  * Three-state segmented control (Light / Dark / Auto) with smooth slide transition.
  * Logout button with subtle destructive hover state.

### 3.2 Report Navigation Tabs
* **Visual Treatment**: Horizontal pill or bottom-border active indicator with smooth transition (`transition: all 150ms cubic-bezier(0.4, 0, 0.2, 1)`).
* **States**:
  * *Default*: Subdued text (`--text-muted`), transparent background.
  * *Hover*: Subtle surface lift (`--bg-subtle`), sharp text.
  * *Active*: High-contrast text (`--brand-primary`), solid bottom accent bar or pill background.

### 3.3 Executive KPI Summary Row (`KpiSummaryGrid`)
Rendered directly above dense tables on key screens (e.g., *Day Summary* and *Monthly*):
* **Card Structure**: 3–4 high-density metric tiles displaying:
  * Metric Label (e.g., "Merchandise Net", "Total Fuel Gallons", "Lottery Net", "Customer Traffic")
  * Hero Value formatted with currency/gallon symbols and tabular alignment.
  * Context Subtext (e.g., "Excludes fuel & lottery", "Across selected date range").
* **Responsive Behavior**: 4-column grid on desktops (`minmax(200px, 1fr)`), 2-column on tablets, single column stacked on mobile.

### 3.4 High-Density Data Grids (`ReportTable.jsx`)
* **Sticky Header**: Pinned header row (`position: sticky; top: 0; z-index: 10`) with solid subtle background to prevent bleed-through during scrolling.
* **Numeric Column Alignment**: Right-aligned headers and cells with monospaced digits.
* **Collapsible Groups (Subtotals)**:
  * Accordion header row with animated chevron (`▾` / `▸`), group name, and item count badge.
  * Subtotal row anchored at the bottom of each group with a top border hairline.
* **Grand Total Row**: Pinned bottom row (`position: sticky; bottom: 0; z-index: 5`) with emphasized typography and border separation.
* **Column Chooser (`ColumnPicker.jsx`)**:
  * Dropdown checklist with search/filter for wide reports.
  * Column visibility counter badge (e.g., `8/12`).
  * Instant reset button to restore default views.
* **CSV Export**: Clean icon button with immediate file download capability.

### 3.5 Transaction Receipt Inspector (`DrilldownModal.jsx`)
Replacing generic table popups with a specialized retail receipt inspector:
* **Receipt Header**:
  * Store code, transaction timestamp, terminal ID, cashier number, and sequence.
  * Type pill (e.g., `SALE`, `REFUND`, `VOID`, `SAFE DROP`).
* **Itemized Lines Section**:
  * Grid showing item description, department, quantity, unit price, and extended total.
  * Negative amounts (refunds, voids) highlighted in soft crimson.
* **Payment / Tender Breakdown**:
  * Tender type (Cash, Visa, MasterCard, Fleet, Lottery Voucher) and amount paid.
* **Tax Summary**:
  * Net sales, total tax collected, and grand total.

### 3.6 Login Experience (`LoginPage.jsx`)
* Centered card container with elevated surface layering and subtle ambient radial gradient.
* Verified security badges and plain-language error messaging (wrong password, account locked, account disabled).
* Smooth autofocus, input icons, and clear interactive focus rings.

### 3.7 Loading Skeletons & Empty States
* **Shimmer Skeletons**: CSS-animated gradient skeleton bars matching the table rows and KPI cards, preventing Cumulative Layout Shift (CLS).
* **Empty States**: Clear graphic icon, informative title (e.g., "No transactions recorded for selected dates"), and actionable recovery tips without technical jargon.

---

## 4. Accessibility & Quality Checklist

1. **Color Contrast**: All text-to-background combinations meet or exceed WCAG 2.1 AA standards (minimum contrast ratio `4.5:1` for regular text, `3:1` for large numbers and UI borders).
2. **Keyboard Navigation**:
   * Modals close on `Escape` key and trap focus appropriately.
   * Dropdowns, tabs, and table group accordions are fully keyboard accessible with visible focus rings (`box-shadow: 0 0 0 3px var(--brand-glow)`).
3. **No Layout Shift (CLS)**: Skeleton screens preserve layout bounds while API calls resolve.
4. **Independent Viewport Scrolling**: Data tables scroll inside their dedicated card container with persistent outer navigation and controls.
