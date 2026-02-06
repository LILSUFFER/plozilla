/** Exported memory */
export declare const memory: WebAssembly.Memory;
/**
 * assembly/index/setHandRank
 * @param index `i32`
 * @param rank `i32`
 */
export declare function setHandRank(index: number, rank: number): void;
/**
 * assembly/index/markTableLoaded
 */
export declare function markTableLoaded(): void;
/**
 * assembly/index/isTableLoaded
 * @returns `bool`
 */
export declare function isTableLoaded(): boolean;
/**
 * assembly/index/eval5
 * @param c0 `i32`
 * @param c1 `i32`
 * @param c2 `i32`
 * @param c3 `i32`
 * @param c4 `i32`
 * @returns `i32`
 */
export declare function eval5(c0: number, c1: number, c2: number, c3: number, c4: number): number;
/**
 * assembly/index/init
 */
export declare function init(): void;
/**
 * assembly/index/setPlayerHand
 * @param playerIdx `i32`
 * @param idx `i32`
 * @param card `i32`
 */
export declare function setPlayerHand(playerIdx: number, idx: number, card: number): void;
/**
 * assembly/index/setPlayerLen
 * @param playerIdx `i32`
 * @param len `i32`
 */
export declare function setPlayerLen(playerIdx: number, len: number): void;
/**
 * assembly/index/setNumPlayers
 * @param n `i32`
 */
export declare function setNumPlayers(n: number): void;
/**
 * assembly/index/setBoardCard
 * @param idx `i32`
 * @param card `i32`
 */
export declare function setBoardCard(idx: number, card: number): void;
/**
 * assembly/index/setBoardLen
 * @param len `i32`
 */
export declare function setBoardLen(len: number): void;
/**
 * assembly/index/buildDeck
 * @param usedLow `i32`
 * @param usedHigh `i32`
 */
export declare function buildDeck(usedLow: number, usedHigh: number): void;
/**
 * assembly/index/setSeed
 * @param s `u32`
 */
export declare function setSeed(s: number): void;
/**
 * assembly/index/calculate
 * @param numTrials `i32`
 */
export declare function calculate(numTrials: number): void;
/**
 * assembly/index/calculateExhaustive
 * @returns `i32`
 */
export declare function calculateExhaustive(): number;
/**
 * assembly/index/getDeckLen
 * @returns `i32`
 */
export declare function getDeckLen(): number;
/**
 * assembly/index/getWins
 * @param playerIdx `i32`
 * @returns `i32`
 */
export declare function getWins(playerIdx: number): number;
/**
 * assembly/index/getTies
 * @param playerIdx `i32`
 * @returns `i32`
 */
export declare function getTies(playerIdx: number): number;
/**
 * assembly/index/debugGetBinomial
 * @param n `i32`
 * @param k `i32`
 * @returns `i32`
 */
export declare function debugGetBinomial(n: number, k: number): number;
/**
 * assembly/index/debugGetHandRank
 * @param idx `i32`
 * @returns `i32`
 */
export declare function debugGetHandRank(idx: number): number;
/**
 * assembly/index/debugEval5
 * @param c0 `i32`
 * @param c1 `i32`
 * @param c2 `i32`
 * @param c3 `i32`
 * @param c4 `i32`
 * @returns `i32`
 */
export declare function debugEval5(c0: number, c1: number, c2: number, c3: number, c4: number): number;
/**
 * assembly/index/debugGetIdx
 * @param c0 `i32`
 * @param c1 `i32`
 * @param c2 `i32`
 * @param c3 `i32`
 * @param c4 `i32`
 * @returns `i32`
 */
export declare function debugGetIdx(c0: number, c1: number, c2: number, c3: number, c4: number): number;
/**
 * assembly/index/calculateExhaustiveRange
 * @param startC0 `i32`
 * @param endC0 `i32`
 * @returns `i32`
 */
export declare function calculateExhaustiveRange(startC0: number, endC0: number): number;
/**
 * assembly/index/getMaxC0
 * @returns `i32`
 */
export declare function getMaxC0(): number;
/**
 * assembly/index/calculateVsRandom
 * @param numTrials `i32`
 * @returns `i32`
 */
export declare function calculateVsRandom(numTrials: number): number;
