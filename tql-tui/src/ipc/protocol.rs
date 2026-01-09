use serde::{Deserialize, Serialize};
use crate::state::{GraphNode, GraphEdge};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "jsonrpc")]
pub struct Request {
    pub method: String,
    pub params: serde_json::Value,
    pub id: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Response {
    pub result: Option<serde_json::Value>,
    pub error: Option<String>,
    pub id: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GraphData {
    pub nodes: Vec<GraphNode>,
    pub edges: Vec<GraphEdge>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueryRequest {
    pub query: String,
    pub limit: Option<usize>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueryResponse {
    pub rows: Vec<serde_json::Value>,
    pub execution_time: f64,
    pub row_count: usize,
}

impl Request {
    pub fn new(method: impl Into<String>, params: serde_json::Value, id: u64) -> Self {
        Request {
            method: method.into(),
            params,
            id,
        }
    }

    pub fn execute_query(query: String, id: u64) -> Self {
        Self::new(
            "executeQuery",
            serde_json::json!({ "query": query }),
            id,
        )
    }

    pub fn load_graph(graph: GraphData, id: u64) -> Self {
        Self::new("loadGraph", serde_json::json!({ "graph": graph }), id)
    }

    pub fn get_entity(entity_id: String, id: u64) -> Self {
        Self::new(
            "getEntity",
            serde_json::json!({ "entityId": entity_id }),
            id,
        )
    }
}

impl Response {
    pub fn success(result: serde_json::Value, id: u64) -> Self {
        Response {
            result: Some(result),
            error: None,
            id,
        }
    }

    pub fn error(error: String, id: u64) -> Self {
        Response {
            result: None,
            error: Some(error),
            id,
        }
    }
}
