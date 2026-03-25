use crate::app::{App, ConnectionState};
use crate::{constants, theme, utils};
use ratatui::{
    layout::{Alignment, Constraint, Layout, Rect},
    style::{Modifier, Style},
    text::{Line, Span},
    widgets::{
        canvas::{Canvas, Line as CanvasLine},
        Block, Borders, Paragraph,
    },
    Frame,
};

#[allow(clippy::too_many_lines)]
pub(super) fn render(frame: &mut Frame, app: &App, area: Rect) {
    let is_focused = app.should_draw_focus(&crate::app::FocusedPanel::Chart);
    let border_style = if is_focused {
        Style::default().fg(theme::BORDER_FOCUSED)
    } else {
        Style::default().fg(theme::BORDER_DEFAULT)
    };

    if app.effective_flipped(&crate::app::FocusedPanel::Chart) {
        render_back(frame, app, area, border_style);
        return;
    }

    // Peak detection for dynamic Y-axis scaling (calculate first for title)
    let max_down = app.down_history.iter().copied().fold(0.0, f64::max);
    let max_up = app.up_history.iter().copied().fold(0.0, f64::max);
    let peak = (max_down.max(max_up) * 1.2).max(1024.0 * 1024.0 * 0.5);
    let (scale_val, scale_unit) = if peak >= 1024.0 * 1024.0 * 1024.0 {
        (peak / 1024.0 / 1024.0 / 1024.0, "GB/s")
    } else if peak >= 1024.0 * 1024.0 {
        (peak / 1024.0 / 1024.0, "MB/s")
    } else {
        (peak / 1024.0, "KB/s")
    };
    let peak_label = format!(" Peak: {scale_val:.1} {scale_unit} ");

    let block = Block::default()
        .borders(Borders::ALL)
        .border_style(border_style)
        .title(" Network Throughput ")
        .title(
            Line::from(Span::styled(
                peak_label,
                Style::default().fg(theme::NORD_POLAR_NIGHT_4),
            ))
            .right_aligned(),
        )
        .title_bottom(
            Line::from(Span::styled(
                format!(" Scale: 0 – {scale_val:.1} {scale_unit} "),
                Style::default().fg(theme::KEY_HINT_DESC),
            ))
            .right_aligned(),
        );

    let inner = block.inner(area);
    frame.render_widget(block, area);

    // Layout: Stats+Legend (Top) | Chart (Bottom)
    let chunks = Layout::vertical([Constraint::Length(1), Constraint::Min(0)]).split(inner);

    // Calculate session totals from connection details if available
    let (session_rx, session_tx) = match &app.connection_state {
        ConnectionState::Connected { details, .. } => {
            let rx = if details.transfer_rx.is_empty() {
                "0B".to_string()
            } else {
                details.transfer_rx.clone()
            };
            let tx = if details.transfer_tx.is_empty() {
                "0B".to_string()
            } else {
                details.transfer_tx.clone()
            };
            (rx, tx)
        }
        _ => ("0B".to_string(), "0B".to_string()),
    };

    let stats_line = Line::from(vec![
        Span::styled(" ▲ UP: ", Style::default().fg(theme::NORD_GREEN)),
        Span::styled(
            format!("{:<10}", utils::format_bytes_speed(app.current_up)),
            Style::default().fg(theme::TEXT_PRIMARY),
        ),
        Span::styled(" │ ", Style::default().fg(theme::NORD_POLAR_NIGHT_4)),
        Span::styled(" ▼ DOWN: ", Style::default().fg(theme::NORD_FROST_2)),
        Span::styled(
            format!("{:<10}", utils::format_bytes_speed(app.current_down)),
            Style::default().fg(theme::TEXT_PRIMARY),
        ),
        Span::styled(" │ ", Style::default().fg(theme::NORD_POLAR_NIGHT_4)),
        Span::styled(" Session: ", Style::default().fg(theme::TEXT_SECONDARY)),
        Span::styled("↓", Style::default().fg(theme::NORD_FROST_3)),
        Span::styled(&session_rx, Style::default().fg(theme::TEXT_PRIMARY)),
        Span::styled(" ↑", Style::default().fg(theme::NORD_GREEN)),
        Span::styled(&session_tx, Style::default().fg(theme::TEXT_PRIMARY)),
    ]);
    frame.render_widget(
        Paragraph::new(stats_line).alignment(Alignment::Center),
        chunks[0],
    );

    let hist_len = app.down_history.len();
    #[allow(clippy::cast_precision_loss)]
    let x_max = constants::NETWORK_HISTORY_SIZE as f64;
    let canvas = Canvas::default()
        .block(Block::default())
        .x_bounds([0.0, x_max])
        .y_bounds([0.0, peak])
        .paint(|ctx| {
            if hist_len > 1 {
                #[allow(clippy::cast_precision_loss)]
                for i in 0..hist_len - 1 {
                    let x1 = i as f64;
                    let x2 = (i + 1) as f64;

                    let dy1 = app.down_history[i];
                    let dy2 = app.down_history[i + 1];
                    if dy1 > 0.0 || dy2 > 0.0 {
                        ctx.draw(&CanvasLine {
                            x1,
                            y1: dy1,
                            x2,
                            y2: dy2,
                            color: theme::ACCENT_PRIMARY,
                        });
                    }

                    let uy1 = app.up_history[i];
                    let uy2 = app.up_history[i + 1];
                    if uy1 > 0.0 || uy2 > 0.0 {
                        ctx.draw(&CanvasLine {
                            x1,
                            y1: uy1,
                            x2,
                            y2: uy2,
                            color: theme::SUCCESS,
                        });
                    }
                }
            }
        });
    frame.render_widget(canvas, chunks[1]);
}

