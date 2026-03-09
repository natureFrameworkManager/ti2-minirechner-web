#! mrasm
    .ORG 0

    CLR R0
    CLR R1
LOOP:
    INC R0
    ADD R1, R0
    ST (0xF0), R0
    ST (0xF1), R1
    JR LOOP

; test-result: 04 05 44 61 F0 1F F0 F1 1F F1 20 F6