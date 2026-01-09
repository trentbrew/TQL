use clap::{Parser, Subcommand};
use color_eyre::Result;

mod app;
mod ipc;
mod screens;
mod state;
mod theme;
mod widgets;

#[derive(Parser)]
#[command(name = "tql-tui")]
#[command(about = "Interactive TUI for TQL (Tree Query Language)", long_about = None)]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Launch graph visualizer
    Graph {
        /// Graph data file (JSON)
        #[arg(short, long)]
        file: Option<String>,

        /// Watch for changes
        #[arg(short, long)]
        watch: bool,

        /// Run in headless IPC mode (stdin/stdout JSON-RPC)
        #[arg(long)]
        ipc: bool,
    },
    /// Launch interactive query builder
    Query {
        /// Data file to query
        #[arg(short, long)]
        data: Option<String>,

        /// Run in headless IPC mode (stdin/stdout JSON-RPC)
        #[arg(long)]
        ipc: bool,
    },
    /// Monitor workflow execution
    Workflow {
        /// Workflow file (YAML)
        #[arg(short, long)]
        file: String,

        /// Run in headless IPC mode (stdin/stdout JSON-RPC)
        #[arg(long)]
        ipc: bool,
    },
    /// Launch data explorer
    Explore {
        /// Data file to explore
        file: String,

        /// Run in headless IPC mode (stdin/stdout JSON-RPC)
        #[arg(long)]
        ipc: bool,
    },
    /// Launch full dashboard
    Dashboard {
        /// Workspace database
        #[arg(short, long)]
        workspace: Option<String>,

        /// Run in headless IPC mode (stdin/stdout JSON-RPC)
        #[arg(long)]
        ipc: bool,
    },
}

fn main() -> Result<()> {
    color_eyre::install()?;

    let cli = Cli::parse();

    match cli.command {
        Commands::Graph { file, watch, ipc } => {
            if ipc {
                app::run_graph_viewer_ipc(file)?;
            } else {
                app::run_graph_viewer(file, watch)?;
            }
        }
        Commands::Query { data, ipc } => {
            if ipc {
                app::run_query_builder_ipc(data)?;
            } else {
                app::run_query_builder(data)?;
            }
        }
        Commands::Workflow { file, ipc } => {
            if ipc {
                app::run_workflow_monitor_ipc(file)?;
            } else {
                app::run_workflow_monitor(file)?;
            }
        }
        Commands::Explore { file, ipc } => {
            if ipc {
                app::run_data_explorer_ipc(file)?;
            } else {
                app::run_data_explorer(file)?;
            }
        }
        Commands::Dashboard { workspace, ipc } => {
            if ipc {
                app::run_dashboard_ipc(workspace)?;
            } else {
                app::run_dashboard(workspace)?;
            }
        }
    }

    Ok(())
}
