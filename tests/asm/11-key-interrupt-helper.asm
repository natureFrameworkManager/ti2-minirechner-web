#! mrasm

; This will test the MISR bits for the key interrupt.

    .ORG 0

    JR INIT
    JR ISR

INIT:
    LDSP 0xEF
    EI

MAIN:
    LD R0, (0xFC)
    JZS LOOP ; If input FC is zero, do not enable key interrupts
    BITS (0xF9), 0x01 ; Enable key interrupts

LOOP:
    MOV (0xFE), (0xF9)
    JR LOOP ; FOREVER!


ISR:
    MOV (0xFF), (0xF9)
    LD R0, (0xFD)
    JZS SKIP_STOP
    STOP
SKIP_STOP:
    RETI

; test-result: 20 02 20 13 FB EF 40 08 FF FC 10 22 04 FB 01 5F F9 FF F9 1F FE 20 FA FF F9 1F FF FF FD 10 22 01 01 2C