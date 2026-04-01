import { invoke as tauriInvoke } from "@tauri-apps/api/core";
import { listen as tauriListen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
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
    if (cmd === 'get_initial_survey') return [];
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
setupPanelToggle('btn-toggle-layout', 'panel-layout');

// Window controls (only visible in Tauri with decorations disabled)
if (isTauri) {
    const windowControls = document.getElementById('window-controls');
    if (windowControls) windowControls.classList.remove('hidden');

    const appWindow = getCurrentWindow();

    document.getElementById('btn-minimize')?.addEventListener('click', () => appWindow.minimize());
    document.getElementById('btn-close')?.addEventListener('click', () => appWindow.close());
    document.getElementById('btn-maximize')?.addEventListener('click', async () => {
        const maximized = await appWindow.isMaximized();
        if (maximized) {
            appWindow.unmaximize();
        } else {
            appWindow.maximize();
        }
    });

    // Update maximize icon when window state changes
    appWindow.onResized(async () => {
        const maximized = await appWindow.isMaximized();
        const icon = document.getElementById('btn-maximize') as HTMLElement | null;
        if (icon) icon.innerText = maximized ? 'filter_none' : 'crop_square';
    });

    // Explicit startDragging on mousedown for reliable Wayland support.
    const header = document.querySelector('header');
    if (header) {
        header.addEventListener('mousedown', (e) => {
            const target = e.target as HTMLElement;
            if (target.closest('button, a, input, select')) return;
            appWindow.startDragging();
        });
    }
}

log("Waiting for Aladin to load...");

let aladinInstances: any[] = [];
let activeAladinIndex = 0;
let isSyncing = true;
let isUpdatingSync = false; // Prevent infinite loops during sync

const getActiveAladin = () => aladinInstances[activeAladinIndex];

// Keep track of surveys per instance
let instanceSurveys: string[][] = [];
let instanceCurrentSurvey: string[] = [];

// Layout handling
const viewportsContainer = document.getElementById('viewports-container');
const layoutModeSelect = document.getElementById('layout-mode-select') as HTMLSelectElement;
const syncViewsCheckbox = document.getElementById('sync-views-checkbox') as HTMLInputElement;

if (syncViewsCheckbox) {
    syncViewsCheckbox.addEventListener('change', (e) => {
        isSyncing = (e.target as HTMLInputElement).checked;
    });
}

function updateLayout(mode: string, count: number) {
    if (!viewportsContainer) return;

    // Reset classes
    viewportsContainer.className = 'absolute inset-0 bg-gradient-to-br from-surface to-surface-container-lowest z-0 grid gap-1';

    if (mode === 'single' || count === 1) {
        viewportsContainer.classList.add('grid-cols-1', 'grid-rows-1');
        // Hide all but the active one, or the first one
        Array.from(viewportsContainer.children).forEach((child, idx) => {
            if (idx === activeAladinIndex) {
                (child as HTMLElement).style.display = 'block';
            } else {
                (child as HTMLElement).style.display = 'none';
            }
        });
    } else {
        // Show all
        Array.from(viewportsContainer.children).forEach(child => {
            (child as HTMLElement).style.display = 'block';
        });

        if (mode === 'horizontal') {
            viewportsContainer.style.gridTemplateColumns = '1fr';
            viewportsContainer.style.gridTemplateRows = `repeat(${count}, 1fr)`;
        } else if (mode === 'vertical') {
            viewportsContainer.style.gridTemplateColumns = `repeat(${count}, 1fr)`;
            viewportsContainer.style.gridTemplateRows = '1fr';
        } else { // grid
            const cols = Math.ceil(Math.sqrt(count));
            const rows = Math.ceil(count / cols);
            viewportsContainer.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
            viewportsContainer.style.gridTemplateRows = `repeat(${rows}, 1fr)`;
        }
    }

    // Trigger resize on all instances so they fill the new space properly
    aladinInstances.forEach(aladin => {
        // Aladin Lite might need a tiny delay to measure correctly after CSS changes
        setTimeout(() => {
            if(aladin.view && aladin.view.mustBeResized) {
               aladin.view.mustBeResized();
            }
        }, 100);
    });
}

if (layoutModeSelect) {
    layoutModeSelect.addEventListener('change', (e) => {
        updateLayout((e.target as HTMLSelectElement).value, aladinInstances.length);
    });
}

const checkA = setInterval(() => {
    const A = (window as any).A;
    if (A) {
        clearInterval(checkA);
        log("Aladin object found, initializing...");
        (window as any).aladinInstances = aladinInstances;

        invoke<string[]>('get_initial_survey').then((surveyUrls) => {
            let initialSurveys = surveyUrls;
            if (!initialSurveys || initialSurveys.length === 0) {
                initialSurveys = [isTauri ? 'hips-compute://local/hips_data/test_hips' : DEFAULT_BROWSER_SURVEY];
                log(`Using default survey URL: ${initialSurveys[0]}`);
            } else {
                initialSurveys = initialSurveys.map(s => {
                    if (s.startsWith('http')) return s;
                    if (s.startsWith('hips-compute')) return s;
                    if (s.startsWith('redis://')) {
                        return s.replace('redis://', 'hips-compute://redis/');
                    }
                    // Local path
                    return `hips-compute://local/${s}`;
                });
                log(`Using provided survey URLs: ${initialSurveys.join(', ')}`);
            }

            A.init.then(() => {
                if (!viewportsContainer) return;
                viewportsContainer.innerHTML = '';

                initialSurveys.forEach((surveyUrl, idx) => {
                    const container = document.createElement('div');
                    container.id = `aladin-container-${idx}`;
                    container.className = 'w-full h-full relative cursor-crosshair border-2 border-transparent transition-colors';
                    if (idx === activeAladinIndex) {
                        container.classList.add('border-primary');
                    }

                    // Add click listener to set active instance
                    container.addEventListener('mousedown', () => {
                        activeAladinIndex = idx;
                        document.querySelectorAll('[id^="aladin-container-"]').forEach(el => {
                            el.classList.remove('border-primary');
                        });
                        container.classList.add('border-primary');
                        renderSurveyList(); // Re-render survey list for active instance

                        // Update coordinate frame UI to match the active instance
                        const activeAladin = getActiveAladin();
                        if (activeAladin) {
                             const frameSelect = document.getElementById('coord-frame-select') as HTMLSelectElement;
                             if (frameSelect) {
                                 // Basic frame mapping (Aladin returns things like 'J2000', 'Galactic')
                                 const currentFrame = activeAladin.getFrame().toLowerCase();
                                 if (currentFrame.includes('galactic')) frameSelect.value = 'galactic';
                                 else frameSelect.value = 'icrs';
                             }
                        }
                    });

                    viewportsContainer.appendChild(container);

                    const aladin = A.aladin(`#${container.id}`, {
                        survey: surveyUrl,
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

                    aladinInstances.push(aladin);
                    instanceSurveys.push([surveyUrl]);
                    instanceCurrentSurvey.push(surveyUrl);

                    // Sync logic
                    aladin.on('positionChanged', () => {
                        if (idx === activeAladinIndex) {
                            const center = aladin.getRaDec();
                            const elem = document.getElementById('label-center-radec');
                            if(elem && center) elem.innerText = `${center[0].toFixed(4)} | ${center[1].toFixed(4)}`;
                        }

                        if (isSyncing && !isUpdatingSync) {
                            isUpdatingSync = true;
                            const center = aladin.getRaDec();
                            aladinInstances.forEach((otherAladin, otherIdx) => {
                                if (otherIdx !== idx && center) {
                                    otherAladin.gotoRaDec(center[0], center[1]);
                                }
                            });
                            isUpdatingSync = false;
                        }
                    });

                    aladin.on('zoomChanged', () => {
                        if (idx === activeAladinIndex) {
                            const fov = aladin.getFov();
                            const elem = document.getElementById('label-fov');
                            if(elem && fov) elem.innerText = `${fov[0].toFixed(2)}°`;
                        }

                        if (isSyncing && !isUpdatingSync) {
                            isUpdatingSync = true;
                            const fov = aladin.getFov();
                            aladinInstances.forEach((otherAladin, otherIdx) => {
                                if (otherIdx !== idx && fov) {
                                    otherAladin.setFoV(fov[0]);
                                }
                            });
                            isUpdatingSync = false;
                        }
                    });
                });

                // Set initial layout
                updateLayout('grid', aladinInstances.length);

                const coordSelect = document.getElementById('coord-frame-select') as HTMLSelectElement;
                if (coordSelect) {
                    coordSelect.addEventListener('change', (e) => {
                        const frame = (e.target as HTMLSelectElement).value;
                        const activeAladin = getActiveAladin();
                        if (activeAladin) activeAladin.setFrame(frame);
                    });
                }

                // --- Survey List Management ---
                const surveyListEl = document.getElementById('survey-list');
                const btnAddSurvey = document.getElementById('btn-add-survey');
                const inputNewSurvey = document.getElementById('input-new-survey') as HTMLInputElement;

                const renderSurveyList = () => {
                    if (!surveyListEl) return;
                    surveyListEl.innerHTML = '';
                    const currentSurveys = instanceSurveys[activeAladinIndex];
                    const currentActiveUrl = instanceCurrentSurvey[activeAladinIndex];

                    currentSurveys.forEach((surveyUrl, idx) => {
                        const isSelected = surveyUrl === currentActiveUrl;
                        const item = document.createElement('div');
                        item.className = 'bg-surface-container p-2 rounded flex items-center gap-2 group';

                        const radioContainer = document.createElement('div');
                        radioContainer.className = 'relative w-4 h-4 flex items-center justify-center';

                        const radio = document.createElement('input');
                        radio.type = 'radio';
                        radio.name = 'active_layer';
                        radio.value = surveyUrl;
                        radio.checked = isSelected;
                        radio.className = 'appearance-none w-4 h-4 border border-outline rounded-full checked:border-secondary checked:bg-transparent transition-all cursor-pointer';

                        const radioIndicator = document.createElement('div');
                        radioIndicator.className = 'absolute w-1.5 h-1.5 bg-secondary rounded-full pointer-events-none opacity-0 ' + (isSelected ? 'opacity-100' : 'group-has-[:checked]:opacity-100');

                        radioContainer.appendChild(radio);
                        radioContainer.appendChild(radioIndicator);

                        const labelDiv = document.createElement('div');
                        labelDiv.className = 'flex-1 overflow-hidden';
                        const titleP = document.createElement('p');
                        titleP.className = 'text-[11px] font-bold text-primary tracking-tight truncate';
                        titleP.title = surveyUrl;
                        titleP.innerText = surveyUrl.split('/').pop() || 'Survey ' + (idx + 1);

                        const typeP = document.createElement('p');
                        typeP.className = 'text-[9px] text-on-surface-variant font-mono truncate';
                        typeP.innerText = surveyUrl;

                        labelDiv.appendChild(titleP);
                        labelDiv.appendChild(typeP);

                        const actionsDiv = document.createElement('div');
                        actionsDiv.className = 'flex items-center gap-1 opacity-40 group-hover:opacity-100 transition-opacity';

                        const btnRemove = document.createElement('button');
                        btnRemove.className = 'material-symbols-outlined text-sm hover:text-red-400';
                        btnRemove.innerText = 'delete';
                        btnRemove.title = 'Remove survey';
                        btnRemove.onclick = (e) => {
                            e.stopPropagation();
                            currentSurveys.splice(idx, 1);
                            if (isSelected && currentSurveys.length > 0) {
                                instanceCurrentSurvey[activeAladinIndex] = currentSurveys[0];
                                document.getElementById('btn-reload-survey')?.click();
                            } else if (isSelected) {
                                instanceCurrentSurvey[activeAladinIndex] = '';
                            }
                            renderSurveyList();
                        };

                        actionsDiv.appendChild(btnRemove);

                        item.appendChild(radioContainer);
                        item.appendChild(labelDiv);
                        item.appendChild(actionsDiv);

                        radio.addEventListener('change', () => {
                            if (radio.checked) {
                                instanceCurrentSurvey[activeAladinIndex] = surveyUrl;
                                document.getElementById('btn-reload-survey')?.click();
                                renderSurveyList();
                            }
                        });

                        item.addEventListener('click', (e) => {
                            if (e.target !== radio && e.target !== btnRemove) {
                                radio.checked = true;
                                radio.dispatchEvent(new Event('change'));
                            }
                        });

                        surveyListEl.appendChild(item);
                    });
                };

                renderSurveyList();

                if (btnAddSurvey && inputNewSurvey) {
                    btnAddSurvey.addEventListener('click', () => {
                        const newUrl = inputNewSurvey.value.trim();
                        const currentSurveys = instanceSurveys[activeAladinIndex];
                        if (newUrl && !currentSurveys.includes(newUrl)) {
                            currentSurveys.push(newUrl);
                            inputNewSurvey.value = '';
                            instanceCurrentSurvey[activeAladinIndex] = newUrl;
                            document.getElementById('btn-reload-survey')?.click();
                            renderSurveyList();
                        }
                    });
                    inputNewSurvey.addEventListener('keypress', (e) => {
                        if (e.key === 'Enter') {
                            btnAddSurvey.click();
                        }
                    });
                }

                // --- Default init: apply colormap + cuts to match the UI defaults ---
                const DEFAULT_COLORMAP = 'viridis';
                const DEFAULT_STRETCH  = 'linear';
                const DEFAULT_VMIN = -0.5;
                const DEFAULT_VMAX = 15.0;

                const getCurrentSettings = () => ({
                    colormap: (document.getElementById('colormap-select') as HTMLSelectElement)?.value ?? DEFAULT_COLORMAP,
                    stretch:  (() => {
                        const active = document.querySelector('.scale-btn[data-scale].border-primary') as HTMLElement | null;
                        return active?.getAttribute('data-scale') ?? DEFAULT_STRETCH;
                    })(),
                    vmin: parseFloat((document.getElementById('input-vmin') as HTMLInputElement)?.value ?? String(DEFAULT_VMIN)),
                    vmax: parseFloat((document.getElementById('input-vmax') as HTMLInputElement)?.value ?? String(DEFAULT_VMAX)),
                });

                const applyToSurvey = (survey: any, colormap: string, stretch: string, vmin: number, vmax: number) => {
                    if (!survey) return;
                    try { survey.setColormap(colormap, { stretch }); } catch (_) {}
                    try { survey.setCuts(vmin, vmax); } catch (_) {}
                };

                const applyImgOptions = (opts: { colormap?: string; stretch?: string; minCut?: number; maxCut?: number; reversed?: boolean }) => {
                    const activeAladin = getActiveAladin();
                    if (!activeAladin) return;
                    const layer = activeAladin.getBaseImageLayer();
                    if (!layer) return;
                    if (opts.colormap !== undefined || opts.stretch !== undefined) {
                        try {
                            const cmap = opts.colormap ?? DEFAULT_COLORMAP;
                            const st   = opts.stretch  ?? DEFAULT_STRETCH;
                            layer.setColormap(cmap, { stretch: st, reversed: opts.reversed ?? false });
                        } catch (_) {
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

                setTimeout(() => {
                    aladinInstances.forEach((aladin, idx) => {
                        // Switch active index temporarily to apply correctly if needed, though applyImgOptions uses getActiveAladin
                        // Actually, it's better to apply defaults to ALL layers on startup
                        const layer = aladin.getBaseImageLayer();
                        if (layer) {
                            try { layer.setColormap(DEFAULT_COLORMAP, { stretch: DEFAULT_STRETCH, reversed: false }); } catch (_) {}
                            try { layer.setCuts(DEFAULT_VMIN, DEFAULT_VMAX); } catch (_) {}
                        }
                    });
                }, 500);

                const reloadBtn = document.getElementById('btn-reload-survey');
                if (reloadBtn) {
                    reloadBtn.addEventListener('click', () => {
                        const activeAladin = getActiveAladin();
                        if (!activeAladin) return;

                        const { colormap, stretch, vmin, vmax } = getCurrentSettings();

                        reloadBtn.classList.add('spinning');
                        reloadBtn.setAttribute('disabled', 'true');

                        const currentUrl = instanceCurrentSurvey[activeAladinIndex];

                        try {
                            const survey = activeAladin.newImageSurvey(currentUrl);
                            applyToSurvey(survey, colormap, stretch, vmin, vmax);
                            activeAladin.setBaseImageLayer(survey);

                            setTimeout(() => {
                                applyImgOptions({ colormap, stretch, minCut: vmin, maxCut: vmax });
                            }, 500);

                        } catch (_) {
                            try { activeAladin.setBaseImageLayer(currentUrl); } catch (_) {}
                        }

                        reloadBtn.classList.remove('spinning');
                        reloadBtn.removeAttribute('disabled');
                    });
                }

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

                const adjustValue = (id: string, delta: number) => {
                    const el = document.getElementById(id) as HTMLInputElement;
                    if (!el) return;
                    const current = parseFloat(el.value);
                    if (!isNaN(current)) {
                        el.value = (current + delta).toFixed(2);
                        applyCuts();
                    }
                };

                document.getElementById('btn-vmin-dec')?.addEventListener('click', () => adjustValue('input-vmin', -0.5));
                document.getElementById('btn-vmin-inc')?.addEventListener('click', () => adjustValue('input-vmin', 0.5));
                document.getElementById('btn-vmax-dec')?.addEventListener('click', () => adjustValue('input-vmax', -0.5));
                document.getElementById('btn-vmax-inc')?.addEventListener('click', () => adjustValue('input-vmax', 0.5));

                document.getElementById('btn-apply-cuts')?.addEventListener('click', applyCuts);

                document.getElementById('btn-invert')?.addEventListener('click', () => {
                    let isReversed = false;
                    const activeAladin = getActiveAladin();
                    if (activeAladin) {
                        try { isReversed = activeAladin.getBaseImageLayer()?.getColorCfg?.()?.getReversed() ?? false; } catch(_) {}
                    }
                    const { colormap, stretch } = getCurrentSettings();
                    applyImgOptions({ colormap, stretch, reversed: !isReversed });
                });

                document.getElementById('btn-reset')?.addEventListener('click', () => {
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
                    applyImgOptions({ stretch: 'linear', colormap: DEFAULT_COLORMAP, reversed: false, minCut: DEFAULT_VMIN, maxCut: DEFAULT_VMAX });
                });

                // Fetch properties for the first survey and set view
                const firstSurvey = initialSurveys[0];
                const propertiesUrl = firstSurvey.startsWith('http')
                    ? `${firstSurvey}/properties`
                    : `${firstSurvey}/properties`;

                fetch(propertiesUrl)
                    .then(res => res.text())
                    .then(propsText => {
                        let ra = 86.40, dec = 28.93, fov = 10.0;
                        let formatTypes: string[] = ['jpeg'];
                        
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

                        // Set all aladins to these properties
                        aladinInstances.forEach(aladin => {
                            aladin.gotoRaDec(ra, dec);
                            aladin.setFoV(fov);
                        });

                        log(`Aladin dynamically centered to RA=${ra}, DEC=${dec}, FOV=${fov}`);

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

                                const currentFormat = document.querySelector('.format-btn.border-primary')?.getAttribute('data-format');
                                if (newFormat === currentFormat) return;

                                updateFormatUI(newFormat);

                                const { colormap, stretch, vmin, vmax } = getCurrentSettings();
                                const activeAladin = getActiveAladin();
                                if (!activeAladin) return;

                                try {
                                    const survey = activeAladin.newImageSurvey(instanceCurrentSurvey[activeAladinIndex], { imgFormat: newFormat });
                                    applyToSurvey(survey, colormap, stretch, vmin, vmax);
                                    activeAladin.setBaseImageLayer(survey);
                                    setTimeout(() => {
                                        applyImgOptions({ colormap, stretch, minCut: vmin, maxCut: vmax });
                                    }, 500);
                                } catch (err) {
                                    log("Error changing format: " + err);
                                    try { activeAladin.setBaseImageLayer(instanceCurrentSurvey[activeAladinIndex]); } catch (_) {}
                                }
                            });
                        });

                        updateFormatUI(activeFormat);

                        if (activeFormat === 'fits') {
                             const { colormap, stretch, vmin, vmax } = getCurrentSettings();
                             aladinInstances.forEach((aladin, idx) => {
                                 try {
                                     const survey = aladin.newImageSurvey(instanceCurrentSurvey[idx], { imgFormat: 'fits' });
                                     applyToSurvey(survey, colormap, stretch, vmin, vmax);
                                     aladin.setBaseImageLayer(survey);
                                 } catch (err) {
                                     log("Error setting initial FITS format: " + err);
                                 }
                             });
                        }

                        listen('python-command', (event: any) => {
                            const payload = event.payload;
                            if (!payload || !payload.command) return;
                            const activeAladin = getActiveAladin();
                            if (!activeAladin) return;

                            if (payload.command === 'set_survey') {
                                if (payload.survey) {
                                    instanceCurrentSurvey[activeAladinIndex] = payload.survey;
                                    if (!instanceSurveys[activeAladinIndex].includes(payload.survey)) {
                                        instanceSurveys[activeAladinIndex].push(payload.survey);
                                    }
                                    const currentFormat = document.querySelector('.format-btn.border-primary')?.getAttribute('data-format') || 'jpeg';
                                    const { colormap, stretch, vmin, vmax } = getCurrentSettings();
                                    try {
                                        const survey = activeAladin.newImageSurvey(payload.survey, { imgFormat: currentFormat });
                                        applyToSurvey(survey, colormap, stretch, vmin, vmax);
                                        activeAladin.setBaseImageLayer(survey);
                                        setTimeout(() => {
                                            applyImgOptions({ colormap, stretch, minCut: vmin, maxCut: vmax });
                                        }, 500);
                                        log(`Survey changed to ${payload.survey}`);
                                        renderSurveyList();
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
                                    activeAladin.gotoRaDec(payload.ra, payload.dec);
                                }
                                if (payload.fov !== undefined) {
                                    activeAladin.setFoV(payload.fov);
                                }
                            }
                        });

                    })
                    .catch(err => log("Failed to fetch properties: " + err));

            }).catch((e: Error) => log("Aladin init error: " + e));
        }).catch((e: Error) => log("Get initial survey error: " + e));
    }
}, 100);
