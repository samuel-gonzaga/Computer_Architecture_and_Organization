import type { Metadata } from "next";
import type { ReactNode } from "react";
import { assemble } from "@/core/assembler";
import { cacheStatistics } from "@/core/cache";
import { ISA, toHex, type OperandFormat } from "@/core/isa";
import { createMachine, run } from "@/core/machine";
import { RAM_WAIT_CYCLES } from "@/core/memory";
import { EXAMPLES } from "@/core/programs";
import type { ComponentId, MicroStep } from "@/core/types";
import { Diagram } from "@/components/diagram/Diagram";
import { PHASE_NAME } from "@/components/panels/StepExplanation";
import { SiteNav } from "@/components/SiteNav";

export const metadata: Metadata = {
  title: "Sobre · NeoCore Computer Lab",
  description: "Contexto, arquitetura NeoCore-8, conjunto de instruções, hierarquia de memória e glossário do simulador.",
};

// Tudo o que é calculado aqui vem do próprio motor, no momento do build.

function runExample(index: number) {
  const example = EXAMPLES[index];
  const result = assemble(example.source);
  if (!result.ok) throw new Error(`O exemplo "${example.name}" não montou.`);
  return run(createMachine(result.program, { keyboard: example.keyboard }));
}

/** Microetapas de uma instrução: da busca até a última etapa de execução. */
function microStepsOf(micros: MicroStep[], instruction: string): MicroStep[] {
  const groups: MicroStep[][] = [];
  micros.forEach((micro, index) => {
    if (micro.phase === "BOOT") return;
    if (micro.phase === "FETCH" && micros[index - 1]?.phase !== "FETCH") groups.push([]);
    groups[groups.length - 1].push(micro);
  });
  return groups.find((group) => group.some((micro) => micro.instruction === instruction)) ?? [];
}

const SYNTAX: Record<OperandFormat, (mnemonic: string) => string> = {
  NONE: (m) => m,
  RD: (m) => `${m} rd`,
  RD_RS: (m) => `${m} rd, rs`,
  RD_IMM: (m) => `${m} rd, imm`,
  RD_ADDR: (m) => `${m} rd, [addr]`,
  ADDR: (m) => `${m} addr`,
};

const COMPONENT_NAME: Record<ComponentId, string> = {
  CONTROL_UNIT: "UC",
  ALU: "ULA",
  R0: "R0",
  R1: "R1",
  R2: "R2",
  R3: "R3",
  PC: "PC",
  IR: "IR",
  MAR: "MAR",
  MDR: "MDR",
  FLAGS: "FLAGS",
  CACHE: "Cache",
  RAM: "RAM",
  DISK: "Disco",
  KEYBOARD: "Teclado",
  DISPLAY: "Display",
  LED: "LED",
};

const GLOSSARY: [string, string][] = [
  ["Barramento", "Conjunto de linhas compartilhadas por onde trafegam endereços, dados ou sinais de controle entre a CPU, a memória e a E/S."],
  ["Bypass", "Acesso que não passa pela cache. No NeoCore-8, toda a região de E/S (0xF0–0xFF) faz bypass."],
  ["Cache", "Memória pequena e rápida entre a CPU e a RAM que guarda cópias das palavras usadas recentemente."],
  ["Ciclo de clock", "Unidade de tempo da CPU. Cada microetapa dura 1 ciclo, mais os ciclos de espera da RAM quando há acesso a ela."],
  ["CPI", "Ciclos por instrução: total de ciclos dividido pelo número de instruções executadas."],
  ["Decodificação", "Fase em que a UC separa os campos do IR (opcode, rd, rs, imm/addr) e decide quais sinais de controle a execução vai usar."],
  ["E/S mapeada em memória", "Os dispositivos de entrada e saída ocupam endereços de memória e são acessados com LOAD e STORE comuns."],
  ["Flags", "Bits de estado gerados pela ULA: Z (zero), N (negativo), C (carry/borrow) e V (overflow)."],
  ["HIT / MISS", "Acerto ou falta na cache: o dado procurado está (HIT) ou não está (MISS) na cache."],
  ["IR", "Registrador de instrução: guarda a instrução que está sendo decodificada e executada."],
  ["Load/store", "Princípio RISC em que só as instruções LOAD e STORE acessam a memória; as operações da ULA usam apenas registradores."],
  ["MAR", "Registrador de endereço de memória: guarda o endereço que a CPU coloca no barramento de endereços."],
  ["MDR", "Registrador de dados de memória: guarda a palavra que chega ou sai pelo barramento de dados."],
  ["Microetapa", "Cada passo elementar de uma instrução, como \"MAR ← PC\" ou \"IR ← MDR\". O simulador avança uma microetapa por vez."],
  ["Opcode", "Código de operação: os 4 bits mais altos da instrução, que dizem qual operação executar."],
  ["PC", "Contador de programa: endereço da próxima instrução a ser buscada."],
  ["RISC", "Filosofia de projeto com instruções simples, formato fixo e poucas formas de acessar a memória."],
  ["UC", "Unidade de Controle: coordena as microetapas e emite os sinais de controle."],
  ["ULA", "Unidade Lógica e Aritmética: executa somas, subtrações e operações lógicas e atualiza as flags."],
  ["Von Neumann", "Arquitetura em que instruções e dados ficam na mesma memória e usam os mesmos barramentos."],
  ["Wait state", "Ciclo de espera: a CPU aguarda a RAM, mais lenta, responder. No NeoCore-8 são 4 por acesso à RAM."],
  ["Write-through", "Política de escrita em que a RAM é sempre atualizada; a cache só é atualizada se já tiver o endereço (sem alocação na escrita)."],
];

