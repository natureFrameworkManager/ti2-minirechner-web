#! mrasm

    CLR R0
    CLR R1
LOOP:
    LD R0, (0xFC)
    LD R1, (0xFD)
    ADD R0, R1
    ST (0xFF), R0
    JR LOOP

; test-result: 04 05 FF FC 10 FF FD 11 64 F0 1F FF 20 F4