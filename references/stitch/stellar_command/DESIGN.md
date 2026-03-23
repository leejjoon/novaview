# Design System Specification: The Cosmic Command Center

## 1. Overview & Creative North Star
**The Creative North Star: "The Observational Monolith"**

This design system moves away from the "web-app-in-a-box" aesthetic and toward the high-fidelity feel of an advanced astrophysical workstation. It is defined by **The Observational Monolith**—a philosophy where the UI feels like a seamless, precision-milled physical instrument.

To break the "template" look, we utilize **Intentional Asymmetry**. Control panels are weighted to the left with strict density, while the right-side visualization viewport breathes with expansive, high-contrast typography. We bypass traditional grids by using "nested depth," where the UI appears to be carved out of a single piece of dark obsidian, layered with glowing data filaments.

---

## 2. Colors & Tonal Depth
Our palette is rooted in the void of space (`surface: #10131a`), utilizing the "Deep Dark" spectrum to allow data highlights to pierce through with maximum luminosity.

### The "No-Line" Rule
**Explicit Instruction:** Do not use 1px solid borders to define sections. Structural containment must be achieved through background shifts.
- A primary control panel should use `surface_container_low`.
- Nested property groups within that panel must shift to `surface_container`.
- High-priority data readouts sit in `surface_container_highest`.
*This creates a UI that feels architectural rather than "drawn."*

### Surface Hierarchy & Nesting
- **Base Layer:** `surface` (#10131a) for the overall application background.
- **Primary Workspaces:** `surface_container_low` (#191c22) for large sidebars.
- **Active Modules:** `surface_container` (#1d2026) for individual tool groups.
- **High-Intensity Focus:** `surface_bright` (#363940) for temporary pop-overs.

### The "Glass & Gradient" Rule
Floating overlays (modals, math operator popovers) must use **Glassmorphism**: 
- Background: `surface_container_high` at 70% opacity.
- Effect: 20px Backdrop Blur.
- Edge: A 1px "Ghost Border" using `outline_variant` at 15% opacity to catch the "light" of the data visualization behind it.

### Signature Textures
Main CTAs (e.g., "Run Analysis") should utilize a subtle linear gradient from `primary` (#c3f5ff) to `primary_container` (#00e5ff) at a 135-degree angle. This provides a "liquid light" feel that flat hex codes cannot replicate.

---

## 3. Typography: The Precision Scale
We employ a dual-font strategy to balance editorial authority with technical rigor.

*   **Display & Headlines (Space Grotesk):** Used for macroscopic data (e.g., Object Coordinates, Magnitude). The wide apertures and geometric forms evoke a "Command Center" aesthetic.
    *   *Headline-LG:* 2rem, tight letter-spacing (-0.02em).
*   **Body & Labels (Inter):** The workhorse for UI controls. It is chosen for its extreme legibility at small sizes (label-sm: 0.6875rem) within dense layouts.
*   **Data Readouts (Monospaced):** All numerical values and WebSocket logs must use a monospaced font (JetBrains Mono/Roboto Mono) to ensure tabular alignment and rapid scanning.

---

## 4. Elevation & Depth: Tonal Layering
Traditional shadows are too "earthly" for a scientific tool. We use **Tonal Layering** and **Ambient Glows**.

-   **The Layering Principle:** Place a `surface_container_lowest` (#0b0e14) input field inside a `surface_container` (#1d2026) panel. The "sinking" effect creates immediate focus without visual clutter.
-   **Ambient Shadows:** For floating math operator dropdowns, use a shadow with a 40px blur, 0px offset, and 6% opacity, tinted with `primary` (#c3f5ff). It should look like the panel is emitting a faint blue light.
-   **The "Ghost Border" Fallback:** Use only when high-density controls overlap. Apply `outline_variant` at 20% opacity. Never use 100% opaque lines.

---

## 5. Components: Technical Primitives

### Radio Buttons (Layer Selection)
- **Unselected:** A thin `outline` ring. No fill.
- **Selected:** A `secondary` (#e0b6ff) glowing center dot. 
- **Style:** Use `secondary_container` as a subtle "halo" around the selected state.

### Sliders (Contrast/Cutoffs)
- **Track:** `surface_container_highest` (#32353c).
- **Active Range:** A gradient from `primary` (#c3f5ff) to `tertiary` (#ffe9cd).
- **Thumb:** A crisp, 12px square with a `DEFAULT` (0.25rem) corner radius.

### Dropdowns (Colormaps/Operators)
- Forbid standard OS-level borders. Use `surface_container_highest` background.
- On hover, the list item should shift to `primary_container` (#00e5ff) with `on_primary_container` text.

### Status Indicators (WebSocket)
- **Connected:** `primary` (#c3f5ff) with a soft 4px outer glow.
- **Syncing:** `tertiary` (#ffe9cd) pulsing.
- **Error:** `error` (#ffb4ab) static.

### Input Fields (Coordinate Entry)
- **Style:** No bottom line or full border. Use a solid `surface_container_lowest` background. 
- **Interaction:** On focus, the background transitions to `surface_container_high` and the text color shifts to `primary`.

### Cards & Lists (Data Tables)
- **Strict Rule:** Forbid divider lines.
- **Separation:** Use `Spacing-4` (0.9rem) vertical gaps. If content is dense, use alternating row colors between `surface_container_low` and `surface`.

---

## 6. Do's and Don'ts

### Do
- **Do** use `Spacing-1.5` (0.3rem) for tight, expert-level control groupings.
- **Do** use `primary_fixed_dim` for non-interactive data labels to maintain hierarchy.
- **Do** embrace "Empty Space" as a structural tool in the viewport to contrast the "Dense" control panels.

### Don't
- **Don't** use pure white (#FFFFFF). All "white" text should be `on_surface` (#e1e2eb) to prevent eye strain in dark environments.
- **Don't** use standard `0.5rem` border-radii for everything. Use `sm` (0.125rem) for technical inputs and `full` for status pips.
- **Don't** use "Drop Shadows" to create depth; use "Background Tone Shifts." Shadows are only for floating glass overlays.