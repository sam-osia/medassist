"""Trace visualization for debugging multi-agent workflow system."""

import json
import html
from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional


class TraceVisualizer(ABC):
    """Base interface for trace visualization."""

    @abstractmethod
    def generate(self, events: List[dict], metadata: dict) -> str:
        """Generate visualization from trace events.

        Args:
            events: List of trace events (parsed from JSONL)
            metadata: Dict with conversation_id, turn_number

        Returns:
            Visualization content (e.g., HTML string)
        """
        raise NotImplementedError


class HTMLTraceVisualizer(TraceVisualizer):
    """Generates self-contained HTML visualization for trace debugging."""

    def generate(self, events: List[dict], metadata: dict) -> str:
        """Generate complete HTML visualization."""
        conversation_id = metadata.get("conversation_id", "unknown")
        turn_number = metadata.get("turn_number", 0)

        # Extract summary info
        summary = self._extract_summary(events)

        # Generate components
        flow_svg = self._generate_flow_diagram_svg(events)
        timeline_html = self._generate_timeline(events)

        return f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Trace: {conversation_id[:8]}... | Turn {turn_number}</title>
    {self._get_styles()}
    {self._get_head_scripts()}
</head>
<body>
    <div class="container">
        <header class="header">
            <h1>Turn {turn_number}</h1>
            <p class="conversation-id">Conversation: {conversation_id}</p>
            <p class="user-message">{html.escape(summary['user_message'][:200])}{'...' if len(summary['user_message']) > 200 else ''}</p>
            <div class="summary-stats">
                <span class="stat"><strong>${summary['total_cost']:.4f}</strong> cost</span>
                <span class="stat"><strong>{summary['total_input_tokens']:,}</strong> in</span>
                <span class="stat"><strong>{summary['total_output_tokens']:,}</strong> out</span>
                <span class="stat"><strong>{summary['duration_s']:.1f}s</strong> duration</span>
            </div>
        </header>

        <section class="flow-section">
            <h2>Flow Diagram</h2>
            <div class="flow-container">
                {flow_svg}
            </div>
        </section>

        <section class="timeline-section">
            <h2>Timeline</h2>
            <div class="timeline">
                {timeline_html}
            </div>
        </section>
    </div>
    {self._get_scripts()}
