# Task Detail 04: Status Filter and Pagination UI

## Objective

在 Editor 和 Sidebar 中提供一致、可访问的 Change 状态管理体验。

## Editor Layout

```text
Changes                                  [New Change] [Add Operation]
17 total · Local ./openspec · Healthy

[All 17] [Planning 5] [Ready 3] [Applying 4] [Verify 2] [Archived 3]

[Search changes...] [Sort: Updated desc] [More Filters]

Cards...

Showing 1–10 of 17                      [<] [1] [2] [>]
```

## Sidebar Layout

```text
Changes

[Status: Applying (4) v]
[Search...]
[Sort v] [Filter]

Cards...

1–4 of 4
```

## Components

Recommended split:

```text
ChangeStatusFilter.tsx
ChangeAdvancedFilters.tsx
ChangePagination.tsx
ArchivedChangeCard.tsx
```

`ChangesSection` coordinates them but does not contain lifecycle business rules.

## Interaction Rules

- Lifecycle status is single-select.
- Needs Attention is a combinable boolean filter.
- Selecting status resets page to 1.
- Changing query resets page to 1.
- Changing sort resets page to 1.
- Changing pageSize resets page to 1.
- Status counts come from `DashboardData.changeStatusCounts`.
- Disabled pagination controls must use real `disabled`.
- Selected status uses `aria-current` or `aria-pressed`.
- Compact select must have an accessible label.

## Archived

- Archived card is visibly read-only.
- No workflow action area.
- Click opens archived detail.
- All view may mix Archived with Active cards according to current sort.

## Empty States

Differentiate:

```text
No changes in this Root
No Planning changes
No Ready to Apply changes
No Applying changes
No Ready to Verify changes
No Archived changes
No changes match the current search and filters
```

## Responsive Threshold

Prefer CSS container behavior over hard-coded global window assumptions. If the existing webview does not use container queries, a small responsive breakpoint is acceptable.

## Done When

- Wide and narrow layouts expose the same statuses.
- Status filter is visible without opening More Filters.
- Pagination communicates total filtered results.
- Keyboard-only flow is complete.
