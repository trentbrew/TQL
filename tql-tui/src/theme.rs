use ratatui::style::{Color, Style, Modifier};

pub struct Theme {
    pub primary: Color,
    pub secondary: Color,
    pub success: Color,
    pub warning: Color,
    pub error: Color,
    pub info: Color,
    pub background: Color,
    pub foreground: Color,
    pub border: Color,
    pub highlight: Color,
}

impl Theme {
    pub fn default() -> Self {
        Theme {
            primary: Color::Cyan,
            secondary: Color::Blue,
            success: Color::Green,
            warning: Color::Yellow,
            error: Color::Red,
            info: Color::Blue,
            background: Color::Black,
            foreground: Color::White,
            border: Color::DarkGray,
            highlight: Color::Cyan,
        }
    }

    pub fn nord() -> Self {
        Theme {
            primary: Color::Rgb(136, 192, 208),      // Nord8 - cyan
            secondary: Color::Rgb(129, 161, 193),    // Nord9 - blue
            success: Color::Rgb(163, 190, 140),      // Nord14 - green
            warning: Color::Rgb(235, 203, 139),      // Nord13 - yellow
            error: Color::Rgb(191, 97, 106),         // Nord11 - red
            info: Color::Rgb(94, 129, 172),          // Nord10 - dark blue
            background: Color::Rgb(46, 52, 64),      // Nord0 - dark
            foreground: Color::Rgb(216, 222, 233),   // Nord4 - white
            border: Color::Rgb(67, 76, 94),          // Nord2 - gray
            highlight: Color::Rgb(136, 192, 208),    // Nord8 - cyan
        }
    }

    pub fn title_style(&self) -> Style {
        Style::default()
            .fg(self.primary)
            .add_modifier(Modifier::BOLD)
    }

    pub fn border_style(&self) -> Style {
        Style::default().fg(self.border)
    }

    pub fn highlight_style(&self) -> Style {
        Style::default()
            .fg(self.highlight)
            .add_modifier(Modifier::BOLD)
    }

    pub fn success_style(&self) -> Style {
        Style::default().fg(self.success)
    }

    pub fn error_style(&self) -> Style {
        Style::default().fg(self.error)
    }

    pub fn warning_style(&self) -> Style {
        Style::default().fg(self.warning)
    }
}

pub static THEME: Theme = Theme {
    primary: Color::Cyan,
    secondary: Color::Blue,
    success: Color::Green,
    warning: Color::Yellow,
    error: Color::Red,
    info: Color::Blue,
    background: Color::Black,
    foreground: Color::White,
    border: Color::DarkGray,
    highlight: Color::Cyan,
};
