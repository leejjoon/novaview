use clap::Parser;
use std::path::PathBuf;
use tauri::http::{Request, Response};

#[derive(Parser, Default, Debug, Clone)]
#[clap(author, version, about, long_about = None, ignore_errors = true)]
pub struct CliArgs {
    #[clap(long, help = "Survey URI to load on startup")]
    pub survey: Option<String>,
}

#[tauri::command]
fn log_message(msg: String) {
    println!("JS_LOG: {}", msg);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let args = CliArgs::parse();

    #[allow(unused_variables)]
    let survey = args.survey.clone();

    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![log_message])
        .setup(move |app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            if let Some(s) = survey {
                log::info!("Starting with survey: {}", s);
            }
            Ok(())
        })
        .register_uri_scheme_protocol("hips-compute", move |_app, req| {
            let uri = req.uri();
            let path = uri.path();
            println!("hips-compute request: {}", uri);
            
            // Navigate out of src-tauri to workspace root, then into hips_data
            let root_dir = std::env::current_dir()
                .unwrap_or_else(|_| PathBuf::from("."))
                .join("../hips_data/test_hips");
            
            let segments: Vec<&str> = path.split('/').collect();
            let file_path = if let Some(norder_index) = segments.iter().position(|s| s.starts_with("Norder")) {
                let rel_path = segments[norder_index..].join("/");
                root_dir.join(rel_path)
            } else if path.ends_with("properties") {
                root_dir.join("properties")
            } else {
                root_dir.join(path.trim_start_matches('/'))
            };

            let response = if !file_path.exists() || file_path.is_dir() {
                // Silently return 404 for directory paths or unknown resources
                Response::builder()
                    .status(404)
                    .header("Access-Control-Allow-Origin", "*")
                    .body(Vec::new())
                    .unwrap()
            } else {
                match std::fs::read(&file_path) {
                Ok(bytes) => {
                    let mut builder = Response::builder()
                        .status(200)
                        .header("Access-Control-Allow-Origin", "*")
                        .header("Access-Control-Allow-Methods", "GET, OPTIONS, HEAD")
                        .header("Access-Control-Allow-Headers", "*");
                    if file_path.extension().and_then(|e| e.to_str()) == Some("jpg") {
                        builder = builder.header("Content-Type", "image/jpeg");
                    } else if file_path.extension().and_then(|e| e.to_str()) == Some("png") {
                        builder = builder.header("Content-Type", "image/png");
                    } else if file_path.extension().and_then(|e| e.to_str()) == Some("fits") {
                        builder = builder.header("Content-Type", "application/fits");
                    }
                    builder.body(bytes).unwrap()
                }
                Err(err) => {
                    println!("Failed to load {:?}: {}", file_path, err);
                    Response::builder()
                        .status(404)
                        .header("Access-Control-Allow-Origin", "*")
                        .body(Vec::new())
                        .unwrap()
                }
            }
            };
            response
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
