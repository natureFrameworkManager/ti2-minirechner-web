# Technical Specification: Architecture 2a

## Table of Contents

1. [Overview](#1-overview)
2. [Register File](#2-register-file)
3. [Arithmetic Logic Unit (ALU)](#3-arithmetic-logic-unit-alu)
4. [Microinstruction Format](#4-microinstruction-format)
5. [Microcode Memory (MPRAM)](#5-microcode-memory-mpram)
6. [Control Unit / Address Sequencer](#6-control-unit--address-sequencer)
7. [Instruction Register (BR) and Opcode Decoding](#7-instruction-register-br-and-opcode-decoding)
8. [Memory Bus and Address Space](#8-memory-bus-and-address-space)
9. [I/O System](#9-io-system)
10. [UART Interface](#10-uart-interface)
11. [Expansion Card Interface](#11-expansion-card-interface)
12. [Interrupt System](#12-interrupt-system)
13. [Stack and Stack Pointer](#13-stack-and-stack-pointer)
14. [Instruction Set Architecture (ISA)](#14-instruction-set-architecture-isa)
15. [Addressing Modes](#15-addressing-modes)
16. [Clock Cycle and Execution Flow](#16-clock-cycle-and-execution-flow)
17. [Reset Behavior](#17-reset-behavior)
18. [Assembler Syntax (MRASM)](#18-assembler-syntax-mrasm)
19. [Microcode Block Reference](#19-microcode-block-reference)
20. [Control Signal Summary](#20-control-signal-summary)

---

## 1. Overview

Architecture 2a is an 8-bit microcoded processor with a Harvard-style split between microcode memory and data memory. The processor executes user-visible machine instructions (ISA level) by interpreting sequences of 28-bit microinstructions stored in microprogram memory (MPRAM). The microarchitecture is horizontally microcoded — each bit in the microinstruction directly controls one hardware signal without intermediate decoding.

**Key characteristics:**

| Property | Value |
|---|---|
| Data width | 8-bit (signed two's complement) |
| Microinstruction width | 28 bits |
| Microcode address space | 9 bits (512 words), organized as 16 blocks × 32 words |
| Data RAM address space | 8 bits (00–EF = 240 bytes general purpose, F0–FF = memory-mapped I/O) |
| General-purpose registers | 3 (R0, R1, R2) |
| Special registers | PC, FLAGS, SP, 2× Microcode-internal registers |
| ALU operations | 16 |
| Flags | Carry (CF), Zero (ZF), Negative (NF), Interrupt Enable Flag (IEF) |
| Addressing modes | Register direct, register indirect, register indirect with post-increment, indirect with pre-increment, immediate, absolute, relative |
| I/O ports | 4× 8-bit input (FC–FF), 2× 8-bit output (FE–FF) |
| UART | Memory-mapped at FA (status/control) and FB (data) |
| Expansion | 4 addresses (F0–F3) for memory-mapped expansion cards |
| Interrupts | 2 flip-flops (IFF1, IFF2) with maskable interrupt support |
| Stack | In-memory stack, 8-bit stack pointer (SP) growing downward |

---

## 2. Register File

The register file contains 8 registers, each 8 bits wide, addressed by a 3-bit register address.

| Index | Name | Purpose |
|---|---|---|
| 0 | R0 | General-purpose register 0 |
| 1 | R1 | General-purpose register 1 |
| 2 | R2 | General-purpose register 2 |
| 3 | PC | Program Counter — holds address of next instruction in data RAM |
| 4 | FLAGS | Status flags: `0000.IEF.NF.ZF.CF` |
| 5 | SP | Stack Pointer — points to top of stack in data RAM |
| 6 | µR6 | Microcode-internal scratch register |
| 7 | µR7 | Microcode-internal scratch register |

### 2.1 Flag Register (Register 4) Bit Layout

```
Bit:   7  6  5  4    3       2      1      0
     [0  0  0  0] [IEF]  [NF]   [ZF]   [CF]
```

| Bit | Name | Description |
|---|---|---|
| 0 | CF | Carry Flag — set by ALU carry-out |
| 1 | ZF | Zero Flag — set when ALU result is zero |
| 2 | NF | Negative Flag — set when ALU result has MSB=1 (negative in two's complement) |
| 3 | IEF | Interrupt Enable Flag — set/cleared by microcode (EI/DI instructions) |
| 7–4 | — | Reserved, always 0 |

### 2.2 Register Addressing in Microinstructions

The CTRL word contains two 4-bit fields for register addressing:

- **mrgAA** (4 bits): Register Address A
  - Bits 2–0: Register number (0–7)
  - Bit 3: If set, bits 2–0 are overridden — the register address comes from `BR[1:0]` (i.e., bits BR.1–BR.0 of the Instruction Register)

- **mrgAB** (4 bits): Register Address B / Immediate constant
  - Bits 2–0: Register number (0–7) or lower bits of an immediate value
  - Bit 3: If set, bits 2–0 are overridden — the register address comes from `BR[3:2]`

This dual-addressing scheme allows the microcode to use the BR (Instruction Register) fields to dynamically select operand registers based on the current instruction's opcode.

---

## 3. Arithmetic Logic Unit (ALU)

The ALU is an 8-bit signed integer ALU that computes `F = f(A, B, Cin)` and produces three result flags: Carry Out (CO), Zero Out (ZO), and Negative Out (NO).

### 3.1 ALU Inputs

| Input | Source | Width |
|---|---|---|
| A | Register File (via mrgAA) or Memory Bus Data (selectable by mAluIA) | 8-bit |
| B | Register File (via mrgAB) or Immediate constant from mrgAB field (selectable by mAluIB) | 8-bit |
| Cin | Carry Flag (CF from FLAGS register) | 1-bit |

### 3.2 ALU Control Signals

The 4-bit **mAluS** field selects the ALU operation:

| mAluS | Mnemonic | Function | CO (Carry Out) |
|---|---|---|---|
| 0000 | ADDH | F = A + B | `Cin ∨ Ca` (OR of input carry and adder carry) |
| 0001 | A | F = A | `0` |
| 0010 | NOR | F = ¬(A ∨ B) | `0` |
| 0011 | 0 | F = 0 | `0` |
| 0100 | ADD | F = A + B | `Ca` (adder carry) |
| 0101 | ADDS | F = A + B + 1 | `¬Ca` (inverted adder carry, for subtraction) |
| 0110 | ADC | F = A + B + Cin | `Ca` |
| 0111 | ADCS | F = A + B + ¬Cin | `¬Ca` |
| 1000 | LSR | F(n) = A(n+1), F(7)=0 | `A(0)` |
| 1001 | RR | F(n) = A(n+1), F(7)=A(0) | `A(0)` |
| 1010 | RRC | F(n) = A(n+1), F(7)=Cin | `A(0)` |
| 1011 | ASR | F(n) = A(n+1), F(7)=A(7) | `A(0)` |
| 1100 | B | F = B | `0` |
| 1101 | SETC | F = B | `1` |
| 1110 | BH | F = B | `Cin` (hold carry) |
| 1111 | INVC | F = B | `¬Cin` (invert carry) |

Where:
- **Ca** = carry out from the 8-bit adder (true when unsigned sum > 0xFF)
- **A(0)** = bit 0 (LSB) of input A
- **Cin** = input carry from FLAGS.CF
- All results F are masked to 8 bits (`F & 0xFF`)

### 3.3 ALU Outputs

| Output | Width | Description |
|---|---|---|
| F | 8-bit | Result of the selected operation |
| CO | 1-bit | Carry Out (becomes new CF when mChFlg=1) |
| ZO | 1-bit | Zero Out — `1` if F === 0 |
| NO | 1-bit | Negative Out — `1` if F[7] === 1 |

### 3.4 ALU Operations with B = A (compound instructions)

When the same register is used for both A and B inputs, several ALU operations produce useful single-operand instructions:

| ALU Operation | With B=A | ISA Instruction | Description |
|---|---|---|---|
| ADD (0100) | F = A + A = 2·A | LSL | Logical Shift Left |
| ADDH (0000) | F = A + A, C = Cin ∨ Ca | LSLH | LSL + Hold Carry |
| ADDS (0101) | F = A + A + 1 | (SL1) | Shift left, insert 1 at LSB |
| ADC (0110) | F = A + A + Cin | RLC | Rotate Left through Carry |
| NOR (0010) | F = ¬(A ∨ A) = ¬A | COM | Complement (bitwise NOT) |
| B (1100) | F = B = A | CLC | Pass through, clear carry |

---

## 4. Microinstruction Format

Each microinstruction is 28 bits wide. The bits control hardware signals directly without intermediate decoding (horizontal microcode).

### 4.1 CTRL Word Bit Layout

```
Bit:   27      26..23    22      21      20      19      18..15    14..11    10      9       8..4       3..0
     [mChFlg] [mAluS] [mAluIB] [mAluIA] [mrgWE] [mrgWS] [mrgAB]  [mrgAA]  [busEn] [busWr] [nextAddr] [mAC]
```

### 4.2 Field Descriptions

| Bits | Field | Width | Description |
|---|---|---|---|
| 3–0 | **mAC** | 4 | Microprogram Address Control — determines how the next microinstruction address is computed (see §6) |
| 8–4 | **nextAddr** | 5 | Next Address field — supplies bits 4–0 (or part thereof) of the next microinstruction address |
| 9 | **busWr** | 1 | Bus Write — `1` = write to memory bus, `0` = read from memory bus |
| 10 | **busEn** | 1 | Bus Enable — `1` = enable memory bus access, `0` = disable |
| 14–11 | **mrgAA** | 4 | Register Address A — selects register for ALU input A and memory address (see §2.2) |
| 18–15 | **mrgAB** | 4 | Register Address B / Immediate — selects register for ALU input B or provides a 4-bit immediate constant (see §2.2) |
| 19 | **mrgWS** | 1 | Register Write Select — `0` = write to register addressed by mrgAA, `1` = write to register addressed by mrgAB |
| 20 | **mrgWE** | 1 | Register Write Enable — `1` = write ALU result F to the selected register |
| 21 | **mAluIA** | 1 | ALU Input A Select — `0` = register data from mrgAA address, `1` = memory bus data |
| 22 | **mAluIB** | 1 | ALU Input B Select — `0` = register data from mrgAB address, `1` = immediate constant from mrgAB field (sign-extended to 8-bit: `mrgAB[3] ? 0xF8 | mrgAB : mrgAB`) |
| 26–23 | **mAluS** | 4 | ALU Function Select — selects one of 16 ALU operations (see §3.2) |
| 27 | **mChFlg** | 1 | Change Flags — `1` = update FLAGS register (NF, ZF, CF) from ALU outputs NO, ZO, CO |

### 4.3 Encoding Format in MPRAM

Microinstructions are stored in MPRAM as 28-character strings of `'0'` and `'1'` characters. The bit order in storage matches the CTRL word layout:

```
Position:  0..3     4..8      9       10       11..14   15..18   19       20       21       22       23..26   27
Field:     mAC      nextAddr  busWr   busEn    mrgAA    mrgAB    mrgWS    mrgWE    mAluIA   mAluIB   mAluS    mChFlg
```

So `MPRAM[addr][0]` = mAC[3] (MSB), `MPRAM[addr][3]` = mAC[0] (LSB), `MPRAM[addr][27]` = mChFlg.

The human-readable form commonly uses spaces for readability:
```
mAC nextAddr busWr busEn mrgAA mrgAB mrgWS mrgWE mAluIA mAluIB mAluS mChFlg
0011 00111   0     0     0000  0000  0     0     0      0      1100  0
```

---

## 5. Microcode Memory (MPRAM)

MPRAM is a 512 × 28-bit memory, addressed by a 9-bit address.

### 5.1 Address Organization

The 9-bit microcode address is decomposed as:

```
Bit:   8  7  6  5    4  3  2  1  0
     [ Block (4 bits) ][ Word (5 bits) ]
```

- **Block** (bits 8–5): Selects one of 16 blocks (0–15)
- **Word** (bits 4–0): Selects one of 32 microinstructions within the block

### 5.2 Block Assignment

Each block contains the microcode for a group of related ISA instructions or control sequences:

| Block | Range (Binary) | Purpose |
|---|---|---|
| 0 | `0000_00000` – `0000_11111` | RESET sequence, instruction fetch (FETCH), opcode dispatch |
| 1 | `0001_00000` – `0001_11111` | Data transfer instructions: MOV, LD, ST, PUSH, POP, PUSHF, POPF, LDSP, LDFR |
| 2 | `0010_00000` – `0010_11111` | ALU operations: ADD, ADC, SUB, AND, OR, XOR, CMP, BITT, conditional branches |
| 3 | `0011_00000` – `0011_11111` | Shift/rotate group 1: LSR, ASR, RRC, RLC (continued from block 1/2) |
| 4 | `0100_00000` – `0100_11111` | Shift/rotate group 2: LSL, COM, NEG, INC, DEC, TST, BITS, BITC |
| 5 | `0101_00000` – `0101_11111` | MUL, DIV instructions |
| 6 | `0110_00000` – `0110_11111` | JMP, JCS, JCC, JZS, JZC, JNS, JNC, JR, CALL |
| 7 | `0111_00000` – `0111_11111` | Conditional jump evaluation (continued from block 6) |
| 8 | `1000_00000` – `1000_11111` | RET, RETI, EI, DI, STOP, NOP |
| 9 | `1001_00000` – `1001_11111` | Extended operations |
| 10 | `1010_00000` – `1010_11111` | Additional control flow |
| 11 | `1011_00000` – `1011_11111` | Memory indirect / indexed operations |
| 12 | `1100_00000` – `1100_11111` | Complex addressing modes |
| 13 | `1101_00000` – `1101_11111` | Extended ALU and memory operations |
| 14 | `1110_00000` – `1110_11111` | Interrupt acknowledge sequence |
| 15 | `1111_00000` – `1111_11111` | FETCH helpers, PC increment, operand load |

### 5.3 FETCH Sequence

The instruction fetch cycle is the heart of the microcode sequencer. It resides primarily in Block 0 and Block 15:

1. **Microaddress `0000_0000` (Block 0, Word 0):** Reset / Init entry point
   - Loads PC value, prepares to read instruction from memory
   
2. **Microaddress `0000_0110`:** FETCH complete
   - When `mAC[3:0] = 1101` and conditions are met, the BR is loaded with the instruction byte from memory
   - The next microaddress is formed using bits from the fetched instruction
   
3. **Block selection via BR:** After FETCH, the upper 4 bits of BR (`BR[7:4]`) — called the "Next Address 8–5" or `na8to5` — are used to select which block's microcode to execute, providing a 16-way branch (one block per major opcode group)

The FETCH sequence also increments PC (stored in Register 3) to point to the next instruction byte.

---

## 6. Control Unit / Address Sequencer

The Control Unit computes the next microinstruction address each clock cycle. The 4-bit **mAC** field (Microprogram Address Control) determines the addressing mode.

### 6.1 mAC Field Encoding

```
mAC[3] mAC[2] mAC[1] mAC[0]
  |      |      |      |
  |      |      |      +-- BL1: Load BR from memory bus (when mAC[3]=1)
  |      |      +--------- BL3: Reset BR to 0x00 (when mAC[3]=1)
  |      +---------------- (Condition bit used in AM1 logic)
  +----------------------- Block Mode: 0 = standard, 1 = use BR for address bits
```

**Detailed bit functions:**

| mAC Bit | Name | Function |
|---|---|---|
| mAC[0] | BL1 (BR Load 1) | When **both** mAC[3]=1 AND mAC[0]=1: Load BR from memory bus data |
| mAC[1] | BL3 (BR Reset) | When **both** mAC[3]=1 AND mAC[1]=1: Reset BR to 0x00 |
| mAC[2] | — | Used as a condition select bit in AM1 multiplexer (see §6.3) |
| mAC[3] | Block Mode | `0` = next address computed from `nextAddr` field + AM1 logic, `1` = next address partially derived from BR (instruction-driven branching) |

### 6.2 Next Address Computation

The 9-bit next address is composed as follows:

```
na[8] na[7] na[6] na[5] na[4] na[3] na[2] na[1] na[0]
  |     |     |     |     |     |     |     |     |
  |     |     |     |     |     |     |     |     +-- na0: see AM1 logic (§6.3)
  |     |     |     |     |     |     |     +-------- na1: (block mode? BR[3] : nextAddr[1])
  |     |     |     |     |     |     +-------------- na2: nextAddr[2] (always from field)
  |     |     |     |     |     +-------------------- na3: nextAddr[3] (always from field)
  |     |     |     |     +-------------------------- na4: nextAddr[4] (always from field)
  |     |     |     +-------------------------------- na5: BR[4] << 1 (upper BR bits)
  |     |     +-------------------------------------- na6: BR[5] << 1
  |     +-------------------------------------------- na7: BR[6] << 1
  +-------------------------------------------------- na8: BR[7] << 1
```

**In mathematical form:**

```
if (mAC[3] == 0) {
    // Standard mode
    na[8:5] = BR[7:4]             // Block selection from instruction
    na[4:2] = nextAddr[4:2]       // From microinstruction field
    na[1]   = nextAddr[1]         // From microinstruction field
    na[0]   = AM1()               // Computed by AM1 logic
} else {
    // Block mode (BR-driven)
    na[8:5] = BR[7:4]             // Block selection from instruction
    na[4:2] = nextAddr[4:2]       // From microinstruction field
    na[1]   = BR[3]               // From instruction bit 3
    na[0]   = BR[2]               // From instruction bit 2
}
```

This scheme means:
- **Bits 8–5** always come from BR[7:4] — the fetched opcode selects the microcode block
- **Bits 4–2** always come from the `nextAddr` field in the microinstruction
- **Bit 1** comes from `nextAddr[1]` (standard) or `BR[3]` (block mode)
- **Bit 0** comes from AM1 logic (standard) or `BR[2]` (block mode)

### 6.3 AM1 — Address Modifier 1

AM1 computes the least significant bit of the next microaddress. It is a multiplexer controlled by `mAC[2:1]` and `nextAddr[0]`:

```
AM1 = MUX(select = {mAC[2], mAC[1], nextAddr[0]}, inputs = {
  0b000: 0                    // Always 0
  0b001: 1                    // Always 1
  0b010: BR[2] ⊕ AM2()        // XOR of instruction bit 2 and AM2 result
  0b011: CF                   // Current Carry Flag
  0b100: ALU.CO               // ALU Carry Out
  0b101: ALU.ZO               // ALU Zero Out
  0b110: ALU.NO               // ALU Negative Out
  0b111: IEF ∧ (INTL ∨ IFF1)  // Interrupt condition: IEF AND (interrupt line OR IFF1)
})
```

### 6.4 AM2 — Address Modifier 2

AM2 provides a condition bit derived from the FLAGS register, selected by `BR[1:0]`:

```
AM2 = MUX(select = BR[1:0], inputs = {
  0b00: 1                     // Always true (unconditional)
  0b01: CF                    // Carry Flag
  0b10: ZF                    // Zero Flag
  0b11: NF                    // Negative Flag
})
```

This allows the microcode to perform conditional branching based on the instruction's condition code field (typically BR[1:0]).

### 6.5 IEF Control (Set/Reset)

The Interrupt Enable Flag (IEF, bit 3 of FLAGS register) is managed by microcode:

- **SET IEF:** When `mAC[0] = 1` AND `mAC[1] = 0` AND `mAC[3] = 0` AND `nextAddr[0] = 1` — sets IFF2 = IFF1
- **RESET IFF1:** When IFF2 is true, IFF1 is cleared on the next cycle

The `getIEF()` function returns bit 3 of the FLAGS register directly; it is set by microcode through register write operations.

### 6.6 Interrupt Flip-Flops

```
IFF2 = IFF1 ∧ mAC[1]' ∧ mAC[0] ∧ (nextAddr[0])
IFF1_reset = IFF2 (clears IFF1 when IFF2 is active)
```

This implements a two-stage interrupt synchronization mechanism:
1. **IFF1** is the primary interrupt enable flip-flop
2. **IFF2** is set one cycle after IFF1 when specific microcode conditions are met
3. When IFF2 becomes active, IFF1 is cleared (one-cycle pulse generation)

---

## 7. Instruction Register (BR) and Opcode Decoding

The **Befehlsregister (BR)** is an 8-bit instruction register that holds the currently executing machine instruction.

### 7.1 BR Bit Layout

```
BR[7] BR[6] BR[5] BR[4]  BR[3] BR[2] BR[1] BR[0]
  |     |     |     |       |     |     |     |
  |     |     |     |       |     |     |     +-- Opcode bit 0 / condition select 0
  |     |     |     |       |     |     +-------- Opcode bit 1 / condition select 1
  |     |     |     |       |     +-------------- Opcode bit 2 / operand select
  |     |     |     |       +-------------------- Opcode bit 3 / operand select
  |     |     |     +---------------------------- Opcode bit 4 (= Next Address bit 5)
  |     |     +---------------------------------- Opcode bit 5 (= Next Address bit 6)
  |     +---------------------------------------- Opcode bit 6 (= Next Address bit 7)
  +---------------------------------------------- Opcode bit 7 (= Next Address bit 8)
```

### 7.2 BR Usage in Addressing

- **BR[7:4]:** Select the microcode block (na[8:5]), providing 16-way dispatch
- **BR[3:2]:** In block mode (mAC[3]=1), these directly drive na[1:0]; also used for register selection when mrgAA[3]=1 or mrgAB[3]=1
- **BR[1:0]:** Select the condition for AM2, used in conditional branch evaluation; also used for register destination selection

### 7.3 BR Loading

BR is loaded from the memory bus when:
```
mAC[3] = 1  AND  mAC[0] = 1
```
At this point, `BR = getMemBusData()` — the byte at the memory address currently on the bus.

### 7.4 BR Reset

BR is reset to `0x00` when:
```
mAC[3] = 1  AND  mAC[1] = 1
```

---

## 8. Memory Bus and Address Space

### 8.1 Address Space Map

| Range | Size | Purpose | Access |
|---|---|---|---|
| `0x00` – `0xEF` | 240 bytes | General-purpose Data RAM (DPRAM) | Read/Write |
| `0xF0` – `0xF3` | 4 bytes | Expansion Card Interface | Read/Write |
| `0xF4` – `0xF9` | 6 bytes | Reserved | — |
| `0xFA` | 1 byte | UART Status/Control Register | Read = Status, Write = Control |
| `0xFB` | 1 byte | UART Data Register | Read = Receive, Write = Send |
| `0xFC` | 1 byte | Input Port FC | Read-only |
| `0xFD` | 1 byte | Input Port FD | Read-only |
| `0xFE` | 1 byte | Input Port FE / Output Port FE | Read = Input, Write = Output |
| `0xFF` | 1 byte | Input Port FF / Output Port FF | Read = Input, Write = Output |

### 8.2 Memory Bus Control

Memory access is controlled by two CTRL signals:

| busEn | busWr | Operation |
|---|---|---|
| 0 | X | No memory access |
| 1 | 0 | Read from memory at address = Register A |
| 1 | 1 | Write ALU result F to memory at address = Register A |

**Memory Address:** The memory address is always taken from **Register A** (the register selected by mrgAA). This means before any memory access, the target address must be loaded into a register and that register must be selected as Register A.

### 8.3 Write Behavior

After a memory write (`busEn=1, busWr=1`), the implementation broadcasts the updated DPRAM array via `BroadcastChannel("memory-channel")` with message `{msg: "update", data: DPRAM, architecture: "a"}`. This allows other components (like the GUI) to stay synchronized.

---

## 9. I/O System

The processor has 4 input ports and 2 output ports, memory-mapped at addresses FC–FF.

### 9.1 Input Ports

| Address | Name | Description |
|---|---|---|
| `0xFC` | IN0 | General-purpose input 0 |
| `0xFD` | IN1 | General-purpose input 1 |
| `0xFE` | IN2 | General-purpose input 2 |
| `0xFF` | IN3 | General-purpose input 3 |

Input ports are read-only from the processor's perspective. Reads return the 8-bit value currently present on the input.

### 9.2 Output Ports

| Address | Name | Description |
|---|---|---|
| `0xFE` | OUT0 | General-purpose output 0 |
| `0xFF` | OUT1 | General-purpose output 1 |

Output ports are write-only. Writing to `0xFE` or `0xFF` with `busWr=1` stores the ALU result F to the corresponding output.

### 9.3 Implementation Note

Addresses `0xFE` and `0xFF` serve dual purposes:
- **Read:** Return the value from the `inputs` object
- **Write:** Store the value to the `outputs` object

The `outputs` and `inputs` objects are separate, so reading back a written output value will return the input value, not the previously written output.

---

## 10. UART Interface

The UART is memory-mapped at addresses `0xFA` and `0xFB`.

### 10.1 UART Status Register (FA — Read)

```
Bit:   7        6        5          4      3      2        1        0
     [TxReady] [TxEmpty] [not CTS] [TxD] [RxD] [not RTS] [RxFull] [RxReady]
```

| Bit | Name | Description |
|---|---|---|
| 0 | RxReady | Data received and ready to be read (cleared when read) |
| 1 | RxFull | Receive buffer full — data waiting and not yet read |
| 2 | not RTS | UART cannot accept new data (RTS inactive) — set when receiving |
| 3 | RxD | Current input value on Rx line |
| 4 | TxD | Current output value on Tx line |
| 5 | not CTS | Clear To Send inactive — transmitter waiting |
| 6 | TxEmpty | No data waiting to be sent (both buffer and shift register empty) |
| 7 | TxReady | Ready to accept new data to send (transmit buffer available) |

### 10.2 UART Control Register (FA — Write)

```
Bit:   7              6              5         4         3                    2        1..0
     [Int on RxReady] [Int on RxFull] [TxEmpty] [TxReady] [0=use CTS / 1=ignore] [always 0] [Baudrate]
```

| Bits | Name | Description |
|---|---|---|
| 1–0 | Baudrate | `00` = 115200, `01` = 38400, `10` = 19200, `11` = 9600 |
| 2 | — | Always 0 |
| 3 | CTS Mode | `0` = honor CTS, `1` = ignore CTS |
| 4 | TxReady IE | Interrupt enable on TxReady |
| 5 | TxEmpty IE | Interrupt enable on TxEmpty |
| 6 | RxFull IE | Interrupt enable on RxFull |
| 7 | RxReady IE | Interrupt enable on RxReady |

### 10.3 UART Data Register (FB)

- **Read (FB):** Returns the received data byte (`uartRecvReg`). The receive buffer is marked as read.
- **Write (FB):** Queues a byte for transmission (`uartSendBuffer`).

### 10.4 UART Internal Operation

The UART uses a software-timed transmission scheme:
- A timeout-driven state machine runs at the configured baudrate
- **Transmit:** Data moves from `uartSendBuffer` → `uartSendShiftReg` → transmitted
- **Receive:** Incoming data moves to `uartRecvShiftReg` → `uartRecvReg` (when read by processor)
- The status flags update automatically via `setUartStatus()`

---

## 11. Expansion Card Interface

Four memory-mapped addresses (`0xF0`–`0xF3`) provide an interface to external expansion cards.

### 11.1 Address Mapping

| Address | Read | Write |
|---|---|---|
| `0xF0` | Read Interrupt Register (IRG) | Write DAC Reference Value 1 (ORG1) |
| `0xF1` | Read Status Register | Write DAC Reference Value 2 (ORG2) |
| `0xF2` | Read Fan Counter | Write UIO Register / Direction / ICR |
| `0xF3` | Read Interrupt Status Register | Reset Interrupt Flip-Flop |

### 11.2 Status Register (F1 — Read)

```
Bit:   7    6    5     4       3       2..0
     [J2] [J1] [Fan] [CP2] [CP1] [UIO state]
```

| Bit | Name | Description |
|---|---|---|
| 2–0 | UIO | User I/O pin states (3 bits) |
| 3 | CP1 | Comparator 1 output (`AI1 > DAC(ORG1)` → 1) |
| 4 | CP2 | Comparator 2 output (`max(AI2, temp) > DAC(ORG2)` → 1, if J9; else `temp > DAC(ORG2)`) |
| 5 | Fan | Fan status |
| 6 | J1 | Jumper 1 state |
| 7 | J2 | Jumper 2 state |

### 11.3 Interrupt Register (F0 — Read)

Returns the 8-bit IRG (Interrupt Register) value reflecting pending interrupt sources.

### 11.4 Fan Counter (F2 — Read)

Returns an 8-bit free-running counter incremented every 275 ms, used for fan speed measurement.

### 11.5 DAC Outputs

Two 8-bit DACs with 2.55V reference:
- **DAC1 (ORG1):** `Vout = 2.55V × (ORG1 / 256)`, written via F0
- **DAC2 (ORG2):** `Vout = 2.55V × (ORG2 / 256)`, written via F1

### 11.6 Comparators

- **CP1:** Compares analog input AI1 against DAC1 output
- **CP2:** Compares `max(AI2, temperature sensor)` (when J9 jumper is set) or just temperature sensor against DAC2 output

---

## 12. Interrupt System

### 12.1 Interrupt Flip-Flops

The interrupt system uses two cascaded flip-flops:

| Flip-Flop | Description |
|---|---|
| IFF1 | Primary interrupt enable flip-flop — set by EI instruction, cleared by DI or interrupt acknowledge |
| IFF2 | Secondary flip-flop — delayed version of IFF1, used for edge-triggered interrupt entry |

### 12.2 Interrupt Condition

The interrupt condition signal is:

```
INT_COND = IEF ∧ (INTL ∨ IFF1)
```

Where:
- **IEF** = Interrupt Enable Flag (bit 3 of FLAGS register)
- **INTL** = Interrupt line from external sources (currently always `false` — not yet implemented)
- **IFF1** = Primary interrupt flip-flop

This signal feeds into AM1 select `0b111`, allowing the microcode sequencer to branch to the interrupt handler when interrupts are enabled and pending.

### 12.3 EI / DI Instructions

- **EI (Enable Interrupts):** Sets IFF1 and IEF, enabling the interrupt system
- **DI (Disable Interrupts):** Clears IFF1 (and through it, the interrupt path)

### 12.4 Interrupt Acknowledge Sequence

When an interrupt is accepted (AM1 condition `0b111` returns true):
1. The sequencer branches to the interrupt handler microcode (Block 14, `0xE`)
2. The current PC is saved (pushed to stack)
3. IFF1 is cleared to prevent re-entrant interrupts
4. The interrupt vector is fetched
5. The handler executes
6. **RETI** restores PC, FLAGS, and re-enables interrupts (sets IFF1)

---

## 13. Stack and Stack Pointer

### 13.1 Stack Pointer (SP)

The Stack Pointer is Register 5 in the register file. It is an 8-bit pointer into data RAM.

### 13.2 Stack Operation

- **PUSH:** Register data is written to memory at the address in SP, then SP is decremented
- **POP:** SP is incremented, then data is read from memory at the new SP address
- **CALL:** PC is pushed to stack, then PC is loaded with the call target address
- **RET:** PC is popped from stack
- **PUSHF:** FLAGS register is pushed to stack
- **POPF:** FLAGS register is popped from stack

### 13.3 Stack Growth Direction

The stack grows **downward** (from higher addresses to lower addresses). The initial SP value should be set to the highest desired stack address (typically near `0xEF` or at a user-defined boundary).

---

## 14. Instruction Set Architecture (ISA)

### 14.1 Instruction Encoding Overview

All instructions are 1 to 3 bytes long. The first byte is the opcode, which encodes both the operation and (for register instructions) operand registers. Additional bytes provide immediate values, addresses, or branch offsets.

### 14.2 Opcode Map

#### Arithmetic and Logic (Block 2: `0010_xxxx`)

| Instruction | Encoding | Bytes | Description |
|---|---|---|---|
| ADD Rd, Rs | `0110_0dds` | 1 | Rd = Rd + Rs (d, s = register number, 0–2) |
| ADC Rd, Rs | `0111_0dds` | 1 | Rd = Rd + Rs + CF |
| SUB Rd, Rs | `1000_0dds` | 1 | Rd = Rd - Rs |
| AND Rd, Rs | `1001_0dds` | 1 | Rd = Rd ∧ Rs |
| OR Rd, Rs  | `1010_0dds` | 1 | Rd = Rd ∨ Rs |
| XOR Rd, Rs | `1101_0dds` | 1 | Rd = Rd ⊕ Rs |
| MUL Rd, Rs | `1011_0dds` | 1 | Rd = Rd × Rs (signed) |
| DIV Rd, Rs | `1100_0dds` | 1 | Rd = Rd ÷ Rs (signed) |

**Encoding detail for ALU reg-reg instructions:**
```
Bits: 7 6 5 4  3  2  1  0
     [opcode group] [Rs][Rd]
```
Where `dd` and `ss` are 2-bit register selectors (R0=00, R1=01, R2=10).

#### Shift and Rotate (Blocks 3, 4: `0011_xxxx`, `0100_xxxx`)

| Instruction | Encoding | Bytes | Description |
|---|---|---|---|
| LSR Rd | `0011_10dd` | 1 | Logical Shift Right Rd |
| ASR Rd | `0011_11dd` | 1 | Arithmetic Shift Right Rd |
| RRC Rd | `0100_00dd` | 1 | Rotate Right through Carry Rd |
| RLC Rd | `0111_00dd` | 1 | Rotate Left through Carry Rd (encoding: same as ADC with Rs=Rd) |
| LSL Rd | `0110_00dd` | 1 | Logical Shift Left Rd (ADD Rd,Rd) |
| COM Rd | `0011_00dd` | 1 | Complement (bitwise NOT) Rd |
| NEG Rd | `0011_01dd` | 1 | Negate (two's complement) Rd |

#### Unary Register Operations (Block 4: `0100_xxxx`)

| Instruction | Encoding | Bytes | Description |
|---|---|---|---|
| INC Rd | `0100_01dd` | 1 | Rd = Rd + 1 |
| DEC Rd | `0101_00dd` | 1 | Rd = Rd - 1 |
| TST Rd | `0100_10dd` | 1 | Test Rd (set flags based on Rd) |
| CLR Rd | `0000_01dd` | 1 | Rd = 0 |
| BITS Rd | `0101_00dd` | 1 | Bit set? (uses ALU to test) |
| BITC Rd | `0110_00dd` | 1 | Bit clear? (uses ALU to test) |

#### Data Transfer (Block 1: `0001_xxxx`)

| Instruction | Encoding | Bytes | Description |
|---|---|---|---|
| MOV dst, src | `0001_00dd` + src encoding | 2–3 | Move data from src to dst |
| LD dst, src  | `0001_00dd` + src encoding | 2–3 | Load dst from src (synonym for MOV) |
| ST dst, src  | `0001_00dd` + src encoding | 2–3 | Store src to dst (reverse MOV) |

**MOV/LD/ST operand encoding:**

The first byte `0001_00dd` encodes the destination using bits 1–0 (dd):
- `00` = R0, `01` = R1, `10` = R2
- For register-indirect modes, additional encoding bytes follow

The second byte encodes the source and its addressing mode:

| Source | Byte 2 Encoding |
|---|---|
| Rn | `0001_00ss` |
| (Rn) | `0001_01ss` |
| (Rn+) | `0001_10ss` |
| ((Rn+)) | `0001_11ss` |
| Immediate #n | `1111_1011` + byte 3 = value |
| (addr) | `0001_1111` + byte 3 = address |

The destination encoding (first byte bits 1–0 extended):

| Destination | First Byte Modifier |
|---|---|
| Rn | `0001_00dd` where dd = register |
| (Rn) | `1111_01dd` |
| (Rn+) | `1111_10dd` |
| ((Rn+)) | `1111_11dd` |
| (addr) | `1111_1111` + address byte follows |
| Immediate (as dst) | (not applicable — stores must have memory/register dst) |

#### Special Register Transfers

| Instruction | Encoding | Bytes | Description |
|---|---|---|---|
| LDSP src | dst_encoding + `0100_0000` | 2–3 | Load SP from src |
| LDFR src | dst_encoding + `0100_0100` | 2–3 | Load FLAGS from src |
| PUSH Rs  | `0001_00ss` (ss = reg) | 1 | Push Rs onto stack |
| POP Rd   | `0001_11dd` (dd = reg) | 1 | Pop from stack into Rd |
| PUSHF    | `0001_1000` | 1 | Push FLAGS onto stack |
| POPF     | `0001_1100` | 1 | Pop FLAGS from stack |

#### Control Flow (Blocks 6, 7: `0110_xxxx`, `0111_xxxx`)

| Instruction | Encoding | Bytes | Description |
|---|---|---|---|
| JMP target | `1111_1011` + addr + `0001_0011` | 3 | Unconditional jump to target |
| JMP (addr) | `1111_1111` + addr + `0001_0011` | 3 | Indirect jump via address |
| JCS offset | `0010_0001` + offset | 2 | Jump if Carry Set (relative) |
| JCC offset | `0010_0101` + offset | 2 | Jump if Carry Clear (relative) |
| JZS offset | `0010_0010` + offset | 2 | Jump if Zero Set (relative) |
| JZC offset | `0010_0110` + offset | 2 | Jump if Zero Clear (relative) |
| JNS offset | `0010_0011` + offset | 2 | Jump if Negative Set (relative) |
| JNC offset | `0010_0111` + offset | 2 | Jump if Negative Clear (relative) |
| JR offset  | `0010_0000` + offset | 2 | Jump Relative (unconditional, 8-bit signed offset) |
| CALL addr  | `0010_1000` + addr | 2 | Call subroutine at addr |
| RET        | `0001_0111` | 1 | Return from subroutine |
| RETI       | `0010_1100` | 1 | Return from interrupt |

**Conditional branch encoding (`0010_0ccc`):**
```
Bits: 7 6 5 4  3  2  1  0
     0 0 1 0  [cond] 0/1
```
Where `ccc` selects the condition:
- `000` = always (JR)
- `001` = CF=1 (JCS)
- `010` = ZF=1 (JZS)
- `011` = NF=1 (JNS)
- `101` = CF=0 (JCC)
- `110` = ZF=0 (JZC)
- `111` = NF=0 (JNC)

The second byte is an 8-bit signed relative offset from the **byte after the offset** (i.e., `target = (current_PC + 1) + offset`). Offset is sign-extended: values 0x80–0xFF represent −128 to −1.

#### System Control (Block 8: `1000_xxxx`)

| Instruction | Encoding | Bytes | Description |
|---|---|---|---|
| STOP | `0000_0001` | 1 | Halt execution |
| NOP  | `0000_0010` | 1 | No operation |
| EI   | `0000_1000` | 1 | Enable interrupts |
| DI   | `0000_1100` | 1 | Disable interrupts |

#### DEC with Immediate/Address

| Instruction | Encoding | Bytes | Description |
|---|---|---|---|
| DEC Rd  | `0101_00dd` | 1 | Decrement register |
| DEC #n   | `0101_1111` + n | 2 | Decrement immediate value (encoded as special form) |
| DEC (addr) | `0101_1111` + addr | 2 | Decrement value at address |

---

## 15. Addressing Modes

### 15.1 Source Addressing Modes

| Syntax | Encoding (in src byte) | Description |
|---|---|---|
| Rn | `xxxx_00ss` | Register direct — value in register Rn |
| (Rn) | `xxxx_01ss` | Register indirect — value at memory address in Rn |
| (Rn+) | `xxxx_10ss` | Register indirect with post-increment — value at memory address in Rn, then Rn++ |
| ((Rn+)) | `xxxx_11ss` | Indirect with pre-increment — Rn++, then value at memory address pointed to by value at new Rn |
| #n | `1111_1011` + byte | Immediate — the literal byte n |
| (addr) | `xxxx_1111` + addr | Absolute/PC-relative indirect — value at memory address addr (loaded via PC increment) |

### 15.2 Destination Addressing Modes

| Syntax | Encoding (in dst byte) | Description |
|---|---|---|
| Rn | `1111_00dd` | Register direct — store to register Rn |
| (Rn) | `1111_01dd` | Register indirect — store to memory address in Rn |
| (Rn+) | `1111_10dd` | Register indirect with post-increment — store to memory address in Rn, then Rn++ |
| ((Rn+)) | `1111_11dd` | Indirect with pre-increment — Rn++, then store to memory address pointed to by value at new Rn |
| (addr) | `1111_1111` + addr | Absolute indirect — store to memory address addr |

### 15.3 JMP Addressing Modes

| Syntax | Encoding | Description |
|---|---|---|
| JMP addr | `1111_1011` + addr + `0001_0011` | Jump to absolute address addr |
| JMP (addr) | `1111_1111` + addr + `0001_0011` | Indirect jump — jump to address stored at addr |

### 15.4 LDSP / LDFR Addressing Modes

These instructions use the same source encoding as MOV/LD:

| Syntax | Bytes | Description |
|---|---|---|
| LDSP Rn | 2 | SP = Rn |
| LDSP (Rn) | 2 | SP = [Rn] |
| LDSP #n | 3 | SP = n (immediate) |
| LDSP (addr) | 3 | SP = [addr] |
| LDFR Rn | 2 | FLAGS = Rn |
| LDFR #n | 3 | FLAGS = n |

---

## 16. Clock Cycle and Execution Flow

### 16.1 Clock Cycle Sequence

Each clock cycle (`clk()`) executes the following operations in order:

1. **setReg()** — Write ALU result to register file (if mrgWE=1)
2. **setMemBus()** — Perform memory read/write (if busEn=1)
3. **setCTRL()** — Compute next address and load new microinstruction into CTRL register
4. **setBR()** — Load BR from memory bus (if mAC[3]=1 and mAC[0]=1)
5. **resetBR()** — Reset BR to 0x00 (if mAC[3]=1 and mAC[1]=1)
6. **setIFF2()** — Update IFF2 based on IFF1 and microcode conditions
7. **resetIFF1()** — Clear IFF1 if IFF2 is set

### 16.2 Instruction Execution Phases

A typical instruction goes through these phases:

1. **FETCH:** Read instruction byte from memory at PC, load into BR, increment PC
2. **DECODE:** BR[7:4] selects the microcode block; BR[3:0] provides operand/condition selects
3. **OPERAND FETCH:** If the instruction has additional bytes (immediate, address, offset), load them via PC increment
4. **EXECUTE:** Perform the operation (ALU, memory access, branch)
5. **WRITE-BACK:** Store results to registers or memory
6. **NEXT FETCH:** Return to FETCH for the next instruction

### 16.3 STOP Condition

Execution halts when the opcode at the current PC is `0x01` (STOP) or `0x00`. The `runUntilStop2a()` function checks:
```javascript
while (CTRL.mAC >> 3 == 0 ? count < max : (opcode != 0x01 && opcode != 0x00))
```
This means: while in Block 0 (FETCH), keep running. Once in another block, check if the current opcode is STOP or 0x00; if so, halt.

---

## 17. Reset Behavior

### 17.1 Reset Sequence

When `reset()` is called:

1. **BR** = `0x00`
2. **CTRL** is set to all zeros:
   - mAC = 0, nextAddr = 0, busWr = 0, busEn = 0
   - mrgAA = 0, mrgAB = 0, mrgWS = 0, mrgWE = 0
   - mAluIA = 0, mAluIB = 0, mAluS = 0 (ADDH)
   - mChFlg = false
3. **IFF1** = false
4. **All registers** = 0x00 (R0–R3, FLAGS, SP, µR6, µR7)
5. **Outputs** = `{ff: 0x00, fe: 0x00}`
6. **Microcode** is reloaded into MPRAM via `fillMicrocode()`

### 17.2 Initial Microaddress

After reset, the first microinstruction executed is at address `0b000000000` (Block 0, Word 0), which is the start of the FETCH sequence.

---

## 18. Assembler Syntax (MRASM)

### 18.1 File Format

Assembly files must start with the identifier:
```
#! mrasm
```

### 18.2 Comments

- Line comments start with `;`
- Full-line comments and end-of-line comments are supported
- Empty lines are ignored

### 18.3 Labels

Labels are defined by appending `:` to a name on its own line:
```asm
LOOP:
    ADD R0, R1
    JR LOOP
```

Label naming rules:
- Must match regex: `^[A-Z_][A-Z0-9_]*$`
- Must not conflict with register names (R0, R1, R2, PC) or instruction mnemonics
- Each label must be defined exactly once

### 18.4 Equates

Symbolic constants can be defined with `.EQU`:
```asm
.EQU MAX_VALUE, 0xFF
.EQU PORT_A, 0xFE
```

### 18.5 Directives

| Directive | Syntax | Description |
|---|---|---|
| `.ORG n` | `.ORG 0x10` | Set origin address for subsequent code/data |
| `.BYTE n` | `.BYTE 4` | Reserve n bytes (advances address) |
| `.DB v1, v2, ...` | `.DB 0x41, 0x42, 0x00` | Emit literal byte values |
| `.DW v1, v2, ...` | `.DW 0x1234` | Emit 16-bit word values (big-endian, high byte first) |
| `.EQU name, value` | `.EQU BUFSIZE, 64` | Define a symbolic constant |

### 18.6 Number Formats

| Format | Example | Description |
|---|---|---|
| Decimal | `42` | Standard decimal |
| Binary | `0B10101010` | Binary literal |
| Hexadecimal | `0xFF`, `0xAB` | Hex literal |

### 18.7 Operand Syntax

| Syntax | Example | Meaning |
|---|---|---|
| Rn | `R0`, `R1`, `R2` | Register direct |
| (Rn) | `(R0)` | Register indirect |
| (Rn+) | `(R1+)` | Register indirect with post-increment |
| ((Rn+)) | `((R2+))` | Indirect with pre-increment |
| (addr) | `(0xFF)`, `(BUFFER)` | Absolute address indirect |
| #n | (implied by bare number) | Immediate value |

---

## 19. Microcode Block Reference

### Block 0 (RESET / FETCH)

| Address | Description |
|---|---|
| `0x000` | RESET entry: Initialize, prepare instruction fetch |
| `0x001` | Load PC to memory address register |
| `0x002`–`0x005` | Memory read setup, PC increment preparation |
| `0x006` | FETCH complete: `mAC=1101`, load BR from memory, dispatch to opcode block |
| `0x007` | Post-FETCH cleanup |

### Block 1 (Data Transfer)

Microcode for MOV, LD, ST, PUSH, POP, PUSHF, POPF, LDSP, LDFR. Handles register indirect addressing modes including:
- (Rn) — indirect
- (Rn+) — indirect with post-increment
- ((Rn+)) — indirect with pre-increment
- (PC+) — immediate / absolute addressing via PC increment

### Block 2 (ALU Operations)

Microcode for ADD, ADC, SUB, AND, OR, XOR, CMP, BITT, and conditional branch evaluation.

### Block 3 (Shift/Rotate Group 1)

Microcode for LSR, ASR, RRC, RLC and related single-operand shift instructions.

### Block 4 (Shift/Rotate Group 2)

Microcode for LSL, COM, NEG, INC, DEC, TST, BITS, BITC.

### Block 5 (Multiply / Divide)

Microcode for MUL (signed multiplication) and DIV (signed division) using iterative algorithms.

### Block 6 (Jumps and Calls — Setup)

Microcode for JMP, JCS/JCC/JZS/JZC/JNS/JNC, JR, CALL — preparing target addresses and conditions.

### Block 7 (Jumps and Calls — Evaluation)

Continuation of Block 6: condition evaluation, PC modification for taken/not-taken branches.

### Block 8 (System Control)

Microcode for RET, RETI, EI, DI, STOP, NOP.

### Blocks 9–13 (Extended Operations)

Additional microcode for complex addressing modes, memory-mapped I/O operations, and extended arithmetic.

### Block 14 (Interrupt Acknowledge)

Microcode for interrupt entry: save PC and FLAGS, clear IFF1, fetch interrupt vector.

### Block 15 (FETCH Helpers)

Microcode helpers for PC increment, operand byte fetch, and return to FETCH sequence.

---

## 20. Control Signal Summary

| Signal | Width | When Active | Effect |
|---|---|---|---|
| **mrgWE** | 1 | `1` | Write ALU result F to register file |
| **mrgWS** | 1 | `0` = reg A, `1` = reg B | Selects which register address is the write destination |
| **mrgAA[3:0]** | 4 | Always | Register address for ALU input A and memory address |
| **mrgAB[3:0]** | 4 | Always | Register address for ALU input B, or 4-bit immediate (when mAluIB=1) |
| **mAluIA** | 1 | `0` = reg file, `1` = mem bus | Selects ALU input A source |
| **mAluIB** | 1 | `0` = reg file, `1` = immediate | Selects ALU input B source |
| **mAluS[3:0]** | 4 | Always | Selects ALU operation (0–15) |
| **mChFlg** | 1 | `1` | Update NF, ZF, CF from ALU outputs NO, ZO, CO |
| **busEn** | 1 | `1` | Enable memory bus access |
| **busWr** | 1 | `1` = write, `0` = read | Memory bus direction |
| **nextAddr[4:0]** | 5 | Always | Next microaddress bits 4–0 (partial) |
| **mAC[3:0]** | 4 | Always | Microaddress control mode |

---

## Appendix A: ALU Quick Reference

```
mAluS  Mnemonic   F = f(A,B)         CO
0x0    ADDH       A + B              Cin ∨ Ca
0x1    A          A                  0
0x2    NOR        ¬(A ∨ B)           0
0x3    0          0                  0
0x4    ADD        A + B              Ca
0x5    ADDS       A + B + 1          ¬Ca
0x6    ADC        A + B + Cin        Ca
0x7    ADCS       A + B + ¬Cin       ¬Ca
0x8    LSR        A >> 1 (0←7)       A(0)
0x9    RR         A >> 1 (A(0)←7)    A(0)
0xA    RRC        A >> 1 (Cin←7)     A(0)
0xB    ASR        A >> 1 (A(7)←7)    A(0)
0xC    B          B                  0
0xD    SETC       B                  1
0xE    BH         B                  Cin
0xF    INVC       B                  ¬Cin
```

## Appendix B: Flag Register Quick Reference

```
Bit 7-4: Reserved (always 0)
Bit 3:   IEF — Interrupt Enable Flag
Bit 2:   NF  — Negative Flag (result bit 7)
Bit 1:   ZF  — Zero Flag (result == 0)
Bit 0:   CF  — Carry Flag
```

## Appendix C: Memory Map Quick Reference

```
0x00–0xEF: Data RAM (240 bytes)
0xF0–0xF3: Expansion Card
0xF4–0xF9: Reserved
0xFA:      UART Status (R) / Control (W)
0xFB:      UART Data (R/W)
0xFC:      Input Port 0
0xFD:      Input Port 1
0xFE:      Input Port 2 / Output Port 0
0xFF:      Input Port 3 / Output Port 1
```

## Appendix D: Microinstruction Field Quick Reference

```
Bit:   27      26..23   22      21      20      19      18..15  14..11  10     9      8..4      3..0
      [mChFlg][mAluS] [mAluIB][mAluIA][mrgWE] [mrgWS] [mrgAB] [mrgAA] [busEn][busWr][nextAddr][mAC]