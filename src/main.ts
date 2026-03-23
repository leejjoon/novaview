import { invoke } from "@tauri-apps/api/core";
import '@fontsource/space-grotesk/300.css';
import '@fontsource/space-grotesk/400.css';
import '@fontsource/space-grotesk/500.css';
import '@fontsource/space-grotesk/600.css';
import '@fontsource/space-grotesk/700.css';
import '@fontsource/inter/300.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/500.css';
import 'material-symbols/outlined.css';
function log(msg: string) {
    invoke('log_message', { msg });
}

// Panel toggle helpers
function setupPanelToggle(btnId: string, panelId: string) {
    const btn = document.getElementById(btnId);
    const panel = document.getElementById(panelId);
    if (!btn || !panel) return;

    btn.addEventListener('click', () => {
        const isHidden = panel.classList.toggle('hidden');
        // Active state on button
        if (isHidden) {
            btn.classList.remove('bg-[#1d2026]', 'text-[#00e5ff]', 'border-[#00e5ff]', 'opacity-100');
            btn.classList.add('opacity-50', 'border-transparent');
        } else {
            btn.classList.remove('opacity-50', 'border-transparent');
            btn.classList.add('bg-[#1d2026]', 'text-[#00e5ff]', 'border-[#00e5ff]', 'opacity-100');
        }
    });
}

setupPanelToggle('btn-toggle-data-sources', 'panel-data-sources');
setupPanelToggle('btn-toggle-analysis', 'panel-analysis-toolkit');

log("Waiting for Aladin to load...");

