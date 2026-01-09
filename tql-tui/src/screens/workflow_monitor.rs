use color_eyre::Result;
use crossterm::event::KeyEvent;
use ratatui::{Frame, widgets::{Block, Borders, Paragraph}};

use crate::app::Screen;
use crate::theme::THEME;

pub struct WorkflowMonitor {
    _workflow_file: String,
}

impl WorkflowMonitor {
    pub fn new(file: String) -> Result<Self> {
        Ok(WorkflowMonitor {
            _workflow_file: file,
        })
    }
}

impl Screen for WorkflowMonitor {
    fn render(&mut self, frame: &mut Frame) {
        let paragraph = Paragraph::new("Workflow Monitor - Coming Soon!")
            .style(THEME.title_style())
            .block(Block::default().borders(Borders::ALL).title("Workflow Monitor"));
        frame.render_widget(paragraph, frame.area());
    }

    fn handle_input(&mut self, _key: KeyEvent) -> Result<()> {
        Ok(())
    }

    fn update(&mut self) -> Result<()> {
        Ok(())
    }
}
