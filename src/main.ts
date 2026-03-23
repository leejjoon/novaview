import { invoke } from "@tauri-apps/api/core";

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