const SECTIONS = [
  ["contexto", "1. Contexto"],
  ["arquitetura", "2. Arquitetura escolhida"],
  ["diagrama", "3. Diagrama geral"],
  ["parametros", "4. Parâmetros da CPU"],
  ["isa", "5. Conjunto de instruções"],
  ["memoria", "6. Hierarquia de memória"],
  ["barramentos", "7. Barramentos e E/S"],
  ["ciclo", "8. Ciclo de instrução"],
  ["limites", "9. Simplificações e próximos passos"],
  ["glossario", "Glossário"],
] as const;

export default function AboutPage() {
  const example1 = runExample(0);
  const example2 = runExample(1);
  const addSteps = microStepsOf(example1.micros, "ADD R0, R1");
  const loop = cacheStatistics(example2.state.cache, example2.state.cycle);

  return (
    <>
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div>
            <h1 className="text-2xl font-bold leading-none tracking-wide">Sobre o NeoCore Computer Lab</h1>
            <p className="mt-1 text-sm text-ink-muted">Arquitetura NeoCore-8, conjunto de instruções e glossário</p>
          </div>
          <SiteNav current="/sobre" />
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-6xl flex-1 gap-8 px-4 py-8 lg:grid-cols-[13rem_minmax(0,1fr)]">
        <nav aria-label="Nesta página" className="lg:sticky lg:top-6 lg:self-start">
          <p className="panel-title mb-2">Nesta página</p>
          <ol className="flex flex-col gap-1 text-sm">
            {SECTIONS.map(([id, label]) => (
              <li key={id}>
                <a href={`#${id}`} className="text-ink-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-ink">
                  {label}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <article className="flex min-w-0 flex-col gap-12 leading-relaxed">
          <Section id="contexto" title="1. Contexto">
            <p>
              A <strong>NeoCore Tech</strong> é uma empresa de tecnologia educacional que atende escolas técnicas, universidades e
              centros de formação. Os alunos estudam registradores, ULA, unidade de controle, cache, memória e barramentos de forma
              isolada e têm dificuldade de enxergar como esses componentes trabalham <em>juntos</em>.
            </p>
            <p>
              Este simulador é a prova de conceito proposta para esse problema. Ele responde à pergunta:{" "}
              <strong>como os componentes de um computador se coordenam para buscar, interpretar e executar uma instrução?</strong> A cada
              microetapa, mostra qual componente age, qual barramento é usado, qual sinal de controle é emitido e qual valor muda, com
              uma explicação em português.
            </p>
          </Section>

          <Section id="arquitetura" title="2. Arquitetura escolhida: Von Neumann com traços RISC">
            <ul className="list-disc space-y-2 pl-5">
              <li>
                <strong>Von Neumann.</strong> Uma única memória guarda instruções e dados, acessada por um único conjunto de
                barramentos. É a arquitetura de referência no ensino e deixa visível o <em>gargalo de Von Neumann</em>: a busca de
                instruções e o acesso a dados disputam o mesmo caminho, o que aparece na contagem de ciclos.
              </li>
              <li>
                <strong>Load/store (RISC).</strong> Só <code>LOAD</code> e <code>STORE</code> acessam a memória; a ULA opera apenas
                sobre registradores.
              </li>
              <li>
                <strong>Formato fixo de 16 bits (RISC)</strong>, decodificado campo a campo, e um conjunto pequeno de{" "}
                <strong>{ISA.length} instruções</strong>: menos carga cognitiva e fases bem distintas.
              </li>
              <li>
                <strong>Sem pipeline.</strong> Uma instrução termina antes da próxima começar, para que cada fase do ciclo possa ser
                observada isoladamente. O pipeline é a evolução natural (seção 9).
              </li>
              <li>
                <strong>E/S mapeada em memória.</strong> Teclado, display e LED ocupam endereços fixos e são acessados com{" "}
                <code>LOAD</code>/<code>STORE</code>, coerente com a filosofia load/store.
              </li>
            </ul>
          </Section>

          <Section id="diagrama" title="3. Diagrama geral">
            <figure className="flex flex-col gap-2">
              <div className="panel overflow-x-auto">
                <div className="min-w-[760px]">
                  <Diagram state={example1.state} />
                </div>
              </div>
              <figcaption className="text-sm text-ink-muted">
                Estado final do exemplo 1 (entrada 5): R0 = 12 e o display mostrando 12. Barramento de endereços em azul tracejado,
                de dados em verde contínuo e de controle em laranja pontilhado.
              </figcaption>
            </figure>
          </Section>

          <Section id="parametros" title="4. Parâmetros da CPU">
            <Table
              head={["Item", "Valor"]}
              rows={[
                ["Palavra", "16 bits"],
                ["Memória principal", "256 palavras (0x00–0xFF), endereçamento por palavra"],
                ["Registradores de uso geral", "R0–R3 (16 bits)"],
                ["Registradores especiais", "PC (8 bits), IR (16), MAR (8), MDR (16), FLAGS (Z, N, C, V)"],
                ["Unidade de Controle (UC)", "Sequencia as microetapas e emite os sinais de controle"],
                ["ULA", "ADD e SUB (atualizam Z, N, C, V); AND, OR e NOT (atualizam Z e N)"],
              ]}
            />
          </Section>

          <Section id="isa" title="5. Conjunto de instruções (ISA)">
            <p>Toda instrução tem 16 bits, divididos em quatro campos:</p>
            <pre className="panel overflow-x-auto p-4 font-mono text-sm">
              {` 15    12 11  10 9    8 7              0\n[ opcode ][  rd  ][  rs  ][ imm / addr ]\n  4 bits   2 bits  2 bits     8 bits`}
            </pre>
            <Table
              head={["Opcode", "Sintaxe", "Operação", "Flags"]}
              rows={ISA.map((spec) => [
                <code key="op">{toHex(spec.opcode, 1)}</code>,
                <code key="syntax">{SYNTAX[spec.format](spec.mnemonic)}</code>,
                spec.operation,
                spec.affectedFlags.length > 0 ? spec.affectedFlags.join(" ") : "—",
              ])}
            />
            <p className="text-sm text-ink-muted">
              Os opcodes 0xD e 0xE são reservados: se aparecerem, a UC gera uma exceção didática (&quot;instrução inválida&quot;) e a
              máquina para. Exemplo de codificação: <code>LDI R1, 5</code> → <code>0011 01 00 00000101</code> = <code>0x3405</code>.
            </p>
          </Section>

          <Section id="memoria" title="6. Hierarquia de memória e o papel da cache">
            <Table
              head={["Nível", "Representação", "Latência simulada"]}
              rows={[
                ["Registradores", "R0–R3 e especiais, dentro da CPU", "sem espera"],
                ["Cache L1", "mapeamento direto, 8 linhas de 1 palavra; write-through", "1 ciclo"],
                ["Memória principal (RAM)", "256 palavras", `+${RAM_WAIT_CYCLES} ciclos de espera por acesso`],
                ["Armazenamento (disco)", "guarda o programa; o loader o copia para a RAM no boot", "só no carregamento"],
              ]}
            />
            <p>
              A cache é <strong>unificada</strong> (instruções e dados) e divide o endereço em <strong>tag (5 bits) | índice (3 bits)</strong>
              : o índice escolhe a linha e a tag diz qual endereço ela guarda. Em um <strong>HIT</strong>, a palavra sai da cache em 1
              ciclo; em um <strong>MISS</strong>, vem da RAM com {RAM_WAIT_CYCLES} ciclos de espera, e a cache guarda uma cópia.
            </p>
            <p>
              No exemplo 2 (contador com laço), as instruções do laço passam a vir da cache a partir da 2ª volta:{" "}
              <strong>
                {loop.hits} de {loop.hits + loop.misses} leituras são HIT ({Math.round(loop.hitRate * 100)}%)
              </strong>
              , e a execução leva <strong>{loop.totalCycles} ciclos</strong> em vez de {loop.cyclesWithoutCache} sem a cache.
            </p>
          </Section>

          <Section id="barramentos" title="7. Barramentos e E/S">
            <Table
              head={["Barramento", "Largura", "O que transporta"]}
              rows={[
                ["Endereços", "8 bits", "o endereço que o MAR coloca para a memória ou a E/S"],
                ["Dados", "16 bits", "a palavra lida ou escrita (via MDR)"],
                ["Controle", "sinais", "MEM_READ, MEM_WRITE, CLOCK e RESET; dentro da CPU, ALU_OP, REG_WRITE, PC_INC, PC_LOAD, IR_LOAD e HALT"],
              ]}
            />
            <Table
              head={["Endereço", "Dispositivo", "Uso"]}
              rows={[
                ["0xF0", "Teclado", "entrada: LOAD lê o valor digitado"],
                ["0xF1", "Display", "saída: STORE mostra o valor"],
                ["0xF2", "LED", "saída: STORE acende conforme os bits"],
              ]}
            />
            <p className="text-sm text-ink-muted">A região 0xF0–0xFF não é cacheável e não é RAM.</p>
          </Section>

          <Section id="ciclo" title="8. Ciclo de busca, decodificação e execução">
            <p>
              Toda instrução passa por <strong>busca</strong> (4 microetapas, iguais para todas), <strong>decodificação</strong> (1) e{" "}
              <strong>execução</strong> (varia por instrução). A tabela abaixo é a execução real de <code>ADD R0, R1</code> no exemplo 1,
              gerada pelo motor do simulador:
            </p>
            <Table
              head={["#", "Fase", "Microetapa", "Sinais de controle", "Componentes ativos", "Ciclo"]}
              rows={addSteps.map((micro, index) => [
                String(index + 1),
                PHASE_NAME[micro.phase],
                <span key="title">
                  <strong>{micro.title}</strong>
                  <br />
                  <span className="text-sm text-ink-muted">{micro.explanation}</span>
                </span>,
                micro.buses.control.join(", "),
                micro.activeComponents.map((id) => COMPONENT_NAME[id]).join(", "),
                String(micro.cycle),
              ])}
            />
          </Section>

          <Section id="limites" title="9. Simplificações e próximos passos">
            <p>
              Para manter cada etapa visível, o NeoCore-8 simplifica: latência fixa da RAM, dispositivos de E/S que respondem na hora,
              cache de um único nível com uma palavra por linha e execução estritamente sequencial. Ficam como evoluções naturais:
              pipeline, interrupções, DMA, memória virtual e multiprocessamento.
            </p>
          </Section>

          <Section id="glossario" title="Glossário">
            <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-[11rem_1fr]">
              {GLOSSARY.map(([term, definition]) => (
                <div key={term} className="contents">
                  <dt className="font-semibold">{term}</dt>
                  <dd className="text-ink-muted">{definition}</dd>
                </div>
              ))}
            </dl>
          </Section>
        </article>
      </main>
    </>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="flex scroll-mt-6 flex-col gap-4">
      <h2 id={`${id}-title`} className="text-2xl font-bold">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Table({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <div className="panel overflow-x-auto">
      <table className="w-full border-collapse text-left text-sm">
        <thead className="text-ink-muted">
          <tr>
            {head.map((cell) => (
              <th key={cell} scope="col" className="border-b border-line px-3 py-2 font-semibold">
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index} className="border-b border-line last:border-b-0 align-top">
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className="px-3 py-2">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
