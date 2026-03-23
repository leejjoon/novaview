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
                showReticleControl: false
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

            // FITS Controls Wiring
            document.getElementById('colormap-select')?.addEventListener('change', (e) => {
                const val = (e.target as HTMLSelectElement).value;
                const baseLayer = aladin.getBaseImageLayer();
                if (baseLayer && baseLayer.setOptions) {
                    baseLayer.setOptions({ colormap: val });
                }
            });

            document.querySelectorAll('.scale-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const scale = (e.currentTarget as HTMLElement).getAttribute('data-scale') || 'linear';
                    const baseLayer = aladin.getBaseImageLayer();
                    if (baseLayer && baseLayer.setOptions) {
                        baseLayer.setOptions({ stretch: scale });
                    }
                    
                    document.querySelectorAll('.scale-btn .material-symbols-outlined').forEach(icon => {
                        (icon as HTMLElement).innerText = 'radio_button_unchecked';
                        (icon as HTMLElement).style.fontVariationSettings = "'FILL' 0";
                        icon.parentElement?.classList.remove('border-primary', 'text-primary');
                        icon.parentElement?.classList.add('border-transparent', 'text-on-surface/60');
                    });
                    
                    const icon = (e.currentTarget as HTMLElement).querySelector('.material-symbols-outlined') as HTMLElement;
                    if(icon) {
                        icon.innerText = 'radio_button_checked';
                        icon.style.fontVariationSettings = "'FILL' 1";
                        icon.parentElement?.classList.remove('border-transparent', 'text-on-surface/60');
                        icon.parentElement?.classList.add('border-primary', 'text-primary');
                    }
                });
            });

            document.getElementById('btn-invert')?.addEventListener('click', () => {
                const baseLayer = aladin.getBaseImageLayer();
                if (baseLayer && baseLayer.setOptions) {
                    let isReversed = false;
                    try {
                        if (baseLayer.getColorCfg) {
                            isReversed = baseLayer.getColorCfg().getReversed();
                        }
                    } catch(e) {}
                    baseLayer.setOptions({ reversed: !isReversed });
                }
            });

            document.getElementById('btn-reset')?.addEventListener('click', () => {
                const baseLayer = aladin.getBaseImageLayer();
                if (baseLayer && baseLayer.setOptions) {
                    document.querySelectorAll('.scale-btn .material-symbols-outlined').forEach(icon => {
                        (icon as HTMLElement).innerText = 'radio_button_unchecked';
                        (icon as HTMLElement).style.fontVariationSettings = "'FILL' 0";
                        icon.parentElement?.classList.remove('border-primary', 'text-primary');
                        icon.parentElement?.classList.add('border-transparent', 'text-on-surface/60');
                    });
                    
                    const linearIcon = document.querySelector('.scale-btn[data-scale="linear"] .material-symbols-outlined') as HTMLElement;
                    if(linearIcon) {
                        linearIcon.innerText = 'radio_button_checked';
                        linearIcon.style.fontVariationSettings = "'FILL' 1";
                        linearIcon.parentElement?.classList.remove('border-transparent', 'text-on-surface/60');
                        linearIcon.parentElement?.classList.add('border-primary', 'text-primary');
                    }
                    
                    (document.getElementById('colormap-select') as HTMLSelectElement).value = 'viridis';
                    
                    baseLayer.setOptions({ stretch: 'linear', colormap: 'viridis', reversed: false });
                }
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
