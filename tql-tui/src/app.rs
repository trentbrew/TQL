use color_eyre::Result;
use crossterm::{
    event::{self, DisableMouseCapture, EnableMouseCapture, Event, KeyCode},
    execute,
    terminal::{disable_raw_mode, enable_raw_mode, EnterAlternateScreen, LeaveAlternateScreen},
};
use ratatui::{backend::CrosstermBackend, Terminal};
use std::io;

use crate::screens::{Dashboard, DataExplorer, GraphViewer, QueryBuilder, WorkflowMonitor};

pub fn run_graph_viewer(file: Option<String>, watch: bool) -> Result<()> {
    let mut terminal = setup_terminal()?;
    let mut app = GraphViewer::new(file, watch)?;

    let result = run_app(&mut terminal, &mut app);

    restore_terminal(terminal)?;
    result
}

pub fn run_query_builder(data: Option<String>) -> Result<()> {
    let mut terminal = setup_terminal()?;
    let mut app = QueryBuilder::new(data)?;

    let result = run_app(&mut terminal, &mut app);

    restore_terminal(terminal)?;
    result
}

pub fn run_workflow_monitor(file: String) -> Result<()> {
    let mut terminal = setup_terminal()?;
    let mut app = WorkflowMonitor::new(file)?;

    let result = run_app(&mut terminal, &mut app);

    restore_terminal(terminal)?;
    result
}

pub fn run_data_explorer(file: String) -> Result<()> {
    let mut terminal = setup_terminal()?;
    let mut app = DataExplorer::new(file)?;

    let result = run_app(&mut terminal, &mut app);

    restore_terminal(terminal)?;
    result
}

pub fn run_dashboard(workspace: Option<String>) -> Result<()> {
    let mut terminal = setup_terminal()?;
    let mut app = Dashboard::new(workspace)?;

    let result = run_app(&mut terminal, &mut app);

    restore_terminal(terminal)?;
    result
}

fn setup_terminal() -> Result<Terminal<CrosstermBackend<io::Stdout>>> {
    enable_raw_mode()?;
    let mut stdout = io::stdout();
    execute!(stdout, EnterAlternateScreen, EnableMouseCapture)?;
    let backend = CrosstermBackend::new(stdout);
    Ok(Terminal::new(backend)?)
}

fn restore_terminal(mut terminal: Terminal<CrosstermBackend<io::Stdout>>) -> Result<()> {
    disable_raw_mode()?;
    execute!(
        terminal.backend_mut(),
        LeaveAlternateScreen,
        DisableMouseCapture
    )?;
    terminal.show_cursor()?;
    Ok(())
}

fn run_app<T: Screen>(
    terminal: &mut Terminal<CrosstermBackend<io::Stdout>>,
    app: &mut T,
) -> Result<()> {
    loop {
        terminal.draw(|f| app.render(f))?;

        if event::poll(std::time::Duration::from_millis(100))? {
            if let Event::Key(key) = event::read()? {
                if key.code == KeyCode::Char('q') {
                    break;
                }
                app.handle_input(key)?;
            }
        }

        app.update()?;
    }
    Ok(())
}

pub trait Screen {
    fn render(&mut self, frame: &mut ratatui::Frame);
    fn handle_input(&mut self, key: event::KeyEvent) -> Result<()>;
    fn update(&mut self) -> Result<()>;
}

// IPC mode implementations (headless, JSON-RPC over stdin/stdout)
use crate::ipc::{Request, Response};
use std::io::{BufRead, BufReader};

pub fn run_graph_viewer_ipc(file: Option<String>) -> Result<()> {
    let stdin = io::stdin();
    let reader = BufReader::new(stdin);

    // Send ready signal
    let ready = Response {
        id: 0,
        result: Some(serde_json::json!({ "status": "ready", "mode": "graph" })),
        error: None,
    };
    println!("{}", serde_json::to_string(&ready)?);

    // Process IPC requests
    for line in reader.lines() {
        let line = line?;
        if let Ok(request) = serde_json::from_str::<Request>(&line) {
            let response = handle_graph_request(request, &file);
            println!("{}", serde_json::to_string(&response)?);
        }
    }

    Ok(())
}

