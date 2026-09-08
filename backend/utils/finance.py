def to_float(value, default: float = 0.0) -> float:
    """Coerce a value to float, falling back to `default` on None/invalid input."""
    try:
        return float(value)
    except (TypeError, ValueError):
        return float(default)
