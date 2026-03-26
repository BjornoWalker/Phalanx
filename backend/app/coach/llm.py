from typing import AsyncGenerator

import chess

from app.models.schemas import MoveClassification


CLASSIFICATION_DESC = {
    MoveClassification.BRILLIANT: "brilliant",
    MoveClassification.GREAT: "great",
    MoveClassification.BEST: "the best move",
    MoveClassification.GOOD: "a good move",
    MoveClassification.MISTAKE: "a mistake",
    MoveClassification.MISS: "a missed opportunity",
    MoveClassification.BLUNDER: "a serious blunder",
}


PERSONALITY_PROMPTS = {
    "robot": "You are a precise, data-driven chess coach. Focus on numbers: centipawn losses, evaluation shifts, and concrete variations. Be efficient and factual.",
    "teacher": "You are a patient, encouraging chess teacher. Explain concepts step by step. If the move was bad, reassure the student and teach them what to look for.",
    "wizard": "You are a mysterious chess wizard who teaches through questions. Ask the student to think about the position before giving answers, then provide the answer.",
    "brain": "You are an analytical chess coach who compares multiple candidate moves. Discuss trade-offs between different options and why the best move is best.",
    "owl": "You are a wise chess coach who teaches chess principles and patterns. Connect the current position to general strategic rules and typical plans.",
}

DEFAULT_PERSONALITY = "You are a friendly, encouraging chess coach analyzing a student's move. Be conversational and educational."


class LLMCoach:
    """Generate coaching feedback using a local LLM via Ollama."""

    def __init__(self, model: str = "llama3.1:8b"):
        self.model = model
        self._client = None

    def _get_client(self):
        if self._client is None:
            import ollama
            self._client = ollama.AsyncClient()
        return self._client

    VERBOSITY_INSTRUCTIONS = {
        "short": "Respond in exactly 1 sentence. Be direct and concise.",
        "medium": "Respond in 2-3 sentences. Balance detail with brevity.",
        "long": "Respond in 4-6 sentences. Provide detailed analysis, tactical ideas, and positional concepts the student should learn from.",
    }

    def _build_prompt(
        self,
        classification: MoveClassification,
        san: str,
        best_san: str,
        cp_loss: int,
        fen_before: str,
        fen_after: str,
        eval_before: float,
        eval_after: float,
        top_lines: list[list[str]],
        verbosity: str = "medium",
        personality: str = "",
    ) -> str:
        desc = CLASSIFICATION_DESC.get(classification, "a move")
        lines_str = ""
        for i, line in enumerate(top_lines[:3]):
            lines_str += f"  Line {i+1}: {' '.join(line)}\n"

        length_instruction = self.VERBOSITY_INSTRUCTIONS.get(
            verbosity, self.VERBOSITY_INSTRUCTIONS["medium"]
        )

        persona = PERSONALITY_PROMPTS.get(personality, DEFAULT_PERSONALITY)

        return f"""{persona}

Position BEFORE the move (FEN): {fen_before}
The student played: {san} (classified as {desc})
Position AFTER the move (FEN): {fen_after}

Engine evaluation before move: {eval_before:+.2f} (positive = white advantage)
Engine evaluation after move: {eval_after:+.2f}
Centipawn loss: {cp_loss}
Engine's recommended move: {best_san}
Engine's top lines:
{lines_str}
{length_instruction} If the move was good, explain why it works. If it was a mistake or worse, explain what the better move ({best_san}) achieves and what the student should look for in similar positions. Be specific about chess tactics and strategy. Do not repeat the FEN notation."""

    async def generate_feedback(
        self,
        classification: MoveClassification,
        san: str,
        best_san: str,
        cp_loss: int,
        fen_before: str,
        fen_after: str,
        eval_before: float,
        eval_after: float,
        top_lines: list[list[str]],
        verbosity: str = "medium",
        threats: list[dict] | None = None,
        personality: str = "",
    ) -> AsyncGenerator[str, None]:
        """Stream coaching feedback from Ollama."""
        prompt = self._build_prompt(
            classification, san, best_san, cp_loss,
            fen_before, fen_after, eval_before, eval_after, top_lines,
            verbosity=verbosity,
            personality=personality,
        )

        # Append threat context to the prompt
        if threats:
            threat_lines = "\n".join(t["description"] for t in threats[:3])
            prompt += f"\n\nIMPORTANT — tactical warnings to mention:\n{threat_lines}"

        try:
            client = self._get_client()
            stream = await client.chat(
                model=self.model,
                messages=[{"role": "user", "content": prompt}],
                stream=True,
            )

            async for chunk in stream:
                content = chunk.get("message", {}).get("content", "")
                if content:
                    yield content

        except Exception as e:
            yield f"[LLM unavailable: {e}. Falling back to template feedback.]"
