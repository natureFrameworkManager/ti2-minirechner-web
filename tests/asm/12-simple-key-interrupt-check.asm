#! mrasm

; If this program is executed correctly, output register FF
; will contain 1 iff an interrupt was triggered

    .ORG 0

    JR MAIN
    JR ISR

MAIN:
    LDSP 0xEF
    BITS (0xF9), 1
    EI
LOOP:
    JR LOOP

ISR:
    MOV (0xFF), 1

; test-result: 20 02 20 0A FB EF 40 FB 01 5F F9 08 20 FE FB 01 1F FF