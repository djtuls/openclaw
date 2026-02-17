use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::{
    image::Image,
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager, State, WebviewUrl, WebviewWindowBuilder,
};

// ── Health state ────────────────────────────────────────────────────────────
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServiceHealth {
    pub name: String,
    pub healthy: bool,
    pub port: u16,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HealthState {
    pub services: Vec<ServiceHealth>,
    pub overall: String, // "healthy", "degraded", "down"
}

impl Default for HealthState {
    fn default() -> Self {
        Self {
            services: vec![
                ServiceHealth { name: "PostgreSQL".into(), healthy: false, port: 5432 },
                ServiceHealth { name: "Qdrant".into(), healthy: false, port: 6333 },
                ServiceHealth { name: "Context Manager".into(), healthy: false, port: 3001 },
                ServiceHealth { name: "Web UI".into(), healthy: false, port: 3100 },
            ],
            overall: "down".into(),
        }
    }
}

pub struct AppState {
    pub health: Mutex<HealthState>,
}

// ── Tauri commands ──────────────────────────────────────────────────────────

/// Return the most recent health snapshot.
#[tauri::command]
async fn get_health(state: State<'_, AppState>) -> Result<HealthState, String> {
    let health = state.health.lock().map_err(|e| e.to_string())?;
    Ok(health.clone())
}

/// Generic HTTP proxy — lets the frontend call any backend endpoint through
/// the Tauri IPC bridge (required because production CSP blocks localhost).
#[tauri::command]
async fn api_proxy(
    method: String,
    url: String,
    body: Option<String>,
) -> Result<String, String> {
    let client = reqwest::Client::new();

    let req_method = match method.to_uppercase().as_str() {
        "GET" => reqwest::Method::GET,
        "POST" => reqwest::Method::POST,
        "PUT" => reqwest::Method::PUT,
        "DELETE" => reqwest::Method::DELETE,
        "PATCH" => reqwest::Method::PATCH,
        other => return Err(format!("Unsupported HTTP method: {}", other)),
    };

    let mut builder = client
        .request(req_method, &url)
        .timeout(std::time::Duration::from_secs(60));

    if let Some(json_body) = body {
        builder = builder
            .header("content-type", "application/json")
            .body(json_body);
    }

    let resp = builder
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;

    let status = resp.status().as_u16();
    let text = resp.text().await.map_err(|e| e.to_string())?;

    if status >= 400 {
        return Err(format!("HTTP {}: {}", status, text));
    }
    Ok(text)
}

// ── Popover window management ─────────────────────────────────────────────

#[tauri::command]
async fn toggle_popover(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("chat-popover") {
        if window.is_visible().unwrap_or(false) {
            window.hide().map_err(|e| e.to_string())?;
        } else {
            // Position near top-right of the primary monitor
            if let Ok(Some(monitor)) = window.primary_monitor() {
                let scale = monitor.scale_factor();
                let screen_w = (monitor.size().width as f64 / scale) as i32;
                let x = screen_w - 390; // 380px wide + 10px margin
                let y = 30; // Below menu bar
                let _ = window.set_position(tauri::Position::Logical(
                    tauri::LogicalPosition::new(x as f64, y as f64),
                ));
            }
            window.show().map_err(|e| e.to_string())?;
            window.set_focus().map_err(|e| e.to_string())?;
        }
    } else {
        // Fallback: create the popover if it doesn't exist
        let _win = WebviewWindowBuilder::new(
            &app,
            "chat-popover",
            WebviewUrl::App("tulsbot.html".into()),
        )
        .title("")
        .inner_size(380.0, 540.0)
        .decorations(false)
        .always_on_top(true)
        .visible(true)
        .skip_taskbar(true)
        .build()
        .map_err(|e: tauri::Error| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
async fn hide_popover(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("chat-popover") {
        window.hide().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
async fn show_dashboard(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        window.show().map_err(|e| e.to_string())?;
        window.set_focus().map_err(|e| e.to_string())?;
    }
    Ok(())
}

// ── Health polling ──────────────────────────────────────────────────────────

async fn check_port(port: u16) -> bool {
    tokio::net::TcpStream::connect(format!("127.0.0.1:{}", port))
        .await
        .is_ok()
}

async fn poll_health(app: AppHandle, state: &AppState) {
    let ports = vec![
        ("PostgreSQL", 5432u16),
        ("Qdrant", 6333),
        ("Context Manager", 3001),
        ("Web UI", 3100),
    ];

    let mut services = Vec::new();
    let mut healthy_count = 0;

    for (name, port) in &ports {
        let healthy = check_port(*port).await;
        if healthy {
            healthy_count += 1;
        }
        services.push(ServiceHealth {
            name: name.to_string(),
            healthy,
            port: *port,
        });
    }

    let overall = if healthy_count == ports.len() {
        "healthy"
    } else if healthy_count > 0 {
        "degraded"
    } else {
        "down"
    }
    .to_string();

    // Update tray icon colour based on health
    if let Some(tray) = app.tray_by_id("main-tray") {
        let icon_bytes: &[u8] = match overall.as_str() {
            "healthy" => include_bytes!("../icons/tray-green.png"),
            "degraded" => include_bytes!("../icons/tray-yellow.png"),
            _ => include_bytes!("../icons/tray-red.png"),
        };
        if let Ok(icon) = Image::from_bytes(icon_bytes) {
            let _ = tray.set_icon(Some(icon));
            let _ = tray.set_icon_as_template(false);
        }
        let _ = tray.set_tooltip(Some(&format!("Tulsbot — {}", overall)));
    }

    let new_health = HealthState {
        services,
        overall: overall.clone(),
    };

    if let Ok(mut health) = state.health.lock() {
        *health = new_health.clone();
    }

    // Broadcast to all frontend windows
    let _ = app.emit("health-update", &new_health);
}

// ── Tray setup ──────────────────────────────────────────────────────────────

fn setup_tray(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let open_item = MenuItem::with_id(app, "open", "Open Dashboard", true, None::<&str>)?;
    let sep = MenuItem::with_id(app, "sep", "────────────", false, None::<&str>)?;
    let quit_item = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;

    let menu = Menu::with_items(app, &[&open_item, &sep, &quit_item])?;

    let _tray = TrayIconBuilder::with_id("main-tray")
        .icon(
            Image::from_bytes(include_bytes!("../icons/tray-icon.png")).unwrap_or_else(|_| {
                // Fallback: tiny placeholder (will be replaced by health poll)
                Image::new_owned(vec![255u8; 16 * 16 * 4], 16, 16)
            }),
        )
        .icon_as_template(true)
        .menu(&menu)
        .tooltip("Tulsbot")
        .on_menu_event(move |app, event| {
            let app = app.clone();
            match event.id().as_ref() {
                "open" => {
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                }
                "quit" => {
                    app.exit(0);
                }
                _ => {}
            }
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let app = tray.app_handle().clone();
                tauri::async_runtime::spawn(async move {
                    let _ = toggle_popover(app).await;
                });
            }
        })
        .build(app)?;

    Ok(())
}

// ── App entry ───────────────────────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app_state = AppState {
        health: Mutex::new(HealthState::default()),
    };

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(app_state)
        .invoke_handler(tauri::generate_handler![
            get_health,
            api_proxy,
            toggle_popover,
            hide_popover,
            show_dashboard,
        ])
        .setup(|app| {
            let handle = app.handle().clone();

            // Setup tray icon + menu
            if let Err(e) = setup_tray(&handle) {
                eprintln!("[tulsbot] Failed to setup tray: {}", e);
            }

            // Show main window
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }

            // Popover: hide on blur (lose focus)
            if let Some(popover) = app.get_webview_window("chat-popover") {
                let popover_clone = popover.clone();
                popover.on_window_event(move |event| {
                    if let tauri::WindowEvent::Focused(false) = event {
                        let _ = popover_clone.hide();
                    }
                });
            }

            // Start health polling (every 5 seconds)
            let poll_handle = handle.clone();
            tauri::async_runtime::spawn(async move {
                // Initial delay so the UI can render first
                tokio::time::sleep(std::time::Duration::from_secs(3)).await;
                loop {
                    let state = poll_handle.state::<AppState>();
                    poll_health(poll_handle.clone(), state.inner()).await;
                    tokio::time::sleep(std::time::Duration::from_secs(5)).await;
                }
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Tulsbot");
}
