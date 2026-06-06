const rewire = require('rewire');
const fs = require('fs');
const path = require('path');
const minirechnerA = rewire('../js/2a.js');

const maxCycles = 1000; // Maximum number of cycles to prevent infinite loops

clearInterval(minirechnerA.__get__('displayInterval'));

function bitToSignedInt(bit) {
    return bit << 24 >> 24;
}

function getCode(filename) {
    const filePath = path.join(__dirname, 'programms/2a', filename);
    return fs.readFileSync(filePath, 'utf-8');
}

function runUntilStop(minirechner) {
    var reset = minirechner.__get__('reset');
    var clk = minirechner.__get__('clk');
    var readOpCode = minirechner.__get__('getMemBusData');
    reset();
    clk();
    var count = 0;
    while ((minirechner.__get__('CTRL').mAC >> 3 == 0 ? count < maxCycles : (readOpCode().toString(2).padStart(8, "0") != "00000001" && readOpCode().toString(2).padStart(8, "0") != "00000000"))) {
        clk();
        count++;
    }
    if (count >= maxCycles) {
        throw new Error("Program did not halt within the maximum number of cycles");
    }
}

function testProgram(minirechner, filename, inputs, expectedOutputs) {
    const code = getCode(filename);
    var tram = minirechner.__get__('parseASM')(code);
    for (let index = 0; index < 0xEF +1; index++) {
        if (tram[index] === undefined) {
            tram[index] = 0;
        }
    }
    if (tram !== false) {
        minirechner.__set__('DPRAM', tram);
    }
    minirechner.__set__('inputs', inputs);
    
    runUntilStop(minirechner);
    const outputs = minirechner.__get__('outputs');
    for (const [key, value] of Object.entries(expectedOutputs)) {
        expect(outputs[key]).toBe(value);
    }
}

describe('addition.asm', () => {
    var testCases = [
        {"inputs": {"ff": 0x01, "fe": 0x01, "fd": 0, "fc": 0}, "output": {"ff": 0x02, "fe": 0x00}}, // 1 + 1 = 2
        {"inputs": {"ff": 0xFF, "fe": 0x01, "fd": 0, "fc": 0}, "output": {"ff": 0x00, "fe": 0x00}}, // -1 + 1 = 0
        {"inputs": {"ff": 0xFF, "fe": 0xFF, "fd": 0, "fc": 0}, "output": {"ff": 0xFE, "fe": 0x00}}, // -1 + -1 = -2
        {"inputs": {"ff": 0x7F, "fe": 0x01, "fd": 0, "fc": 0}, "output": {"ff": 0x80, "fe": 0x00}}, // 127 + 1 = -128 (overflow)
        {"inputs": {"ff": 0x80, "fe": 0xFF, "fd": 0, "fc": 0}, "output": {"ff": 0x7F, "fe": 0x00}} // -128 + -1 = 127 (underflow)
    ]
    for (const {inputs, output} of testCases) {
        test(`add ${bitToSignedInt(inputs.ff)} + ${bitToSignedInt(inputs.fe)}`, () => {
            testProgram(minirechnerA, 'addition.asm', inputs, output);
        });
    }
});

describe('average.asm', () => {
    var testCases = [
        {"inputs": {"ff": 0x01, "fe": 0x03, "fd": 0, "fc": 0}, "output": {"ff": 0x02}}, // (1 + 3) / 2 = 2
        {"inputs": {"ff": 0x01, "fe": 0x02, "fd": 0, "fc": 0}, "output": {"ff": 0x01}}, // (1 + 2) / 2 = 1
        {"inputs": {"ff": 0xFF, "fe": 0x01, "fd": 0, "fc": 0}, "output": {"ff": 0x00}}, // (-1 + 1) / 2 = 0
        {"inputs": {"ff": 0xFF, "fe": 0xFF, "fd": 0, "fc": 0}, "output": {"ff": 0xFF}}, // (-1 + -1) / 2 = -1
        {"inputs": {"ff": 0x7F, "fe": 0x01, "fd": 0, "fc": 0}, "output": {"ff": 0x40}}, // (127 + 1) / 2 = 64
        {"inputs": {"ff": 0x80, "fe": 0xFF, "fd": 0, "fc": 0}, "output": {"ff": 0xC0}} // (-128 + -1) / 2 = -64
    ];
    for (const {inputs, output} of testCases) {
        test(`average of ${bitToSignedInt(inputs.ff)} and ${bitToSignedInt(inputs.fe)}`, () => {
            testProgram(minirechnerA, 'average.asm', inputs, output);
        });
    }
});

