import 'package:flutter/material.dart';
import 'package:lmslocal_flutter/core/theme/coupon_theme.dart';

/// One destination in [AppNavBar].
class AppNavItem {
  const AppNavItem({
    required this.icon,
    required this.activeIcon,
    required this.label,
    required this.isActive,
    required this.onTap,
  });

  final IconData icon;
  final IconData activeIcon;
  final String label;
  final bool isActive;
  final VoidCallback onTap;
}

/// The bottom navigation shared by the dashboard and the competition screens,
/// so the two can never drift apart.
///
/// The active item is marked twice — an ink rule across the top of its cell and
/// a weight change — rather than by colour alone, which is the same rule the
/// game screens follow for player state (design-system.md §8). It deliberately
/// does not use `moss`: green means "still in" in this product, and spending it
/// on chrome would blunt that.
class AppNavBar extends StatelessWidget {
  const AppNavBar({super.key, required this.items});

  final List<AppNavItem> items;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: CouponTheme.stockLit,
        border: Border(top: CouponTheme.rule()),
      ),
      child: SafeArea(
        top: false,
        child: SizedBox(
          // Keeps every destination on a 48dp-plus tap target.
          height: 60,
          child: Row(
            children: [
              for (final item in items) Expanded(child: _NavCell(item: item)),
            ],
          ),
        ),
      ),
    );
  }
}

class _NavCell extends StatelessWidget {
  const _NavCell({required this.item});

  final AppNavItem item;

  @override
  Widget build(BuildContext context) {
    final color = item.isActive ? CouponTheme.ink : CouponTheme.inkFade;

    return Semantics(
      button: true,
      selected: item.isActive,
      label: item.label,
      child: GestureDetector(
        onTap: item.onTap,
        behavior: HitTestBehavior.opaque,
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            // The marker sits flush with the bar's own top rule.
            Container(
              height: 2,
              margin: const EdgeInsets.only(bottom: 8),
              color: item.isActive ? CouponTheme.ink : Colors.transparent,
            ),
            Icon(item.isActive ? item.activeIcon : item.icon, size: 24, color: color),
            const SizedBox(height: 3),
            Text(
              item.label.toUpperCase(),
              style: CouponTheme.label.copyWith(
                color: color,
                fontWeight: item.isActive ? FontWeight.w600 : FontWeight.w400,
                fontSize: 10,
                letterSpacing: 10 * 0.12,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
