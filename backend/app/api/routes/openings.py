from fastapi import APIRouter, HTTPException, File, UploadFile

from app.openings.repertoire import RepertoireDB

router = APIRouter(prefix="/api/repertoire", tags=["repertoire"])


def _get_db() -> RepertoireDB:
    return RepertoireDB()


@router.get("/lines")
async def get_lines(color: str | None = None):
    db = _get_db()
    return {"lines": db.get_lines(color)}


@router.post("/lines")
async def add_line(req: dict):
    name = req.get("name", "Unnamed Line")
    color = req.get("color", "white")
    moves_san = req.get("moves", [])

    if not moves_san:
        raise HTTPException(status_code=400, detail="No moves provided")

    db = _get_db()
    try:
        line = db.add_line(name, color, moves_san)
        return line
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/import")
async def import_pgn(req: dict):
    pgn = req.get("pgn", "")
    color = req.get("color", "white")

    if not pgn:
        raise HTTPException(status_code=400, detail="No PGN provided")

    db = _get_db()
    lines = db.import_pgn(pgn, color)
    return {"imported": len(lines), "lines": lines}


@router.delete("/lines/{line_id}")
async def delete_line(line_id: str):
    db = _get_db()
    if db.delete_line(line_id):
        return {"deleted": True}
    raise HTTPException(status_code=404, detail="Line not found")


@router.get("/drill")
async def get_drill(color: str | None = None):
    db = _get_db()
    line = db.get_next_drill(color)
    if not line:
        raise HTTPException(status_code=404, detail="No lines available for drilling")
    return line


@router.post("/drill/result")
async def record_drill_result(req: dict):
    line_id = req.get("line_id", "")
    correct = req.get("correct", False)

    db = _get_db()
    result = db.record_drill_result(line_id, correct)
    if not result:
        raise HTTPException(status_code=404, detail="Line not found")
    return result
