import itertools
import json
import re
from pathlib import Path

root = Path(__file__).resolve().parents[1]
groups = iter((root / "data/song-occasions.txt").read_text().splitlines())
occasions = []
for header, labels in zip(groups, groups):
    category, bank = header.split("|")
    words, textures, accents = map(str.split, bank.split(";"))
    for label in labels.split(", "):
        # Use a concrete motif where an event's own name would give too much away.
        motifs = {
            "First boxing bout": "gloves", "Boxing title fight": "canvas",
            "First date": "matchbook", "Blind date": "silhouette",
            "Proposal": "pocket", "First kiss": "breath",
            "Graduation": "tassel", "Surprise birthday": "doorbell",
            "New job": "badge", "Moving day": "boxes",
            "Passing a driving test": "ignition", "First flight": "runway",
        }
        tokens = re.findall(r"[a-z]+", label.lower())
        bland = {"first", "day", "night", "opening", "party", "of", "the", "a", "at", "in", "to"}
        motif = motifs.get(label, next((word for word in reversed(tokens) if word not in bland), tokens[-1]))
        anchors = list(dict.fromkeys([motif, *words]))
        # Three foreground words, four supporting images and two textures.
        foreground = [motif, *[word for word in accents if word != motif]][:3]
        background = [word for word in anchors if word not in foreground]
        tone = [word for word in textures if word not in foreground]
        occasions.append((label, category, foreground, background[:4], tone))

occasions[:0] = [
    ("Birthday", "Milestones", ["candles", "wish", "ribbon"], ["cake", "clock", "confetti", "wrapping"], ["glow", "surprise"]),
    ("Farewell", "Work", ["keys", "train", "coffee"], ["desk", "window", "suitcase", "sunrise"], ["distance", "echo"]),
]
moods = "Heartfelt, Funny, Playful, Tender, Hopeful, Nostalgic, Bittersweet, Melancholic, Reflective, Dreamy, Calm, Romantic, Triumphant, Energetic, Mischievous, Bold, Mysterious, Grateful".split(", ")

def slug(value):
    return re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")

def sql(value):
    return "'" + value.replace("'", "''") + "'"

schema = """CREATE TABLE song_occasions (
    id TEXT PRIMARY KEY,
    label TEXT NOT NULL UNIQUE,
    category TEXT NOT NULL,
    keywords TEXT NOT NULL
);
CREATE TABLE song_moods (
    id TEXT PRIMARY KEY,
    label TEXT NOT NULL UNIQUE
);
CREATE TABLE song_cue_sets (
    occasion_id TEXT NOT NULL REFERENCES song_occasions(id),
    slot INTEGER NOT NULL CHECK (slot BETWEEN 1 AND 24),
    words TEXT NOT NULL,
    PRIMARY KEY (occasion_id, slot),
    UNIQUE (occasion_id, words)
);
CREATE TABLE song_cue_assignments (
    id TEXT PRIMARY KEY,
    room_id TEXT NOT NULL REFERENCES song_rooms(id) ON DELETE CASCADE,
    player_hash TEXT NOT NULL,
    words TEXT NOT NULL,
    UNIQUE (room_id, player_hash),
    UNIQUE (room_id, words)
);
"""
assert len(occasions) == len({slug(row[0]) for row in occasions}) == 353
assert len(moods) == len(set(moods)) == 18
output = [schema]
for label, category, anchors, words, textures in occasions:
    key = slug(label)
    sets = list(itertools.product(anchors, words, textures))
    assert len(sets) == len({tuple(sorted(row)) for row in sets}) == 24, label
    fields = [key, label, category, json.dumps(anchors)]
    output.append("INSERT INTO song_occasions VALUES (" + ", ".join(map(sql, fields)) + ");")
    values = [f"({sql(key)}, {i}, {sql(json.dumps(list(cue)))})" for i, cue in enumerate(sets, 1)]
    output.append("INSERT INTO song_cue_sets VALUES\n    " + ",\n    ".join(values) + ";")
output.append("INSERT INTO song_moods VALUES " + ", ".join(f"({sql(slug(m))}, {sql(m)})" for m in moods) + ";")
(root / "migrations/0004_song_catalog.sql").write_text("\n".join(output) + "\n")
