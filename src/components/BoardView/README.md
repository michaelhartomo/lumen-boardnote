# @lumen/board-view

Lumen Spatial Visual Workspace & Canvas Board Component for React.

## Installation

```bash
npm install @lumen/board-view @loadable/component @preact/signals-react react-router
```

## Quick Start

```jsx
import { LUMEN_board_view } from '@lumen/board-view';

export default function WorkspacePage() {
  return (
    <LUMEN_board_view
      board_id="my-board-id"
      show_header={true}
      show_dock={true}
      show_minimap={true}
      snap_to_grid={true}
      on_upload_file={async (file, meta) => {
        // Upload file to your server or S3 bucket
        return { id: 'file_123', url: '/files/file_123', name: file.name };
      }}
      on_create_board={async (title, type) => {
        // Create board on your API
        return { id: 'new-board-id', title, type };
      }}
      on_export={async (export_type, board_data) => {
        // Handle export callback
      }}
      on_share={async (board_id, share_config) => {
        // Handle board sharing callback
      }}
    />
  );
}
```

## Props Reference

### Variable Props (Configuration & State)
| Prop | Type | Default | Description |
|---|---|---|---|
| `board_id` | `string` | router param / default | Target board ID to load and display |
| `initial_board` | `object` | `undefined` | Optional seed board data payload |
| `read_only` | `boolean` | `false` | When true, disables editing tools, card drag/drop, and mutation actions |
| `show_header` | `boolean` | `true` | Toggles the top navigation header bar |
| `show_dock` | `boolean` | `true` | Toggles the left tool and card creation dock |
| `show_minimap` | `boolean` | `true` | Toggles the spatial minimap radar navigator |
| `show_layers_panel` | `boolean` | `undefined` | Controlled override for the right layers & cards panel |
| `show_settings_panel` | `boolean` | `undefined` | Controlled override for board styling and settings panel |
| `show_property_panel` | `boolean` | `undefined` | Controlled override for card property inspector panel |
| `show_ai_assistant` | `boolean` | `undefined` | Controlled override for AI co-pilot drawer |
| `current_user` | `object` | default profile | Current user profile `{ id, name, role, avatar, color }` |
| `collaborators` | `array` | default list | Array of collaborator profiles |
| `snap_to_grid` | `boolean` | `true` | Enforces 24px spatial canvas grid snapping |
| `class_name` | `string` | `''` | Additional CSS class name for the wrapper |
| `style` | `object` | `{}` | Inline CSS styles for the wrapper |

### Function Props (API Server & Action Handlers)
| Prop | Signature | Description |
|---|---|---|
| `on_upload_file` | `(file: File, meta?: Object) => Promise<Object>` | Handles uploading files (PDF, 3D GLB, image, doc, video) to API server |
| `on_create_board` | `(title?: string, type?: string) => Promise<Object>` | Handles creating a new board |
| `on_export` | `(export_type: string, board_data: Object, options?: Object) => Promise<any>` | Handles board exports (PDF, PNG, SVG, JSON, ZIP, MD) |
| `on_share` | `(board_id: string, share_config: Object) => Promise<any>` | Handles sharing board and collaborator invitations |
| `on_save` | `(board_id: string, board_data: Object) => Promise<any>` | Handles persisting board state to database |
| `on_load_board` | `(board_id: string) => Promise<Object>` | Handles loading board payload from database |
| `on_post_comment` | `(card_id: string, payload: Object) => Promise<Object>` | Handles posting card comments |
| `on_delete_comment` | `(card_id: string, comment_id: string) => Promise<any>` | Handles deleting card comments |
| `on_ask_ai` | `(board_data: Object, prompt: string) => Promise<Object>` | Handles querying AI assistant with board context |
| `on_navigate_board` | `(board_id: string) => void` | Triggered when user switches boards |
| `on_board_change` | `(board_data: Object) => void` | Triggered whenever board cards or state mutate |
| `on_card_select` | `(selected_ids: string[]) => void` | Triggered whenever card selection changes |
