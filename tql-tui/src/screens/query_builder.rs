use color_eyre::Result;
use crossterm::event::{KeyEvent, KeyCode};
use ratatui::{Frame, widgets::{Block, Borders, Paragraph}, layout::{Layout, Constraint, Direction}};

use crate::app::Screen;
use crate::theme::THEME;

pub struct QueryBuilder {
    query: String,
    cursor_position: usize,
    _data_file: Option<String>,
}

impl QueryBuilder {
    pub fn new(data: Option<String>) -> Result<Self> {
        Ok(QueryBuilder {
            query: String::new(),
            cursor_position: 0,
            _data_file: data,
        })
    }
}

impl Screen for QueryBuilder {
    fn render(&mut self, frame: &mut Frame) {
        let chunks = Layout::default()
            .direction(Direction::Vertical)
            .constraints([Constraint::Length(3), Constraint::Min(5), Constraint::Min(10)])
            .split(frame.area());

        let title = Paragraph::new("TQL Query Builder")
            .style(THEME.title_style())
            .block(Block::default().borders(Borders::ALL).border_style(THEME.border_style()));
        frame.render_widget(title, chunks[0]);

        let query_input = Paragraph::new(self.query.as_str())
            .block(Block::default().borders(Borders::ALL).title("Query"));
        frame.render_widget(query_input, chunks[1]);

        let help = Paragraph::new("Press 'q' to quit, 'Enter' to execute query")
            .block(Block::default().borders(Borders::ALL).title("Help"));
        frame.render_widget(help, chunks[2]);
    }

    fn handle_input(&mut self, key: KeyEvent) -> Result<()> {
        match key.code {
            KeyCode::Char(c) => {
                self.query.insert(self.cursor_position, c);
                self.cursor_position += 1;
            }
            KeyCode::Backspace => {
                if self.cursor_position > 0 {
                    self.query.remove(self.cursor_position - 1);
                    self.cursor_position -= 1;
                }
            }
            _ => {}
        }
        Ok(())
    }

    fn update(&mut self) -> Result<()> {
        Ok(())
    }
}
