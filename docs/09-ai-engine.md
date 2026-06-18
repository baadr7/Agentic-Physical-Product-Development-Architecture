# 09 — AI Engine (DeepSeek / OpenAI-compatible)

## Configuration

- Endpoint: `https://api.deepseek.com/v1/chat/completions` (CORS-native from browser).
- Model: `deepseek-chat`. One constant `LLM_MODEL` + one `LLM_BASE_URL` — swapping to
  GPT-4o or Claude requires changing only these (OpenAI-compatible interface).
- API key: entered by the user in a settings modal (header gear icon). Stored in
  memory only — never in localStorage/sessionStorage, never logged.
- **Demo mode**: without a key, every call site returns a realistic canned response
  from `mockResponses.ts` after a 1–2 s simulated latency, with a "Mode démo" badge.
  The full demo must work offline. (Phase 2 of the project: eliminate the API need
  entirely — demo mode is that path.)

## Response contract pattern

Every prompt ends with: "Réponds UNIQUEMENT avec un objet JSON valide, sans markdown,
sans préambule." Parse → validate with zod → on failure retry once with a corrective
reminder → on second failure fall back to mock + console warning.

## The 4(+1) call sites

### 1. E3 — Orchestrator plan
Input context: scenario, product brief, configured HITL levels.
```json
{
  "plan": [{ "step": 1, "agent": "retrieval", "action": "…", "duration_s": 12 }],
  "hitl_comment": "string",
  "key_risk": "string",
  "sustainability_note": "string"
}
```

### 2. E4 — DFx justifications (one call for all concepts)
Input: the 4 concepts with their deterministic scores + brief.
The model justifies scores it is GIVEN — it never changes them.
```json
{
  "justifications": [
    { "concept_id": "A",
      "dfm": "≤25 mots", "dfa": "≤25 mots", "dfr": "≤25 mots",
      "dfc": "≤25 mots", "dfs": "≤25 mots" }
  ]
}
```

### 3. E5 — Simulation analysis
Input: selected concept FBS, Bs vs Be values, status.
```json
{
  "fbs_summary": "string",
  "bs_be_status": "PASS" | "REDESIGN",
  "engineering_note": "string",
  "feedback_loop_risk": "string"
}
```
(`bs_be_status` must echo the deterministic status passed in — validate equality,
otherwise discard and use the deterministic value.)

### 4. E7 — Residual risks
Input: selected concept, scores, scenario, feedback-loop status.
```json
{
  "risks": [
    { "risk": "string", "severity": "faible|moyen|élevé",
      "category": "string", "mitigation": "string" }
  ]
}
```
Exactly 3 items; ≥1 must have category "durabilité" (enforce: if DFS < 70 and none
present, inject a canned sustainability risk).

### 5 (optional). E2 — NL → structured constraints
Input: free text product description.
Output: partial `ProductBrief.constraints` + `standards`; pre-fills form fields,
each marked source = "langage naturel converti".

## System prompt (shared prefix)

"Tu es un agent d'ingénierie du framework APDA. Tu assistes la conception d'un
produit industriel. Tu ne calcules JAMAIS de scores DFx — ils te sont fournis.
Tu réponds en français technique concis. Réponds uniquement en JSON valide."
