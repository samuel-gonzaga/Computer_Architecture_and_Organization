// Critério de aceite da Fase 6: o tour percorre o exemplo 1 seguindo docs/roteiro-video.md.

import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MAX_TOUR_SECONDS, SCENES } from "@/components/tour/scenes";
import { formatClock, sceneStartMs, totalMs, tourPosition } from "@/components/tour/timeline";
import { exampleRun, Tour } from "@/components/tour/Tour";

const ROTEIRO = readFileSync(new URL("../../docs/roteiro-video.md", import.meta.url), "utf8");

/** Cenas como estão escritas no roteiro do vídeo. */
function roteiroScenes() {
  const blocks = ROTEIRO.split(/^## Cena /m).slice(1);
  return blocks.map((block) => {
    const heading = /^(\d+) — (.+) \((\d+) s\)$/m.exec(block);
    const time = /^- \*\*Tempo:\*\* (\d\d:\d\d)–(\d\d:\d\d)$/m.exec(block);
    const speech = /^- \*\*Fala:\*\* "(.+)"$/m.exec(block);
    return {
      id: Number(heading?.[1]),
      title: heading?.[2],
      seconds: Number(heading?.[3]),
      start: time?.[1],
      end: time?.[2],
      narration: speech?.[1],
    };
  });
}

describe("roteiro do vídeo × tour", () => {
  it("têm as mesmas 7 cenas, com os mesmos títulos, durações e falas", () => {
    expect(roteiroScenes()).toEqual(
      SCENES.map((scene, index) => ({
        id: scene.id,
        title: scene.title,
        seconds: scene.seconds,
        start: formatClock(sceneStartMs(SCENES, index)),
        end: formatClock(sceneStartMs(SCENES, index + 1)),
        narration: scene.narration,
      })),
    );
  });

  it("cobrem os 7 tópicos do pitch (§10) em até 3min40s", () => {
    expect(SCENES.map((scene) => scene.seconds)).toEqual([20, 30, 30, 35, 60, 25, 20]);
    expect(totalMs(SCENES) / 1000).toBeLessThanOrEqual(MAX_TOUR_SECONDS);
    expect(ROTEIRO).toContain(`| 7 | ${formatClock(sceneStartMs(SCENES, 6))}–${formatClock(totalMs(SCENES))} |`);
  });
});

describe("o tour percorre o exemplo 1", () => {
  const { frames, dataAddresses } = exampleRun();

  it("do frame inicial ao HLT, em ordem, sem pular nem repetir frames", () => {
    expect(frames).toHaveLength(43); // estado inicial + 42 microetapas
    expect(SCENES[0].frames[0]).toBe(0);
    expect(SCENES[SCENES.length - 1].frames[1]).toBe(frames.length - 1);
    SCENES.slice(1).forEach((scene, index) => {
      expect(scene.frames[0]).toBe(SCENES[index].frames[1] + 1);
      expect(scene.frames[1]).toBeGreaterThanOrEqual(scene.frames[0]);
    });
    const last = frames[frames.length - 1].machine;
    expect(last).toMatchObject({ halted: true, registers: [12, 7, 0, 0], io: { keyboard: 5, display: 12 } });
    expect([...dataAddresses]).toEqual([0x20]);
  });

  it("cada cena mostra a parte da execução que a fala descreve", () => {
    const instructionsIn = (index: number) => {
      const [first, last] = SCENES[index].frames;
      return new Set(frames.slice(first, last + 1).map((frame) => frame.micro?.instruction).filter(Boolean));
    };
    expect(frames[SCENES[1].frames[0]].micro?.phase).toBe("BOOT");
    expect([...instructionsIn(2)]).toEqual(["LOAD R0, [0xF0]"]);
    expect([...instructionsIn(3)]).toEqual(["LOAD R1, [0x20]"]);
    expect([...instructionsIn(4)]).toEqual(["ADD R0, R1"]);
    expect([...instructionsIn(5)]).toEqual(["STORE R0, [0xF1]"]);
    expect([...instructionsIn(6)]).toEqual(["HLT"]);

    // Cena 4: há um MISS com espera da RAM; cena 5: a busca completa, a decodificação e a ULA.
    const scene4 = frames.slice(SCENES[3].frames[0], SCENES[3].frames[1] + 1);
    expect(scene4.some((frame) => frame.micro?.cache?.type === "MISS" && frame.micro.waitCycles === 4)).toBe(true);
    const scene5 = frames.slice(SCENES[4].frames[0], SCENES[4].frames[1] + 1).map((frame) => frame.micro!);
    expect(scene5.map((micro) => micro.phase)).toEqual(["FETCH", "FETCH", "FETCH", "FETCH", "DECODE", "EXECUTE", "EXECUTE", "EXECUTE"]);
    expect(scene5.some((micro) => micro.activeComponents.includes("ALU"))).toBe(true);
    // Cena 6: o display passa a mostrar 12.
    const scene6 = frames.slice(SCENES[5].frames[0], SCENES[5].frames[1] + 1);
    expect(scene6.some((frame) => frame.micro?.changes.some((change) => change.target === "DISPLAY" && change.to === 12))).toBe(true);
  });
});

describe("linha do tempo do tour", () => {
  it("leva cada instante à cena e ao frame certos", () => {
    expect(tourPosition(SCENES, 0)).toMatchObject({ sceneIndex: 0, frame: 0, sceneProgress: 0 });
    expect(tourPosition(SCENES, 20_000)).toMatchObject({ sceneIndex: 1, frame: 1 });
    // Cena 5 (início em 01:55): 8 frames distribuídos em 60 s, 7,5 s cada.
    const start5 = sceneStartMs(SCENES, 4);
    expect(start5).toBe(115_000);
    expect(tourPosition(SCENES, start5).frame).toBe(21);
    expect(tourPosition(SCENES, start5 + 7_499).frame).toBe(21);
    expect(tourPosition(SCENES, start5 + 7_500).frame).toBe(22);
    expect(tourPosition(SCENES, start5 + 59_999).frame).toBe(28);
  });

  it("fica no último frame no fim e não sai dos limites", () => {
    expect(tourPosition(SCENES, totalMs(SCENES))).toMatchObject({ sceneIndex: 6, frame: 42, sceneProgress: 1 });
    expect(tourPosition(SCENES, 10_000_000).frame).toBe(42);
    expect(tourPosition(SCENES, -5).frame).toBe(0);
    expect(() => tourPosition([], 0)).toThrow();
  });

  it("formata o relógio como mm:ss", () => {
    expect(formatClock(0)).toBe("00:00");
    expect(formatClock(115_900)).toBe("01:55");
    expect(formatClock(220_000)).toBe("03:40");
  });
});

describe("página do tour", () => {
  it("abre na cena 1, com a fala do roteiro como legenda e as 7 cenas listadas", () => {
    const markup = renderToStaticMarkup(<Tour />);
    expect(markup).toContain("Cena 1 de 7");
    expect(markup).toContain(SCENES[0].narration);
    for (const scene of SCENES) expect(markup).toContain(scene.title);
    expect(markup).toContain("00:00 / 03:40");
    expect(markup).toContain("▶ Iniciar");
  });
});
