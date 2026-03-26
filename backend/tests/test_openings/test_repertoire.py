"""Tests for opening repertoire and SM-2 spaced repetition."""
import json
import tempfile
import pytest

from app.openings.repertoire import RepertoireDB


class TestRepertoireDB:
    """Test repertoire management and spaced repetition."""

    @pytest.fixture
    def db(self, tmp_path):
        path = tmp_path / "test_repertoire.json"
        return RepertoireDB(str(path))

    def test_empty_db(self, db):
        assert db.get_lines() == []

    def test_add_line(self, db):
        line = db.add_line("Italian Game", "white", ["e4", "e5", "Nf3", "Nc6", "Bc4"])
        assert line["name"] == "Italian Game"
        assert line["color"] == "white"
        assert len(line["moves"]) == 5
        assert len(line["moves_san"]) == 5
        assert line["interval_days"] == 1.0
        assert line["ease_factor"] == 2.5

    def test_add_and_retrieve(self, db):
        db.add_line("Sicilian", "black", ["e4", "c5"])
        lines = db.get_lines()
        assert len(lines) == 1
        assert lines[0]["name"] == "Sicilian"

    def test_filter_by_color(self, db):
        db.add_line("White Opening", "white", ["e4"])
        db.add_line("Black Defense", "black", ["e4", "e5"])
        assert len(db.get_lines("white")) == 1
        assert len(db.get_lines("black")) == 1
        assert len(db.get_lines()) == 2

    def test_delete_line(self, db):
        line = db.add_line("Test", "white", ["d4"])
        assert db.delete_line(line["id"]) is True
        assert db.get_lines() == []

    def test_delete_nonexistent(self, db):
        assert db.delete_line("fake-id") is False

    def test_import_pgn(self, db):
        pgn = "1. e4 e5 2. Nf3 Nc6 3. Bb5"
        lines = db.import_pgn(pgn, "white")
        assert len(lines) == 1
        assert len(lines[0]["moves_san"]) == 5

    def test_get_next_drill_no_lines(self, db):
        assert db.get_next_drill() is None

    def test_get_next_drill_undrilled_first(self, db):
        db.add_line("Line1", "white", ["e4"])
        line = db.get_next_drill()
        assert line is not None
        assert line["last_drilled"] is None

    def test_record_correct_result(self, db):
        line = db.add_line("Test", "white", ["e4"])
        result = db.record_drill_result(line["id"], correct=True)
        assert result["correct_count"] == 1
        assert result["interval_days"] > 1.0  # interval increased
        assert result["ease_factor"] > 2.5  # ease increased
        assert result["last_drilled"] is not None

    def test_record_incorrect_result(self, db):
        line = db.add_line("Test", "white", ["e4"])
        # First drill correct to increase interval
        db.record_drill_result(line["id"], correct=True)
        # Then incorrect
        result = db.record_drill_result(line["id"], correct=False)
        assert result["incorrect_count"] == 1
        assert result["interval_days"] == 1.0  # reset to 1
        assert result["ease_factor"] < 2.6  # decreased

    def test_sm2_ease_minimum(self, db):
        line = db.add_line("Test", "white", ["e4"])
        # Many incorrect drills should not drop ease below 1.3
        for _ in range(20):
            db.record_drill_result(line["id"], correct=False)
        result = db.get_lines()[0]
        assert result["ease_factor"] >= 1.3

    def test_sm2_ease_maximum(self, db):
        line = db.add_line("Test", "white", ["e4"])
        # Many correct drills should not raise ease above 3.0
        for _ in range(20):
            db.record_drill_result(line["id"], correct=True)
        result = db.get_lines()[0]
        assert result["ease_factor"] <= 3.0

    def test_persistence(self, tmp_path):
        path = tmp_path / "persist_test.json"
        db1 = RepertoireDB(str(path))
        db1.add_line("Persist", "white", ["e4"])

        # New instance reads the same file
        db2 = RepertoireDB(str(path))
        assert len(db2.get_lines()) == 1
        assert db2.get_lines()[0]["name"] == "Persist"
