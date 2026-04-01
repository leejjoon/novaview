use clap::Parser;
use std::path::PathBuf;
use tauri::http::Response;

#[derive(Parser, Default, Debug, Clone)]
#[clap(author, version, about, long_about = None, ignore_errors = true)]
pub struct CliArgs {
    #[clap(long, help = "Survey URIs to load on startup")]
    pub survey: Vec<String>,
}

#[tauri::command]
fn log_message(msg: String) {
    println!("JS_LOG: {}", msg);
}

#[tauri::command]
fn get_initial_survey(state: tauri::State<'_, InitialSurveyState>) -> Vec<String> {
    state.surveys.clone()
}

struct InitialSurveyState {
    surveys: Vec<String>,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let args = CliArgs::parse();

    #[allow(unused_variables)]
    let surveys = args.survey.clone();

    tauri::Builder::default()
        .manage(InitialSurveyState { surveys: surveys.clone() })
        .invoke_handler(tauri::generate_handler![log_message, get_initial_survey])
        .setup(move |app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            if !surveys.is_empty() {
                log::info!("Starting with surveys: {:?}", surveys);
            }

            use tauri::Emitter;
            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                let addr = "127.0.0.1:8765";
                let listener = match tokio::net::TcpListener::bind(addr).await {
                    Ok(l) => l,
                    Err(e) => {
                        log::error!("Failed to bind WebSocket server: {}", e);
                        return;
                    }
                };
                log::info!("WebSocket server listening on ws://{}", addr);

                while let Ok((stream, _)) = listener.accept().await {
                    let app_handle_clone = app_handle.clone();
                    tauri::async_runtime::spawn(async move {
                        if let Ok(mut ws_stream) = tokio_tungstenite::accept_async(stream).await {
                            log::info!("New WebSocket connection");
                            use futures_util::StreamExt;
                            while let Some(msg) = ws_stream.next().await {
                                if let Ok(tokio_tungstenite::tungstenite::Message::Text(text)) = msg {
                                    if let Ok(json) = serde_json::from_str::<serde_json::Value>(&text) {
                                        app_handle_clone.emit("python-command", json).unwrap_or_else(|e| log::error!("Emit error: {}", e));
                                    } else {
                                        log::warn!("Invalid JSON received via WS: {}", text);
                                    }
                                }
                            }
                        }
                    });
                }
            });

            Ok(())
        })
        .register_uri_scheme_protocol("hips-compute", move |_app, req| {
            let uri = req.uri();
            let authority = uri.authority().map(|a| a.as_str()).unwrap_or("");
            let path = uri.path();
            
            println!("hips-compute request: {} (authority: {}, path: {})", uri, authority, path);
            
            let bytes = if authority == "redis" {
                // Fetch from Redis
                match redis::Client::open("redis://127.0.0.1/") {
                    Ok(client) => match client.get_connection() {
                        Ok(mut con) => {
                            use redis::Commands;
                            let key = path.trim_start_matches('/');
                            match con.get::<&str, Vec<u8>>(key) {
                                Ok(data) => Some(data),
                                Err(e) => {
                                    println!("Redis get error for {}: {}", key, e);
                                    None
                                }
                            }
                        }
                        Err(e) => {
                            println!("Redis connection error: {}", e);
                            None
                        }
                    },
                    Err(e) => {
                        println!("Redis client error: {}", e);
                        None
                    }
                }
            } else if authority == "http" || authority == "https" {
                // Fetch from HTTP
                let target_url = format!("{}://{}", authority, path.trim_start_matches('/'));
                match reqwest::blocking::get(&target_url) {
                    Ok(res) => res.bytes().ok().map(|b| b.to_vec()),
                    Err(e) => {
                        println!("HTTP fetch error for {}: {}", target_url, e);
                        None
                    }
                }
            } else {
                // Assume "local" or any other is local filesystem
                let project_root = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
                // If we are in src-tauri, go up
                let base_dir = if project_root.ends_with("src-tauri") {
                    project_root.parent().unwrap().to_path_buf()
                } else {
                    project_root
                };
                
                let file_path = if authority == "local" || authority == "local_survey" {
                    if path.starts_with("//") {
                        // Absolute path (e.g. hips-compute://local//home/jjlee)
                        PathBuf::from(&path[1..])
                    } else {
                        // Relative path (e.g. hips-compute://local/hips_data)
                        base_dir.join(path.trim_start_matches('/'))
                    }
                } else {
                    // Backwards compatibility or direct path
                    if path.starts_with("//") {
                         PathBuf::from(&path[1..])
                    } else if path.starts_with("/hips_data") {
                        base_dir.join(path.trim_start_matches('/'))
                    } else {
                        // If authority is not empty and not special, it might be the start of the path
                        if !authority.is_empty() {
                            base_dir.join(format!("{}/{}", authority, path.trim_start_matches('/')))
                        } else {
                             base_dir.join(path.trim_start_matches('/'))
                        }
                    }
                };
                
                if file_path.exists() && !file_path.is_dir() {
                    std::fs::read(&file_path).ok()
                } else {
                    None
                }
            };

            let response = if let Some(data) = bytes {
                let mut builder = Response::builder()
                    .status(200)
                    .header("Access-Control-Allow-Origin", "*")
                    .header("Access-Control-Allow-Methods", "GET, OPTIONS, HEAD")
                    .header("Access-Control-Allow-Headers", "*");
                
                // Try to infer content type from path
                if path.ends_with(".jpg") || path.ends_with(".jpeg") {
                    builder = builder.header("Content-Type", "image/jpeg");
                } else if path.ends_with(".png") {
                    builder = builder.header("Content-Type", "image/png");
                } else if path.ends_with(".fits") {
                    builder = builder.header("Content-Type", "application/fits");
                } else if path.ends_with("properties") {
                    builder = builder.header("Content-Type", "text/plain");
                }
                
                builder.body(data).unwrap()
            } else {
                Response::builder()
                    .status(404)
                    .header("Access-Control-Allow-Origin", "*")
                    .body(Vec::new())
                    .unwrap()
            };
            response
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
