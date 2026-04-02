# NovaView User Manual

NovaView is a high-performance astronomical survey viewer based on Aladin Lite and Tauri. It supports loading HiPS (Hierarchical Progressive Surveys) from various sources including local files, Redis, and remote HTTP servers.

## Startup Commands

You can start NovaView with specific surveys using the `--survey` flag.

### Loading Local Surveys
To load a survey from your local filesystem:
```bash
npx tauri dev -- --survey hips_data/test_hips
```
Paths are relative to the project root or can be absolute.

### Loading from Redis
NovaView can fetch tiles directly from a Redis key-value store. It assumes a local Redis server at `127.0.0.1:6379`.
```bash
npx tauri dev -- --survey redis://iras_100um
```
In this case, NovaView will look for keys like `iras_100um/properties`, `iras_100um/Norder3/Dir0/Npix123.jpg`, etc.

### Loading from Remote HTTPS
Standard remote HiPS surveys can be loaded via their URL:
```bash
npx tauri dev -- --survey https://alasky.cds.unistra.fr/DSS/DSSColor
```

### Multiple Surveys
You can load multiple surveys at once, which will open in a grid view:
```bash
npx tauri dev -- --survey hips_data/test_hips --survey https://alasky.cds.unistra.fr/DSS/DSSColor
```

## Protocol Details

NovaView uses a custom internal protocol `hips-compute://` to bridge the frontend Aladin Lite with the Rust backend.

- `hips-compute://local/<path>`: Resolves to the local filesystem.
- `hips-compute://redis/<prefix>`: Resolves to Redis keys starting with `<prefix>`.
- `hips-compute://http/<url>`: Proxies HTTP requests through the Rust backend (useful for "compute" operations in the future).

## UI Controls

- **Data Sources Panel**: Toggle this to see the list of loaded surveys and add new ones dynamically.
- **Analysis Toolkit**: Future home of mathematical operations on surveys.
- **Layout**: Switch between single, horizontal, vertical, and grid views.
- **Sync**: When enabled, moving or zooming in one viewport will sync all other viewports.
- **Colormap & Stretch**: Adjust the visualization of the active survey. Supports FITS and JPEG/PNG formats.
