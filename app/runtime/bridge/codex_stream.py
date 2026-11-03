"""Observe one Codex app-server notification stream; never send client commands."""

import argparse
import copy
import json
import os
from pathlib import Path
import queue
import sys
import tempfile
import threading
import time


ITEM_KINDS = {
    "webSearch": "search", "imageView": "read",
    "fileChange": "edit", "commandExecution": "command",
    "mcpToolCall": "unknown", "dynamicToolCall": "unknown",
}
REQUEST_KINDS = {
    "item/commandExecution/requestApproval": ("approval", "work"),
    "item/fileChange/requestApproval": ("approval", "work"),
    "item/permissions/requestApproval": ("approval", None),
    "item/tool/requestUserInput": ("question", None),
    "mcpServer/elicitation/request": ("action", None),
}


def atomic_write(path, snapshot):
    """Replace one complete snapshot, so polling readers never see partial JSON."""
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temporary = tempfile.mkstemp(prefix=path.name + ".", dir=path.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as stream:
            json.dump(snapshot, stream, ensure_ascii=False, separators=(",", ":"))
            stream.write("\n")
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


class CodexFacts:
    """Keep call/request identity, without storing conversation or tool content."""

    def __init__(self, thread_id, previous=None, replay=False):
        self.thread_id = thread_id
        source = "codex-replay" if replay else "codex-app-server"
        self.snapshot = {
            "source": source, "sessionId": thread_id, "revision": 0,
            "connection": "disconnected", "phase": "unknown", "turnId": None,
            "outcome": None, "reason": "", "reasoning": False,
            "tools": [], "requests": [], "lastToolKind": None,
        }
        if previous is not None:
            if (previous["source"], previous["sessionId"]) != (source, thread_id):
                raise ValueError("Output belongs to a different source/thread; choose another output file.")
            # Producer restart preserves ordering, never revives stale active facts.
            self.snapshot["revision"] = previous["revision"]
            self.snapshot["closedTurnIds"] = previous.get("closedTurnIds", [])
        self.closed_turns = set(self.snapshot.get("closedTurnIds", []))
        self.flags = set()
        self.reasoning_items = set()

    def _publish(self, before):
        self.snapshot["closedTurnIds"] = sorted(self.closed_turns)
        if self.snapshot == before:
            return None
        self.snapshot["revision"] += 1
        self.snapshot["heartbeatAt"] = round(time.time() * 1000)
        return copy.deepcopy(self.snapshot)

    def heartbeat(self):
        if self.snapshot["connection"] != "connected":
            return None
        self.snapshot["heartbeatAt"] = round(time.time() * 1000)
        self.snapshot["revision"] += 1
        return copy.deepcopy(self.snapshot)

    def _blocking(self):
        for request in self.snapshot["requests"]:
            if request["kind"] == "approval":
                request["blocking"] = "waitingOnApproval" in self.flags
            elif request["kind"] == "action":
                request["blocking"] = "waitingOnUserInput" in self.flags

    def _status(self, status):
        kind = status["type"]
        self.flags = set(status.get("activeFlags", []))
        self._blocking()
        if kind == "idle":
            # Idle is authoritative inactivity, but does not prove a successful result.
            if self.snapshot["phase"] != "ended":
                self.snapshot.update(phase="idle", outcome=None, reasoning=False, tools=[], requests=[])
        elif kind == "notLoaded":
            self.snapshot.update(phase="unknown", reasoning=False, tools=[], requests=[])
        elif kind == "systemError":
            self.snapshot.update(phase="unknown", reason="客户端报告系统异常", reasoning=False, tools=[], requests=[])
        elif kind == "active" and self.snapshot["phase"] == "idle":
            self.snapshot.update(phase="unknown", outcome=None, reason="正在同步当前轮次")

    def feed(self, message):
        before = copy.deepcopy(self.snapshot)
        method, params = message.get("method"), message.get("params", {})
        if method == "thread/started":
            thread = params["thread"]
            if thread["id"] != self.thread_id:
                return None
            self.snapshot["connection"] = "connected"
            self._status(thread["status"])
            return self._publish(before)
        if params.get("threadId") != self.thread_id:
            return None
        self.snapshot["connection"] = "connected"

        if method == "thread/status/changed":
            self._status(params["status"])
        elif method == "thread/closed":
            self.snapshot.update(phase="unknown", reasoning=False, tools=[], requests=[])
        elif method == "turn/started":
            turn_id = params["turn"]["id"]
            if turn_id in self.closed_turns:
                self.snapshot = before
                return None
            if turn_id != self.snapshot["turnId"]:
                if self.snapshot["turnId"]:
                    self.closed_turns.add(self.snapshot["turnId"])
                self.flags.clear()
                self.reasoning_items.clear()
                self.snapshot.update(turnId=turn_id, phase="running", outcome=None,
                                     reason="", reasoning=False, tools=[], requests=[], lastToolKind=None)
        elif method == "serverRequest/resolved":
            request_id = str(params["requestId"])
            self.snapshot["requests"] = [r for r in self.snapshot["requests"] if r["requestId"] != request_id]
        elif method in ("turn/completed", "item/started", "item/completed") or method in REQUEST_KINDS:
            turn_id = params["turn"]["id"] if method == "turn/completed" else params.get("turnId")
            valid_phase = self.snapshot["phase"] == "running" or (method == "turn/completed" and turn_id not in self.closed_turns)
            if not valid_phase or turn_id != self.snapshot["turnId"]:
                self.snapshot = before
                return None
            if method == "turn/completed":
                turn = params["turn"]
                outcome = {"completed": "completed", "interrupted": "cancelled", "failed": "error"}[turn["status"]]
                self.closed_turns.add(turn_id)
                self.reasoning_items.clear()
                self.flags.clear()
                self.snapshot.update(phase="ended", outcome=outcome, reasoning=False, tools=[], requests=[],
                                     reason="客户端报告本轮异常停止" if outcome == "error" else "")
            elif method in REQUEST_KINDS:
                kind, scene = REQUEST_KINDS[method]
                request = {"requestId": str(message["id"]), "kind": kind, "blocking": False,
                           "label": {"approval": "等待客户端授权", "question": "有问题待回答", "action": "需要客户端操作"}[kind]}
                if kind == "question":
                    request["blocking"] = params["isBlocking"]
                if params.get("itemId"):
                    request["callId"] = params["itemId"]
                if scene:
                    request["scene"] = scene
                self.snapshot["requests"] = [r for r in self.snapshot["requests"] if r["requestId"] != request["requestId"]]
                self.snapshot["requests"].append(request)
                self._blocking()
            else:
                item = params["item"]
                item_id, item_type = item["id"], item["type"]
                started = method == "item/started"
                if item_type == "reasoning":
                    if started:
                        self.reasoning_items.add(item_id)
                    else:
                        self.reasoning_items.discard(item_id)
                    self.snapshot["reasoning"] = bool(self.reasoning_items)
                elif item_type in ITEM_KINDS:
                    self.snapshot["tools"] = [t for t in self.snapshot["tools"] if t["callId"] != item_id]
                    if started:
                        kind = ITEM_KINDS[item_type]
                        self.snapshot["tools"].append({"callId": item_id, "kind": kind, "name": item_type})
                        self.snapshot["lastToolKind"] = kind
        else:
            self.snapshot = before
            return None
        return self._publish(before)

    def disconnect(self):
        before = copy.deepcopy(self.snapshot)
        self.snapshot["connection"] = "disconnected"
        return self._publish(before)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--thread-id", required=True, help="Exactly one observed app-server thread id")
    parser.add_argument("--output", type=Path, help="Atomic snapshot path")
    parser.add_argument("--replay", action="store_true", help="Mark recorded/synthetic input as replay")
    args = parser.parse_args()
    output = args.output or Path(__file__).with_name("replay-session.json" if args.replay else "session.json")
    previous = json.loads(output.read_text()) if output.exists() else None
    facts = CodexFacts(args.thread_id, previous, args.replay)
    if previous is not None:
        atomic_write(output, facts._publish({}))
    inbox = queue.Queue()

    def read_input():
        try:
            for line in sys.stdin:
                inbox.put(line)
        finally:
            inbox.put(None)

    # A blocking reader thread works for stdin pipes on both Windows and macOS.
    threading.Thread(target=read_input, daemon=True).start()
    try:
        while True:
            try:
                line = inbox.get(timeout=1)
            except queue.Empty:
                snapshot = facts.heartbeat()
                if snapshot is not None:
                    atomic_write(output, snapshot)
                continue
            if line is None:
                break
            if line.strip():
                snapshot = facts.feed(json.loads(line))
                if snapshot is not None:
                    atomic_write(output, snapshot)
    finally:
        snapshot = facts.disconnect()
        if snapshot is not None:
            atomic_write(output, snapshot)


if __name__ == "__main__":
    main()
