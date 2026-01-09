use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppState {
    pub current_view: View,
    pub query_history: Vec<String>,
    pub last_query: Option<String>,
    pub last_result: Option<QueryResult>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum View {
    Dashboard,
    Graph,
    Query,
    Workflow,
    Data,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueryResult {
    pub rows: Vec<serde_json::Value>,
    pub execution_time: f64,
    pub row_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GraphNode {
    pub id: String,
    pub label: String,
    pub node_type: String,
    pub state: NodeState,
    pub position: Option<(f32, f32)>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GraphEdge {
    pub from: String,
    pub to: String,
    pub label: String,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
pub enum NodeState {
    Pending,
    Running,
    Success,
    Error,
    Skipped,
}

impl AppState {
    pub fn new() -> Self {
        AppState {
            current_view: View::Dashboard,
            query_history: Vec::new(),
            last_query: None,
            last_result: None,
        }
    }

    pub fn add_to_history(&mut self, query: String) {
        if !query.is_empty() {
            self.query_history.push(query.clone());
            self.last_query = Some(query);
        }
    }
}

impl Default for AppState {
    fn default() -> Self {
        Self::new()
    }
}
