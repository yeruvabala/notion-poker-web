// Type augmentation for enhanced coaching output
// This fixes TypeScript errors without modifying core types

declare module '@/app/api/coach/analyze-hand/pipeline' {
    export interface CoachOutput {
        gto_strategy: string;
        exploit_deviation: string;
        learning_tag: string[];
        structured_data: any;
        // Phase 12-14.5: Enhanced coaching data
        heroClassification?: any;
        spr?: any;
        mistakes?: any;
    }
}

export { };
