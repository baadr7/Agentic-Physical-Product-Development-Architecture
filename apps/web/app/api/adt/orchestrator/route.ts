import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const apiKey = process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY;

    if (!apiKey) {
      // Fallback to simulated response if no API key is present
      return NextResponse.json({
        plan: [
          { agent: 'orchestrator', action: 'plan', duration: '1s' },
          { agent: 'retrieval', action: 'query_sources', duration: '2s' },
          { agent: 'generation', action: 'f_to_s_mapping', duration: '3s' },
          { agent: 'dfx', action: 'score_evaluation', duration: '1s' },
          { agent: 'simulation', action: 'bs_computation', duration: '4s' },
          { agent: 'documentation', action: 'build_thread', duration: '1s' },
        ],
        hitl_comment: 'Plan recommandé selon S2 Industriel (Simulé sans clé API)',
        key_risk: 'Cycle thermique -10/+120°C (Simulé)',
        sustainability_note: 'DFS monitoring enabled (Simulé)'
      });
    }

    // Call DeepSeek/OpenAI API
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          {
            role: 'system',
            content: 'You are an Orchestrator AI for an industrial design framework (APDA). Generate a JSON output with the following keys: plan (array of objects with agent, action, duration), hitl_comment (string), key_risk (string), sustainability_note (string).'
          },
          {
            role: 'user',
            content: `Generate an execution plan for the following product brief: ${JSON.stringify(body)}`
          }
        ],
        response_format: { type: 'json_object' }
      })
    });

    if (!response.ok) {
      throw new Error('API call failed');
    }

    const data = await response.json();
    const content = JSON.parse(data.choices[0].message.content);

    return NextResponse.json(content);
  } catch (error) {
    console.error('Orchestrator API error:', error);
    return NextResponse.json({
      plan: [],
      hitl_comment: 'Erreur API',
      key_risk: 'Non évalué',
      sustainability_note: 'Non évalué'
    }, { status: 500 });
  }
}
