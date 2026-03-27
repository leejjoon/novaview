import { invoke as tauriInvoke } from "@tauri-apps/api/core";
import { listen as tauriListen } from "@tauri-apps/api/event";
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

// Check if we are running in Tauri
const isTauri = (window as any).__TAURI_INTERNALS__ !== undefined;

// Mock invoke and listen if not in Tauri
const invoke = isTauri ? tauriInvoke : async (cmd: string, args?: any) => {
    console.log(`[Mock Invoke] ${cmd}`, args);
    if (cmd === 'get_initial_survey') return null;
    return null;
};

const listen = isTauri ? tauriListen : async (event: string, handler: (e: any) => void) => {
    console.log(`[Mock Listen] ${event}`);
    return () => {}; // Return unlisten function
};

function log(msg: string) {
    invoke('log_message', { msg });
}

const DEFAULT_BROWSER_SURVEY = 'https://alasky.cds.unistra.fr/DSS/DSSColor';
let SURVEY_BASE_URL = isTauri ? 'hips-compute://local_survey' : DEFAULT_BROWSER_SURVEY;

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

        invoke<string | null>('get_initial_survey').then((surveyUrl) => {
            if (surveyUrl) {
                SURVEY_BASE_URL = surveyUrl;
                log(`Using provided survey URL: ${SURVEY_BASE_URL}`);
            } else {
                log(`Using default survey URL: ${SURVEY_BASE_URL}`);
            }

            A.init.then(() => {
                const aladin = A.aladin('#aladin-lite-container', {
                    survey: SURVEY_BASE_URL,
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
            const DEFAULT_STRETCH  = 'linear';
            const DEFAULT_VMIN = -0.5;
            const DEFAULT_VMAX = 15.0;

            // Helper: read current UI values
            const getCurrentSettings = () => ({
                colormap: (document.getElementById('colormap-select') as HTMLSelectElement)?.value ?? DEFAULT_COLORMAP,
                stretch:  (() => {
                    const active = document.querySelector('.scale-btn[data-scale].border-primary') as HTMLElement | null;
                    return active?.getAttribute('data-scale') ?? DEFAULT_STRETCH;
                })(),
                vmin: parseFloat((document.getElementById('input-vmin') as HTMLInputElement)?.value ?? String(DEFAULT_VMIN)),
                vmax: parseFloat((document.getElementById('input-vmax') as HTMLInputElement)?.value ?? String(DEFAULT_VMAX)),
            });

            // Apply settings to an HpxImageSurvey object using the proper v3 API
            const applyToSurvey = (survey: any, colormap: string, stretch: string, vmin: number, vmax: number) => {
                if (!survey) return;
                try { survey.setColormap(colormap, { stretch }); } catch (_) {}
                try { survey.setCuts(vmin, vmax); } catch (_) {}
            };

            // Convenience: apply to the current base layer
            const applyImgOptions = (opts: { colormap?: string; stretch?: string; minCut?: number; maxCut?: number; reversed?: boolean }) => {
                const layer = aladin.getBaseImageLayer();
                if (!layer) return;
                if (opts.colormap !== undefined || opts.stretch !== undefined) {
                    try {
                        const cmap = opts.colormap ?? DEFAULT_COLORMAP;
                        const st   = opts.stretch  ?? DEFAULT_STRETCH;
                        layer.setColormap(cmap, { stretch: st, reversed: opts.reversed ?? false });
                    } catch (_) {
                        // Fallback to legacy API if available
                        try { layer.setOptions({ colormap: opts.colormap, stretch: opts.stretch }); } catch (_) {}
                    }
                }
                if (opts.minCut !== undefined && opts.maxCut !== undefined) {
                    try { layer.setCuts(opts.minCut, opts.maxCut); } catch (_) {}
                }
                if (opts.reversed !== undefined && opts.colormap === undefined) {
                    try { layer.setColormap(DEFAULT_COLORMAP, { reversed: opts.reversed }); } catch (_) {}
                }
            };

            // Apply defaults on init (next tick so survey has time to load)
            setTimeout(() => {
                applyImgOptions({ colormap: DEFAULT_COLORMAP, stretch: DEFAULT_STRETCH, minCut: DEFAULT_VMIN, maxCut: DEFAULT_VMAX });
            }, 500);

            // --- Reload button: re-create survey object with current settings applied ---
            const reloadBtn = document.getElementById('btn-reload-survey');
            if (reloadBtn) {
                reloadBtn.addEventListener('click', () => {
                    const { colormap, stretch, vmin, vmax } = getCurrentSettings();

                    reloadBtn.classList.add('spinning');
                    reloadBtn.setAttribute('disabled', 'true');

                    try {
                        // newImageSurvey() returns an HpxImageSurvey object.
                        // We apply colormap/cuts on it BEFORE handing it to Aladin.
                        const survey = aladin.newImageSurvey(SURVEY_BASE_URL);
                        applyToSurvey(survey, colormap, stretch, vmin, vmax);
                        aladin.setBaseImageLayer(survey);

                        // Aladin Lite v3 may perform an automatic "auto-cut" after the layer
                        // is attached to the view. To be sure we keep our values, we
                        // provide a secondary application after a short delay.
                        setTimeout(() => {
                            applyImgOptions({ colormap, stretch, minCut: vmin, maxCut: vmax });
                        }, 500);

                    } catch (_) {
                        // Fallback if newImageSurvey is unavailable
                        try { aladin.setBaseImageLayer(SURVEY_BASE_URL); } catch (_) {}
                    }

                    reloadBtn.classList.remove('spinning');
                    reloadBtn.removeAttribute('disabled');
                });
            }

            // FITS Controls Wiring
            document.getElementById('colormap-select')?.addEventListener('change', (e) => {
                const val = (e.target as HTMLSelectElement).value;
                const { stretch } = getCurrentSettings();
                applyImgOptions({ colormap: val, stretch });
            });

            document.querySelectorAll('.scale-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const scale = (e.currentTarget as HTMLElement).getAttribute('data-scale') || 'linear';
                    const { colormap } = getCurrentSettings();
                    applyImgOptions({ colormap, stretch: scale });

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
                const { colormap, stretch } = getCurrentSettings();
                applyImgOptions({ colormap, stretch, reversed: !isReversed });
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



            // Determine properties URL based on whether it is a remote hips or local
            const propertiesUrl = SURVEY_BASE_URL.startsWith('http') 
                ? `${SURVEY_BASE_URL}/properties` 
                : `${SURVEY_BASE_URL}/properties`;

            fetch(propertiesUrl)
                .then(res => res.text())
                .then(propsText => {
                    let ra = 86.40, dec = 28.93, fov = 10.0;
                    let formatTypes: string[] = ['jpeg']; // Default to jpeg if missing
                    
                    propsText.split('\n').forEach(line => {
                        let match = line.match(/^\s*hips_initial_ra\s*=\s*(.*)/);
                        if (match) ra = parseFloat(match[1]);
                        match = line.match(/^\s*hips_initial_dec\s*=\s*(.*)/);
                        if (match) dec = parseFloat(match[1]);
                        match = line.match(/^\s*hips_initial_fov\s*=\s*(.*)/);
                        if (match) fov = parseFloat(match[1]);
                        match = line.match(/^\s*hips_tile_format\s*=\s*(.*)/);
                        if (match) formatTypes = match[1].split(/\s+/).filter(f => f.trim().length > 0);
                    });

                    aladin.gotoRaDec(ra, dec);
                    aladin.setFoV(fov);
                    log(`Aladin dynamically centered to RA=${ra}, DEC=${dec}, FOV=${fov}`);

                    // Format Auto-Detection Logic
                    let activeFormat = formatTypes.includes('fits') ? 'fits' : (formatTypes.includes('jpeg') ? 'jpeg' : formatTypes[0] || 'jpeg');
                    const formatLabel = document.getElementById('label-format-auto');
                    if (formatLabel) formatLabel.innerText = `Auto: ${activeFormat.toUpperCase()}`;

                    const updateFormatUI = (format: string) => {
                        document.querySelectorAll('.format-btn').forEach(b => {
                            b.classList.remove('border-primary', 'text-primary', 'bg-surface-container-low');
                            b.classList.add('border-transparent', 'text-on-surface/60', 'bg-surface-container-lowest');
                            const ic = b.querySelector('.material-symbols-outlined') as HTMLElement | null;
                            if (ic) { ic.innerText = 'radio_button_unchecked'; ic.style.fontVariationSettings = "'FILL' 0"; }
                        });
                        const cur = document.querySelector(`.format-btn[data-format="${format}"]`) as HTMLElement | null;
                        if (cur) {
                            cur.classList.remove('border-transparent', 'text-on-surface/60', 'bg-surface-container-lowest');
                            cur.classList.add('border-primary', 'text-primary', 'bg-surface-container-low');
                            const icon = cur.querySelector('.material-symbols-outlined') as HTMLElement | null;
                            if (icon) { icon.innerText = 'radio_button_checked'; icon.style.fontVariationSettings = "'FILL' 1"; }
                        }
                    };

                    document.querySelectorAll('.format-btn').forEach(btn => {
                        const fmt = btn.getAttribute('data-format');
                        if (!formatTypes.includes(fmt || '')) {
                            btn.setAttribute('disabled', 'true');
                        }
                        
                        btn.addEventListener('click', (e) => {
                            const newFormat = (e.currentTarget as HTMLElement).getAttribute('data-format');
                            if (!newFormat || (e.currentTarget as HTMLButtonElement).disabled) return;
                            
                            updateFormatUI(newFormat);
                            
                            // Re-apply layer with new format
                            const { colormap, stretch, vmin, vmax } = getCurrentSettings();
                            try {
                                const survey = aladin.newImageSurvey(SURVEY_BASE_URL, { imgFormat: newFormat });
                                applyToSurvey(survey, colormap, stretch, vmin, vmax);
                                aladin.setBaseImageLayer(survey);
                                setTimeout(() => {
                                    applyImgOptions({ colormap, stretch, minCut: vmin, maxCut: vmax });
                                }, 500);
                            } catch (err) {
                                log("Error changing format: " + err);
                            }
                        });
                    });

                    updateFormatUI(activeFormat);

                    // Force initial survey to prefer FITS if available (Aladin might default to JPEG)
                    if (activeFormat === 'fits') {
                         const { colormap, stretch, vmin, vmax } = getCurrentSettings();
                         try {
                             const survey = aladin.newImageSurvey(SURVEY_BASE_URL, { imgFormat: 'fits' });
                             applyToSurvey(survey, colormap, stretch, vmin, vmax);
                             aladin.setBaseImageLayer(survey);
                         } catch (err) {
                             log("Error setting initial FITS format: " + err);
                         }
                    }

                    // --- Python Remote Control Listener ---
                    listen('python-command', (event: any) => {
                        const payload = event.payload;
                        if (!payload || !payload.command) return;

                        if (payload.command === 'set_survey') {
                            if (payload.survey) {
                                SURVEY_BASE_URL = payload.survey;
                                const currentFormat = document.querySelector('.format-btn.border-primary')?.getAttribute('data-format') || 'jpeg';
                                const { colormap, stretch, vmin, vmax } = getCurrentSettings();
                                try {
                                    const survey = aladin.newImageSurvey(SURVEY_BASE_URL, { imgFormat: currentFormat });
                                    applyToSurvey(survey, colormap, stretch, vmin, vmax);
                                    aladin.setBaseImageLayer(survey);
                                    setTimeout(() => {
                                        applyImgOptions({ colormap, stretch, minCut: vmin, maxCut: vmax });
                                    }, 500);
                                    log(`Survey changed to ${SURVEY_BASE_URL}`);
                                } catch (err) { log("Error: " + err); }
                            }
                        } else if (payload.command === 'set_colormap') {
                            const { colormap, stretch, vmin, vmax } = payload;
                            
                            if (colormap !== undefined) {
                                const select = document.getElementById('colormap-select') as HTMLSelectElement;
                                if (select) select.value = colormap;
                            }
                            if (stretch !== undefined) {
                                document.querySelectorAll('.scale-btn').forEach(b => {
                                    b.classList.remove('border-primary', 'text-primary', 'bg-surface-container-low');
                                    b.classList.add('border-transparent', 'text-on-surface/60', 'bg-surface-container-lowest');
                                    const ic = b.querySelector('.material-symbols-outlined') as HTMLElement | null;
                                    if (ic) { ic.innerText = 'radio_button_unchecked'; ic.style.fontVariationSettings = "'FILL' 0"; }
                                });
                                const cur = document.querySelector(`.scale-btn[data-scale="${stretch}"]`) as HTMLElement | null;
                                if (cur) {
                                    cur.classList.remove('border-transparent', 'text-on-surface/60', 'bg-surface-container-lowest');
                                    cur.classList.add('border-primary', 'text-primary', 'bg-surface-container-low');
                                    const icon = cur.querySelector('.material-symbols-outlined') as HTMLElement | null;
                                    if (icon) { icon.innerText = 'radio_button_checked'; icon.style.fontVariationSettings = "'FILL' 1"; }
                                }
                            }
                            if (vmin !== undefined) {
                                const vminInput = document.getElementById('input-vmin') as HTMLInputElement;
                                if (vminInput) vminInput.value = vmin.toString();
                            }
                            if (vmax !== undefined) {
                                const vmaxInput = document.getElementById('input-vmax') as HTMLInputElement;
                                if (vmaxInput) vmaxInput.value = vmax.toString();
                            }
                            
                            const newSettings = getCurrentSettings();
                            applyImgOptions({ colormap: newSettings.colormap, stretch: newSettings.stretch, minCut: newSettings.vmin, maxCut: newSettings.vmax });
                        } else if (payload.command === 'goto_radec') {
                            if (payload.ra !== undefined && payload.dec !== undefined) {
                                aladin.gotoRaDec(payload.ra, payload.dec);
                            }
                            if (payload.fov !== undefined) {
                                aladin.setFoV(payload.fov);
                            }
                        }
                    });

                })
                .catch(err => log("Failed to fetch properties: " + err));

        }).catch((e: Error) => log("Aladin init error: " + e));
        }).catch((e: Error) => log("Get initial survey error: " + e));
    }
}, 100);
