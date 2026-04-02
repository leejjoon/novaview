# Developer Guide

This document contains information for developers working on NovaView.

## UI Testing in Browser

While NovaView is primarily a Tauri desktop application, you can test the frontend UI in a standard web browser for faster development cycles.

### URL Parameters for Browser Mode

When running with `npm run dev` and accessing via a browser (e.g., `http://localhost:5173`), you can use URL parameters to simulate startup arguments that would normally be passed via the CLI in Tauri.

- **`?survey=<URL>`**: Specify an initial HiPS survey to load.
- **Multiple Viewports**: Pass the `survey` parameter multiple times to trigger a split-screen viewport layout.

**Example:**
`http://localhost:5173/?survey=https://alasky.cds.unistra.fr/DSS/DSSColor&survey=https://alasky.u-strasbg.fr/AllWISE/RGB`

### Limitations in Browser Mode

1. **Local Files**: Browsers cannot access local filesystem paths (e.g., `/home/user/hips_data`). Use public HiPS URLs or serve your local data via a local HTTP server for browser testing.
2. **Tauri APIs**: Backend-specific features (like window controls or custom protocol handling) are mocked in browser mode.
3. **`hips-compute://` Protocol**: This protocol is only available when running as a Tauri app.

## Running as a Tauri App

To test with full backend support and local file access:

```bash
npm run tauri dev -- --survey /path/to/local/hips
```
