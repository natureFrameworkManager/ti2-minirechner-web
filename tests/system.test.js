const rewire = require('rewire');
const fs = require('fs');
const path = require('path');
const minirechnerI = rewire('../js/2i.js');
const minirechnerA = rewire('../js/2a.js');

const maxCycles2a = 1000; // Maximum number of cycles to prevent infinite loops
const maxCycles2i = 1000; // Maximum number of cycles to prevent infinite loops

clearInterval(minirechnerI.__get__('displayInterval'));
clearInterval(minirechnerA.__get__('displayInterval'));

function bitToSignedInt(bit) {
    return bit << 24 >> 24;
}

function getCode(filename, folder) {
    const filePath = path.join(__dirname, 'programms/' + folder, filename);
    return fs.readFileSync(filePath, 'utf-8');
}

function runUntilStop2i(minirechner) {
    var reset = minirechner.__get__('reset');
    var clk = minirechner.__get__('clk');
    reset();
    clk();
    var count = 0;
    while (minirechner.__get__('nAddr').toString(2) !== "11111" && count < maxCycles2i) {
        clk();
        count++;
    }
    if (count >= maxCycles2i) {
        throw new Error("Program did not halt within the maximum number of cycles");
    } else {
        clk(); // Run one more cycle to ensure the final state is reached
    }
}

function runUntilStop2a(minirechner) {
    var reset = minirechner.__get__('reset');
    var clk = minirechner.__get__('clk');
    var readOpCode = minirechner.__get__('getMemBusData');
    reset();
    clk();
    var count = 0;
    while ((minirechner.__get__('CTRL').mAC >> 3 == 0 ? count < maxCycles2a : (readOpCode().toString(2).padStart(8, "0") != "00000001" && readOpCode().toString(2).padStart(8, "0") != "00000000"))) {
        clk();
        count++;
    }
    if (count >= maxCycles2a) {
        throw new Error("Program did not halt within the maximum number of cycles");
    }
}

function testProgram2i(minirechner, filename, inputs, expectedOutputs) {
    const code = getCode(filename, '2i');
    minirechner.__get__('parseCodeInput')(null, code);
    minirechner.__set__('inputs', inputs);
    runUntilStop2i(minirechner);
    const outputs = minirechner.__get__('outputs');
    for (const [key, value] of Object.entries(expectedOutputs)) {
        expect(outputs[key]).toBe(value);
    }
}

function testProgram2a(minirechner, filename, inputs, expectedOutputs) {
    const code = getCode(filename, '2a');
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
    
    runUntilStop2a(minirechner);
    const outputs = minirechner.__get__('outputs');
    for (const [key, value] of Object.entries(expectedOutputs)) {
        expect(outputs[key]).toBe(value);
    }
}

describe('2i', () => {
    describe('answer.2i', () => {
        var testCases = [
            {"inputs": {"ff": 0, "fe": 0, "fd": 0, "fc": 0}, "output": {"fe": 0x2A}}, // answer should be 42
        ];
        for (const {inputs, output} of testCases) {
            test(`answer.2i`, () => {
                testProgram2i(minirechnerI, 'answer.2i', inputs, output);
            });
        }
    });

    describe('multiply.2i', () => {
        var testCases = [
            {"inputs": {"ff": 0, "fe": 0, "fd": 0x01, "fc": 0x02}, "output": {"fe": 0x02}}, // 1 * 2 = 2
            {"inputs": {"ff": 0, "fe": 0, "fd": 0xFF, "fc": 0x02}, "output": {"fe": 0xFE}}, // -1 * 2 = -2
            {"inputs": {"ff": 0, "fe": 0, "fd": 0x7F, "fc": 0x02}, "output": {"fe": 0xFE}}, // 127 * 2 = -2 (overflow)
            {"inputs": {"ff": 0, "fe": 0, "fd": 0x80, "fc": 0x02}, "output": {"fe": 0x00}}, // -128 * 2 = 0 (underflow)
            {"inputs": {"ff": 0, "fe": 0, "fd": 0x01, "fc": 0xFF}, "output": {"fe": 0xFF}}, // 1 * -1 = -1
        ];
        for (const {inputs, output} of testCases) {
            test(`multiply ${bitToSignedInt(inputs.fd)} * ${bitToSignedInt(inputs.fc)}`, () => {
                testProgram2i(minirechnerI, 'multiply.2i', inputs, output);
            });
        }
    });

    describe('multiply2.2i', () => {
        var testCases = [
            {"inputs": {"ff": 0, "fe": 0, "fd": 0x01, "fc": 0x02}, "output": {"ff": 0x02}}, // 1 * 2 = 2
            {"inputs": {"ff": 0, "fe": 0, "fd": 0xFF, "fc": 0x02}, "output": {"ff": 0xFE}}, // -1 * 2 = -2
            {"inputs": {"ff": 0, "fe": 0, "fd": 0x7F, "fc": 0x02}, "output": {"ff": 0xFE}}, // 127 * 2 = -2 (overflow)
            {"inputs": {"ff": 0, "fe": 0, "fd": 0x80, "fc": 0x02}, "output": {"ff": 0x00}}, // -128 * 2 = 0 (underflow)
            {"inputs": {"ff": 0, "fe": 0, "fd": 0x01, "fc": 0xFF}, "output": {"ff": 0xFF}}, // 1 * -1 = -1
        ];
        for (const {inputs, output} of testCases) {
            test(`multiply2 ${bitToSignedInt(inputs.fd)} * ${bitToSignedInt(inputs.fc)}`, () => {
                testProgram2i(minirechnerI, 'multiply2.2i', inputs, output);
            });
        }
    });

    describe('compare.2i', () => {
        var testCases = [
            {"inputs": {"ff": 0, "fe": 0, "fd": 0x01, "fc": 0x02}, "output": {"fe": 0xFF, "ff": 0x00}}, // 1 < 2
            {"inputs": {"ff": 0, "fe": 0, "fd": 0x02, "fc": 0x01}, "output": {"fe": 0x00, "ff": 0xFF}}, // 2 > 1
            {"inputs": {"ff": 0, "fe": 0, "fd": 0x01, "fc": 0x01}, "output": {"fe": 0xFF, "ff": 0x00}}, // 1 == 1
            {"inputs": {"ff": 0, "fe": 0, "fd": 0xFF, "fc": 0x01}, "output": {"fe": 0xFF, "ff": 0x00}}, // -1 < 1
            {"inputs": {"ff": 0, "fe": 0, "fd": 0x01, "fc": 0xFF}, "output": {"fe": 0x00, "ff": 0xFF}}, // 1 > -1
        ];
        for (const {inputs, output} of testCases) {
            test(`compare ${bitToSignedInt(inputs.fd)} and ${bitToSignedInt(inputs.fc)}`, () => {
                testProgram2i(minirechnerI, 'compare.2i', inputs, output);
            });
        }
    });
});

describe('2a', () => {
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
                testProgram2a(minirechnerA, 'addition.asm', inputs, output);
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
                testProgram2a(minirechnerA, 'average.asm', inputs, output);
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
                testProgram2a(minirechnerA, 'fibonacci.asm', inputs, output);
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
                testProgram2a(minirechnerA, 'iterative.asm', inputs, output);
            });
        }
    });
});