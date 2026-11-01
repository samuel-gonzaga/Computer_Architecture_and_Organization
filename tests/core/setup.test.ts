import { describe, expect, it } from "vitest";
import type { MicroStep } from "@/core/types";

// Teste trivial da Fase 0: valida que o Vitest roda e que o alias "@/" resolve os tipos do núcleo.
describe("setup do Vitest", () => {
  it("monta um MicroStep válido segundo o contrato da §5.2", () => {
    const micro: MicroStep = {
      cycle: 1,
      phase: "FETCH",
      title: "MAR ← PC",
      explanation: "A Unidade de Controle coloca o PC no barramento de endereços.",
      activeComponents: ["CONTROL_UNIT", "PC", "MAR"],
      buses: { address: 0x00, control: [] },
      changes: [{ target: "MAR", from: 0x00, to: 0x00 }],
    };

    expect(micro.phase).toBe("FETCH");
    expect(micro.activeComponents).toContain("MAR");
  });
});
