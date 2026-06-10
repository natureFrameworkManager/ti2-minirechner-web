const rewire = require('rewire');
const { aluLookupAdd, aluLookupNor } = require('../lookup_tables/alu_lookup.js');

// ─── ALU runners ─────────────────────────────────────────────────────────────
// Modules are loaded once; only state is reset between calls.

const minirechnerI = rewire('../../js/2i.js');
const minirechnerA = rewire('../../js/2a.js');

clearInterval(minirechnerI.__get__('displayInterval'));
clearTimeout(minirechnerI.__get__('uartTimeout'));
clearInterval(minirechnerA.__get__('displayInterval'));
clearTimeout(minirechnerA.__get__('uartTimeout'));

/**
 * Run both ALU implementations for the given inputs and return their outputs.
 *
 * @param {number} ctrl  4-bit control signal
 * @param {number} a     8-bit operand A
 * @param {number} b     8-bit operand B
 * @param {number} cin   carry-in (0 or 1)
 * @returns {{ i: {f:number,co:number,zo:number,no:number},
 *             a: {f:number,co:number,zo:number,no:number} }}
 */
function runALU(ctrl, a, b, cin) {
    // ── Implementation I ──────────────────────────────────────────────────
    minirechnerI.__get__('reset')();
    minirechnerI.__set__('regs', [a, b, 0, 0, 0, 0, 0, 0]);
    minirechnerI.__set__('CF', cin);
    minirechnerI.__set__('mAluS', ctrl);
    minirechnerI.__get__('alu')();
    const iResult = {
        f:  minirechnerI.__get__('F'),
        co: minirechnerI.__get__('CO') ? 1 : 0,
        zo: minirechnerI.__get__('ZO') ? 1 : 0,
        no: minirechnerI.__get__('NO') ? 1 : 0,
    };

    // ── Implementation A ──────────────────────────────────────────────────
    minirechnerA.__get__('reset')();
    const flagsReg = cin ? 0b00000001 : 0b00000000;
    minirechnerA.__set__('regs', [a, b, 0, 0, flagsReg, 0, 0, 0]);
    const CTRL = minirechnerA.__get__('CTRL');
    CTRL.mAluS = ctrl;
    minirechnerA.__set__('CTRL', CTRL);
    const {f, co, zo, no} = minirechnerA.__get__('getALU')();
    const aResult = { f, co: co ? 1 : 0, zo: zo ? 1 : 0, no: no ? 1 : 0 };

    return { i: iResult, a: aResult };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Pre-compute N and Z flags for a single 8-bit value (0–255). */
const NZ = Array.from({ length: 256 }, (_, f) => ({
    no: (f & 0x80) ? 1 : 0,
    zo: f === 0    ? 1 : 0,
}));

/**
 * Boundary probe values for inputs that are irrelevant to a given op.
 * Chosen to cover: all-zeros, LSB set, MSB-1 (max positive signed),
 * MSB set (min negative signed / sign-boundary), all-ones.
 * A buggy ALU that accidentally reads an "irrelevant" input will most
 * likely corrupt flags or the result for at least one of these values.
 */
const PROBE = [0x00, 0x01, 0x7F, 0x80, 0xFF];
const CINS  = [0, 1];

// ── 0b1011  ASR  (F(n) = A(n+1), F(7) = A(7), C = A(0)) ────────────────
// 'b' and 'cin' are irrelevant — probed to catch accidental reads.
describe('ASR', () => {
    for (let a = 0; a <= 0xFF; a++) {
        for (const b of PROBE) {
            for (const cin of CINS) {
                const result = runALU(0b1011, a, b, cin);
                const f  = ((a >> 1) | (a & 0x80)) & 0xFF;
                const co = a & 1;
                test(`2I: a=0x${a.toString(16).padStart(2,'0')} b=0x${b.toString(16).padStart(2,'0')} cin=${cin}`, () => {
                    expect(result.i).toEqual({ f, co, ...NZ[f] });
                });
                test(`2A: a=0x${a.toString(16).padStart(2,'0')} b=0x${b.toString(16).padStart(2,'0')} cin=${cin}`, () => {
                    expect(result.a).toEqual({ f, co, ...NZ[f] });
                });
            }
        }
    }
});