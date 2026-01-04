/**
 * Simple test for frontend position parsing
 * Run with: node
 */

const parsePosition = (t) => {
    if (!t) return '';

    const s = t.toLowerCase();

    // Normalize abbreviations
    let normalized = s;
    normalized = normalized.replace(/\bbut\b/g, 'button');
    normalized = normalized.replace(/\bcut\b/g, 'cutoff');
    normalized = normalized.replace(/\bhi\b/g, 'hijack');
    normalized = normalized.replace(/\bdealer\b/g, 'button');
    normalized = normalized.replace(/\butg1\b/g, 'UTG+1');
    normalized = normalized.replace(/\butg2\b/g, 'UTG+2');
    normalized = normalized.replace(/\bmiddle\b/g, 'MP');
    normalized = normalized.replace(/\bmid\b/g, 'MP');

    // Pattern 1: "hero on BTN"
    let m = normalized.match(/\b(?:hero|i|me|my).*?\b(?:on|at|from|in)\s+(btn|button|co|cutoff|hj|hijack|utg\+?[12]?|mp|sb|bb|small\s+blind|big\s+blind)\b/i);
    if (m) {
        const pos = m[1].toUpperCase();
        if (pos === 'BUTTON') return 'BTN';
        if (pos === 'CUTOFF') return 'CO';
        if (pos === 'HIJACK') return 'HJ';
        if (pos.startsWith('SMALL')) return 'SB';
        if (pos.startsWith('BIG')) return 'BB';
        return pos;
    }

    // Pattern 2: "BTN opens"
    m = normalized.match(/\b(btn|co|hj|utg\+?[12]?|mp|sb|bb)\s+(opens?|raises?|3-?bets?|bets?|calls?)/i);
    if (m) {
        return m[1].toUpperCase();
    }

    return '';
};

// Test cases
const tests = [
    { input: 'hero on UTG+1 with KJs', expected: 'UTG+1' },
    { input: 'hero on utg1 with AKo', expected: 'UTG+1' },
    { input: 'hero on UTG+2 with 99', expected: 'UTG+2' },
    { input: 'hero on utg2 with QJs', expected: 'UTG+2' },
    { input: 'hero on MP with AKs', expected: 'MP' },
    { input: 'hero in middle with KK', expected: 'MP' },
    { input: 'hero on but with KJs', expected: 'BTN' },
    { input: 'hero on cut with AKo', expected: 'CO' },
    { input: 'hero on hi with 99', expected: 'HJ' },
];

console.log('Testing position parsing:\n');

let passed = 0;
let failed = 0;

for (const test of tests) {
    const result = parsePosition(test.input);
    const status = result === test.expected ? '✅' : '❌';
    console.log(`${status} "${test.input}" → ${result} (expected: ${test.expected})`);
    if (result === test.expected) passed++;
    else failed++;
}

console.log(`\n📊 Results: ${passed}/${passed + failed} passed (${Math.round(passed / (passed + failed) * 100)}%)`);