const checkA = setInterval(() => {
    const A = (window as any).A;
    if (A) {
        clearInterval(checkA);
        log("Aladin object found, initializing...");

        A.init.then(() => {
            const aladin = A.aladin('#aladin-lite-container', {
                survey: 'hips-compute://local_survey',
                cooFrame: 'galactic',
                showLayersControl: false,
                showFullscreenControl: false,
                showReticleControl: false,
                showZoomControl: false,
                showCooLocation: false,
                showProjectionControl: false,
                showContextMenu: false,
                showFrame: false,
                showStatusBar: false,
            });

            // Event Hooks for Bottom Right Coord Panel
            aladin.on('positionChanged', () => {
                const center = aladin.getRaDec();
                const elem = document.getElementById('label-center-radec');
                if(elem && center) elem.innerText = `${center[0].toFixed(4)} | ${center[1].toFixed(4)}`;
            });
            aladin.on('zoomChanged', () => {
                const fov = aladin.getFov();
                const elem = document.getElementById('label-fov');
                if(elem && fov) elem.innerText = `${fov[0].toFixed(2)}°`;
            });

            // --- Default init: apply colormap + cuts to match the UI defaults ---
            const DEFAULT_COLORMAP = 'viridis';
            const DEFAULT_VMIN = -0.5;
            const DEFAULT_VMAX = 15.0;
            const applyImgOptions = (opts: Record<string, unknown>) => {
                const baseLayer = aladin.getBaseImageLayer();
                if (baseLayer && baseLayer.setOptions) baseLayer.setOptions(opts);
            };
            // Apply on next tick so the survey has time to load
            setTimeout(() => {
                applyImgOptions({ colormap: DEFAULT_COLORMAP, stretch: 'linear', minCut: DEFAULT_VMIN, maxCut: DEFAULT_VMAX });
            }, 500);

            // FITS Controls Wiring
            document.getElementById('colormap-select')?.addEventListener('change', (e) => {
                applyImgOptions({ colormap: (e.target as HTMLSelectElement).value });
            });

            document.querySelectorAll('.scale-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const scale = (e.currentTarget as HTMLElement).getAttribute('data-scale') || 'linear';
                    applyImgOptions({ stretch: scale });

                    document.querySelectorAll('.scale-btn').forEach(b => {
                        b.classList.remove('border-primary', 'text-primary', 'bg-surface-container-low');
                        b.classList.add('border-transparent', 'text-on-surface/60', 'bg-surface-container-lowest');
                        const ic = b.querySelector('.material-symbols-outlined') as HTMLElement | null;
                        if (ic) { ic.innerText = 'radio_button_unchecked'; ic.style.fontVariationSettings = "'FILL' 0"; }
                    });
                    const cur = e.currentTarget as HTMLElement;
                    cur.classList.remove('border-transparent', 'text-on-surface/60', 'bg-surface-container-lowest');
                    cur.classList.add('border-primary', 'text-primary', 'bg-surface-container-low');
                    const icon = cur.querySelector('.material-symbols-outlined') as HTMLElement | null;
                    if (icon) { icon.innerText = 'radio_button_checked'; icon.style.fontVariationSettings = "'FILL' 1"; }
                });
            });

            // Auto-apply vmin/vmax on change (debounced)
            let cutDebounce: ReturnType<typeof setTimeout>;
            const applyCuts = () => {
                const vmin = parseFloat((document.getElementById('input-vmin') as HTMLInputElement).value);
                const vmax = parseFloat((document.getElementById('input-vmax') as HTMLInputElement).value);
                if (!isNaN(vmin) && !isNaN(vmax)) applyImgOptions({ minCut: vmin, maxCut: vmax });
            };
            ['input-vmin', 'input-vmax'].forEach(id => {
                document.getElementById(id)?.addEventListener('input', () => {
                    clearTimeout(cutDebounce);
                    cutDebounce = setTimeout(applyCuts, 600);
                });
            });

            // Manual apply button (still useful for precision entry)
            document.getElementById('btn-apply-cuts')?.addEventListener('click', applyCuts);

            document.getElementById('btn-invert')?.addEventListener('click', () => {
                let isReversed = false;
                try { isReversed = aladin.getBaseImageLayer()?.getColorCfg?.()?.getReversed() ?? false; } catch(_) {}
                applyImgOptions({ reversed: !isReversed });
            });

            document.getElementById('btn-reset')?.addEventListener('click', () => {
                // Reset UI
                (document.getElementById('colormap-select') as HTMLSelectElement).value = DEFAULT_COLORMAP;
                (document.getElementById('input-vmin') as HTMLInputElement).value = String(DEFAULT_VMIN);
                (document.getElementById('input-vmax') as HTMLInputElement).value = String(DEFAULT_VMAX);
                document.querySelectorAll('.scale-btn').forEach(b => {
                    b.classList.remove('border-primary', 'text-primary', 'bg-surface-container-low');
                    b.classList.add('border-transparent', 'text-on-surface/60', 'bg-surface-container-lowest');
                    const ic = b.querySelector('.material-symbols-outlined') as HTMLElement | null;
                    if (ic) { ic.innerText = 'radio_button_unchecked'; ic.style.fontVariationSettings = "'FILL' 0"; }
                });
                const linearBtn = document.querySelector('.scale-btn[data-scale="linear"]') as HTMLElement | null;
                if (linearBtn) {
                    linearBtn.classList.remove('border-transparent', 'text-on-surface/60', 'bg-surface-container-lowest');
                    linearBtn.classList.add('border-primary', 'text-primary', 'bg-surface-container-low');
                    const ic = linearBtn.querySelector('.material-symbols-outlined') as HTMLElement | null;
                    if (ic) { ic.innerText = 'radio_button_checked'; ic.style.fontVariationSettings = "'FILL' 1"; }
                }
                // Reset Aladin
                applyImgOptions({ stretch: 'linear', colormap: DEFAULT_COLORMAP, reversed: false, minCut: DEFAULT_VMIN, maxCut: DEFAULT_VMAX });
            });

            document.getElementById('btn-apply-cuts')?.addEventListener('click', () => {
                const vmin = parseFloat((document.getElementById('input-vmin') as HTMLInputElement).value);
                const vmax = parseFloat((document.getElementById('input-vmax') as HTMLInputElement).value);
                const baseLayer = aladin.getBaseImageLayer();
                if (baseLayer && baseLayer.setOptions) {
                    baseLayer.setOptions({ minCut: vmin, maxCut: vmax });
                }
            });

            fetch('hips-compute://local_survey/properties')
                .then(res => res.text())
                .then(propsText => {
                    let ra = 86.40, dec = 28.93, fov = 10.0;
                    propsText.split('\n').forEach(line => {
                        let match = line.match(/^\s*hips_initial_ra\s*=\s*(.*)/);
                        if (match) ra = parseFloat(match[1]);
                        match = line.match(/^\s*hips_initial_dec\s*=\s*(.*)/);
                        if (match) dec = parseFloat(match[1]);
                        match = line.match(/^\s*hips_initial_fov\s*=\s*(.*)/);
                        if (match) fov = parseFloat(match[1]);
                    });

                    aladin.gotoRaDec(ra, dec);
                    aladin.setFoV(fov);
                    
                    log(`Aladin dynamically centered to RA=${ra}, DEC=${dec}, FOV=${fov}`);
                })
                .catch(err => log("Failed to fetch properties: " + err));

        }).catch((e: Error) => log("Aladin init error: " + e));
    }
}, 100);
