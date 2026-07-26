# MRASM Assembler Specification for Architecture 2a

## Table of Contents

1. [Overview](#1-overview)
2. [Lexical Conventions](#2-lexical-conventions)
3. [Labels](#3-labels)
4. [Equates (.EQU)](#4-equates-equ)
5. [Assembler Directives](#5-assembler-directives)
6. [Number Formats](#6-number-formats)
7. [Addressing Modes](#7-addressing-modes)
8. [Instruction Reference](#8-instruction-reference)
9. [Two-Pass Assembly Process](#9-two-pass-assembly-process)
10. [Error and Warning Messages](#10-error-and-warning-messages)
11. [Opcode Encoding Reference](#11-opcode-encoding-reference)
12. [Complete Opcode Map (by Binary Encoding)](#12-complete-opcode-map-by-binary-encoding)
13. [Assembly Examples](#13-assembly-examples)
14. [Test Result Format](#14-test-result-format)

---

## 1. Overview

MRASM is the assembler for the 2a microcoded processor. It translates human-readable assembly language into machine code bytes that are loaded into the processor's data RAM (DPRAM, addresses `0x00`–`0xEF`).

**Key design principles:**
- Two-pass assembly: labels are resolved in a first pass, code is generated in a second pass
- Case-insensitive: all source text is normalized to uppercase
- Line-oriented: each instruction, directive, or label occupies its own line
- Strict error checking: invalid syntax produces errors (not warnings) and prevents code generation
- Output: a 240-byte array (indices `0`–`0xEF`), with unused bytes filled with `0x00`

**File identifier:** Every valid assembly file must begin with the magic string `#! mrasm` on the first line.

---

## 2. Lexical Conventions

### 2.1 File Structure

```
#! mrasm                        ← Mandatory first line
                                 ← Blank lines allowed & ignored
; This is a comment              ← Comment line (starts with ';')
LABEL:                           ← Label definition
    INSTRUCTION OPERAND1, OPERAND2  ; End-of-line comment
    .DIRECTIVE ARG1, ARG2
```

### 2.2 Comments

Comments begin with a semicolon `;` and extend to the end of the line. They are removed before parsing. Both full-line comments and end-of-line comments are supported:

```asm
; This entire line is a comment
    ADD R0, R1    ; This is an end-of-line comment
```

### 2.3 Whitespace

- Leading and trailing whitespace is ignored on each line
- Tokens within a line are separated by spaces or commas
- Mixed whitespace (spaces + commas) is allowed: `ADD R0,R1` and `ADD R0, R1` are equivalent
- **Whitespace before a comma or colon is a syntax error:** `R0 , R1` and `LABEL :` are invalid

### 2.4 Case Sensitivity

All source text is converted to uppercase before parsing. `add r0, r1` is equivalent to `ADD R0, R1`.

### 2.5 Reserved Words

The following are reserved and cannot be used as label names:

**Register names:** `R0`, `R1`, `R2`, `PC`

**Instruction mnemonics:**
```
CLR ADD ADC SUB MUL DIV AND OR XOR INC DEC
NEG COM LSR ASR LSL RRC RLC TST BITS BITC CMP
BITT MOV LD ST LDSP LDFR JMP PUSH POP
JCS JCC JZS JZC JNS JNC JR CALL
PUSHF POPF RET RETI STOP NOP EI DI
```

### 2.6 Label Name Rules

Labels must match the regular expression: `^[A-Z_][A-Z0-9_]*$`

- Must start with a letter (A–Z) or underscore (`_`)
- Subsequent characters may be letters, digits (0–9), or underscores
- Cannot start with `R` followed by a digit (conflict with register names)
- Cannot start with `PC` (conflict with program counter)
- Cannot match any instruction mnemonic
- **Must not contain lowercase letters** (they are uppercased, but the validator checks after uppercasing)

**Valid examples:** `LOOP`, `MAIN`, `_START`, `MY_LABEL_1`, `HANDLER`

**Invalid examples:** `R0`, `R1`, `R2`, `PC`, `ADD`, `1LOOP`, `MY-LABEL`, `LOOP:`

---

## 3. Labels

### 3.1 Code Labels

A code label marks a position in the program and is defined by a name followed by a colon on its own line:

```asm
LOOP:
    INC R0
    JR LOOP
```

Rules:
- The label and colon must be the only content on the line (no instructions on the same line)
- Each label can be defined **exactly once** — duplicate labels are a hard error
- Labels can be used as operands before they are defined (forward reference, resolved in pass 2)

### 3.2 Label Values

A code label evaluates to the address at which the next instruction or data will be placed (the current value of the assembler's address counter).

### 3.3 Labels in Expressions

Labels can be used wherever a numeric value is expected:
- As operands to instructions: `JMP MY_FUNCTION`, `LD R0, BUFFER`
- In addressing expressions: `LD R0, (MY_LABEL)`, `ST (PORT), R0`
- As arguments to directives: `.DB MY_LABEL`
- As branch targets: `JR LOOP`, `JCS ERROR_HANDLER`, `CALL SUBROUTINE`

### 3.4 Label vs. EQU Priority

Labels defined with `.EQU` take precedence. If a `.EQU` and a code label share the same name, it is an error (duplicate definition is detected in pass 1).

### 3.5 Unresolved Labels

If a label referenced in code is never defined (neither as a code label nor as `.EQU`), the assembler reports an error:
```
Unknown label or constant: 'UNDEFINED_LABEL'
```

### 3.6 Null Labels

A label that is referenced in a `.EQU` right-hand side but not yet defined gets a null placeholder in pass 1. If it remains null after pass 2 (never assigned an address), an error is reported.

---

## 4. Equates (.EQU)

### 4.1 Syntax

```
.EQU NAME, VALUE
```

Defines a symbolic constant `NAME` with the numeric value `VALUE`.

### 4.2 Value Expression

The value can be any valid number format (decimal, binary, hex) or another previously defined label/EQU name:

```asm
.EQU MAX_VALUE, 255
.EQU BUFFER_SIZE, 0x40
.EQU PORT_A, 0xFF
.EQU TWICE_MAX, MAX_VALUE   ; references another .EQU — but only if defined earlier
```

### 4.3 Constraints

- `.EQU` requires **exactly 2 parameters** (name and value)
- The name must follow label naming rules
- The name must not conflict with registers (R0–R2, PC) or instruction mnemonics
- Redefining a name (via `.EQU` or label) is an error — detected in pass 1
- `.EQU` can be used to **override** a code label — if a name appears first as `.EQU`, a later code label with the same name is rejected (and vice versa)

### 4.4 Evaluation

`.EQU` values are evaluated immediately during pass 1 using `parseASMNumber()`. Only numeric literals and already-defined labels are supported on the right-hand side.

---

## 5. Assembler Directives

### 5.1 `.ORG` — Set Origin

```
.ORG ADDRESS
```

Sets the current assembly address counter to `ADDRESS` (0–255, 0x00–0xFF).

**Example:**
```asm
    .ORG 0x00
    ; Code starting at address 0
    CLR R0
    
    .ORG 0x80
    ; Data starting at address 128
    .DB 0x41, 0x42
```

**Constraints:**
- Requires exactly 1 parameter
- Parameter must be a valid number in range 0–255

### 5.2 `.BYTE` — Reserve Bytes

```
.BYTE COUNT
```

Advances the address counter by `COUNT` bytes without emitting any data. Used to reserve space.

**Example:**
```asm
    .ORG 0x10
BUFFER:
    .BYTE 16           ; Reserve 16 bytes for a buffer
    ; Address is now 0x20
```

**Constraints:**
- Requires exactly 1 parameter
- COUNT must be a non-negative number
- Warning if address exceeds 0xFF

### 5.3 `.DB` — Define Bytes

```
.DB VALUE1, VALUE2, ...
```

Emits one or more literal byte values sequentially into memory.

**Example:**
```asm
    .DB 0x48, 0x65, 0x6C, 0x6C, 0x6F   ; "Hello" in ASCII
    .DB 42, 0x2A, 0B00101010            ; All represent the same value
```

**Constraints:**
- Requires at least 1 value
- Each value is truncated to 8 bits (`value & 0xFF`)
- Values outside −128 to 255 produce a warning
- Error if any write exceeds address 0xFF

### 5.4 `.DW` — Define Words

```
.DW VALUE1, VALUE2, ...
```

Emits 16-bit word values in **big-endian** order (high byte first, low byte second).

**Example:**
```asm
    .DW 0x1234    ; Emits: 0x12, 0x34
    .DW 42        ; Emits: 0x00, 0x2A
```

**Constraints:**
- Requires at least 1 value
- Values outside 0–65535 produce a warning
- Error if write exceeds address 0xFF (word spans two bytes, checks addr+1)

### 5.5 `.EQU` — Define Constant

Described in detail in §4.

### 5.6 Unknown Directives

Unrecognized directives produce a warning but do not stop assembly:
```
Unknown assembler directive '.FOO'
```

---

## 6. Number Formats

### 6.1 Recognized Formats

The assembler accepts three numeric literal formats, identified by prefix:

| Prefix | Format | Example | Description |
|---|---|---|---|
| (none) | Decimal | `42`, `255` | Standard decimal integer |
| `0B` or `0b` | Binary | `0B10101010` | Binary literal (after uppercasing) |
| `0X` or `0x` | Hexadecimal | `0xFF`, `0x2A` | Hex literal (after uppercasing) |

### 6.2 Validation Regex

```
Decimal:  ^[0-9]+$
Binary:   ^0B[0-1]+$
Hex:      ^0X([0-9]|[A-F])+$
```

Combined valid number pattern: `^([0-9]+|0B[0-1]+|0X([0-9]|[A-F])+)$`

### 6.3 Usage Context

Numbers are used as:
- Operands to `.EQU`: `.EQU SIZE, 64`
- Arguments to directives: `.DB 0xFF`, `.DW 0x1234`, `.ORG 0x80`
- Immediate values in instructions: `LD R0, 42`
- Address operands: `LD R0, (0xFF)`
- Branch offsets: `JR 5`

### 6.4 Number Parsing

The `parseASMNumber()` function parses a string:

```javascript
function parseASMNumber(string) {
    if (/^0B[0-1]+$/.test(string)) {
        return parseInt(string.slice(2), 2);
    } else if (/^0X([0-9]|[A-F])+$/.test(string)) {
        return parseInt(string.slice(2), 16);
    } else if (/^[0-9]+$/.test(string)) {
        return parseInt(string);
    }
    // Returns undefined if no format matches
}
```

**Note:** Invalid inputs return `undefined` (NaN from parseInt), which triggers error handling in the caller.

---

## 7. Addressing Modes

### 7.1 Operand Syntax Overview

The assembler supports six operand forms for data transfer and I/O instructions:

| Syntax | Addressing Mode | Valid As Source | Valid As Destination |
|---|---|---|---|
| `Rn` | Register Direct | Yes | Yes |
| `(Rn)` | Register Indirect | Yes | Yes |
| `(Rn+)` | Register Indirect with Post-Increment | Yes | Yes |
| `((Rn+))` | Indirect with Pre-Increment | Yes | Yes |
| `n` / `LABEL` | Immediate / Absolute | Yes (as immediate) | Yes (as immediate, stored via PC+) |
| `(n)` / `(LABEL)` | Absolute Address Indirect | Yes | Yes |

Where `Rn` is one of: `R0`, `R1`, `R2`

### 7.2 Register Direct: `Rn`

The value is read from or written to the register itself.

```asm
MOV R0, R1       ; R0 ← R1
ADD R0, R1       ; R0 ← R0 + R1
PUSH R0          ; Push R0 onto stack
POP R1           ; Pop stack into R1
```

**Encoding pattern:** Bits 1–0 encode the register: `00` = R0, `01` = R1, `10` = R2

### 7.3 Register Indirect: `(Rn)`

The value is read from or written to the memory address contained in register Rn.

```asm
LD R0, (R1)      ; R0 ← [R1]
ST (R2), R0      ; [R2] ← R0
```

Rn is not modified after the operation.

**Encoding pattern for source:** `0001_0100 | reg`
**Encoding pattern for destination:** `1111_0100 | reg`

### 7.4 Register Indirect with Post-Increment: `(Rn+)`

The value is read from or written to the memory address contained in Rn, then Rn is incremented by 1.

```asm
LD R0, (R1+)     ; R0 ← [R1]; R1 ← R1 + 1
ST (R2+), R0     ; [R2] ← R0; R2 ← R2 + 1
```

**Encoding pattern for source:** `0001_1000 | reg`
**Encoding pattern for destination:** `1111_1000 | reg`

### 7.5 Indirect with Pre-Increment: `((Rn+))`

Rn is incremented by 1, then the value is read from or written to the memory address **contained in another memory location** pointed to by the new value of Rn. This is a double-indirect addressing mode.

```asm
LD R0, ((R1+))   ; R1 ← R1 + 1; R0 ← [[R1]]
ST ((R2+)), R0   ; R2 ← R2 + 1; [[R2]] ← R0
```

**Encoding pattern for source:** `0001_1100 | reg`
**Encoding pattern for destination:** `1111_1100 | reg`

### 7.6 Immediate: `n` / `LABEL`

A literal byte value or label address is encoded directly in the instruction stream. The processor fetches it via the PC-increment mechanism.

```asm
LD R0, 42           ; R0 ← 42
LD R0, MY_CONSTANT  ; R0 ← address of MY_CONSTANT
JMP DESTINATION     ; PC ← address of DESTINATION
LDSP 0xEF           ; SP ← 0xEF
LDFR 0xFF           ; FLAGS ← 0xFF
```

**How it works:** The assembler emits a `MOV dst, (PC+)` prefix byte (`0xFB` for immediate), followed by the literal byte(s). The processor's microcode reads the next byte via PC increment and uses it as the source operand.

**Multi-byte encoding for MOV/LD/ST with immediate destination:**
```
Byte 1: 0xFB              ; "(PC+)" — load next byte as destination value
Byte 2: immediate_value   ; The literal value
Byte 3: src_encoding      ; The source operand encoding
```

**Multi-byte encoding for JMP immediate:**
```
Byte 1: 0xFB              ; "(PC+)" — load next byte as destination value  
Byte 2: target_address    ; The jump target
Byte 3: 0x13              ; JMP operation code
```

### 7.7 Absolute Address Indirect: `(n)` / `(LABEL)`

The operand is read from or written to the absolute memory address specified.

```asm
LD R0, (0xFF)       ; R0 ← [0xFF] (read from input port FF)
ST (0xF0), R0       ; [0xF0] ← R0 (write to expansion card DAC1)
LD R0, (BUFFER)     ; R0 ← [address of BUFFER]
```

**Encoding:**
- For source `(addr)`: `0001_1111` prefix + address byte (loaded via PC increment)
- For destination `(addr)`: `0xFF` prefix + address byte

### 7.8 Operand Validation Patterns

The assembler validates operands against these patterns:

```
Register direct:        /^R[0-2]$/
Register indirect:      /^\(R[0-2]\)$/
Post-increment:         /^\(R[0-2]\+\)$/
Pre-increment indirect: /^\(\(R[0-2]\+\)\)$/
Absolute indirect:      Starts with '(' and ends with ')', inner is number or label
Immediate:              A bare number or label (not enclosed in parentheses)
```

### 7.9 Restrictions on MOV/LD/ST Operands

For `MOV`, `LD`, and `ST`:
- **Source** may be: Rn, (Rn), (Rn+), ((Rn+)), or (addr)
- **Destination** may be: Rn, (Rn), (Rn+), ((Rn+)), immediate (#n), or (addr)
- `MOV` and `LD` are synonyms (identical behavior)

For `LDSP` and `LDFR`:
- **Source** may be: Rn, (Rn), (Rn+), ((Rn+)), immediate (#n), or (addr)
- Destination is implicitly SP or FLAGS

---

## 8. Instruction Reference

### 8.1 Notation

- `Rd`, `Rs` — Destination/source register: `R0`, `R1`, or `R2`
- `dd`, `ss` — 2-bit register encoding: `00`=R0, `01`=R1, `10`=R2
- `n` — Immediate value or address (8-bit)
- `offset` — Signed 8-bit relative branch offset
- `(addr)` — Absolute memory address
- `[X]` — Contents of memory at address X

### 8.2 Arithmetic Instructions

#### ADD — Add
```
ADD Rd, Rs    ; Rd ← Rd + Rs
```
| | |
|---|---|
| **Encoding** | `0110_0ssd_d` (1 byte) |
| **Flags** | NF, ZF, CF updated |
| **Description** | Signed 8-bit addition. CF = carry out of adder. |

#### ADC — Add with Carry
```
ADC Rd, Rs    ; Rd ← Rd + Rs + CF
```
| | |
|---|---|
| **Encoding** | `0111_0ssd_d` (1 byte) |
| **Flags** | NF, ZF, CF updated |
| **Description** | Signed addition with carry-in. CF = carry out of adder. |

#### SUB — Subtract
```
SUB Rd, Rs    ; Rd ← Rd - Rs
```
| | |
|---|---|
| **Encoding** | `1000_0ssd_d` (1 byte) |
| **Flags** | NF, ZF, CF updated |
| **Description** | Signed subtraction. Implemented as Rd + ¬Rs + 1 in the ALU. CF = ¬Ca (borrow). |

#### MUL — Multiply
```
MUL Rd, Rs    ; Rd ← Rd × Rs (signed)
```
| | |
|---|---|
| **Encoding** | `1011_0ssd_d` (1 byte) |
| **Flags** | NF, ZF, CF updated |
| **Description** | Signed 8-bit multiplication. Result truncated to 8 bits. |

#### DIV — Divide
```
DIV Rd, Rs    ; Rd ← Rd ÷ Rs (signed)
```
| | |
|---|---|
| **Encoding** | `1100_0ssd_d` (1 byte) |
| **Flags** | NF, ZF, CF updated |
| **Description** | Signed 8-bit division. Result truncated to 8 bits. |

### 8.3 Logic Instructions

#### AND — Bitwise AND
```
AND Rd, Rs    ; Rd ← Rd ∧ Rs
```
| | |
|---|---|
| **Encoding** | `1001_0ssd_d` (1 byte) |
| **Flags** | NF, ZF updated; CF unaffected |

#### OR — Bitwise OR
```
OR Rd, Rs     ; Rd ← Rd ∨ Rs
```
| | |
|---|---|
| **Encoding** | `1010_0ssd_d` (1 byte) |
| **Flags** | NF, ZF updated; CF unaffected |

#### XOR — Bitwise XOR
```
XOR Rd, Rs    ; Rd ← Rd ⊕ Rs
```
| | |
|---|---|
| **Encoding** | `1101_0ssd_d` (1 byte) |
| **Flags** | NF, ZF updated; CF unaffected |

#### COM — Complement (Bitwise NOT)
```
COM Rd        ; Rd ← ¬Rd
```
| | |
|---|---|
| **Encoding** | `0011_00dd` (1 byte) |
| **Flags** | NF, ZF updated; CF = 0 |
| **Description** | Implemented via ALU NOR with A=B. |

#### NEG — Negate (Two's Complement)
```
NEG Rd        ; Rd ← -Rd
```
| | |
|---|---|
| **Encoding** | `0011_01dd` (1 byte) |
| **Flags** | NF, ZF, CF updated |

### 8.4 Shift and Rotate Instructions

#### LSR — Logical Shift Right
```
LSR Rd        ; Rd ← Rd >> 1 (MSB ← 0)
```
| | |
|---|---|
| **Encoding** | `0011_10dd` (1 byte) |
| **Flags** | NF, ZF, CF updated; CF ← old bit 0 |

#### ASR — Arithmetic Shift Right
```
ASR Rd        ; Rd ← Rd >> 1 (MSB preserved)
```
| | |
|---|---|
| **Encoding** | `0011_11dd` (1 byte) |
| **Flags** | NF, ZF, CF updated; CF ← old bit 0 |

#### LSL — Logical Shift Left
```
LSL Rd        ; Rd ← Rd << 1 (LSB ← 0)
```
| | |
|---|---|
| **Encoding** | `0110_00dd` (1 byte, same as ADD Rd,Rd) |
| **Flags** | NF, ZF, CF updated; CF ← old bit 7 |
| **Description** | Implemented as ADD Rd,Rd (Rd + Rd = 2×Rd = shift left). |

#### RRC — Rotate Right through Carry
```
RRC Rd        ; Rd ← (CF << 7) | (Rd >> 1); CF ← old bit 0
```
| | |
|---|---|
| **Encoding** | `0100_00dd` (1 byte) |
| **Flags** | NF, ZF, CF updated |

#### RLC — Rotate Left through Carry
```
RLC Rd        ; Rd ← (Rd << 1) | CF; CF ← old bit 7
```
| | |
|---|---|
| **Encoding** | `0111_00dd` (1 byte, same as ADC Rd,Rd) |
| **Flags** | NF, ZF, CF updated |
| **Description** | Implemented as ADC Rd,Rd (Rd + Rd + CF). |

### 8.5 Unary Register Instructions

#### INC — Increment
```
INC Rd        ; Rd ← Rd + 1
```
| | |
|---|---|
| **Encoding** | `0100_01dd` (1 byte) |
| **Flags** | NF, ZF, CF updated |

#### DEC — Decrement
```
DEC Rd        ; Rd ← Rd - 1
```
| | |
|---|---|
| **Encoding** | `0101_00dd` (1 byte) |
| **Flags** | NF, ZF, CF updated |

**Special form — DEC with immediate/address:**
```
DEC n        ; Decrement immediate value (encoded as: 0x5F + n)
DEC (addr)   ; Decrement value at address (encoded as: 0x5F + addr)
```
| | |
|---|---|
| **Encoding** | `0101_1111` + value/address byte (2 bytes) |

#### TST — Test
```
TST Rd        ; Set flags based on Rd (Rd unchanged)
```
| | |
|---|---|
| **Encoding** | `0100_10dd` (1 byte) |
| **Flags** | NF, ZF updated |
| **Description** | Passes Rd through ALU (F=Rd) and sets NF, ZF. Does not modify Rd. |

#### CLR — Clear
```
CLR Rd        ; Rd ← 0
```
| | |
|---|---|
| **Encoding** | `0000_01dd` (1 byte) |
| **Flags** | ZF = 1, NF = 0, CF = 0 |

### 8.6 Bit Test Instructions

#### BITS — Bit Set Test
```
BITS Rd, Rs   ; Test if bits set in Rs are also set in Rd
```
| | |
|---|---|
| **Encoding** | `0101_00dd` + `0101_00ss` (2 bytes) |
| **Flags** | NF, ZF updated |

#### BITC — Bit Clear Test
```
BITC Rd, Rs   ; Test if bits set in Rs are clear in Rd
```
| | |
|---|---|
| **Encoding** | `0110_00dd` + `0110_00ss` (2 bytes) |
| **Flags** | NF, ZF updated |

#### BITT — Bit Test
```
BITT Rd, Rs   ; Bit test
```
| | |
|---|---|
| **Encoding** | `0011_00dd` + `0011_00ss` (2 bytes) |
| **Flags** | NF, ZF updated |

#### CMP — Compare
```
CMP Rd, Rs    ; Compare Rd with Rs (Rd - Rs, flags only)
```
| | |
|---|---|
| **Encoding** | `0010_00dd` + `0010_00ss` (2 bytes) |
| **Flags** | NF, ZF, CF updated |
| **Description** | Performs subtraction Rd - Rs but discards the result. Only updates flags (like SUB without write-back). |

### 8.7 Data Transfer Instructions

#### MOV — Move
```
MOV dst, src    ; dst ← src
```
| | |
|---|---|
| **Encoding** | 2–3 bytes (see §7 and §10) |
| **Description** | Copies data from src to dst. Synonym for LD. |

#### LD — Load
```
LD dst, src     ; dst ← src
```
| | |
|---|---|
| **Encoding** | 2–3 bytes (see §7 and §10) |
| **Description** | Exact synonym for MOV. |

#### ST — Store
```
ST dst, src     ; dst ← src
```
| | |
|---|---|
| **Encoding** | 2–3 bytes |
| **Description** | Same as MOV but with reversed operand semantics. The src is stored to dst. For `ST (addr), Rn`, the encoding is: `0xFF` + addr + src byte. |

#### LDSP — Load Stack Pointer
```
LDSP src        ; SP ← src
```
| | |
|---|---|
| **Encoding** | dst_encoding + `0100_0000` (2–3 bytes) |
| **Description** | Loads the stack pointer (Register 5) from the source operand. |

#### LDFR — Load Flags Register
```
LDFR src        ; FLAGS ← src
```
| | |
|---|---|
| **Encoding** | dst_encoding + `0100_0100` (2–3 bytes) |
| **Description** | Loads the flags register (Register 4) from the source operand. |

#### PUSH — Push to Stack
```
PUSH Rs         ; [SP] ← Rs; SP ← SP - 1
```
| | |
|---|---|
| **Encoding** | `0001_00ss` (1 byte) |
| **Description** | Pushes register Rs onto the stack and decrements SP. |

#### POP — Pop from Stack
```
POP Rd          ; SP ← SP + 1; Rd ← [SP]
```
| | |
|---|---|
| **Encoding** | `0001_01dd` (1 byte) |
| **Description** | Increments SP, then pops the top of stack into Rd. |

#### PUSHF — Push Flags
```
PUSHF           ; [SP] ← FLAGS; SP ← SP - 1
```
| | |
|---|---|
| **Encoding** | `0001_1000` (1 byte) |
| **Description** | Pushes the FLAGS register onto the stack. |

#### POPF — Pop Flags
```
POPF            ; SP ← SP + 1; FLAGS ← [SP]
```
| | |
|---|---|
| **Encoding** | `0001_1100` (1 byte) |
| **Description** | Pops the FLAGS register from the stack. |

### 8.8 Control Flow Instructions

#### JMP — Jump
```
JMP target          ; PC ← target (absolute)
JMP (target)        ; PC ← [target] (indirect)
```
| | |
|---|---|
| **Encoding** | 3 bytes (see §7.6) |
| **Description** | Absolute or indirect unconditional jump. |

**Absolute encoding:**
```
Byte 1: 0xFB          ; (PC+) — load next byte as target
Byte 2: target_addr   ; The absolute jump target
Byte 3: 0x13          ; JMP opcode
```

**Indirect encoding:**
```
Byte 1: 0xFF          ; ((PC+)) — load next byte, then indirect through it
Byte 2: addr          ; Address containing the target
Byte 3: 0x13          ; JMP opcode
```

#### JR — Jump Relative
```
JR offset       ; PC ← PC + 1 + offset (relative, unconditional)
```
| | |
|---|---|
| **Encoding** | `0010_0000` + signed_offset (2 bytes) |
| **Description** | Relative unconditional jump. offset is an 8-bit signed value (−128 to +127). |

#### JCS / JCC — Jump if Carry Set / Clear
```
JCS offset      ; If CF=1: PC ← PC + 1 + offset
JCC offset      ; If CF=0: PC ← PC + 1 + offset
```
| | |
|---|---|
| **Encoding** | `0010_0001` / `0010_0101` + signed_offset (2 bytes) |

#### JZS / JZC — Jump if Zero Set / Clear
```
JZS offset      ; If ZF=1: PC ← PC + 1 + offset
JZC offset      ; If ZF=0: PC ← PC + 1 + offset
```
| | |
|---|---|
| **Encoding** | `0010_0010` / `0010_0110` + signed_offset (2 bytes) |

#### JNS / JNC — Jump if Negative Set / Clear
```
JNS offset      ; If NF=1: PC ← PC + 1 + offset
JNC offset      ; If NF=0: PC ← PC + 1 + offset
```
| | |
|---|---|
| **Encoding** | `0010_0011` / `0010_0111` + signed_offset (2 bytes) |

#### CALL — Call Subroutine
```
CALL addr       ; [SP] ← PC+2; SP ← SP-1; PC ← addr
```
| | |
|---|---|
| **Encoding** | `0010_1000` + addr (2 bytes) |
| **Description** | Pushes return address (PC+2) onto stack, then jumps to addr. |

#### RET — Return from Subroutine
```
RET             ; SP ← SP+1; PC ← [SP]
```
| | |
|---|---|
| **Encoding** | `0001_0111` (1 byte) |
| **Description** | Pops return address from stack into PC. |

#### RETI — Return from Interrupt
```
RETI            ; Return from interrupt handler
```
| | |
|---|---|
| **Encoding** | `0010_1100` (1 byte) |
| **Description** | Pops PC and FLAGS from stack, re-enables interrupts. |

### 8.9 System Instructions

#### EI — Enable Interrupts
```
EI              ; IEF ← 1, IFF1 ← 1
```
| | |
|---|---|
| **Encoding** | `0000_1000` (1 byte) |

#### DI — Disable Interrupts
```
DI              ; IEF ← 0, IFF1 ← 0
```
| | |
|---|---|
| **Encoding** | `0000_1100` (1 byte) |

#### STOP — Halt Execution
```
STOP            ; Halt the processor
```
| | |
|---|---|
| **Encoding** | `0000_0001` (1 byte) |

#### NOP — No Operation
```
NOP             ; Do nothing
```
| | |
|---|---|
| **Encoding** | `0000_0010` (1 byte) |

---

## 9. Two-Pass Assembly Process

### 9.1 Pass 1: Label Collection

1. Read all lines, strip comments and whitespace, convert to uppercase
2. Drop empty lines
3. For each directive line:
   - `.EQU`: Parse name and value. If name is valid, not reserved, and not already defined, store in `labels` map
4. For each label line (ends with `:`):
   - Validate label name (no conflicts, valid format)
   - Check for duplicate definitions
   - Store in `labels` map with value `null` (placeholder, to be filled in pass 2)
   - Error if any other tokens exist on the same line

### 9.2 Pass 2: Code Generation

1. Reset address counter to 0
2. For each line:
   - **Label line:** Record the current address as the label's value: `labels[name] = addr`
   - **Directive:**
     - `.ORG n`: Set `addr = n`
     - `.BYTE n`: `addr += n`
     - `.DB v1, v2, ...`: Emit each byte at `addr`, increment `addr`
     - `.DW v1, v2, ...`: Emit each word (2 bytes, big-endian) at `addr`, increment `addr` by 2
     - `.EQU`: Already processed in pass 1; skip (re-evaluated for consistency)
   - **Instruction line:** Emit the instruction bytes (1–3 bytes) at the current `addr`, advance `addr` accordingly

### 9.3 Label Resolution

After pass 2, the `output` array may contain string placeholders for unresolved labels. A final pass replaces each string with its resolved value:

```javascript
for (let index = 0; index < output.length; index++) {
    const exec = output[index];
    if (typeof exec == "string") {
        if (labels[exec] !== undefined) {
            if (labels[exec] === null) {
                error("Label was never assigned an address");
                return;
            }
            // For relative branches (JR, JCS, etc.), compute relative offset
            if ((output[index - 1] & 0b11111000) == 0b00100000) {
                value = labels[exec] - (index + 1);  // Relative from byte after offset
                if (value < -128 || value > 127) {
                    warn("Relative branch offset out of range, wrapping to 8-bit");
                }
            } else {
                value = labels[exec];  // Absolute address
            }
            value = value < 0 ? value + 256 : value;  // Wrap negative to unsigned
            output[index] = value;
        } else {
            error("Unknown label or constant");
            return;
        }
    }
}
```

**Relative branch offset computation:**
- `target_address = (index + 1) + offset` where `index + 1` is the address of the byte **after** the offset byte
- Therefore: `offset = target_address - (index + 1)`
- Offset is signed 8-bit (−128 to +127). Negative offsets are wrapped to unsigned (e.g., −1 becomes 255 = 0xFF)

### 9.4 Final Output

The completed `output` array is returned. At the call site, it is padded to 240 bytes (addresses `0x00`–`0xEF`):
```javascript
for (let index = 0; index < 0xEF + 1; index++) {
    if (tram[index] === undefined) {
        tram[index] = 0;
    }
}
```

---

## 10. Error and Warning Messages

### 10.1 Errors (prevent code generation)

| Message | Condition |
|---|---|
| `No valid asm file` | First line is not `#! mrasm` |
| `Unexpected whitespace before ',' or ':'` | Space before comma or colon in source line |
| `.EQU requires exactly 2 parameters` | `.EQU` with wrong number of arguments |
| `Invalid label name 'X'` | Label name doesn't match `^[A-Z_][A-Z0-9_]*$` |
| `Invalid label name 'X' - conflicts with register name` | Label starts with `R` + digit, or is `PC` |
| `Label name 'X' conflicts with instruction mnemonic` | Label name is a reserved instruction word |
| `Duplicate label/EQU definition 'X'` | Same name defined twice |
| `No tokens allowed on same line as label 'X'` | Label line has additional tokens |
| `.ORG requires exactly 1 parameter` | `.ORG` with wrong number of arguments |
| `.ORG value X is out of range (0-255)` | `.ORG` address not 0–255 |
| `.BYTE requires exactly 1 parameter` | `.BYTE` with wrong number of arguments |
| `.BYTE value X must be a non-negative number` | `.BYTE` count is negative or NaN |
| `.DB requires at least 1 parameter` | `.DB` with no values |
| `.DB value 'X' is not a valid number` | `.DB` value cannot be parsed |
| `.DB write at address X exceeds memory limit` | Writing past 0xFF |
| `.DW requires at least 1 parameter` | `.DW` with no values |
| `.DW value 'X' is not a valid number` | `.DW` value cannot be parsed |
| `.DW write at address X exceeds memory limit` | Writing past 0xFF |
| `X requires exactly N parameters` | Wrong operand count for instruction |
| `X - expected register R0-R2, got 'Y'` | Non-register where register required |
| `X - invalid destination/source 'Y'` | Invalid addressing mode syntax |
| `X - target 'Y' is not a valid label or number` | Branch/jump target is invalid |
| `Unknown instruction 'X'` | Unrecognized mnemonic |
| `Unknown label or constant: 'X'` | Referenced label was never defined |
| `Label 'X' was never assigned an address` | Label remained null after pass 2 |
| `X takes no parameters` | Instruction with no operands got operands |

### 10.2 Warnings (do not prevent code generation)

| Message | Condition |
|---|---|
| `.BYTE advances address past 0xFF` | `.BYTE` causes address to exceed 255 |
| `.DB value X is out of byte range (−128-255), truncated` | `.DB` value outside −128..255 |
| `.DW value X is out of word range (0-65535), truncated` | `.DW` value outside 0..65535 |
| `Relative branch to label 'X' is out of range (offset Y); wrapping to 8-bit` | Branch offset outside −128..127 |
| `Unknown assembler directive '.X'` | Unrecognized directive |

---

## 11. Opcode Encoding Reference

### 11.1 Register-Register ALU Instructions (1 byte)

```
Format: oooo_0ssd_d

oooo  = opcode group (bits 7–4)
ss    = source register (bits 3–2): 00=R0, 01=R1, 10=R2
dd    = destination register (bits 1–0): 00=R0, 01=R1, 10=R2
```

| Instruction | oooo | ss | dd | Binary | Hex |
|---|---|---|---|---|---|
| ADD R0,R0 | 0110 | 00 | 00 | `0110_0000` | `0x60` |
| ADD R0,R1 | 0110 | 01 | 00 | `0110_0100` | `0x64` |
| ADD R0,R2 | 0110 | 10 | 00 | `0110_1000` | `0x68` |
| ADD R1,R0 | 0110 | 00 | 01 | `0110_0001` | `0x61` |
| ADD R1,R1 | 0110 | 01 | 01 | `0110_0101` | `0x65` |
| ADD R1,R2 | 0110 | 10 | 01 | `0110_1001` | `0x69` |
| ADD R2,R0 | 0110 | 00 | 10 | `0110_0010` | `0x62` |
| ADD R2,R1 | 0110 | 01 | 10 | `0110_0110` | `0x66` |
| ADD R2,R2 | 0110 | 10 | 10 | `0110_1010` | `0x6A` |

The same pattern applies to **ADC** (0111), **SUB** (1000), **AND** (1001), **OR** (1010), **MUL** (1011), **DIV** (1100), **XOR** (1101).

### 11.2 Unary Register Instructions (1 byte)

```
Format: oooo_oOdd

oooo_o = opcode group (bits 7–3)
Odd    = register select extension
dd     = destination register

Note: For LSL and RLC, the encoding overlaps with ADD/ADC
where ss=dd (same register for both operands).
```

| Instruction | Encoding (binary) | Hex (R0/R1/R2) |
|---|---|---|
| CLR Rd | `0000_01dd` | `0x04` / `0x05` / `0x06` |
| COM Rd | `0011_00dd` | `0x30` / `0x31` / `0x32` |
| NEG Rd | `0011_01dd` | `0x34` / `0x35` / `0x36` |
| LSR Rd | `0011_10dd` | `0x38` / `0x39` / `0x3A` |
| ASR Rd | `0011_11dd` | `0x3C` / `0x3D` / `0x3E` |
| RRC Rd | `0100_00dd` | `0x40` / `0x41` / `0x42` |
| INC Rd | `0100_01dd` | `0x44` / `0x45` / `0x46` |
| TST Rd | `0100_10dd` | `0x48` / `0x49` / `0x4A` |
| DEC Rd | `0101_00dd` | `0x50` / `0x51` / `0x52` |
| LSL Rd | `0110_00dd` (ADD Rd,Rd) | `0x60` / `0x65` / `0x6A` |
| RLC Rd | `0111_00dd` (ADC Rd,Rd) | `0x70` / `0x75` / `0x7A` |

### 11.3 Stack Instructions (1 byte)

| Instruction | Encoding | Hex |
|---|---|---|
| PUSH R0 | `0001_0000` | `0x10` |
| PUSH R1 | `0001_0001` | `0x11` |
| PUSH R2 | `0001_0010` | `0x12` |
| POP R0 | `0001_0100` | `0x14` |
| POP R1 | `0001_0101` | `0x15` |
| POP R2 | `0001_0110` | `0x16` |
| PUSHF | `0001_1000` | `0x18` |
| POPF | `0001_1100` | `0x1C` |
| RET | `0001_0111` | `0x17` |

### 11.4 System Instructions (1 byte)

| Instruction | Encoding | Hex |
|---|---|---|
| STOP | `0000_0001` | `0x01` |
| NOP | `0000_0010` | `0x02` |
| EI | `0000_1000` | `0x08` |
| DI | `0000_1100` | `0x0C` |
| RETI | `0010_1100` | `0x2C` |

### 11.5 Branch Instructions (2 bytes)

```
Byte 1: 0010_0ccc
  ccc = condition code:
    000 = JR  (always)
    001 = JCS (CF=1)
    010 = JZS (ZF=1)
    011 = JNS (NF=1)
    101 = JCC (CF=0)
    110 = JZC (ZF=0)
    111 = JNC (NF=0)

Byte 2: signed 8-bit offset from next instruction
```

| Instruction | Byte 1 | Example (offset=0) |
|---|---|---|
| JR | `0x20` | `0x20 0x00` |
| JCS | `0x21` | `0x21 0x00` |
| JZS | `0x22` | `0x22 0x00` |
| JNS | `0x23` | `0x23 0x00` |
| JCC | `0x25` | `0x25 0x00` |
| JZC | `0x26` | `0x26 0x00` |
| JNC | `0x27` | `0x27 0x00` |

### 11.6 CALL Instruction (2 bytes)

```
Byte 1: 0010_1000  = 0x28
Byte 2: absolute target address
```

### 11.7 DEC with Immediate/Address (2 bytes)

```
Byte 1: 0101_1111  = 0x5F
Byte 2: immediate value or address
```

### 11.8 MOV/LD/ST Prefix Bytes for Source Operands

These bytes encode the source operand of a data transfer instruction:

| Source | Encoding (bits 7–4 = instruction, bits 3–0 = mode+reg) |
|---|---|
| Rn | `0001_00ss` (0x10/0x11/0x12) |
| (Rn) | `0001_01ss` (0x14/0x15/0x16) |
| (Rn+) | `0001_10ss` (0x18/0x19/0x1A) |
| ((Rn+)) | `0001_11ss` (0x1C/0x1D/0x1E) |
| (addr) | `0001_1111` = `0x1F` + address byte |
| #n (immediate) | `1111_1011` = `0xFB` + value byte |

For **BITS** the instruction prefix is `0101`:
| Source | Encoding |
|---|---|
| Rn | `0101_00ss` |
| (Rn) | `0101_01ss` |
| (Rn+) | `0101_10ss` |
| ((Rn+)) | `0101_11ss` |
| (addr) | `0101_1111` |

For **BITC** the instruction prefix is `0110`:
| Source | Encoding |
|---|---|
| Rn | `0110_00ss` |
| (Rn) | `0110_01ss` |
| (Rn+) | `0110_10ss` |
| ((Rn+)) | `0110_11ss` |
| (addr) | `0110_1111` |

For **CMP** the instruction prefix is `0010`:
| Source | Encoding |
|---|---|
| Rn | `0010_00ss` |
| ... | (same pattern) |

For **BITT** the instruction prefix is `0011`:
| Source | Encoding |
|---|---|
| Rn | `0011_00ss` |
| ... | (same pattern) |

### 11.9 MOV/LD/ST Prefix Bytes for Destination Operands

These bytes encode the destination operand of a data transfer instruction:

| Destination | Encoding |
|---|---|
| Rn | `1111_00dd` (0xF0/0xF1/0xF2) |
| (Rn) | `1111_01dd` (0xF4/0xF5/0xF6) |
| (Rn+) | `1111_10dd` (0xF8/0xF9/0xFA) |
| ((Rn+)) | `1111_11dd` (0xFC/0xFD/0xFE) |
| (addr) | `1111_1111` = `0xFF` + address byte |
| #n (immediate) | `1111_1011` = `0xFB` + value byte |

### 11.10 LDSP / LDFR Postfix Bytes

After the destination encoding, these bytes specify the target special register:

| Instruction | Postfix Byte |
|---|---|
| LDSP | `0100_0000` = `0x40` |
| LDFR | `0100_0100` = `0x44` |

### 11.11 JMP Postfix Byte

After the target address encoding, the JMP opcode byte:
```
0001_0011 = 0x13
```

---

## 12. Complete Opcode Map (by Binary Encoding)

```
Opcode[7:0]  Instruction    Operands
-----------  -----------    --------
0000 0000    (reserved)     -
0000 0001    STOP           -
0000 0010    NOP            -
0000 01dd    CLR            Rd
0000 1000    EI             -
0000 1100    DI             -
0001 00ss    PUSH           Rs
0001 00dd    (MOV/LD src prefix: Rn)
0001 01dd    POP            Rd
0001 01ss    (MOV/LD src prefix: (Rn))
0001 0111    RET            -
0001 10ss    (MOV/LD src prefix: (Rn+))
0001 1000    PUSHF          -
0001 11ss    (MOV/LD src prefix: ((Rn+)))
0001 1100    POPF           -
0001 1111    (MOV/LD src prefix: (addr))    + addr byte
0010 0000    JR             offset          + offset byte
0010 0001    JCS            offset          + offset byte
0010 0010    JZS            offset          + offset byte
0010 0011    JNS            offset          + offset byte
0010 0101    JCC            offset          + offset byte
0010 0110    JZC            offset          + offset byte
0010 0111    JNC            offset          + offset byte
0010 1000    CALL           addr            + addr byte
0010 1100    RETI           -
0010 00dd    (CMP src prefix: Rn)
0010 01ss    (CMP src prefix: (Rn))
0010 10ss    (CMP src prefix: (Rn+))
0010 11ss    (CMP src prefix: ((Rn+)))
0011 0000    COM            R0
0011 0001    COM            R1
0011 0010    COM            R2
0011 00dd    (BITT src prefix: Rn)
0011 0100    NEG            R0
0011 0101    NEG            R1
0011 0110    NEG            R2
0011 1000    LSR            R0
0011 1001    LSR            R1
0011 1010    LSR            R2
0011 1100    ASR            R0
0011 1101    ASR            R1
0011 1110    ASR            R2
0100 0000    RRC            R0
0100 0001    RRC            R1
0100 0010    RRC            R2
0100 0100    INC            R0
0100 0101    INC            R1
0100 0110    INC            R2
0100 1000    TST            R0
0100 1001    TST            R1
0100 1010    TST            R2
0101 0000    DEC            R0
0101 0001    DEC            R1
0101 0010    DEC            R2
0101 00ss    (BITS src prefix: Rn)
0101 01ss    (BITS src prefix: (Rn))
0101 10ss    (BITS src prefix: (Rn+))
0101 11ss    (BITS src prefix: ((Rn+)))
0101 1111    DEC            #n / (addr)     + value/addr byte
0110 0ssdd   ADD            Rd, Rs
0110 00dd    LSL            Rd              (ADD Rd,Rd)
0110 00ss    (BITC src prefix: Rn)
0110 01ss    (BITC src prefix: (Rn))
0110 10ss    (BITC src prefix: (Rn+))
0110 11ss    (BITC src prefix: ((Rn+)))
0111 0ssdd   ADC            Rd, Rs
0111 00dd    RLC            Rd              (ADC Rd,Rd)
1000 0ssdd   SUB            Rd, Rs
1001 0ssdd   AND            Rd, Rs
1010 0ssdd   OR             Rd, Rs
1011 0ssdd   MUL            Rd, Rs
1100 0ssdd   DIV            Rd, Rs
1101 0ssdd   XOR            Rd, Rs
1111 00dd    (MOV/LD/ST dst prefix: Rn)
1111 01dd    (MOV/LD/ST dst prefix: (Rn))
1111 10dd    (MOV/LD/ST dst prefix: (Rn+))
1111 11dd    (MOV/LD/ST dst prefix: ((Rn+)))
1111 1011    (MOV/LD/ST/JMP dst prefix: #n/(PC+))  + value byte
1111 1111    (MOV/LD/ST/JMP dst prefix: (addr))     + addr byte
0001 0011    (JMP opcode postfix)           + follows target encoding
0100 0000    (LDSP opcode postfix)          + follows src encoding
0100 0100    (LDFR opcode postfix)          + follows src encoding
```

---

## 13. Assembly Examples

### 13.1 Simple Addition

```asm
#! mrasm
    LD R0, (0xFE)    ; Load first input
    LD R1, (0xFF)    ; Load second input
    ADD R0, R1       ; Add them together
    ST (0xFF), R0    ; Store result to output
    ST (0xF0), R0    ; Also send to DAC1
    STOP

; test-result: FF FC 10 FF FD 11 64 F0 1F FF F0 1F F0 01
```

### 13.2 Fibonacci Sequence (Iterative)

```asm
#! mrasm
    ; Input: 0xFF = N
    ; Output: 0xFF = Fib(N)
    
    LD R0, (0xFF)    ; R0 = N
    CLR R1           ; R1 = 0 (Fib(0))
    LD R2, 1         ; R2 = 1 (Fib(1))
    
    TST R0           ; Check if N=0
    JZS DONE         ; If so, result is 0
    
LOOP:
    DEC R0
    JZS DONE         ; If N decrements to 0, done
    MOV R0, R1       ; Swap: new R1 = old R2
    ADD R2, R1       ; R2 = R2 + R1
    JR LOOP
    
DONE:
    ST (0xFF), R2    ; Output result
    STOP
```

### 13.3 Using Labels, .EQU, and .ORG

```asm
#! mrasm
    .EQU OUTPUT_PORT, 0xFF
    .EQU DAC1, 0xF0
    .EQU DELAY_COUNT, 10
    
    .ORG 0x00
START:
    LDSP 0xEF        ; Initialize stack pointer
    CLR R0
    
MAIN_LOOP:
    INC R0
    ST (DAC1), R0    ; Write to DAC1 (using .EQU constant)
    ST (OUTPUT_PORT), R0  ; Also write to output
    CALL DELAY
    JR MAIN_LOOP
    
DELAY:
    PUSH R1
    LD R1, DELAY_COUNT
DELAY_LOOP:
    DEC R1
    JZS DELAY_DONE
    JR DELAY_LOOP
DELAY_DONE:
    POP R1
    RET

; test-result: FB EF 40 04 44 F0 1F F0 F0 1F FF 28 10 10 FB 0A 11 51 22 1E 20 FC 14 17
```

### 13.4 All Addressing Modes

```asm
#! mrasm
    LD R0, 42             ; Immediate
    LD R1, (0xFC)         ; Absolute indirect (input port)
    LD R2, (R0)           ; Register indirect
    LD R2, (R0+)          ; Register indirect with post-increment
    LD R2, ((R0+))        ; Indirect with pre-increment
    
    ST (0xFF), R0         ; Store to absolute address
    ST (R1), R2           ; Store to register indirect
    ST (R1+), R2          ; Store to reg indirect with post-increment
    ST ((R1+)), R2        ; Store to indirect with pre-increment
    
    MOV R0, R1            ; Register to register
    STOP
```

### 13.5 Conditional Branching

```asm
#! mrasm
    LD R0, (0xFC)        ; Load value to test
    
    TST R0               ; Test R0, set flags
    JZS IS_ZERO          ; Branch if zero
    JNS IS_NEGATIVE      ; Branch if negative
    
    ; Value is positive
    ST (0xFF), 1
    STOP
    
IS_ZERO:
    ST (0xFF), 0
    STOP
    
IS_NEGATIVE:
    ST (0xFF), 0xFF      ; Output -1
    STOP
```

### 13.6 Interrupt Handling

```asm
#! mrasm
    .ORG 0x00
    JR INIT              ; Reset vector
    JR ISR               ; Interrupt vector (address 0x02)
    
    .ORG 0x10
INIT:
    LDSP 0xEF            ; Set up stack
    EI                   ; Enable interrupts
    
MAIN:
    INC R0
    ST (0xF0), R0        ; Update DAC1 continuously
    JR MAIN
    
ISR:
    PUSHF                ; Save flags
    PUSH R0              ; Save R0
    LD R0, (0xF1)        ; Read expansion status
    ST (0xFF), R0        ; Echo to output
    POP R0               ; Restore R0
    POPF                 ; Restore flags
    RETI                 ; Return from interrupt
```

---

## 14. Test Result Format

### 14.1 Syntax

Assembly test files may end with a special comment line specifying the expected assembler output:

```
; test-result: HEX_BYTES
```

or:

```
; test-result: false
```

### 14.2 Expected Bytes

When the test-result is a hex string, it lists the expected contents of DPRAM (addresses `0x00`–`0xEF`). Bytes are space-separated hex values. The test framework pads the expected output to 240 bytes with `0x00`.

Example:
```
; test-result: 04 FB 01 11 64 74 84 B4 C4 44 50 34 94 A4 D4 30
```

### 14.3 Expected Failure

When the test-result is `false`, the assembler is expected to return `false` (indicating an error was detected during assembly). This is used to test error handling:

```
; test-result: false
```

### 14.4 Empty Output

An empty test-result means the expected output is all zeros (240 bytes of `0x00`). This is used for minimal valid programs that produce no code:

```
; test-result: 
```

---

## Appendix A: Instruction Quick Reference (Alphabetical)

| Instruction | Operands | Bytes | Description |
|---|---|---|---|
| ADC | Rd, Rs | 1 | Add with carry |
| ADD | Rd, Rs | 1 | Add |
| AND | Rd, Rs | 1 | Bitwise AND |
| ASR | Rd | 1 | Arithmetic shift right |
| BITC | Rd, Rs | 2 | Bit clear test |
| BITS | Rd, Rs | 2 | Bit set test |
| BITT | Rd, Rs | 2 | Bit test |
| CALL | addr | 2 | Call subroutine |
| CLR | Rd | 1 | Clear register (set to 0) |
| CMP | Rd, Rs | 2 | Compare (subtract, set flags only) |
| COM | Rd | 1 | Complement (bitwise NOT) |
| DEC | Rd | 1 | Decrement register |
| DEC | #n / (addr) | 2 | Decrement immediate/address |
| DI | — | 1 | Disable interrupts |
| DIV | Rd, Rs | 1 | Signed divide |
| EI | — | 1 | Enable interrupts |
| INC | Rd | 1 | Increment register |
| JCC | offset | 2 | Jump if carry clear |
| JCS | offset | 2 | Jump if carry set |
| JMP | addr | 3 | Absolute jump |
| JMP | (addr) | 3 | Indirect jump |
| JNC | offset | 2 | Jump if negative clear |
| JNS | offset | 2 | Jump if negative set |
| JR | offset | 2 | Jump relative (unconditional) |
| JZC | offset | 2 | Jump if zero clear |
| JZS | offset | 2 | Jump if zero set |
| LD | dst, src | 2–3 | Load (synonym for MOV) |
| LDFR | src | 2–3 | Load flags register |
| LDSP | src | 2–3 | Load stack pointer |
| LSL | Rd | 1 | Logical shift left |
| LSR | Rd | 1 | Logical shift right |
| MOV | dst, src | 2–3 | Move data |
| MUL | Rd, Rs | 1 | Signed multiply |
| NEG | Rd | 1 | Negate (two's complement) |
| NOP | — | 1 | No operation |
| OR | Rd, Rs | 1 | Bitwise OR |
| POP | Rd | 1 | Pop from stack |
| POPF | — | 1 | Pop flags from stack |
| PUSH | Rs | 1 | Push to stack |
| PUSHF | — | 1 | Push flags to stack |
| RET | — | 1 | Return from subroutine |
| RETI | — | 1 | Return from interrupt |
| RLC | Rd | 1 | Rotate left through carry |
| RRC | Rd | 1 | Rotate right through carry |
| ST | dst, src | 2–3 | Store |
| STOP | — | 1 | Halt execution |
| SUB | Rd, Rs | 1 | Subtract |
| TST | Rd | 1 | Test (set flags) |
| XOR | Rd, Rs | 1 | Bitwise XOR |

## Appendix B: Directive Quick Reference

| Directive | Syntax | Description |
|---|---|---|
| .EQU | `.EQU NAME, VALUE` | Define symbolic constant |
| .ORG | `.ORG ADDRESS` | Set assembly address counter |
| .BYTE | `.BYTE COUNT` | Reserve COUNT bytes |
| .DB | `.DB V1, V2, ...` | Emit byte values |
| .DW | `.DW V1, V2, ...` | Emit word values (big-endian) |

## Appendix C: Operand Syntax Quick Reference

| Syntax | Mode | Valid As |
|---|---|---|
| `R0`, `R1`, `R2` | Register direct | Src, Dst |
| `(R0)`, `(R1)`, `(R2)` | Register indirect | Src, Dst |
| `(R0+)`, `(R1+)`, `(R2+)` | Reg indirect, post-increment | Src, Dst |
| `((R0+))`, `((R1+))`, `((R2+))` | Indirect, pre-increment | Src, Dst |
| `42`, `0xFF`, `LABEL` | Immediate / Absolute | Src, Dst |
| `(0xFF)`, `(LABEL)` | Absolute indirect | Src, Dst |