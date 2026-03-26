import chess

STRUCTURE_NAMES = {
    # Common pawn structure patterns (simplified detection)
    "sicilian": "Sicilian Structure",
    "french": "French Structure",
    "caro": "Caro-Kann Structure",
    "kings_indian": "King's Indian Structure",
    "isolated_qp": "Isolated Queen's Pawn",
    "hanging_pawns": "Hanging Pawns",
    "symmetric": "Symmetric Pawn Structure",
}


def analyze_pawn_structure(board: chess.Board) -> dict:
    """Analyze the pawn structure of the current position.

    Returns:
    {
        "white_pawns": ["e4", "d3", ...],
        "black_pawns": ["e5", "d6", ...],
        "isolated": [{"square": "d4", "color": "white"}, ...],
        "doubled": [{"file": "e", "color": "white"}, ...],
        "passed": [{"square": "d5", "color": "white"}, ...],
        "pawn_islands": {"white": 2, "black": 1},
        "description": "White has an isolated queen's pawn on d4..."
    }
    """
    white_pawns: list[str] = []
    black_pawns: list[str] = []
    isolated: list[dict] = []
    doubled: list[dict] = []
    passed: list[dict] = []

    # Collect all pawns
    for square in chess.SQUARES:
        piece = board.piece_at(square)
        if piece and piece.piece_type == chess.PAWN:
            sq_name = chess.square_name(square)
            if piece.color == chess.WHITE:
                white_pawns.append(sq_name)
            else:
                black_pawns.append(sq_name)

    # Analyze by file
    def get_files(pawns: list[str]) -> dict[int, list[str]]:
        files: dict[int, list[str]] = {}
        for p in pawns:
            f = ord(p[0]) - ord('a')
            files.setdefault(f, []).append(p)
        return files

    white_files = get_files(white_pawns)
    black_files = get_files(black_pawns)

    # Doubled pawns: multiple pawns on the same file
    for color, files in [("white", white_files), ("black", black_files)]:
        for f, pawns in files.items():
            if len(pawns) > 1:
                file_letter = chr(ord('a') + f)
                doubled.append({"file": file_letter, "color": color, "count": len(pawns)})

    # Isolated pawns: no friendly pawns on adjacent files
    for color, files, all_files in [
        ("white", white_files, white_files),
        ("black", black_files, black_files),
    ]:
        for f in files:
            has_neighbor = (f - 1) in all_files or (f + 1) in all_files
            if not has_neighbor:
                for sq in files[f]:
                    isolated.append({"square": sq, "color": color})

    # Passed pawns: no enemy pawns on same or adjacent files ahead
    for sq_name in white_pawns:
        f = ord(sq_name[0]) - ord('a')
        r = int(sq_name[1])
        is_passed = True
        for bf in [f - 1, f, f + 1]:
            if bf < 0 or bf > 7:
                continue
            for bsq in black_files.get(bf, []):
                br = int(bsq[1])
                if br > r:  # black pawn ahead
                    is_passed = False
                    break
            if not is_passed:
                break
        if is_passed:
            passed.append({"square": sq_name, "color": "white"})

    for sq_name in black_pawns:
        f = ord(sq_name[0]) - ord('a')
        r = int(sq_name[1])
        is_passed = True
        for wf in [f - 1, f, f + 1]:
            if wf < 0 or wf > 7:
                continue
            for wsq in white_files.get(wf, []):
                wr = int(wsq[1])
                if wr < r:  # white pawn ahead
                    is_passed = False
                    break
            if not is_passed:
                break
        if is_passed:
            passed.append({"square": sq_name, "color": "black"})

    # Pawn islands
    def count_islands(files: dict[int, list[str]]) -> int:
        if not files:
            return 0
        sorted_files = sorted(files.keys())
        islands = 1
        for i in range(1, len(sorted_files)):
            if sorted_files[i] - sorted_files[i - 1] > 1:
                islands += 1
        return islands

    white_islands = count_islands(white_files)
    black_islands = count_islands(black_files)

    # Build description
    desc_parts: list[str] = []
    if isolated:
        for ip in isolated:
            desc_parts.append(f"{ip['color'].capitalize()} has an isolated pawn on {ip['square']}.")
    if doubled:
        for dp in doubled:
            desc_parts.append(f"{dp['color'].capitalize()} has doubled pawns on the {dp['file']}-file.")
    if passed:
        for pp in passed:
            desc_parts.append(f"{pp['color'].capitalize()} has a passed pawn on {pp['square']}.")
    if white_islands != black_islands:
        fewer = "White" if white_islands < black_islands else "Black"
        desc_parts.append(f"{fewer} has fewer pawn islands ({min(white_islands, black_islands)} vs {max(white_islands, black_islands)}).")

    return {
        "white_pawns": white_pawns,
        "black_pawns": black_pawns,
        "isolated": isolated,
        "doubled": doubled,
        "passed": passed,
        "pawn_islands": {"white": white_islands, "black": black_islands},
        "description": " ".join(desc_parts) if desc_parts else "Balanced pawn structure.",
    }
