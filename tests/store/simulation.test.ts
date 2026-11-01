// Critério de aceite da Fase 5: voltar/avançar consistentes e carregar programa próprio.

import { describe, expect, it } from "vitest";
import { createMachine, run } from "@/core/machine";
import { EXAMPLES } from "@/core/programs";
import { createSimulationStore, currentFrame, LIMIT_NOTICE, MAX_MICROSTEPS } from "@/store/simulation";
import { assembleOrThrow } from "../core/helpers";

const EXAMPLE_1 = EXAMPLES[0];

function machine(store: ReturnType<typeof createSimulationStore>) {
  return currentFrame(store.getState()).machine;
}

describe("store da simulação", () => {
  it("começa no boot do exemplo 1, com o código no editor", () => {
    const store = createSimulationStore();
    const state = store.getState();
    expect(state.frames).toHaveLength(1);
    expect(state.cursor).toBe(0);
    expect(currentFrame(state).micro).toBeUndefined();
    expect(machine(store)).toMatchObject({ phase: "BOOT", io: { keyboard: 5 } });
    expect(state.draft).toBe(EXAMPLE_1.source);
    expect(state.programName).toBe("Soma simples");
  });

  it("avançar microetapa a microetapa reproduz exatamente o run() do motor", () => {
    const store = createSimulationStore();
    const expected = run(createMachine(assembleOrThrow(EXAMPLE_1.source), { keyboard: 5 }));
    while (!machine(store).halted) store.getState().stepMicro();
    const { frames } = store.getState();
    expect(frames.slice(1).map((frame) => frame.micro)).toEqual(expected.micros);
    expect(machine(store)).toEqual(expected.state);
    expect(machine(store).io.display).toBe(12);
  });

  it("voltar e avançar de novo chega ao mesmo estado, sem recalcular", () => {
    const store = createSimulationStore();
    for (let i = 0; i < 20; i++) store.getState().stepMicro();
    const at20 = currentFrame(store.getState());
    const framesBefore = store.getState().frames;

    for (let i = 0; i < 7; i++) store.getState().back();
    expect(store.getState().cursor).toBe(13);
    expect(currentFrame(store.getState())).toBe(framesBefore[13]);

    for (let i = 0; i < 7; i++) store.getState().stepMicro();
    expect(store.getState().cursor).toBe(20);
    expect(currentFrame(store.getState())).toBe(at20); // o mesmo objeto: o futuro foi reaproveitado
    expect(store.getState().frames).toBe(framesBefore);
  });

  it("voltar no início não faz nada; avançar uma máquina parada também não", () => {
    const store = createSimulationStore();
    store.getState().back();
    expect(store.getState().cursor).toBe(0);
    while (!machine(store).halted) store.getState().stepMicro();
    const { frames, cursor } = store.getState();
    store.getState().stepMicro();
    store.getState().stepInstruction();
    expect(store.getState()).toMatchObject({ frames, cursor });
  });

  it("próxima instrução para no início da busca seguinte", () => {
    const store = createSimulationStore();
    store.getState().stepInstruction(); // BOOT
    expect(machine(store)).toMatchObject({ phase: "FETCH", microIndex: 0, cycle: 0 });
    store.getState().stepInstruction(); // LOAD R0, [0xF0]
    expect(machine(store)).toMatchObject({ phase: "FETCH", microIndex: 0, registers: [5, 0, 0, 0] });
    expect(store.getState().cursor).toBe(11); // boot + 4 busca + 1 decodificação + 5 execução
  });

  it("a linha do tempo leva a qualquer microetapa já executada", () => {
    const store = createSimulationStore();
    for (let i = 0; i < 30; i++) store.getState().stepMicro();
    const target = store.getState().frames[10];
    store.getState().goTo(10);
    expect(currentFrame(store.getState())).toBe(target);
    store.getState().goTo(999);
    expect(store.getState().cursor).toBe(30);
    store.getState().goTo(-5);
    expect(store.getState().cursor).toBe(0);
  });

  it("reset volta ao boot, mantendo o programa e a entrada do teclado", () => {
    const store = createSimulationStore();
    store.getState().setKeyboard(30);
    for (let i = 0; i < 15; i++) store.getState().stepMicro();
    store.getState().reset();
    expect(store.getState().frames).toHaveLength(1);
    expect(machine(store)).toEqual(createMachine(assembleOrThrow(EXAMPLE_1.source), { keyboard: 30 }));
  });

  it("mudar o teclado descarta o futuro, que dependia da entrada antiga", () => {
    const store = createSimulationStore();
    while (!machine(store).halted) store.getState().stepMicro();
    store.getState().goTo(3);
    store.getState().setKeyboard(10);
    expect(store.getState().frames).toHaveLength(4);
    expect(machine(store).io.keyboard).toBe(10);
    while (!machine(store).halted) store.getState().stepMicro();
    expect(machine(store).io.display).toBe(17);
  });

  it("carrega um programa próprio, que passa a ser executado", () => {
    const store = createSimulationStore();
    for (let i = 0; i < 5; i++) store.getState().stepMicro();
    const source = "LDI R0, 2\nLDI R1, 3\nADD R0, R1\nSTORE R0, [0xF1]\nHLT";
    store.getState().loadProgram(assembleOrThrow(source), "Meu programa", source);
    expect(store.getState()).toMatchObject({ cursor: 0, programName: "Meu programa", loadedSource: source });
    expect(store.getState().frames).toHaveLength(1);
    expect(machine(store).io.keyboard).toBe(5); // mantém a entrada atual
    while (!machine(store).halted) store.getState().stepMicro();
    expect(machine(store).io.display).toBe(5);
  });

  it("carregar um exemplo aplica a entrada sugerida para o teclado", () => {
    const store = createSimulationStore();
    const example = EXAMPLES[1];
    store.getState().loadProgram(assembleOrThrow(example.source), example.name, example.source, example.keyboard);
    expect(machine(store).io.keyboard).toBe(0);
    expect(machine(store).disk).toEqual(assembleOrThrow(example.source));
  });

  it("guarda o rascunho do editor sem alterar o programa carregado", () => {
    const store = createSimulationStore();
    store.getState().setDraft("HLT");
    expect(store.getState()).toMatchObject({ draft: "HLT", loadedSource: EXAMPLE_1.source });
  });

  it("executar: cada tick avança uma microetapa até o HLT, e então pausa", () => {
    const store = createSimulationStore();
    store.getState().tick(); // pausado: nada acontece
    expect(store.getState().cursor).toBe(0);
    store.getState().play();
    expect(store.getState().running).toBe(true);
    let ticks = 0;
    while (store.getState().running) {
      store.getState().tick();
      ticks++;
    }
    expect(ticks).toBe(42);
    expect(machine(store).io.display).toBe(12);
    store.getState().play(); // máquina parada: não volta a executar
    expect(store.getState().running).toBe(false);
  });

  it("pausar, alternar, voltar e mudar a velocidade", () => {
    const store = createSimulationStore();
    store.getState().toggleRun();
    expect(store.getState().running).toBe(true);
    store.getState().toggleRun();
    expect(store.getState().running).toBe(false);
    store.getState().play();
    store.getState().tick();
    store.getState().back(); // voltar pausa a execução
    expect(store.getState()).toMatchObject({ running: false, cursor: 0 });
    store.getState().setSpeed(4);
    expect(store.getState().speed).toBe(4);
  });

  it("para no limite de microetapas e avisa sobre um possível laço infinito", () => {
    const store = createSimulationStore();
    const source = "loop: JMP loop";
    store.getState().loadProgram(assembleOrThrow(source), "Laço", source);
    store.getState().play();
    while (store.getState().running) store.getState().tick();
    expect(store.getState().cursor).toBe(MAX_MICROSTEPS);
    expect(store.getState().notice).toBe(LIMIT_NOTICE);
    expect(machine(store).halted).toBe(false);

    store.getState().stepMicro();
    store.getState().stepInstruction();
    expect(store.getState()).toMatchObject({ cursor: MAX_MICROSTEPS, notice: LIMIT_NOTICE });
    store.getState().play();
    expect(store.getState().running).toBe(false);

    store.getState().back();
    expect(store.getState().notice).toBeUndefined();
  });
});