fn format_bytes(bytes: u64) -> String {
    #[allow(clippy::cast_precision_loss)]
    let b = bytes as f64;
    if b >= 1_000_000_000.0 {
        format!("{:.1} GB", b / 1_000_000_000.0)
    } else if b >= 1_000_000.0 {
        format!("{:.1} MB", b / 1_000_000.0)
    } else if b >= 1_000.0 {
        format!("{:.1} KB", b / 1_000.0)
    } else {
        format!("{bytes} B")
    }
}

fn render_back(frame: &mut Frame, app: &App, area: Rect, border_style: Style) {
    let block = Block::default()
        .borders(Borders::ALL)
        .border_style(border_style)
        .title(constants::TITLE_FLIP_NETWORK_ACTIVITY)
        .title_bottom(
            Line::from(Span::styled(
                constants::FLIP_BACK_HINT,
                Style::default().fg(theme::KEY_HINT_DESC),
            ))
            .right_aligned(),
        );

    let inner = block.inner(area);
    frame.render_widget(block, area);

    let is_connected = matches!(app.connection_state, ConnectionState::Connected { .. });

    let text = if is_connected {
        let label_style = Style::default().fg(theme::TEXT_SECONDARY);
        let down_icon = Style::default().fg(theme::NORD_FROST_2);
        let up_icon = Style::default().fg(theme::NORD_GREEN);
        let val_style = Style::default().fg(theme::TEXT_PRIMARY);

        let duration_line = if let Some(start) = app.session_start {
            let elapsed = start.elapsed().as_secs();
            let h = elapsed / 3600;
            let m = (elapsed % 3600) / 60;
            let s = elapsed % 60;
            Line::from(vec![
                Span::styled("  Duration   ", label_style),
                Span::styled(format!("{h}h {m}m {s}s"), val_style),
            ])
        } else {
            Line::from(vec![
                Span::styled("  Duration   ", label_style),
                Span::styled("–", val_style),
            ])
        };

        vec![
            Line::from(""),
            Line::from(Span::styled(
                "Session Network Stats",
                Style::default()
                    .fg(theme::ACCENT_PRIMARY)
                    .add_modifier(Modifier::BOLD),
            )),
            Line::from(""),
            Line::from(vec![
                Span::styled("  ▼ Download  ", down_icon),
                Span::styled(utils::format_bytes_speed(app.current_down), val_style),
            ]),
            Line::from(vec![
                Span::styled("  ▲ Upload    ", up_icon),
                Span::styled(utils::format_bytes_speed(app.current_up), val_style),
            ]),
            Line::from(""),
            Line::from(vec![
                Span::styled("  ▼ Peak Down ", down_icon),
                Span::styled(utils::format_bytes_speed(app.session_peak_down), val_style),
            ]),
            Line::from(vec![
                Span::styled("  ▲ Peak Up   ", up_icon),
                Span::styled(utils::format_bytes_speed(app.session_peak_up), val_style),
            ]),
            Line::from(""),
            Line::from(vec![
                Span::styled("  ▼ Total Down ", down_icon),
                Span::styled(format_bytes(app.session_total_down), val_style),
            ]),
            Line::from(vec![
                Span::styled("  ▲ Total Up   ", up_icon),
                Span::styled(format_bytes(app.session_total_up), val_style),
            ]),
            Line::from(""),
            duration_line,
        ]
    } else {
        vec![
            Line::from(""),
            Line::from(""),
            Line::from(Span::styled(
                "  Connect to a VPN to see network activity.",
                Style::default().fg(theme::INACTIVE),
            )),
        ]
    };

    frame.render_widget(Paragraph::new(text).alignment(Alignment::Left), inner);
}
