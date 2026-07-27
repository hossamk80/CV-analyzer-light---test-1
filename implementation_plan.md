# Implementation Plan — Integrations & API Connections Settings

This plan describes the additions to implement a unified **Integrations & API Connections** Settings page, allowing the Admin to configure LinkedIn AI Sourcing, Odoo ERP, and Custom Webhooks.

---

> [!IMPORTANT]
> **Strict Rule Acknowledgment:** We will NOT remove, modify, or break any existing features, screens, configurations (GDPR, Role-Based Access, AI Prompt settings, existing Dev Portal, etc.). All changes are additive.

---

## Proposed Changes

### Database Layer

#### [MODIFY] [schema.ts](file:///e:/CV-analyzer-light/src/db/schema.ts)
- Define a new Drizzle table schema `integrationsSettings` (maps to database table `integrations_settings`).
- Fields:
  - `id`: `integer().primaryKey({ autoIncrement: true })`
  - `platformName`: `text().notNull().unique()` (e.g., `'LinkedIn'`, `'Odoo'`, `'Custom'`)
  - `isActive`: `integer().notNull().default(0)` (0 or 1)
  - `endpointUrl`: `text()`
  - `apiKey`: `text()`
  - `clientId`: `text()`
  - `clientSecret`: `text()`
  - `customHeaders`: `text()` (JSON string representing mapping or custom headers)
  - `lastSyncDate`: `text()`

---

### Backend API Server

#### [MODIFY] [server.ts](file:///e:/CV-analyzer-light/server.ts)
1. **Schema Initialization (`initDbSchema`)**:
   - Add a `CREATE TABLE IF NOT EXISTS integrations_settings` block to execute on server startup.
2. **Database Seeding (`seedDatabase`)**:
   - Seed default records for the three modules (`LinkedIn`, `Odoo`, `Custom`) if they do not already exist, ensuring the UI has default records to bind values to.
3. **API Routes**:
   - `GET /api/integrations`: Retrieve all integration connection settings (restricted to `admin` role🔒).
   - `PUT /api/integrations/:platformName`: Update connection details for a platform (restricted to `admin` role🔒).
   - `POST /api/integrations/test-connection`: Simulate connection test. It will perform a fetch attempt with timeout to the platform endpoint, falling back to mock rules if localhost/mock urls are supplied (restricted to `admin` role🔒).

---

### Internationalization

#### [MODIFY] [en.ts](file:///e:/CV-analyzer-light/src/i18n/en.ts)
- Add English translation strings for integrations navigation, platform module labels, test connections, and statuses.

#### [MODIFY] [ar.ts](file:///e:/CV-analyzer-light/src/i18n/ar.ts)
- Add Arabic translation strings mirroring the English keys for dynamic RTL presentation.

---

### Sidebar Navigation & Routing

#### [MODIFY] [App.tsx](file:///e:/CV-analyzer-light/src/App.tsx)
- Import the Lucide `Link2` icon.
- Add `/settings/integrations` as a sub-page route under Admin-only protection.
- Inject the navigation entry for the Integrations page in the collapsible sidebar.

---

### Frontend Views & Components

#### [NEW] [IntegrationsSettings.tsx](file:///e:/CV-analyzer-light/src/views/Settings/IntegrationsSettings.tsx)
- Access restricted to `admin` only.
- Render 3 modular cards:
  - **LinkedIn AI Sourcing Card**: Configuration fields for Client ID, Client Secret, and OAuth Redirect URI.
  - **Odoo ERP Card**: Configuration fields for Odoo Server URL, Database Name, Admin Email, and API Key / Password.
  - **Custom Platform Webhook Card**: Configuration fields for Custom Platform Name, Base API URL, Auth Type dropdown, Auth Value, and JSON payload mapping textarea.
- Interactive features:
  - An "Enable/Disable" toggle switch per platform.
  - A "Test Connection" (فحص الاتصال) trigger executing connection validation with feedback.
  - Form validation and dynamic toast notification banners.
  - Seamless RTL/LTR layout transitions using `t('key')`.

---

## Verification Plan

### Automated Tests
- Run TypeScript checking (`pnpm run lint`) to guarantee type-safety on new exports and variables.
- Run production bundler (`pnpm run build`) to ensure Vite assets and compiled server code bundle cleanly.

### Manual Verification
- Log in as **Hiring Manager** or **Recruiter** and verify that the Integrations route is hidden from the sidebar and returns "Access Denied" if visited directly.
- Log in as **Admin**, click the sidebar integrations link, expand each module, toggle status switches, test connection parameters, and save edits.
