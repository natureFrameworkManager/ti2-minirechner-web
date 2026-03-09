#! mrasm
    .ORG 0

LOOP:
    MOV (0xF0), (0xFC)
    MOV (0xF1), (0xFD)
    MOV (0xF2), (0xFE)
    LD R0, 0xF0
    LD R1, (0xFF)
    ADD R0, R1
    MOV (0xFF), (R0)
    JR LOOP

; test-result: FF FC 1F F0 FF FD 1F F1 FF FE 1F F2 FB F0 10 FF FF 11 64 F4 1F FF 20 E8