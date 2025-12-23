/**
 * Map replayer action names to our ActionType
 */
function mapReplayerAction(action: string): ActionType {
    const map: Record<string, ActionType> = {
        'folds': 'fold',
        'checks': 'check',
        'calls': 'call',
        'bets': 'bet',
        'raises': 'raise',
        'raiseTo': 'raise'
    };
    return map[action] || 'check';
}

/**
 * Convert replayer_data actions to our Action[] format
 * Converts player names to "hero" vs "villain" labels
 */
function convertReplayerActions(replayerData: any): Action[] {
    const heroName = replayerData.players.find((p: any) => p.isHero)?.name;

    if (!heroName) {
        console.warn('[convertReplayerActions] Could not find hero in players');
        return [];
    }

    return replayerData.actions.map((a: any) => ({
        street: a.street as Street,
        player: a.player === heroName ? 'hero' : 'villain',
        action: mapReplayerAction(a.action),
        amount: a.amount || undefined
    }));
}
