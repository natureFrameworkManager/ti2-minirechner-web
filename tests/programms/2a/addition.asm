#! mrasm
LD R0, (0xFE)   ; load register FE
LD R1, (0xFF)   ; load register FF
ADD R0, R1      ; add them together
ST (0xFF), R0   ; store in output FF
ST (0xF0), R0   ; store in dac1
STOP