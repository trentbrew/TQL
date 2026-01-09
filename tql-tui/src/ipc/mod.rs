// IPC module for communication with TQL TypeScript core
pub mod client;
pub mod protocol;

// Re-export for convenience (will be used when IPC is fully integrated)
#[allow(unused_imports)]
pub use client::IPCClient;
#[allow(unused_imports)]
pub use protocol::{Request, Response, GraphData, QueryRequest, QueryResponse};
