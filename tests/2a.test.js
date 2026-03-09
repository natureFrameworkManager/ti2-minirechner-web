const rewire = require('rewire');
const fs = require('fs');
const path = require('path');
const assembler = rewire('../js/2a.js');

// Get access to the private parseASM function
const parseASM = assembler.__get__('parseASM');

const padArray = (arr, len, fill) => {
    return arr.concat(Array(len).fill(fill)).slice(0,len);
}

const parseHexString = (hexString) => {
    if (!hexString || hexString.trim() === '') {
        return [];
    }
    return hexString.trim().split(/\s+/).map(byte => parseInt(byte, 16));
};

const extractTestResult = (fileContent) => {
    const lines = fileContent.split('\n');
    const lastLine = lines[lines.length - 1].trim();
    
    if (lastLine.startsWith('; test-result:')) {
        const result = lastLine.substring('; test-result:'.length).trim();
        
        if (result === 'false') {
            return { expected: 'false' };
        } else if (result === '') {
            return { expected: padArray([], 0xEF +1, 0x00) };
        } else {
            return { expected: padArray(parseHexString(result), 0xEF +1, 0x00) };
        }
    }
    
    return null;
};

const getTestFiles = () => {
    const testDir = path.join(__dirname, './asm');
    const files = fs.readdirSync(testDir)
        .filter(file => file.endsWith('.asm'))
        .sort();
    
    return files.map(file => ({
        name: file,
        path: path.join(testDir, file)
    }));
};

describe('parseASM() - Dynamic Assembly Test Files', () => {
    const testFiles = getTestFiles();

    testFiles.forEach(testFile => {
        test(`${testFile.name}`, () => {
            // Read the test file
            const fileContent = fs.readFileSync(testFile.path, 'utf-8');
            
            // Extract expected result from test-result comment
            const testInfo = extractTestResult(fileContent);
            
            if (!testInfo) {
                throw new Error(`No test-result found in ${testFile.name}`);
            }
            
            // Run parseASM
            let result = parseASM(fileContent);
            if (Array.isArray(result)) {
                for (let index = 0; index < 0xEF +1; index++) {
                    if (result[index] === undefined) {
                        result[index] = 0;
                    }
                }
            }
            
            // Validate result based on expected outcome
            if (testInfo.expected === 'false') {
                // Expected to fail - should return false or throw error
                expect([false, undefined]).toContain(result);
            } else if (Array.isArray(testInfo.expected)) {
                // Expected to return specific bytes
                expect(Array.isArray(result)).toBe(true);
                
                // Convert result to comparable format (handle both numbers and strings)
                const resultBytes = result.map(byte => {
                    if (typeof byte === 'string') {
                        // If it's a label that wasn't resolved, this is an error
                        throw new Error(`Unresolved label in ${testFile.name}: ${byte}`);
                    }
                    return byte & 0xFF; // Ensure it's a valid byte
                });
                
                // Compare arrays
                expect(resultBytes).toEqual(testInfo.expected);
            }
        });
    });
});