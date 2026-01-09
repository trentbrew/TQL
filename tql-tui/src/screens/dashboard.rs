use color_eyre::Result;
use crossterm::event::KeyEvent;
use ratatui::{Frame, widgets::{Block, Borders, Paragraph}};

use crate::app::Screen;
use crate::theme::THEME;

pub struct Dashboard {
    _workspace: Option<String>,
}

impl Dashboard {
    pub fn new(workspace: Option<String>) -> Result<Self> {
        Ok(Dashboard {
            _workspace: workspace,
        })
    }
}

impl Screen for Dashboard {
    fn render(&mut self, frame: &mut Frame) {
        let paragraph = Paragraph::new("TQL Dashboard - Coming Soon!")
            .style(THEME.title_style())
            .block(Block::default().borders(Borders::ALL).title("Dashboard"));
        frame.render_widget(paragraph, frame.area());
    }

    fn handle_input(&mut self, _key: KeyEvent) -> Result<()> {
        Ok(())
    }

    fn update(&mut self) -> Result<()> {
        Ok(())
    }
}
