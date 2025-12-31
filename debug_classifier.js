"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const handClassifier_1 = require("./app/api/coach/utils/handClassifier");
const cards = "A♠ J♥";
const board = "T♣ 5♠ J♠ A♥";
console.log("Testing Classification...");
console.log(`Cards: "${cards}"`);
console.log(`Board: "${board}"`);
const result = (0, handClassifier_1.classifyHand)(cards, board);
console.log(JSON.stringify(result, null, 2));
const bucket = result.madeHand >= 4 ? 'MONSTER' :
    result.madeHand >= 2 ? 'VALUE' :
        result.madeHand === 1 ? 'MARGINAL' : 'AIR';
console.log(`\nBucket: ${bucket}`);
