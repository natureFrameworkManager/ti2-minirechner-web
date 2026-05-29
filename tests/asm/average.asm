#! mrasm
LOOP:               ; while (true)
    LD R0, (0xFE)   ; load register FE
    LD R1, (0xFF)   ; load register FF
    MOV R2, R0
    ADD R2, R1
    RRC R2
    ST (0xFF), R2
    JR LOOP         ; repeat

; test-result: FF FE 10 FF FF 11 F0 12 66 42 F2 1F FF 20 F1