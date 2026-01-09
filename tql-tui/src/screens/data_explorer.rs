use color_eyre::Result;
use crossterm::event::KeyEvent;
use ratatui::{Frame, widgets::{Block, Borders, Paragraph}};

use crate::app::Screen;
use crate::theme::THEME;

pub struct DataExplorer {
    _data_file: String,
}

impl DataExplorer {
    pub fn new(file: String) -> Result<Self> {
        Ok(DataExplorer {
            _data_file: file,
        })
    }
}

impl Screen for DataExplorer {
    fn render(&mut self, frame: &mut Frame) {
        let paragraph = Paragraph::new("Data Explorer - Coming Soon!")
            .style(THEME.title_style())
            .block(Block::default().borders(Borders::ALL).title("Data Explorer"));
        frame.render_widget(paragraph, frame.area());
    }

    fn handle_input(&mut self, _key: KeyEvent) -> Result<()> {
        Ok(())
    }

    fn update(&mut self) -> Result<()> {
        Ok(())
    }
}
