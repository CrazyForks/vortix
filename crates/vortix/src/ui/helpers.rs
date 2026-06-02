use ratatui::layout::{Constraint, Flex, Layout, Rect};

fn centered_by(constraint_x: Constraint, constraint_y: Constraint, area: Rect) -> Rect {
    let vertical = Layout::vertical([constraint_y]).flex(Flex::Center);
    let horizontal = Layout::horizontal([constraint_x]).flex(Flex::Center);

    let [area] = vertical.areas(area);
    let [area] = horizontal.areas(area);
    area
}

/// Center a rectangle sized as a percentage of the parent area.
pub(crate) fn centered_rect(percent_x: u16, percent_y: u16, area: Rect) -> Rect {
    centered_by(
        Constraint::Percentage(percent_x),
        Constraint::Percentage(percent_y),
        area,
    )
}

/// Center a rectangle with fixed pixel dimensions.
pub(crate) fn centered_rect_fixed(width: u16, height: u16, area: Rect) -> Rect {
    centered_by(Constraint::Length(width), Constraint::Length(height), area)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn centered_rect_fixed_centers_within_area() {
        let area = Rect::new(0, 0, 100, 50);
        let r = centered_rect_fixed(20, 10, area);
        assert_eq!(r.width, 20);
        assert_eq!(r.height, 10);
        assert_eq!(r.x, 40); // (100 - 20) / 2
        assert_eq!(r.y, 20); // (50 - 10) / 2
    }

    #[test]
    fn centered_rect_fixed_clamps_to_area() {
        let area = Rect::new(0, 0, 10, 10);
        let r = centered_rect_fixed(30, 30, area);
        assert!(r.width <= area.width);
        assert!(r.height <= area.height);
    }

    #[test]
    fn centered_rect_percentage_scales() {
        let area = Rect::new(0, 0, 100, 100);
        let r = centered_rect(50, 50, area);
        assert_eq!(r.width, 50);
        assert_eq!(r.height, 50);
    }
}
