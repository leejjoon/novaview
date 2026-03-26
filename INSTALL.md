# NovaView Installation Guide

NovaView is a Tauri-based HiPS viewer application. Follow these instructions to set up your development environment, build the project, and run the test client.

## Prerequisites

Before building NovaView, ensure you have the following installed on your system:

### 1. Node.js
NovaView requires Node.js (version 20 is recommended, as noted in the project files). You can install it using `nvm` (Node Version Manager):
```bash
nvm install 20
nvm use 20
```

### 2. Rust
Tauri uses Rust for its backend. Install `rustup`, which will install `rustc` and `cargo`:
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

### 3. Tauri System Dependencies
Since this is a Tauri application running on Linux, you will need several system dependencies (WebKit2GTK, etc.). 
For Debian/Ubuntu-based systems, run:
```bash
sudo apt update
sudo apt install libwebkit2gtk-4.1-dev \
    build-essential \
    curl \
    wget \
    file \
    libssl-dev \
    libgtk-3-dev \
    libayatana-appindicator3-dev \
    librsvg2-dev
```
*(For other operating systems, please refer to the official [Tauri Prerequisites Guide](https://tauri.app/v1/guides/getting-started/prerequisites)).*

---

## Installation & Setup

1. **Clone or navigate to the repository:**
   ```bash
   cd /path/to/novaview
   ```

2. **Install Node.js dependencies:**
   ```bash
   npm install
   ```

---

## Running NovaView in Development Mode

To start the NovaView application in development mode (which provides hot-reloading for the frontend), run:

```bash
nvm use 20
npm run tauri dev
```

### Launching with a Specific Survey
You can optionally pass a specific HiPS survey URL when launching the app:

```bash
nvm use 20
npx tauri dev -- -- --survey https://alasky.cds.unistra.fr/2MASS/K
```

---

## Building for Production

To build a standalone executable for production, use the Tauri build command:

```bash
npm run tauri build
```
*(Note: Tauri will automatically run the Vite build script defined in `package.json` before compiling the Rust binary).*

The compiled binaries will be located in the `src-tauri/target/release/` directory.

---

## Testing the WebSocket Remote Control

NovaView includes a Python test client (`test_client.py`) to verify external control capabilities over WebSockets.

1. **Ensure you have Python 3 installed.**
2. **Install the `websockets` package:**
   ```bash
   pip install websockets
   ```
3. **Run NovaView** (as described above).
4. **Run the Python test script in a separate terminal:**
   ```bash
   python test_client.py
   ```
