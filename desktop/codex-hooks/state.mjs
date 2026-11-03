// Project observed hook facts. These labels are observations, not Codex outcomes.
// No input/output bodies are copied into the projection.
const CLOSED = new Set(['interrupted', 'session_ended']);

function closeTurn(turn, state) {
  turn.lifecycle = state;
  turn.compacting = false;
  for (const tool of turn.tools.values()) {
    if (tool.state === 'running') tool.state = state;
  }
  for (const agent of turn.agents.values()) {
    if (agent.state === 'running') agent.state = state;
  }
}

function turnView(turn) {
  const tools = [...turn.tools.values()];
  const agents = [...turn.agents.values()];
  const activeTools = tools.filter(tool => tool.state === 'running').length;
  const activeAgents = agents.filter(agent => agent.state === 'running').length;
  let state = turn.lifecycle;
  if (state === 'activity_observed') {
    if (turn.compacting) state = 'compacting';
    else if (turn.last_event === 'PermissionRequest') state = 'permission_requested';
    else if (activeTools) state = 'tool_running';
    else if (activeAgents) state = 'agent_running';
  }
  return {
    turn_id: turn.turn_id, agent_id:turn.agent_id, state, last_event: turn.last_event,
    last_received_at: turn.last_received_at, active_tools: activeTools,
    active_agents: activeAgents, tools, agents,
    permission_requests: turn.permission_requests,
    compacting: turn.compacting,
    stop_hook_active: turn.stop_hook_active,
  };
}

/**
 * Rebuild from metadata events. received_at is observer time, not tool duration.
 * Full IDs are essential: a tool without tool_use_id remains an unpaired event.
 */
