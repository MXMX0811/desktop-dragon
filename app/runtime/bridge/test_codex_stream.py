import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

from codex_stream import CodexFacts, atomic_write


def event(method, **params):
    return {"method": method, "params": {"threadId": "one", **params}}


class BridgeTests(unittest.TestCase):
    def setUp(self):
        self.facts = CodexFacts("one")
        self.facts.feed(event("turn/started", turn={"id": "turn-1", "status": "inProgress"}))

    def item(self, name, item_id, completed=False, **extra):
        return self.facts.feed(event("item/completed" if completed else "item/started",
                                     turnId="turn-1", item={"id": item_id, "type": name, **extra}))

    def test_parallel_tools_and_unknown_names_do_not_imply_idle_or_command(self):
        self.item("webSearch", "search", query="PRIVATE_QUERY")
        self.item("mcpToolCall", "connector", tool="execute_search_update", arguments="PRIVATE_ARG")
        result = self.item("webSearch", "search", True)
        self.assertEqual(result["phase"], "running")
        self.assertEqual(result["tools"], [{"callId": "connector", "kind": "unknown", "name": "mcpToolCall"}])
        self.assertNotIn("PRIVATE", json.dumps(result))

    def test_foreign_and_closed_turns_cannot_take_over(self):
        self.assertIsNone(self.facts.feed({"method": "turn/started", "params": {"threadId": "two", "turn": {"id": "foreign"}}}))
        self.facts.feed(event("turn/started", turn={"id": "turn-2"}))
        self.assertIsNone(self.item("webSearch", "late"))
        self.assertIsNone(self.facts.feed(event("turn/started", turn={"id": "turn-1"})))
        self.assertEqual(self.facts.snapshot["turnId"], "turn-2")

    def test_pending_approval_requires_actual_waiting_flag(self):
        request = event("item/commandExecution/requestApproval", turnId="turn-1", itemId="command", reason="PRIVATE_REASON")
        request["id"] = 12
        self.assertFalse(self.facts.feed(request)["requests"][0]["blocking"])
        result = self.facts.feed(event("thread/status/changed", status={"type": "active", "activeFlags": ["waitingOnApproval"]}))
        self.assertTrue(result["requests"][0]["blocking"])
        self.assertNotIn("PRIVATE", json.dumps(result))
        result = self.facts.feed(event("serverRequest/resolved", requestId=12))
        self.assertEqual(result["requests"], [])

    def test_nonblocking_questions_remain_nonblocking(self):
        request = event("item/tool/requestUserInput", turnId="turn-1", itemId="ask", isBlocking=False, questions=[{"question": "PRIVATE"}])
        request["id"] = "question"
        self.facts.feed(request)
        self.facts.feed(event("thread/status/changed", status={"type": "active", "activeFlags": ["waitingOnUserInput"]}))
        self.assertFalse(self.facts.snapshot["requests"][0]["blocking"])
        request["id"], request["params"]["isBlocking"] = "blocking-question", True
        result = self.facts.feed(request)
        self.assertTrue(result["requests"][1]["blocking"])

    def test_final_outcomes_are_not_guessed_from_idle_or_stop(self):
        self.assertIsNone(self.facts.feed(event("Stop")))
        result = self.facts.feed(event("thread/status/changed", status={"type": "idle"}))
        self.assertIsNone(result["outcome"])
        result = self.facts.feed(event("turn/completed", turn={"id": "turn-1", "status": "interrupted"}))
        self.assertEqual((result["phase"], result["outcome"]), ("ended", "cancelled"))
        self.assertIsNone(self.facts.feed(event("turn/started", turn={"id": "turn-1"})))

    def test_disconnect_keeps_last_facts_and_restart_keeps_revision_and_closed_turns(self):
        self.item("fileChange", "edit")
        result = self.facts.disconnect()
        self.assertEqual(result["connection"], "disconnected")
        self.assertEqual(result["phase"], "running")
        self.assertEqual(result["tools"][0]["kind"], "edit")
        self.facts.feed(event("turn/completed", turn={"id": "turn-1", "status": "completed"}))
        saved = self.facts.snapshot
        restored = CodexFacts("one", saved)
        self.assertIsNone(restored.feed(event("turn/started", turn={"id": "turn-1"})))
        next_result = restored.feed(event("turn/started", turn={"id": "turn-2"}))
        self.assertGreater(next_result["revision"], saved["revision"])

    def test_reasoning_tracks_each_active_item(self):
        self.item("reasoning", "thought-1")
        self.item("reasoning", "thought-2")
        self.item("reasoning", "thought-1", True)
        self.assertTrue(self.facts.snapshot["reasoning"])
        self.assertFalse(self.item("reasoning", "thought-2", True)["reasoning"])

    def test_heartbeat_is_separate_from_task_lifecycle(self):
        before = self.facts.snapshot["revision"]
        result = self.facts.heartbeat()
        self.assertGreater(result["revision"], before)
        self.assertGreater(result["heartbeatAt"], 0)
        self.assertEqual(result["phase"], "running")
        self.facts.disconnect()
        self.assertIsNone(self.facts.heartbeat())

    def test_replay_cli_is_explicit_and_atomic_output_is_complete(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "snapshot.json"
            raw = json.dumps(event("turn/started", turn={"id": "turn-1"})) + "\n"
            raw += json.dumps(event("item/started", turnId="turn-1", item={"type": "webSearch", "id": "search", "query": "PRIVATE"})) + "\n"
            subprocess.run([sys.executable, str(Path(__file__).with_name("codex_stream.py")), "--thread-id", "one", "--replay", "--output", str(output)], input=raw, text=True, check=True)
            saved = json.loads(output.read_text())
            self.assertEqual(saved["source"], "codex-replay")
            self.assertEqual(saved["connection"], "disconnected")
            self.assertEqual(saved["tools"][0]["kind"], "search")
            self.assertNotIn("PRIVATE", output.read_text())
            atomic_write(output, {"done": True})
            self.assertEqual(json.loads(output.read_text()), {"done": True})
            self.assertEqual(len(list(Path(directory).iterdir())), 1)


if __name__ == "__main__":
    unittest.main()
