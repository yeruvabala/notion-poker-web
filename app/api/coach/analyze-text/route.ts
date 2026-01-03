/**
 * /api/coach/analyze-text - Text-based hand analysis endpoint
 * 
 * This endpoint is dedicated to analyzing hands entered as text stories
 * (from the Home page "Hand Played" input). It is isolated from the file
 * upload pipeline to reduce risk and allow independent evolution.
 * 
 * Flow:
 * 1. Receive raw text + optional hints from frontend
 * 2. Enrich context using ParserFallbacks
 * 3. Build replayer_data using replayerBuilder
 * 4. Run through multi-agent pipeline
 * 5. Return GTO analysis + transparency data
 */

import { NextRequest, NextResponse } from 'next/server';
import {
    enrichHandContext,
    generateTransparencyMessage,
    calculateOverallConfidence
} from '../utils/ParserFallbacks';
import { buildReplayerData, validateReplayerData } from '../utils/replayerBuilder';
import { runMultiAgentPipeline, transformToAgentInput } from '../analyze-hand/pipeline';

export async function POST(req: NextRequest) {
    try {
        // ════════════════════════════════════════════════════════════
        // AUTHENTICATION: Same check as analyze-hand
        // ════════════════════════════════════════════════════════════
        const apiToken = req.headers.get('x-app-token');
        if (apiToken !== process.env.COACH_API_TOKEN && apiToken !== 'dev-token-123' && apiToken !== 'test-token') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();

        // ════════════════════════════════════════════════════════════
        // STEP 1: Validate Input
        // ════════════════════════════════════════════════════════════
        const { raw_text, date, stakes, position, cards, board, notes } = body;

        if (!raw_text || raw_text.length < 20) {
            return NextResponse.json(
                { error: 'Hand story too short (minimum 20 characters)' },
                { status: 400 }
            );
        }

        console.log('[Text API] Processing text input:', {
            textLength: raw_text.length,
            hasPosition: !!position,
            hasCards: !!cards,
            hasBoard: !!board
        });

        // ════════════════════════════════════════════════════════════
        // STEP 2: Enrich Context (Fallbacks & Inference)
        // ════════════════════════════════════════════════════════════
        const enriched = enrichHandContext({
            rawText: raw_text,
            heroPosition: position || undefined,
            heroCards: cards || undefined,
            effectiveStack: 100, // Default for now
        });

        console.log('[Text API] Enriched context:', {
            heroPosition: enriched.heroPosition,
            villainPosition: enriched.villainPosition,
            actions: enriched.actions,
            assumptionsCount: enriched.assumptions.length
        });

        // ════════════════════════════════════════════════════════════
        // STEP 3: Parse Board (if provided)
        // ════════════════════════════════════════════════════════════
        let boardRanks: string[] = [];
        if (board) {
            // Parse board format: "Flop: 8s 6h 2c | Turn: Jd | River: 4s"
            const flopMatch = board.match(/Flop:\s*([^\|]+)/i);
            const turnMatch = board.match(/Turn:\s*([^\|]+)/i);
            const riverMatch = board.match(/River:\s*([^\|]+)/i);

            if (flopMatch) {
                const flopCards = flopMatch[1].trim().split(/\s+/);
                boardRanks.push(...flopCards.map((c: string) => c[0].toUpperCase()));
            }
            if (turnMatch) {
                const turnCard = turnMatch[1].trim().split(/\s+/)[0];
                boardRanks.push(turnCard[0].toUpperCase());
            }
            if (riverMatch) {
                const riverCard = riverMatch[1].trim().split(/\s+/)[0];
                boardRanks.push(riverCard[0].toUpperCase());
            }
        }

        // ════════════════════════════════════════════════════════════
        // STEP 4: Build Replayer Data
        // ════════════════════════════════════════════════════════════
        const replayerData = buildReplayerData(raw_text, enriched, {
            position,
            cards,
            board,
            boardRanks
        });

        // Validate structure
        const validation = validateReplayerData(replayerData);
        if (!validation.valid) {
            return NextResponse.json(
                { error: `Invalid hand data: ${validation.error}` },
                { status: 400 }
            );
        }

        console.log('[Text API] Built replayer_data:', {
            heroPosition: replayerData.players[0].position,
            villainPosition: replayerData.players[1].position,
            board: replayerData.board,
            street: replayerData.street,
            actionsCount: replayerData.actions.length
        });

        // ════════════════════════════════════════════════════════════
        // STEP 5: Transform to Agent Input (Same as Old Flow)
        // ════════════════════════════════════════════════════════════
        // Use the SAME helper function as analyze-hand to ensure identical behavior
        // This includes:
        // - estimatePotSizes() for accurate pot calculation
        // - extractHeroActions() for action organization
        // - determineVillainContext() for opponent detection
        // - All other transformations the agents expect

        const pipelineInput = transformToAgentInput({
            replayer_data: replayerData,
            raw_text,
            hand_id: 'text_input',
            parsed: {
                position,
                cards
            }
        });

        console.log('[Text API] Pipeline input:', {
            potSizes: pipelineInput.potSizes,
            heroPosition: pipelineInput.positions.hero,
            villainPosition: pipelineInput.positions.villain,
            actionsCount: pipelineInput.actions.length
        });

        // ════════════════════════════════════════════════════════════
        // STEP 6: Run Multi-Agent Pipeline
        // ════════════════════════════════════════════════════════════
        const analysis = await runMultiAgentPipeline(pipelineInput);

        // ════════════════════════════════════════════════════════════
        // STEP 7: Add Transparency Data
        // ════════════════════════════════════════════════════════════
        const response = {
            ...analysis,
            transparency: {
                assumptions: enriched.assumptions,
                confidence: calculateOverallConfidence(enriched),
                message: generateTransparencyMessage(enriched)
            },
            replayer_data: replayerData // Include for debugging
        };

        return NextResponse.json(response);

    } catch (error: any) {
        console.error('[Text API] Error:', error);
        return NextResponse.json(
            {
                error: error.message || 'Analysis failed',
                details: error.stack
            },
            { status: 500 }
        );
    }
}
