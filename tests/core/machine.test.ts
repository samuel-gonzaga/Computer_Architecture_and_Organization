import { describe, expect, it } from "vitest";
import {
  createMachine,
  DEFAULT_MAX_STEPS,
  load,
  reset,
  run,
  setKeyboardInput,
  step,
  stepInstruction,
} from "@/core/machine";
import { assembleOrThrow } from "./helpers";

const PROGRAM = assembleOrThrow("LDI R1, 5\nLDI R2, 3\nADD R1, R2\nHLT");

describe("createMachine", () => {
  it("começa no BOOT, com o programa no disco e a RAM vazia", () => {
    const state = createMachine(PROGRAM, { keyboard: 7 });
    expect(state).toMatchObject({
      registers: [0, 0, 0, 0],
      pc: 0,
      ir: 0,
      mar: 0,
      mdr: 0,
      flags: { Z: false, N: false, C: false, V: false },
      io: { keyboard: 7, display: 0, led: 0 },
      disk: PROGRAM,
      cycle: 0,
      phase: "BOOT",
      microIndex: 0,
      halted: false,
    });
    expect(state.memory).toHaveLength(256);
    expect(state.memory.every((word) => word === 0)).toBe(true);
    expect(state.cache.lines).toHaveLength(8);
    expect(state.cache.lines.every((line) => !line.valid)).toBe(true);
  });

  it("guarda uma cópia do programa", () => {
    const program = [0xf000];
    const state = createMachine(program);
    program[0] = 0;
    expect(state.disk).toEqual([0xf000]);
  });

  it("rejeita programas inválidos já na criação", () => {
    expect(() => createMachine(new Array(0xf1).fill(0))).toThrow(/região de E\/S/);
    expect(() => createMachine([0x10000])).toThrow(RangeError);
    expect(() => createMachine([], { keyboard: -1 })).toThrow(RangeError);
  });
});

describe("step", () => {
  it("BOOT: o loader copia o disco para a RAM sem gastar ciclos", () => {
    const { state, micro } = step(createMachine(PROGRAM));
    expect(micro).toMatchObject({
      cycle: 0,
      phase: "BOOT",
      title: "Loader: disco → RAM",
      activeComponents: ["DISK", "RAM"],
      buses: { control: ["RESET"] },
    });
    expect(micro.changes).toEqual([
      { target: "M[0x00]", from: 0, to: 0x3405 },
      { target: "M[0x01]", from: 0, to: 0x3803 },
      { target: "M[0x02]", from: 0, to: 0x5600 },
      { target: "M[0x03]", from: 0, to: 0xf000 },
    ]);
    expect(state.memory.slice(0, 4)).toEqual(PROGRAM);
    expect(state).toMatchObject({ phase: "FETCH", microIndex: 0, cycle: 0 });
  });

  it("conta 1 ciclo por microetapa, mais os wait states da RAM", () => {
    let state = step(createMachine(PROGRAM)).state;
    const cycles: number[] = [];
    for (let i = 0; i < 4; i++) {
      const result = step(state);
      state = result.state;
      cycles.push(result.micro.cycle);
    }
    expect(cycles).toEqual([1, 6, 7, 8]); // MEM_READ = 1 + 4 ciclos de espera
    expect(state.cycle).toBe(8);
  });

  it("não altera o estado recebido (imutabilidade)", () => {
    const initial = createMachine(PROGRAM);
    const snapshot = structuredClone(initial);
    let state = initial;
    for (let i = 0; i < 10; i++) {
      state = step(state).state;
    }
    expect(initial).toEqual(snapshot);
    expect(state.registers[1]).toBe(5);
  });

  it("explica o fim normal do programa ao avançar uma máquina parada", () => {
    const { state } = run(createMachine(PROGRAM));
    const { micro } = step(state);
    expect(micro.explanation).toBe("O programa terminou com HLT. Use Reset para executar novamente.");
  });
});

describe("stepInstruction", () => {
  it("no BOOT, executa apenas o carregamento", () => {
    const { state, micros } = stepInstruction(createMachine(PROGRAM));
    expect(micros.map((micro) => micro.phase)).toEqual(["BOOT"]);
    expect(state.phase).toBe("FETCH");
  });

  it("executa busca, decodificação e execução de uma instrução", () => {
    const booted = stepInstruction(createMachine(PROGRAM)).state;
    const { state, micros } = stepInstruction(booted);
    expect(micros.map((micro) => micro.phase)).toEqual(["FETCH", "FETCH", "FETCH", "FETCH", "DECODE", "EXECUTE"]);
    expect(state).toMatchObject({ pc: 1, registers: [0, 5, 0, 0], phase: "FETCH", microIndex: 0 });
  });

  it("a partir do meio de uma instrução, completa o restante", () => {
    const booted = stepInstruction(createMachine(PROGRAM)).state;
    const { micros } = stepInstruction(step(booted).state);
    expect(micros).toHaveLength(5);
  });

  it("para no HLT e não faz nada com a máquina parada", () => {
    let state = createMachine(PROGRAM);
    for (let i = 0; i < 5; i++) {
      state = stepInstruction(state).state;
    }
    expect(state.halted).toBe(true);
    expect(stepInstruction(state)).toEqual({ state, micros: [] });
  });
});

describe("run", () => {
  it("executa até HLT", () => {
    const { state, micros } = run(createMachine(PROGRAM));
    expect(state).toMatchObject({ halted: true, phase: "HALT", registers: [0, 8, 3, 0] });
    expect(micros[0].phase).toBe("BOOT");
    expect(micros[micros.length - 1].title).toBe("HLT: fim da execução");
    expect(micros[micros.length - 1].cycle).toBe(state.cycle);
  });

  it("respeita o limite de microetapas (proteção contra laço infinito)", () => {
    const { state, micros } = run(createMachine(assembleOrThrow("loop: JMP loop")), 50);
    expect(micros).toHaveLength(50);
    expect(state.halted).toBe(false);
    expect(DEFAULT_MAX_STEPS).toBe(10_000);
  });

  it("não faz nada com a máquina parada", () => {
    const { state } = run(createMachine(PROGRAM));
    expect(run(state)).toEqual({ state, micros: [] });
  });

  it("é determinístico", () => {
    expect(run(createMachine(PROGRAM, { keyboard: 3 }))).toEqual(run(createMachine(PROGRAM, { keyboard: 3 })));
  });
});

describe("reset, load e teclado", () => {
  it("reset volta ao boot com o mesmo disco e mantém a entrada do teclado", () => {
    const { state } = run(createMachine(PROGRAM, { keyboard: 9 }));
    const restarted = reset(state);
    expect(restarted).toEqual(createMachine(PROGRAM, { keyboard: 9 }));
    expect(run(restarted).state).toEqual(state);
  });

  it("load grava outro programa no disco e reinicia", () => {
    const { state } = run(createMachine(PROGRAM, { keyboard: 4 }));
    const other = assembleOrThrow("LDI R0, 1\nHLT");
    const loaded = load(state, other);
    expect(loaded).toEqual(createMachine(other, { keyboard: 4 }));
    expect(run(loaded).state.registers[0]).toBe(1);
  });

  it("setKeyboardInput muda o valor lido em 0xF0", () => {
    const program = assembleOrThrow("LOAD R0, [0xF0]\nHLT");
    const state = setKeyboardInput(createMachine(program, { keyboard: 1 }), 33);
    expect(state.io.keyboard).toBe(33);
    expect(run(state).state.registers[0]).toBe(33);
    expect(() => setKeyboardInput(state, 70000)).toThrow(RangeError);
  });
});
