import OpenAI from 'openai';

let openaiClient: OpenAI | null = null;

/**
 * Get OpenAI client (lazy-loaded)
 * Only instantiates when first called AND API key is present
 */
function getOpenAIClient(): OpenAI | null {
    if (!openaiClient && process.env.OPENAI_API_KEY) {
        openaiClient = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
        });
    }
    return openaiClient;
}

export interface LLMParseResult {
    heroPosition?: string;
    heroCards?: string;
    villainPosition?: string;
    effectiveStack?: number;
    potSize?: number;
    scenario?: string;
}

/**
 * LLM fallback parser for fuzzy inputs
 * Uses fast, cheap model (gpt-4o-mini)
 * 
 * Triggered when:
 * - parsingConfidence < 50%
 * - Critical fields (heroPosition, heroCards) are missing
 * 
 * Cost: ~$0.00003 per call (3 cents per 1000 calls)
 */
export async function parseWithLLM(rawText: string): Promise<LLMParseResult | null> {
    const openai = getOpenAIClient();

    if (!openai) {
        console.log('[LLM Parser] Skipped - No API key configured');
        return null;
    }

    try {
        const completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            temperature: 0, // Deterministic
            max_tokens: 150, // Keep it short
            messages: [
                {
                    role: 'system',
                    content: `You are a poker hand parser. Extract structured data from natural language poker stories.

Output ONLY valid JSON with these optional fields:
- heroPosition: "BTN"|"CO"|"HJ"|"UTG"|"UTG+1"|"UTG+2"|"MP"|"SB"|"BB"
- heroCards: shorthand like "AKs", "KJo", "99", or literal like "A♠ K♠"
- villainPosition: same format as heroPosition
- effectiveStack: number (in bb)
- potSize: number (in bb)  
- scenario: "opening"|"facing_action"|"postflop"

Use null for missing fields. Return ONLY the JSON object, nothing else.

Examples:
Input: "sitting next to dealer with ace king suited"
Output: {"heroPosition":"SB","heroCards":"AKs","villainPosition":null,"effectiveStack":null,"potSize":null,"scenario":"opening"}

Input: "I'm in middle position holding pocket nines"
Output: {"heroPosition":"MP","heroCards":"99","villainPosition":null,"effectiveStack":null,"potSize":null,"scenario":"opening"}`
                },
                {
                    role: 'user',
                    content: rawText
                }
            ],
            response_format: { type: 'json_object' }
        });

        const result = JSON.parse(completion.choices[0].message.content || '{}');

        console.log('[LLM Parser] Success:', {
            input: rawText.slice(0, 50) + '...',
            result,
            tokens: completion.usage?.total_tokens || 0
        });

        return result;
    } catch (error: any) {
        console.error('[LLM Parser] Failed:', {
            error: error.message,
            input: rawText.slice(0, 50)
        });
        return null;
    }
}

/**
 * Check if LLM parsing is available (API key configured)
 */
export function isLLMParsingEnabled(): boolean {
    return !!process.env.OPENAI_API_KEY && process.env.ENABLE_LLM_FALLBACK !== 'false';
}
