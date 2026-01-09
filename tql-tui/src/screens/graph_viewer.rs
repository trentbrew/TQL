use color_eyre::Result;
use crossterm::event::{KeyCode, KeyEvent};
use ratatui::{
    layout::{Constraint, Direction, Layout},
    style::{Color, Modifier, Style},
    text::{Line, Span},
    widgets::{canvas::Canvas, Block, Borders, Paragraph},
    Frame,
};
use std::collections::HashMap;

use crate::app::Screen;
use crate::state::{GraphEdge, GraphNode, NodeState};
use crate::theme::THEME;

pub struct GraphViewer {
    nodes: Vec<GraphNode>,
    edges: Vec<GraphEdge>,
    selected_node: Option<usize>,
    viewport: (f64, f64, f64, f64), // (x_min, y_min, x_max, y_max)
    zoom: f64,
}

impl GraphViewer {
    pub fn new(file: Option<String>, _watch: bool) -> Result<Self> {
        let (nodes, edges) = if let Some(path) = file {
            Self::load_graph_from_file(&path)?
        } else {
            Self::create_demo_graph()
        };

        Ok(GraphViewer {
            nodes,
            edges,
            selected_node: Some(0),
            viewport: (-10.0, -10.0, 10.0, 10.0),
            zoom: 1.0,
        })
    }

    fn load_graph_from_file(_path: &str) -> Result<(Vec<GraphNode>, Vec<GraphEdge>)> {
        // TODO: Implement file loading
        Ok(Self::create_demo_graph())
    }

    fn create_demo_graph() -> (Vec<GraphNode>, Vec<GraphEdge>) {
        let nodes = vec![
            GraphNode {
                id: "init".to_string(),
                label: "Initialize".to_string(),
                node_type: "function".to_string(),
                state: NodeState::Success,
                position: Some((0.0, 0.0)),
            },
            GraphNode {
                id: "query".to_string(),
                label: "Query Data".to_string(),
                node_type: "llm".to_string(),
                state: NodeState::Running,
                position: Some((0.0, -3.0)),
            },
            GraphNode {
                id: "analyze".to_string(),
                label: "Analyze Results".to_string(),
                node_type: "function".to_string(),
                state: NodeState::Pending,
                position: Some((3.0, -6.0)),
            },
            GraphNode {
                id: "format".to_string(),
                label: "Format Output".to_string(),
                node_type: "function".to_string(),
                state: NodeState::Pending,
                position: Some((0.0, -9.0)),
            },
        ];

        let edges = vec![
            GraphEdge {
                from: "init".to_string(),
                to: "query".to_string(),
                label: "NEXT".to_string(),
            },
            GraphEdge {
                from: "query".to_string(),
                to: "analyze".to_string(),
                label: "result".to_string(),
            },
            GraphEdge {
                from: "analyze".to_string(),
                to: "format".to_string(),
                label: "data".to_string(),
            },
        ];

        (nodes, edges)
    }

    fn get_node_color(&self, state: NodeState) -> Color {
        match state {
            NodeState::Pending => Color::Gray,
            NodeState::Running => Color::Yellow,
            NodeState::Success => Color::Green,
            NodeState::Error => Color::Red,
            NodeState::Skipped => Color::DarkGray,
        }
    }

    fn get_node_symbol(&self, state: NodeState) -> &str {
        match state {
            NodeState::Pending => "⏸",
            NodeState::Running => "▶",
            NodeState::Success => "✓",
            NodeState::Error => "✗",
            NodeState::Skipped => "⊘",
        }
    }
}