export function reduceEvents(events) {
  const sessions = new Map(), seen = new Set();
  const ordered = [...events].sort((a, b) =>
    String(a.received_at ?? '').localeCompare(String(b.received_at ?? '')));
  let ignored = 0;
  for (const event of ordered) {
    if (!event.session_id || !event.hook_event_name) { ignored++; continue; }
    if (event.event_id && seen.has(event.event_id)) continue;
    if (event.event_id) seen.add(event.event_id);

    const name = event.hook_event_name;
    let session = sessions.get(event.session_id);
    if (!session) {
      session = {session_id:event.session_id, turns:new Map(), current_turn_id:null,
        closed:false, unpaired_events:0};
      sessions.set(event.session_id, session);
    }
    session.last_event = name;
    session.last_received_at = event.received_at;
    if (event.model) session.model = event.model;

    if (name === 'SessionStart') {
      session.closed = false;
      session.source = event.source;
    }
    if (name === 'SessionEnd') {
      session.closed = true;
      session.compacting = false;
      for (const turn of session.turns.values()) closeTurn(turn, 'session_ended');
      continue;
    }
    if (!event.turn_id) {
      // Some hooks (e.g. compaction) are not turn-scoped. Preserve session facts.
      if (name === 'PreCompact') session.compacting = true;
      if (name === 'PostCompact') session.compacting = false;
      if (['PreToolUse','PostToolUse','PermissionRequest','SubagentStart','SubagentStop'].includes(name)) {
        session.unpaired_events++;
      }
      continue;
    }

    let turn = session.turns.get(event.turn_id);
    if (!turn) {
      turn = {turn_id:event.turn_id, agent_id:event.agent_id, lifecycle:'unknown', tools:new Map(),
        agents:new Map(), permission_requests:[], compacting:false};
      session.turns.set(event.turn_id, turn);
      // Subagents share the session ID but have their own turn IDs.
      if (!session.current_turn_id && !turn.agent_id) session.current_turn_id = event.turn_id;
    }
    turn.last_event = name;
    turn.last_received_at = event.received_at;
    if (name === 'UserPromptSubmit' && !turn.agent_id) {
      if (!turn.prompt_seen) {
        session.current_turn_id = event.turn_id;
        turn.prompt_seen = true;
        session.compacting = false;
      }
      // A redelivered prompt from an older known turn must not take over the UI.
      if (session.current_turn_id === event.turn_id) {
        session.closed = false;
        turn.lifecycle = 'activity_observed';
      }
    }
    if (name === 'Interrupt') {
      if (session.current_turn_id === event.turn_id) session.compacting = false;
      closeTurn(turn, 'interrupted');
      continue;
    }
    if (name === 'Stop') {
      if (session.current_turn_id === event.turn_id) session.compacting = false;
      if (!CLOSED.has(turn.lifecycle)) closeTurn(turn, 'stop_observed');
      turn.stop_hook_active = event.stop_hook_active;
      continue;
    }
    if (CLOSED.has(turn.lifecycle) || session.closed) continue;

    if (name === 'PreCompact') turn.compacting = true;
    if (name === 'PostCompact') turn.compacting = false;
    if (name === 'PermissionRequest') {
      turn.permission_requests.push({event_id:event.event_id, tool_name:event.tool_name,
        received_at:event.received_at, permission_mode:event.permission_mode});
      if (turn.lifecycle !== 'stop_observed') turn.lifecycle = 'activity_observed';
    }
    if (name === 'PreToolUse' || name === 'PostToolUse') {
      if (!event.tool_use_id) { session.unpaired_events++; continue; }
      let tool = turn.tools.get(event.tool_use_id);
      if (!tool) {
        tool = {tool_use_id:event.tool_use_id, tool_name:event.tool_name,
          state:name === 'PreToolUse' ? 'running' : 'output_observed'};
        turn.tools.set(event.tool_use_id, tool);
      }
      if (event.tool_name) tool.tool_name = event.tool_name;
      if (event.tool_kind) tool.tool_kind = event.tool_kind;
      if (name === 'PreToolUse') {
        tool.started_at ??= event.received_at;
        // A late Pre must not resurrect a call whose output was already observed.
        if (tool.state === 'running') turn.lifecycle = 'activity_observed';
      } else {
        tool.state = 'output_observed';
        tool.output_observed_at = event.received_at;
        if (turn.lifecycle === 'unknown') turn.lifecycle = 'activity_observed';
      }
    }
    if (name === 'SubagentStart' || name === 'SubagentStop') {
      if (!event.agent_id) { session.unpaired_events++; continue; }
      let agent = turn.agents.get(event.agent_id);
      if (!agent) {
        agent = {agent_id:event.agent_id, agent_type:event.agent_type,
          state:name === 'SubagentStart' ? 'running' : 'stop_observed'};
        turn.agents.set(event.agent_id, agent);
      }
      if (event.agent_type) agent.agent_type = event.agent_type;
      if (name === 'SubagentStart') {
        agent.started_at ??= event.received_at;
        if (agent.state === 'running' && turn.lifecycle !== 'stop_observed') {
          turn.lifecycle = 'activity_observed';
        }
      } else {
        agent.state = 'stop_observed';
        agent.stop_observed_at = event.received_at;
        if (turn.agent_id === event.agent_id) closeTurn(turn, 'stop_observed');
      }
    }
  }

  const views = [...sessions.values()].map(session => {
    const turns = [...session.turns.values()].map(turnView);
    const current = turns.find(turn => turn.turn_id === session.current_turn_id);
    const activeTurns = turns.filter(turn => turn === current || (turn.agent_id && turn.active_agents > 0));
    const activeAgents = activeTurns.reduce((sum, turn) => sum + turn.active_agents, 0);
    const tools = activeTurns.flatMap(turn => turn.tools.filter(tool => tool.state === 'running'));
    const state = session.closed ? 'session_ended' : session.compacting || current?.compacting ? 'compacting'
      : current?.state === 'permission_requested' ? 'permission_requested'
      : tools.length ? 'tool_running'
      : activeAgents ? 'agent_running' : current?.state ?? 'unknown';
    return {
      session_id:session.session_id, model:session.model, source:session.source,
      last_event:session.last_event, last_received_at:session.last_received_at,
      current_turn_id:session.current_turn_id,
      state, active_tools:tools.length, active_agents:activeAgents, tools,
      unpaired_events:session.unpaired_events, turns,
    };
  });
  return {sessions:views, summary:{
    sessions:views.length,
    activity_observed_sessions:views.filter(s => ['activity_observed','tool_running','agent_running','permission_requested','compacting'].includes(s.state)).length,
    active_tools:views.reduce((n, session) => n+session.active_tools, 0),
    active_agents:views.reduce((n, session) => n+session.active_agents, 0),
    permission_requests_observed:views.reduce((n, s) => n+s.turns.reduce((m, t) => m+t.permission_requests.length, 0), 0),
    stop_observed_sessions:views.filter(s => s.state === 'stop_observed').length,
    unknown_sessions:views.filter(s => s.state === 'unknown').length,
    unpaired_events:views.reduce((n, s) => n+s.unpaired_events, 0),
    ignored_events:ignored,
  }};
}