</body>
</html>"""

    def _extract_summary(self, events: List[dict]) -> dict:
        """Extract summary information from events."""
        user_message = ""
        total_cost = 0.0
        total_input_tokens = 0
        total_output_tokens = 0
        start_ms = 0
        end_ms = 0

        for event in events:
            event_type = event.get("event")

            if event_type == "turn_start":
                user_message = event.get("user_message", "")
                start_ms = event.get("ts_relative_ms", 0)

            elif event_type == "final":
                total_cost = event.get("total_cost", 0.0)
                total_input_tokens = event.get("total_input_tokens", 0)
                total_output_tokens = event.get("total_output_tokens", 0)
                end_ms = event.get("ts_relative_ms", 0)

        # Fallback: get user message from initial_state if turn_start not present
        if not user_message:
            for event in events:
                if event.get("event") == "initial_state":
                    state = event.get("state", {})
                    if state.get("conversation_length", 0) > 0:
                        user_message = "(from existing conversation)"
                    break

        return {
            "user_message": user_message or "(no user message captured)",
            "total_cost": total_cost,
            "total_input_tokens": total_input_tokens,
            "total_output_tokens": total_output_tokens,
            "duration_s": (end_ms - start_ms) / 1000 if end_ms > start_ms else 0
        }

    def _generate_flow_diagram_svg(self, events: List[dict]) -> str:
        """Generate SVG flow diagram showing agent call sequence."""
        # Extract agent sequence from events
        sequence = []
        for event in events:
            event_type = event.get("event")
            if event_type == "turn_start":
                sequence.append(("User", "start"))
            elif event_type == "decision":
                action = event.get("decision", {}).get("action", "")
                if action.startswith("call_"):
                    agent = action.replace("call_", "")
                    sequence.append(("Orch", "decision"))
                    sequence.append((agent, "agent"))
                elif action == "respond_to_user":
                    sequence.append(("Orch", "decision"))
                    sequence.append(("Response", "end"))

        if not sequence:
            return '<svg width="100" height="50"><text x="10" y="30" fill="#666">No flow data</text></svg>'

        # Calculate dimensions
        box_width = 80
        box_height = 36
        gap = 20
        padding = 20
        boxes_per_row = 6

        # Group into rows
        rows = []
        current_row = []
        for item in sequence:
            current_row.append(item)
            if len(current_row) >= boxes_per_row:
                rows.append(current_row)
                current_row = []
        if current_row:
            rows.append(current_row)

        svg_width = min(len(sequence), boxes_per_row) * (box_width + gap) + padding * 2
        svg_height = len(rows) * (box_height + gap + 20) + padding * 2

        svg_parts = [f'<svg width="{svg_width}" height="{svg_height}" xmlns="http://www.w3.org/2000/svg">']

        # Draw boxes and arrows
        for row_idx, row in enumerate(rows):
            y = padding + row_idx * (box_height + gap + 20)

            for i, (label, node_type) in enumerate(row):
                x = padding + i * (box_width + gap)

                # Colors based on type
                if node_type == "start":
                    fill, stroke = "#e3f2fd", "#1976d2"
                elif node_type == "end":
                    fill, stroke = "#e8f5e9", "#388e3c"
                elif node_type == "decision":
                    fill, stroke = "#fff3e0", "#f57c00"
                else:  # agent
                    fill, stroke = "#f3e5f5", "#7b1fa2"

                # Box
                svg_parts.append(
                    f'<rect x="{x}" y="{y}" width="{box_width}" height="{box_height}" '
                    f'rx="4" fill="{fill}" stroke="{stroke}" stroke-width="2"/>'
                )

                # Label
                text_x = x + box_width / 2
                text_y = y + box_height / 2 + 4
                display_label = label[:10] + ".." if len(label) > 10 else label
                svg_parts.append(
                    f'<text x="{text_x}" y="{text_y}" text-anchor="middle" '
                    f'font-family="monospace" font-size="11" fill="#333">{html.escape(display_label)}</text>'
                )

                # Arrow to next (within row)
                if i < len(row) - 1:
                    arrow_x1 = x + box_width
                    arrow_x2 = x + box_width + gap
                    arrow_y = y + box_height / 2
                    svg_parts.append(
                        f'<line x1="{arrow_x1}" y1="{arrow_y}" x2="{arrow_x2 - 5}" y2="{arrow_y}" '
                        f'stroke="#666" stroke-width="2" marker-end="url(#arrowhead)"/>'
                    )

            # Arrow to next row
            if row_idx < len(rows) - 1:
                last_x = padding + (len(row) - 1) * (box_width + gap) + box_width / 2
                arrow_y1 = y + box_height
                arrow_y2 = y + box_height + gap + 20
                first_x_next = padding + box_width / 2
                svg_parts.append(
                    f'<path d="M {last_x} {arrow_y1} L {last_x} {arrow_y1 + 10} L {first_x_next} {arrow_y2 - 10} L {first_x_next} {arrow_y2 - 5}" '
                    f'stroke="#666" stroke-width="2" fill="none" marker-end="url(#arrowhead)"/>'
                )

        # Arrow marker definition
        svg_parts.insert(1, '''
            <defs>
                <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                    <polygon points="0 0, 10 3.5, 0 7" fill="#666"/>
                </marker>
            </defs>
        ''')

        svg_parts.append('</svg>')
        return '\n'.join(svg_parts)

    def _generate_timeline(self, events: List[dict]) -> str:
        """Generate timeline HTML with collapsible events."""
        timeline_parts = []
        decision_count = 0

        for idx, event in enumerate(events):
            event_type = event.get("event")
            ts_relative = event.get("ts_relative_ms", 0)
            time_str = f"+{ts_relative}ms" if ts_relative < 10000 else f"+{ts_relative/1000:.1f}s"

            # Generate event HTML based on type
            if event_type == "turn_start":
                title = "Turn Start"
                subtitle = f"User: {event.get('user_message', '')[:60]}..."
                content = self._generate_json_tabs(event, f"turn_start_{idx}")
                icon = "play"
                color = "blue"

            elif event_type == "initial_state":
                title = "Initial State"
                state = event.get("state", {})
                subtitle = f"Conversation: {state.get('conversation_length', 0)} messages"
                content = self._generate_json_tabs(event, f"initial_state_{idx}")
                icon = "database"
                color = "gray"

            elif event_type == "decision":
                decision_count += 1
                decision = event.get("decision", {})
                action = decision.get("action", "unknown")
                cost = event.get("cost", 0)
                title = f"Decision #{decision_count} - {action}"
                subtitle = decision.get("reasoning", "")[:80]
                cost_str = f"${cost:.4f}" if cost else ""
                content = self._generate_decision_content(event, f"decision_{idx}")
                icon = "brain"
                color = "orange"
                time_str = f"{time_str}   {cost_str}"

            elif event_type == "agent_input":
                agent = event.get("agent", "unknown")
                title = f"Agent Input: {agent}"
                subtitle = "Click to expand input data"
                content = self._generate_json_tabs(event.get("input", {}), f"agent_input_{idx}")
                icon = "arrow-right"
                color = "purple"

            elif event_type == "agent_output":
                agent = event.get("agent", "unknown")
                duration = event.get("duration_ms", 0)
                cost = event.get("cost", 0)
                output = event.get("output", {})
                success = output.get("success", output.get("valid", True))
                status = "success" if success else "failed"
                title = f"Agent Output: {agent}"
                subtitle = f"{'[OK]' if success else '[FAIL]'} {duration}ms"
                cost_str = f"${cost:.4f}" if cost else ""
                content = self._generate_json_tabs(event, f"agent_output_{idx}")
                icon = "check" if success else "x"
                color = "green" if success else "red"
                time_str = f"{time_str}   {cost_str}"

            elif event_type == "state_snapshot":
                trigger = event.get("trigger", "")
                title = f"State Snapshot"
                subtitle = f"Trigger: {trigger}" if trigger else ""
                content = self._generate_json_tabs(event.get("state", {}), f"state_{idx}")
                icon = "camera"
                color = "gray"

            elif event_type == "error":
                title = "Error"
                subtitle = event.get("message", "Unknown error")[:80]
                content = self._generate_json_tabs(event, f"error_{idx}")
                icon = "alert"
                color = "red"

            elif event_type == "final":
                title = "Final"
                cost = event.get("total_cost", 0)
                subtitle = f"Total: ${cost:.4f}"
                content = self._generate_json_tabs(event, f"final_{idx}")
                icon = "flag"
                color = "green"

            else:
                title = event_type
                subtitle = ""
                content = self._generate_json_tabs(event, f"unknown_{idx}")
                icon = "circle"
                color = "gray"

            timeline_parts.append(f"""
                <div class="event event-{color}">
                    <div class="event-header" onclick="toggleEvent(this)">
                        <span class="event-icon">{self._get_icon_svg(icon)}</span>
                        <span class="event-title">{html.escape(title)}</span>
                        <span class="event-subtitle">{html.escape(subtitle or '')}</span>
                        <span class="event-time">{time_str}</span>
                        <span class="event-toggle">+</span>
                    </div>
                    <div class="event-body" style="display: none;">
                        {content}
                    </div>
                </div>
            """)

        return '\n'.join(timeline_parts)

    def _generate_decision_content(self, event: dict, unique_id: str) -> str:
        """Generate content for decision events with separate sections."""
        decision = event.get("decision", {})
        context = event.get("context", "")
        system_prompt = event.get("system_prompt", "")

        decision_tabs = self._generate_json_tabs(decision, f"{unique_id}_decision")

        context_section = ""
        if context:
            context_section = f"""
                <div class="subsection">
                    <div class="subsection-header" onclick="toggleSubsection(this)">
                        <span class="subsection-toggle">+</span> Context sent to LLM
                    </div>
                    <div class="subsection-body" style="display: none;">
                        <pre class="context-pre">{html.escape(context)}</pre>
                    </div>
                </div>
            """

        prompt_section = ""
        if system_prompt:
            prompt_section = f"""
                <div class="subsection">
                    <div class="subsection-header" onclick="toggleSubsection(this)">
                        <span class="subsection-toggle">+</span> System Prompt
                    </div>
                    <div class="subsection-body" style="display: none;">
                        <pre class="context-pre">{html.escape(system_prompt)}</pre>
                    </div>
                </div>
            """

        return f"""
            <div class="decision-content">
                <h4>Decision</h4>
                {decision_tabs}
                {context_section}
                {prompt_section}
            </div>
        """

    def _generate_json_tabs(self, data: dict, unique_id: str) -> str:
        """Generate tabbed JSON view with Pretty, Raw, and Tree formats."""
        json_pretty = json.dumps(data, indent=2, default=str)
        json_raw = json.dumps(data, default=str)

        return f"""
            <div class="json-tabs" id="{unique_id}">
                <div class="tab-buttons">
                    <button class="tab-btn active" onclick="switchTab('{unique_id}', 'pretty')">Pretty</button>
                    <button class="tab-btn" onclick="switchTab('{unique_id}', 'raw')">Raw</button>
                    <button class="tab-btn" onclick="switchTab('{unique_id}', 'tree')">Tree</button>
                </div>
                <div class="tab-content tab-pretty" data-tab="pretty">
                    <pre class="json-pretty">{html.escape(json_pretty)}</pre>
                </div>
                <div class="tab-content tab-raw" data-tab="raw" style="display: none;">
                    <div class="raw-container">
                        <button class="copy-btn" onclick="copyToClipboard(this, `{html.escape(json_raw)}`)">Copy</button>
                        <pre class="json-raw">{html.escape(json_raw)}</pre>
                    </div>
                </div>
                <div class="tab-content tab-tree" data-tab="tree" style="display: none;">
                    <div class="json-tree" id="{unique_id}_tree"></div>
                    <script>
                        (function() {{
                            var data = {json_raw};
                            var container = document.getElementById('{unique_id}_tree');
                            renderTree(data, container, 0);
                        }})();
                    </script>
                </div>
            </div>
        """

    def _get_icon_svg(self, icon_name: str) -> str:
        """Get SVG icon by name."""
        icons = {
            "play": '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>',
            "database": '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>',
            "brain": '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a4 4 0 0 0-4 4v1a4 4 0 0 0-4 4 4 4 0 0 0 4 4v1a4 4 0 0 0 4 4 4 4 0 0 0 4-4v-1a4 4 0 0 0 4-4 4 4 0 0 0-4-4V6a4 4 0 0 0-4-4z"/></svg>',
            "arrow-right": '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>',
            "check": '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>',
            "x": '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
            "camera": '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>',
            "alert": '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
            "flag": '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>',
            "circle": '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg>',
        }
        return icons.get(icon_name, icons["circle"])

    def _get_styles(self) -> str:
        """Get inline CSS styles."""
        return """
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #f5f5f5;
            color: #333;
            line-height: 1.5;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
        }
        .header {
            background: #fff;
            border-radius: 8px;
            padding: 24px;
            margin-bottom: 20px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        .header h1 {
            font-size: 24px;
            margin-bottom: 8px;
        }
        .conversation-id {
            font-size: 12px;
            color: #666;
            font-family: monospace;
        }
        .user-message {
            margin: 12px 0;
            padding: 12px;
            background: #f0f7ff;
            border-radius: 4px;
            font-style: italic;
        }
        .summary-stats {
            display: flex;
            gap: 20px;
            margin-top: 12px;
        }
        .stat {
            font-size: 14px;
            color: #666;
        }
        .stat strong {
            color: #333;
        }
        .flow-section, .timeline-section {
            background: #fff;
            border-radius: 8px;
            padding: 24px;
            margin-bottom: 20px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        .flow-section h2, .timeline-section h2 {
            font-size: 18px;
            margin-bottom: 16px;
            color: #333;
        }
        .flow-container {
            overflow-x: auto;
            padding: 10px 0;
        }
        .timeline {
            display: flex;
            flex-direction: column;
            gap: 8px;
        }
        .event {
            border: 1px solid #e0e0e0;
            border-radius: 6px;
            overflow: hidden;
        }
        .event-header {
            display: flex;
            align-items: center;
            padding: 12px 16px;
            background: #fafafa;
            cursor: pointer;
            gap: 12px;
        }
        .event-header:hover {
            background: #f0f0f0;
        }
        .event-icon {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 24px;
            height: 24px;
            border-radius: 4px;
        }
        .event-blue .event-icon { background: #e3f2fd; color: #1976d2; }
        .event-gray .event-icon { background: #f5f5f5; color: #666; }
        .event-orange .event-icon { background: #fff3e0; color: #f57c00; }
        .event-purple .event-icon { background: #f3e5f5; color: #7b1fa2; }
        .event-green .event-icon { background: #e8f5e9; color: #388e3c; }
        .event-red .event-icon { background: #ffebee; color: #d32f2f; }
        .event-title {
            font-weight: 600;
            font-size: 14px;
        }
        .event-subtitle {
            flex: 1;
            font-size: 12px;
            color: #666;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .event-time {
            font-size: 12px;
            font-family: monospace;
            color: #888;
            white-space: nowrap;
        }
        .event-toggle {
            font-size: 18px;
            color: #888;
            width: 20px;
            text-align: center;
        }
        .event-body {
            padding: 16px;
            border-top: 1px solid #e0e0e0;
            background: #fff;
        }
        .json-tabs {
            margin-top: 8px;
        }
        .tab-buttons {
            display: flex;
            gap: 4px;
            margin-bottom: 8px;
        }
        .tab-btn {
            padding: 6px 12px;
            border: 1px solid #ddd;
            background: #f5f5f5;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
        }
        .tab-btn:hover {
            background: #e8e8e8;
        }
        .tab-btn.active {
            background: #1976d2;
            color: white;
            border-color: #1976d2;
        }
        .tab-content {
            background: #1e1e1e;
            border-radius: 4px;
            overflow: auto;
            max-height: 400px;
        }
        .json-pretty, .json-raw {
            margin: 0;
            padding: 12px;
            font-family: 'Monaco', 'Menlo', monospace;
            font-size: 12px;
            color: #d4d4d4;
            white-space: pre-wrap;
            word-break: break-all;
        }
        .raw-container {
            position: relative;
        }
        .copy-btn {
            position: absolute;
            top: 8px;
            right: 8px;
            padding: 4px 8px;
            background: #333;
            color: #fff;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 11px;
        }
        .copy-btn:hover {
            background: #444;
        }
        .json-tree {
            padding: 12px;
            font-family: 'Monaco', 'Menlo', monospace;
            font-size: 12px;
            color: #d4d4d4;
        }
        .tree-node {
            margin-left: 16px;
        }
        .tree-key {
            color: #9cdcfe;
        }
        .tree-string {
            color: #ce9178;
        }
        .tree-number {
            color: #b5cea8;
        }
        .tree-boolean {
            color: #569cd6;
        }
        .tree-null {
            color: #569cd6;
        }
        .tree-toggle {
            cursor: pointer;
            user-select: none;
        }
        .tree-toggle:hover {
            background: #333;
        }
        .subsection {
            margin-top: 12px;
            border: 1px solid #e0e0e0;
            border-radius: 4px;
        }
        .subsection-header {
            padding: 8px 12px;
            background: #f5f5f5;
            cursor: pointer;
            font-size: 13px;
            font-weight: 500;
        }
        .subsection-header:hover {
            background: #eee;
        }
        .subsection-toggle {
            display: inline-block;
            width: 16px;
        }
        .subsection-body {
            padding: 12px;
            background: #1e1e1e;
        }
        .context-pre {
            margin: 0;
            font-family: 'Monaco', 'Menlo', monospace;
            font-size: 12px;
            color: #d4d4d4;
            white-space: pre-wrap;
            word-break: break-word;
        }
        .decision-content h4 {
            font-size: 13px;
            margin-bottom: 8px;
            color: #666;
        }
    </style>
"""

    def _get_head_scripts(self) -> str:
        """Get JavaScript that must be in head (before inline scripts)."""
        return """
    <script>
        function renderTree(data, container, depth) {
            if (depth > 10) {
                container.innerHTML = '<span class="tree-string">[max depth]</span>';
                return;
            }

            if (data === null) {
                container.innerHTML = '<span class="tree-null">null</span>';
                return;
            }

            if (typeof data === 'string') {
                var escaped = data.replace(/</g, '&lt;').replace(/>/g, '&gt;');
                if (escaped.length > 100) {
                    escaped = escaped.substring(0, 100) + '...';
                }
                container.innerHTML = '<span class="tree-string">"' + escaped + '"</span>';
                return;
            }

            if (typeof data === 'number') {
                container.innerHTML = '<span class="tree-number">' + data + '</span>';
                return;
            }

            if (typeof data === 'boolean') {
                container.innerHTML = '<span class="tree-boolean">' + data + '</span>';
                return;
            }

            if (Array.isArray(data)) {
                if (data.length === 0) {
                    container.innerHTML = '[]';
                    return;
                }
                var html = '<span class="tree-toggle" onclick="this.nextElementSibling.style.display = this.nextElementSibling.style.display === \\'none\\' ? \\'block\\' : \\'none\\'; this.textContent = this.textContent === \\'[-]\\' ? \\'[+]\\' : \\'[-]\\'">[-]</span>';
                html += '<div class="tree-node">';
                data.forEach(function(item, idx) {
                    var itemId = 'tree_' + Math.random().toString(36).substr(2, 9);
                    html += '<div><span class="tree-key">[' + idx + ']</span>: <span id="' + itemId + '"></span></div>';
                });
                html += '</div>';
                container.innerHTML = html;
                data.forEach(function(item, idx) {
                    var itemContainer = container.querySelectorAll('.tree-node > div')[idx].querySelector('span:last-child');
                    renderTree(item, itemContainer, depth + 1);
                });
                return;
            }

            if (typeof data === 'object') {
                var keys = Object.keys(data);
                if (keys.length === 0) {
                    container.innerHTML = '{}';
                    return;
                }
                var html = '<span class="tree-toggle" onclick="this.nextElementSibling.style.display = this.nextElementSibling.style.display === \\'none\\' ? \\'block\\' : \\'none\\'; this.textContent = this.textContent === \\'{-}\\' ? \\'{+}\\' : \\'{-}\\'">{-}</span>';
                html += '<div class="tree-node">';
                keys.forEach(function(key) {
                    var itemId = 'tree_' + Math.random().toString(36).substr(2, 9);
                    html += '<div><span class="tree-key">"' + key + '"</span>: <span id="' + itemId + '"></span></div>';
                });
                html += '</div>';
                container.innerHTML = html;
                keys.forEach(function(key, idx) {
                    var itemContainer = container.querySelectorAll('.tree-node > div')[idx].querySelector('span:last-child');
                    renderTree(data[key], itemContainer, depth + 1);
                });
                return;
            }

            container.innerHTML = String(data);
        }
    </script>
"""

    def _get_scripts(self) -> str:
        """Get inline JavaScript."""
        return """
    <script>
        function toggleEvent(header) {
            var body = header.nextElementSibling;
            var toggle = header.querySelector('.event-toggle');
            if (body.style.display === 'none') {
                body.style.display = 'block';
                toggle.textContent = '-';
            } else {
                body.style.display = 'none';
                toggle.textContent = '+';
            }
        }

        function toggleSubsection(header) {
            var body = header.nextElementSibling;
            var toggle = header.querySelector('.subsection-toggle');
            if (body.style.display === 'none') {
                body.style.display = 'block';
                toggle.textContent = '-';
            } else {
                body.style.display = 'none';
                toggle.textContent = '+';
            }
        }

        function switchTab(containerId, tabName) {
            var container = document.getElementById(containerId);
            var buttons = container.querySelectorAll('.tab-btn');
            var contents = container.querySelectorAll('.tab-content');

            buttons.forEach(function(btn) {
                btn.classList.remove('active');
                if (btn.textContent.toLowerCase() === tabName) {
                    btn.classList.add('active');
                }
            });

            contents.forEach(function(content) {
                if (content.getAttribute('data-tab') === tabName) {
                    content.style.display = 'block';
                } else {
                    content.style.display = 'none';
                }
            });
        }

        function copyToClipboard(button, text) {
            navigator.clipboard.writeText(text).then(function() {
                var original = button.textContent;
                button.textContent = 'Copied!';
                setTimeout(function() {
                    button.textContent = original;
                }, 1500);
            });
        }
    </script>
"""
