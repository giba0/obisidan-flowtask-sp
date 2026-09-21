# Changelog

All notable changes to FlowTask For Super Productivity are documented here.

## Unreleased

- Future changes.

## 0.1.8

- Fixed Obsidian review warnings for icon parsing and CSS specificity.
- Removed the remaining unused Settings import.
- Preserved theme-readable styling without `!important` overrides.

## 0.1.7

- Added Super Productivity project colors and icons to the panel.
- Added tag colors and icons to task badges.
- Added a setting to enable or disable Super Productivity visual styling.
- Improved contrast by keeping task and group text theme-readable.

## 0.1.6

- Added SP-style Subtasks sections to the panel and Quick Capture.
- Added `+ Add subtask` actions and parent-first child creation through `parentId`.
- Added project, tag, and date autocomplete to subtask inputs.
- Changed autocomplete selection to Tab, with Enter reserved for submission.
- Prevented partial task creation while a note line is still being edited.
- Improved parent completion cascade synchronization to note subtasks.
- Unified autocomplete styling and prevented modal clipping near the bottom edge.

## 0.1.5

- Reduced Quick Capture autocomplete width and height.
- Anchored suggestions to the input with compact Obsidian-style menu rows.

## 0.1.4

- Translated remaining user-facing UI strings to English.
- Added documentation screenshots for setup, Quick Capture, the panel, and integration workflows.
- Updated the README requirements and usage examples.

## 0.1.3

- Removed the deprecated imperative Settings `display()` implementation.
- Removed the redundant Settings heading.
- Removed the unused `BridgeSettings` import.

## 0.1.2

- Removed the plugin name from the Settings heading.
- Added declarative Settings definitions for Settings search.
- Removed direct DOM style injection and inline style assignments.
- Updated the minimum supported Obsidian version to 1.13.0.
- Replaced direct DOM creation in Quick Capture with Obsidian helpers.

## 0.1.1

- Fixed Obsidian review compatibility issues.
- Moved plugin styles to the standard root-level `styles.css` file.
- Added release asset attestations for future GitHub releases.
- Added the FlowTask logo and expanded open-source documentation.
- Improved legacy marker migration and release metadata validation.

## 0.1.0

- Local REST API transport with optional Bearer authentication.
- File fallback queue for offline operations.
- Checkbox import with configurable `#sp` routing tag.
- Obsidian Tasks-compatible due dates.
- Quick Capture with project, tag, date, and duration parsing.
- Sidebar task views, fuzzy search, grouping, hierarchy, and tracking controls.
