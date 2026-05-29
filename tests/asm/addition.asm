#! mrasm
LOOP:               ; while (true)
    LD R0, (0xFE)   ; load register FE
    LD R1, (0xFF)   ; load register FF
    ADD R0, R1      ; add them together
    ST (0xFF), R0   ; store in output FF
    ST (0xF0), R0   ; store in dac1
    JR LOOP         ; repeat

; test-result: FF FE 10 FF FF 11 64 F0 1F FF F0 1F F0 20 F1