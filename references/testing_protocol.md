# **AI Agent Testing Protocol for NovaView**

## **1\. The Challenge of Testing Tauri \+ WebGL**

Standard AI web agents (using LangChain, AutoGPT, etc.) navigate by reading the HTML DOM structure. In NovaView:

1. **The Desktop Barrier:** The app is a native .exe or .app, not a URL.  
2. **The WebGL Barrier:** The HiPS tiles and FITS images are drawn on a WebGL \<canvas\>. The DOM does not contain \<img\> tags for the agent to inspect.  
3. **The Native OS Barrier:** When the app opens a native "Select Folder" dialog to load local HiPS or FITS files, the webview loses focus, and Playwright cannot interact with native OS windows.

## **2\. The Solution: Playwright over CDP \+ Vision LLM**

To enable an AI agent to test this app, we will launch the Tauri executable directly via Playwright's Chrome DevTools Protocol (CDP) connection, and use screenshot analysis for validation.

### **Step 1: Configuring Tauri for the AI Agent**

In your tauri.conf.json, ensure that debugging is enabled for your test builds so Playwright can attach to the webview window:

"build": {  
  "devPath": "../dist",  
  "runner": "cargo",  
  "withGlobalTauri": true  
},  
"app": {  
  "macOSPrivateApi": true // Sometimes needed for deep testing on Mac  
}

### **Step 2: The Agent's Playwright Setup**

Your AI testing script (likely written in Python) will not navigate to a URL. Instead, it executes the compiled Tauri binary. The agent can also pass CLI arguments (like \--survey) to test the launch configurations.

from playwright.sync\_api import sync\_playwright

def start\_agent\_session():  
    with sync\_playwright() as p:  
        \# Launch the compiled Tauri desktop app directly\!  
        \# This requires the app to be built in debug/dev mode, or CDP enabled  
        browser \= p.chromium.launch\_persistent\_context(  
            user\_data\_dir="/tmp/tauri-test-profile",  
            executable\_path="./target/debug/novaview.exe", \# Path to Tauri binary  
            args=\[  
                "--remote-debugging-port=9222",  
                "--survey", "local:///data/test\_hips" \# Testing the CLI  
            \]  
        )  
          
        \# The first page in the context is the Tauri window  
        page \= browser.pages\[0\]  
        return page

## **3\. How the AI Agent Executes the Test**

The AI agent operates in a loop: **Act (Playwright/WebSocket) \-\> Observe (Screenshot) \-\> Evaluate (Vision LLM).**

### **Scenario A: Testing the Rust Synchronous Math (UI Interaction)**

**Goal:** Verify that the Rust backend correctly subtracts Survey B from Survey A synchronously when commanded via the UI.

1. **Agent Action (DOM Interaction):**  
   The agent uses Playwright to find the UI controls and initiate the math.  
   page.fill("\#survey-a-input", "local://data/iras\_100um")  
   page.fill("\#survey-b-input", "local://data/iras\_60um")  
   page.select\_option("\#math-operator", "subtract")  
   page.click("\#btn-compute")

2. **Agent Observation (Handling the WebGL Canvas):**  
   Because the agent cannot "read" the pixels in the DOM, it takes a screenshot of the Aladin Lite canvas element.  
   \# Wait for the network requests (hips-compute://) to finish  
   page.wait\_for\_timeout(2000) 

   \# Take a picture of just the astronomical viewer  
   canvas\_bytes \= page.locator("\#aladin-lite-container").screenshot()

3. **Agent Evaluation (Vision Validation):**  
   The agent sends the screenshot to a Vision model (like Gemini 1.5 Pro) with a specific prompt.  
   * *Agent Prompt:* "You are an astronomical QA tester. Attached is a screenshot of an Aladin Lite viewer displaying an image subtraction (IRAS 100um \- 60um). Does the image show correct differencing artifacts (e.g., dark and light contrasting regions), or is the canvas blank, solid black, or showing an error pattern?"  
   * *Vision Model Response:* "The image successfully displays high-contrast differencing artifacts, indicating the subtraction operation completed and rendered correctly."

### **Scenario B: Testing the Python Remote Control (WebSocket IPC)**

**Goal:** Verify that the embedded WebSocket server correctly receives commands and updates the FITS rendering in the UI.

1. **Agent Action (WebSocket Payload):**  
   The agent uses a standard WebSocket client in Python to send a rendering command to the app, bypassing Playwright entirely for the input.  
   import websockets  
   import asyncio  
   import json

   async def send\_command():  
       async with websockets.connect("ws://127.0.0.1:8765") as ws:  
           await ws.send(json.dumps({  
               "action": "update\_fits\_display",  
               "colormap": "plasma",  
               "scale": "log"  
           }))  
   asyncio.run(send\_command())

2. **Agent Observation & Evaluation:**  
   The agent immediately uses Playwright to screenshot the canvas again and asks the Vision LLM: *"Did the colormap change to 'plasma' (purple/orange hues) with a logarithmic scale?"*

## **4\. Bypassing Native OS Dialogs for the Agent**

Playwright **cannot** click buttons inside a native Windows/macOS "Select File" dialog.

**The Workaround:** For automated testing, you must build a "headless mode" or "test mode" into your Tauri Rust backend.

Instead of the JS UI calling the OS file picker:

// Normal flow (Breaks AI Agent)  
const path \= await open({ directory: true }); 

The agent injects a direct command to the Rust backend to bypass the UI:

\# The agent bypasses the UI and forces Rust to mount a test directory  
page.evaluate("window.\_\_TAURI\_\_.invoke('mount\_local\_hips', { path: '/test/data/hips\_a' })")

## **5\. End-to-End AI Agent Pipeline Summary**

Because the architecture has been simplified to a single native binary with synchronous math, the testing pipeline is much more straightforward:

1. Agent launches the compiled NovaView.exe (optionally testing the CLI by injecting \--survey arguments).  
2. Agent connects to the embedded WebSocket server (ws://127.0.0.1:8765) to validate the Python remote control API.  
3. Agent uses Playwright to click UI radio buttons and dropdowns to test local math operations.  
4. Agent monitors the Playwright Network tab to ensure hips-compute:// custom protocol requests are firing successfully.  
5. Agent screenshots the WebGL canvas and uses a VLM to visually confirm that the HiPS tiles or FITS images loaded and that the colormaps/math were applied correctly.