
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const API_URL = 'http://localhost:3000/api/coach/analyze-hand';
const API_TOKEN = 'dev-token-123';

async function runTests() {
    const jsonPath = path.join(__dirname, 'test_range_detection_cases.json');
    const testCases = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));

    console.log(`🚀 Starting Range Detection Tests (${testCases.length} cases)`);
    console.log('Target API:', API_URL);

    let passed = 0;
    let failed = 0;
    const failedTests = [];

    for (const test of testCases) {
        process.stdout.write(`Testing ${test.id}... `);

        try {
            const payload = {
                date: new Date().toISOString(),
                raw_text: test.story,
                source_used: 'STORY'
            };

            const res = await fetch(API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-app-token': API_TOKEN
                },
                body: JSON.stringify(payload)
            });

            if (!res.ok) {
                process.stdout.write(`❌ API Error ${res.status}\n`);
                failed++;
                failedTests.push({ id: test.id, error: `API returned ${res.status}` });
                continue;
            }

            const data = await res.json();
            const strategyText = data.gto_strategy || '';

            // Validation Logic
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

            const parts = strategyText.split(test.expectedSection);
            const relevantSection = parts[1].split('\n\n')[0];

            const keywordFound = relevantSection.toLowerCase().includes(test.expectedActionKeyword.toLowerCase());

            if (!keywordFound) {
                process.stdout.write(`❌ Wrong Action! Expected "${test.expectedActionKeyword}"\n`);
                // console.log(`   > Got: ${relevantSection.trim().substring(0, 60)}...`);
                failed++;
                failedTests.push({
                    id: test.id,
                    error: `Action mismatch. Expected "${test.expectedActionKeyword}"`,
                    got: relevantSection.trim().substring(0, 500)
                });
                continue;
            }

            process.stdout.write(`✅ Passed\n`);
            passed++;

        } catch (e) {
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
            if (f.preview) console.log(`  Preview: "${f.preview}..."`);
            if (f.got) console.log(`  Got: "${f.got}"`);
        });
    }
}

runTests().catch(console.error);