pub fn run_query_builder_ipc(data: Option<String>) -> Result<()> {
    let stdin = io::stdin();
    let reader = BufReader::new(stdin);

    let ready = Response {
        id: 0,
        result: Some(serde_json::json!({ "status": "ready", "mode": "query" })),
        error: None,
    };
    println!("{}", serde_json::to_string(&ready)?);

    for line in reader.lines() {
        let line = line?;
        if let Ok(request) = serde_json::from_str::<Request>(&line) {
            let response = handle_query_request(request, &data);
            println!("{}", serde_json::to_string(&response)?);
        }
    }

    Ok(())
}

pub fn run_workflow_monitor_ipc(file: String) -> Result<()> {
    let stdin = io::stdin();
    let reader = BufReader::new(stdin);

    let ready = Response {
        id: 0,
        result: Some(serde_json::json!({ "status": "ready", "mode": "workflow" })),
        error: None,
    };
    println!("{}", serde_json::to_string(&ready)?);

    for line in reader.lines() {
        let line = line?;
        if let Ok(request) = serde_json::from_str::<Request>(&line) {
            let response = handle_workflow_request(request, &file);
            println!("{}", serde_json::to_string(&response)?);
        }
    }

    Ok(())
}

pub fn run_data_explorer_ipc(file: String) -> Result<()> {
    let stdin = io::stdin();
    let reader = BufReader::new(stdin);

    let ready = Response {
        id: 0,
        result: Some(serde_json::json!({ "status": "ready", "mode": "explore" })),
        error: None,
    };
    println!("{}", serde_json::to_string(&ready)?);

    for line in reader.lines() {
        let line = line?;
        if let Ok(request) = serde_json::from_str::<Request>(&line) {
            let response = handle_explore_request(request, &file);
            println!("{}", serde_json::to_string(&response)?);
        }
    }

    Ok(())
}

pub fn run_dashboard_ipc(workspace: Option<String>) -> Result<()> {
    let stdin = io::stdin();
    let reader = BufReader::new(stdin);

    let ready = Response {
        id: 0,
        result: Some(serde_json::json!({ "status": "ready", "mode": "dashboard" })),
        error: None,
    };
    println!("{}", serde_json::to_string(&ready)?);

    for line in reader.lines() {
        let line = line?;
        if let Ok(request) = serde_json::from_str::<Request>(&line) {
            let response = handle_dashboard_request(request, &workspace);
            println!("{}", serde_json::to_string(&response)?);
        }
    }

    Ok(())
}

// Request handlers
fn handle_graph_request(request: Request, _file: &Option<String>) -> Response {
    match request.method.as_str() {
        "loadGraph" => {
            // Graph data will come from TypeScript via params
            Response {
                id: request.id,
                result: Some(serde_json::json!({ "status": "graph_loaded" })),
                error: None,
            }
        }
        "updateNode" => {
            // Update node state (e.g., from workflow execution)
            Response {
                id: request.id,
                result: Some(serde_json::json!({ "status": "node_updated" })),
                error: None,
            }
        }
        "getViewport" => Response {
            id: request.id,
            result: Some(serde_json::json!({
                "offset_x": 0.0,
                "offset_y": 0.0,
                "zoom": 1.0
            })),
            error: None,
        },
        _ => Response {
            id: request.id,
            result: None,
            error: Some(format!("Unknown method: {}", request.method)),
        },
    }
}

fn handle_query_request(request: Request, _data: &Option<String>) -> Response {
    Response {
        id: request.id,
        result: Some(serde_json::json!({ "status": "ok" })),
        error: None,
    }
}

fn handle_workflow_request(request: Request, _file: &str) -> Response {
    Response {
        id: request.id,
        result: Some(serde_json::json!({ "status": "ok" })),
        error: None,
    }
}

fn handle_explore_request(request: Request, _file: &str) -> Response {
    Response {
        id: request.id,
        result: Some(serde_json::json!({ "status": "ok" })),
        error: None,
    }
}

fn handle_dashboard_request(request: Request, _workspace: &Option<String>) -> Response {
    Response {
        id: request.id,
        result: Some(serde_json::json!({ "status": "ok" })),
        error: None,
    }
}
