from typing import Dict

# Simple content moderation stub; extend with real model or API later.
BLOCKLIST = ['weapon','explosive','hate','illegal']


def content_moderate(prompt: str) -> Dict:
    lowered = prompt.lower()
    flagged = [w for w in BLOCKLIST if w in lowered]
    return {
        'ok': True,
        'prompt': prompt,
        'flagged': flagged,
        'allowed': len(flagged) == 0,
        'reason': 'blocked_terms' if flagged else None
    }
