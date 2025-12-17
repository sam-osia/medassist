from typing import Any, Dict, List, Optional

class LLMResult:
    answer: str
    traces: List[str]
    model: str
    token_usage: Optional[dict[str, int]]
    cost: Optional[float]

    def __init__(self, 
                 answer: str,
                 traces: List[str],
                 model: str,
                 token_usage: Optional[dict[str, int]] = None,
                 cost: Optional[float] = None):
        self.answer = answer
        self.traces = traces
        self.model = model
        self.token_usage = token_usage
        self.cost = cost