impl Screen for GraphViewer {
    fn render(&mut self, frame: &mut Frame) {
        let chunks = Layout::default()
            .direction(Direction::Vertical)
            .constraints([
                Constraint::Length(3),
                Constraint::Min(10),
                Constraint::Length(5),
            ])
            .split(frame.area());

        // Title
        let title = Paragraph::new("TQL Graph Viewer")
            .style(THEME.title_style())
            .block(
                Block::default()
                    .borders(Borders::ALL)
                    .border_style(THEME.border_style()),
            );
        frame.render_widget(title, chunks[0]);

        // Graph canvas
        let node_positions: HashMap<String, (f64, f64)> = self
            .nodes
            .iter()
            .filter_map(|n| n.position.map(|p| (n.id.clone(), (p.0 as f64, p.1 as f64))))
            .collect();

        let canvas = Canvas::default()
            .block(
                Block::default()
                    .borders(Borders::ALL)
                    .title("Graph")
                    .border_style(THEME.border_style()),
            )
            .x_bounds([self.viewport.0, self.viewport.2])
            .y_bounds([self.viewport.1, self.viewport.3])
            .paint(|ctx| {
                // Draw edges
                for edge in &self.edges {
                    if let (Some(&from_pos), Some(&to_pos)) =
                        (node_positions.get(&edge.from), node_positions.get(&edge.to))
                    {
                        ctx.draw(&ratatui::widgets::canvas::Line {
                            x1: from_pos.0,
                            y1: from_pos.1,
                            x2: to_pos.0,
                            y2: to_pos.1,
                            color: THEME.border,
                        });
                    }
                }

                // Draw nodes
                for (i, node) in self.nodes.iter().enumerate() {
                    if let Some(pos) = node.position {
                        let color = self.get_node_color(node.state);
                        let is_selected = self.selected_node == Some(i);

                        // Draw node circle
                        ctx.draw(&ratatui::widgets::canvas::Circle {
                            x: pos.0 as f64,
                            y: pos.1 as f64,
                            radius: if is_selected { 0.8 } else { 0.6 },
                            color: if is_selected { THEME.highlight } else { color },
                        });
                    }
                }
            });

        frame.render_widget(canvas, chunks[1]);

        // Node details
        if let Some(idx) = self.selected_node {
            if let Some(node) = self.nodes.get(idx) {
                let symbol = self.get_node_symbol(node.state);
                let details = vec![
                    Line::from(vec![
                        Span::styled("Node: ", Style::default().add_modifier(Modifier::BOLD)),
                        Span::raw(&node.label),
                    ]),
                    Line::from(vec![
                        Span::styled("Type: ", Style::default().add_modifier(Modifier::BOLD)),
                        Span::raw(&node.node_type),
                    ]),
                    Line::from(vec![
                        Span::styled("State: ", Style::default().add_modifier(Modifier::BOLD)),
                        Span::styled(
                            format!("{} {:?}", symbol, node.state),
                            Style::default().fg(self.get_node_color(node.state)),
                        ),
                    ]),
                ];

                let details_widget = Paragraph::new(details).block(
                    Block::default()
                        .borders(Borders::ALL)
                        .title("Node Details")
                        .border_style(THEME.border_style()),
                );
                frame.render_widget(details_widget, chunks[2]);
            }
        }
    }

    fn handle_input(&mut self, key: KeyEvent) -> Result<()> {
        match key.code {
            KeyCode::Up | KeyCode::Char('k') => {
                if let Some(idx) = self.selected_node {
                    if idx > 0 {
                        self.selected_node = Some(idx - 1);
                    }
                }
            }
            KeyCode::Down | KeyCode::Char('j') => {
                if let Some(idx) = self.selected_node {
                    if idx < self.nodes.len() - 1 {
                        self.selected_node = Some(idx + 1);
                    }
                }
            }
            KeyCode::Char('+') | KeyCode::Char('=') => {
                self.zoom *= 1.1;
                let center_x = (self.viewport.0 + self.viewport.2) / 2.0;
                let center_y = (self.viewport.1 + self.viewport.3) / 2.0;
                let width = (self.viewport.2 - self.viewport.0) / 1.1;
                let height = (self.viewport.3 - self.viewport.1) / 1.1;
                self.viewport = (
                    center_x - width / 2.0,
                    center_y - height / 2.0,
                    center_x + width / 2.0,
                    center_y + height / 2.0,
                );
            }
            KeyCode::Char('-') => {
                self.zoom /= 1.1;
                let center_x = (self.viewport.0 + self.viewport.2) / 2.0;
                let center_y = (self.viewport.1 + self.viewport.3) / 2.0;
                let width = (self.viewport.2 - self.viewport.0) * 1.1;
                let height = (self.viewport.3 - self.viewport.1) * 1.1;
                self.viewport = (
                    center_x - width / 2.0,
                    center_y - height / 2.0,
                    center_x + width / 2.0,
                    center_y + height / 2.0,
                );
            }
            _ => {}
        }
        Ok(())
    }

    fn update(&mut self) -> Result<()> {
        // TODO: Poll for updates from IPC
        Ok(())
    }
}
