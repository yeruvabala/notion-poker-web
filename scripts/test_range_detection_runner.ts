const fs = require('fs');
const path = require('path');

// Configuration
const API_URL = 'http://localhost:3000/api/coach/analyze-hand';
const API_TOKEN = 'dev-token-123';

interface TestCase {
    id: string;
    category: string;
    story: string;
    hand: string;
    position: string;
    expectedSection: string;
    expectedActionKeyword: string;
}

async function runTests() {
    const jsonPath = path.join(__dirname, 'test_range_detection_cases.json');
    const testCases: TestCase[] = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));

    console.log(`🚀 Starting Range Detection Tests (${testCases.length} cases)`);
    console.log('Target API:', API_URL);

    let passed = 0;
    let failed = 0;
    const failedTests: any[] = [];

    for (const test of testCases) {
        process.stdout.write(`Testing ${test.id}... `);

        try {
            const payload = {
                date: new Date().toISOString(),
                raw_text: test.story,
                source_used: 'STORY',
                // Provide hints to help parsing if needed, but we want to test AUTO detection mostly
                // cards: test.hand, 
                // position: test.position
            };

            // We need to fetch. Assuming Node 18+ has global fetch.
            const res = await fetch(API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-app-token': 'dev-token-123' // Try a default, if it fails I'll check logs
                },
                body: JSON.stringify(payload)
            });

            if (!res.ok) {
                process.stdout.write(`❌ API Error ${res.status}\n`);
                failed++;
                failedTests.push({ id: test.id, error: `API returned ${res.status}` });
                continue;
            }

            const data: any = await res.json();
            const strategyText = data.gto_strategy || '';

            // Validation Logic
            // 1. Check if expected section exists
            if (!strategyText.includes(test.expectedSection)) {
                process.stdout.write(`❌ Missing Section: "${test.expectedSection}"\n`);
                failed++;
                failedTests.push({
                    id: test.id,
                    error: `Missing section "${test.expectedSection}"`,
                    preview: strategyText.substring(0, 100).replace(/\n/g, ' ')
                });
                continue;
            }

            // 2. Check if expected action keyword exists INSIDE that section (approximate check)
            // Splitting by section to find the right part
            const parts = strategyText.split(test.expectedSection);
            if (parts.length < 2) {
                // Should catch this above, but to be safe
                process.stdout.write(`❌ Parsing Error\n`);
                failed++;
                continue;
            }

            const relevantSection = parts[1].split('\n\n')[0]; // Take until next double newline

            // Check for action keyword (case insensitive)
            // "raise" matches "Raise", "raising", "4-bet" (wait, 4-bet is a raise type, but I used "raise" keyword for 4bet in JSON?)
            // Let's rely on my JSON keywords "raise", "call".
            // Note: "4bet" often maps to "raise" in text, or "All-In".

            const keywordFound = relevantSection.toLowerCase().includes(test.expectedActionKeyword.toLowerCase());

            if (!keywordFound) {
                process.stdout.write(`❌ Wrong Action! Expected "${test.expectedActionKeyword}"\n`);
                console.log(`   > Got: ${relevantSection.trim().substring(0, 60)}...`);
                failed++;
                failedTests.push({
                    id: test.id,
                    error: `Action mismatch. Expected "${test.expectedActionKeyword}"`,
                    got: relevantSection.trim().substring(0, 60)
                });
                continue;
            }

            process.stdout.write(`✅ Passed\n`);
            passed++;

        } catch (e: any) {
            process.stdout.write(`❌ Exception: ${e.message}\n`);
            failed++;
            failedTests.push({ id: test.id, error: e.message });
        }
    }

    console.log('\n=======================================');
    console.log(`TEST RESULTS: ${passed}/${testCases.length} Passed (${Math.round(passed / testCases.length * 100)}%)`);
    console.log('=======================================');

    if (failed > 0) {
        console.log('\nFAILED TESTS:');
        failedTests.forEach(f => {
            console.log(`- [${f.id}]: ${f.error}`);
            if (f.got) console.log(`  Got: "${f.got}"`);
        });
    }
}

runTests().catch(console.error);