describe('fibonacci.asm', () => {
    var testCases = [
        {"inputs": {"ff": 0x00, "fe": 0, "fd": 0, "fc": 0}, "output": {"ff": 0x00}}, // F(0) = 0
        {"inputs": {"ff": 0x01, "fe": 0, "fd": 0, "fc": 0}, "output": {"ff": 0x01}}, // F(1) = 1
        {"inputs": {"ff": 0x02, "fe": 0, "fd": 0, "fc": 0}, "output": {"ff": 0x01}}, // F(2) = 1
        {"inputs": {"ff": 0x03, "fe": 0, "fd": 0, "fc": 0}, "output": {"ff": 0x02}}, // F(3) = 2
        {"inputs": {"ff": 0x04, "fe": 0, "fd": 0, "fc": 0}, "output": {"ff": 0x03}}, // F(4) = 3
        {"inputs": {"ff": 0x05, "fe": 0, "fd": 0, "fc": 0}, "output": {"ff": 0x05}}, // F(5) = 5
        {"inputs": {"ff": 0x06, "fe": 0, "fd": 0, "fc": 0}, "output": {"ff": 0x08}}, // F(6) = 8
        {"inputs": {"ff": 0x07, "fe": 0, "fd": 0, "fc": 0}, "output": {"ff": 0x00}}, // F(7) fails
    ];
    for (const {inputs, output} of testCases) {
        test(`${bitToSignedInt(inputs.ff)}th Fibonacci number`, () => {
            testProgram(minirechnerA, 'fibonacci.asm', inputs, output);
        });
    }
});

describe('iterative.asm', () => {
    var testCases = [
        {"inputs": {"ff": 0x00, "fe": 0, "fd": 0, "fc": 0}, "output": {"ff": 0x00}}, // F(0) = 0
        {"inputs": {"ff": 0x01, "fe": 0, "fd": 0, "fc": 0}, "output": {"ff": 0x01}}, // F(1) = 1
        {"inputs": {"ff": 0x02, "fe": 0, "fd": 0, "fc": 0}, "output": {"ff": 0x01}}, // F(2) = 1
        {"inputs": {"ff": 0x03, "fe": 0, "fd": 0, "fc": 0}, "output": {"ff": 0x02}}, // F(3) = 2
        {"inputs": {"ff": 0x04, "fe": 0, "fd": 0, "fc": 0}, "output": {"ff": 0x03}}, // F(4) = 3
        {"inputs": {"ff": 0x05, "fe": 0, "fd": 0, "fc": 0}, "output": {"ff": 0x05}}, // F(5) = 5
        {"inputs": {"ff": 0x06, "fe": 0, "fd": 0, "fc": 0}, "output": {"ff": 0x08}}, // F(6) = 8
        {"inputs": {"ff": 0x07, "fe": 0, "fd": 0, "fc": 0}, "output": {"ff": 0x0D}}, // F(7) = 13
        {"inputs": {"ff": 0x08, "fe": 0, "fd": 0, "fc": 0}, "output": {"ff": 0x15}}, // F(8) = 21
        {"inputs": {"ff": 0x09, "fe": 0, "fd": 0, "fc": 0}, "output": {"ff": 0x22}}, // F(9) = 34
        {"inputs": {"ff": 0x0A, "fe": 0, "fd": 0, "fc": 0}, "output": {"ff": 0x37}}, // F(10) = 55
    ];
    for (const {inputs, output} of testCases) {
        test(`${bitToSignedInt(inputs.ff)}th Fibonacci number`, () => {
            testProgram(minirechnerA, 'iterative.asm', inputs, output);
        });
    }
});