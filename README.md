# Iter

A minimalist long-term goal garden for Obsidian.

*Iter* (Latin for *journey*) organizes long-term goals as living potted trees inside an `Iter/` vault directory, watered by daily, weekly, and monthly habits and milestone subgoals.

## Features

- **Automatic `Iter/` structure**: Creates `Iter/` and `Iter/_index/We.md` on startup.
- **Iter Panel**: A dedicated sidebar visualizer for everything inside `Iter/` (keeping `_index` hidden behind the pinned **We** button), with inline subgoal toggling, habit watering, and context menus.
- **We Garden Dashboard**: A minimalist potted-tree garden visualizer where each goal tree grows and blooms with subgoal completion and habit watering.
- **Custom Goal View**: Clicking any tree, subgoal, or habit opens a dedicated view with editable description, target completion date countdown, custom data lists (`Number & Time`, `Text List`, `Notes`, `Notes & Time`), and composable widgets (`Metric Stat`, `Goal Comparison Bar`, `Time Graph`, `Note Navigator`).
- **Commands**:
  - `Iter: Create tree`
  - `Iter: Create subgoal`
  - `Iter: Create habit`
  - `Iter: Open Iter panel`
  - `Iter: Open We garden`
  - `Iter: Open goal view`

## Vault Layout

```text
Iter/
  _index/
    We.md
  Gym/
    _tree.md
    subgoals/
      Bench 80kg.md
    habits/
      Go to the Gym.md
```

## Development

```bash
npm install
npm test
npm run build
```
