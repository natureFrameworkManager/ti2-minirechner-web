#! mrasm
LD R0, (0xFE)   ; load register FE
LD R1, (0xFF)   ; load register FF
MOV R2, R0
ADD R2, R1
RRC R2
ST (0xFF), R2
STOP