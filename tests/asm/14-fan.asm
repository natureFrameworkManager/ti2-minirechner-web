#! mrasm
    .ORG 0

    CLR R0
LOOP:
    INC R0
    ST (0xF0), R0
    ST (0xFF), R0
    JR LOOP

; test-result: 04 44 F0 1F F0 F0 1F FF 20 F7