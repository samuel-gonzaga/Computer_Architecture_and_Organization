# NeoCore Computer Lab

Simulador web didático da arquitetura interna de um computador. Ele mostra, microetapa por microetapa, como a CPU **busca, decodifica e executa** instruções e como os dados trafegam entre CPU, cache, memória, armazenamento e dispositivos de E/S pelos barramentos de dados, endereços e controle.

Trabalho final da disciplina **Computer Architecture and Organization** (UniFECAF), como prova de conceito para a empresa fictícia NeoCore Tech.

## Links

- **Aplicação (Vercel):** [https://computerarch.vercel.app/](https://computerarch.vercel.app/)
- **Vídeo pitch (YouTube, não listado, 3min57s):** [https://youtu.be/KRExI6gs2_I](https://youtu.be/KRExI6gs2_I)
- **Repositório:** [https://github.com/samuel-gonzaga/Computer_Architecture_and_Organization](https://github.com/samuel-gonzaga/Computer_Architecture_and_Organization)
- **Relatório técnico:** [`docs/relatorio/relatorio.pdf`](docs/relatorio/relatorio.pdf) (fonte em [`relatorio.md`](docs/relatorio/relatorio.md))

## O que o simulador faz

- Executa programas em uma CPU didática, a **NeoCore-8**: Von Neumann com traços RISC, palavra de 16 bits, 14 instruções, cache L1 de mapeamento direto e E/S mapeada em memória (teclado, display e LED).
- Mostra cada **microetapa** no diagrama: os componentes ativos acendem, e o trecho do barramento em uso exibe o valor transmitido e o sentido. Um painel explica em português o que aconteceu.
- Permite **avançar, voltar, executar continuamente** (de 0,25× a 4×) e mudar a entrada do teclado a qualquer momento.
- Tem um **editor de assembly** com o código de máquina de cada linha, erros explicados por linha e exportação/importação de programas em **`.neocore.json`**.
- Mostra **memória, cache, linha do tempo e estatísticas**: ciclos, CPI, taxa de acerto e ciclos economizados pela cache.
- Inclui um **Tour guiado** (`/tour`), com 7 cenas em 3min40s, usado para gravar o vídeo, e a página **Sobre** (`/sobre`), com a arquitetura, o conjunto de instruções e o glossário.

## Como rodar

Pré-requisito: Node.js 22.12 ou superior (exigência do Vitest 5; desenvolvido com Node 24).

```bash
npm install
npx playwright install chromium   # para o teste E2E, as capturas e o PDF do relatório

npm run dev            # desenvolvimento em http://localhost:3000
npm run build          # build estático em out/ (é o que vai para a Vercel)
```

## Como usar

1. Abra o **Editor**, escolha um exemplo (ou escreva o seu programa) e clique em **Montar e carregar**.
2. Ajuste a entrada do **teclado (0xF0)**, se o programa ler do teclado.
3. Avance **microetapa** a microetapa, **instrução** a instrução, ou **execute** continuamente na velocidade escolhida.
4. Acompanhe o diagrama, o painel "O que está acontecendo", os registradores e as abas Memória, Cache, Linha do tempo e Estatísticas.

| Atalho | Ação |
|---|---|
| `→` | próxima microetapa |
| `Shift + →` | próxima instrução |
| `←` | voltar uma microetapa |
| `Espaço` | executar / pausar |
| `R` | reset |

No Tour guiado: `Espaço` inicia ou pausa, e `←`/`→` trocam de cena.

**Programas de exemplo:** *Soma simples* (teclado + memória + ULA + display), *Contador com laço* (desvio `JZ`, flags e ganho da cache) e *Lógica bit a bit* (`AND`, `OR` e `NOT` com máscaras).

## Testes e qualidade

```bash
npm test               # Vitest: motor, diagrama, painéis, store e coerência do relatório
npm run test:coverage  # o mesmo, com cobertura do motor (mínimo 90%; atual: 100%)
npm run test:e2e       # Playwright: exemplo 1 com entrada 5 → display mostra 12
npm run lint           # ESLint
```

## Documentação

| Documento | Conteúdo |
|---|---|
| [`docs/relatorio/relatorio.md`](docs/relatorio/relatorio.md) | relatório técnico (seções 1–9 e apêndices) |
| [`docs/decisoes-arquitetura.md`](docs/decisoes-arquitetura.md) | justificativas e simplificações (D1–D26) |
| [`docs/rastreabilidade.md`](docs/rastreabilidade.md) | matriz enunciado → app → código → relatório → vídeo |
| [`docs/roteiro-video.md`](docs/roteiro-video.md) | estrutura do vídeo publicado e roteiro do `/tour` |
| [`CLAUDE.md`](CLAUDE.md) | especificação completa do projeto |

Para atualizar o relatório depois de mudar o app:

```bash
npm run capturas       # regenera as figuras em docs/relatorio/img/ a partir do app real
npm run relatorio:pdf  # gera docs/relatorio/relatorio.pdf a partir do relatorio.md
```

## Estrutura

```
src/core/          motor da arquitetura (TypeScript puro, sem React)
src/store/         estado da simulação (zustand): histórico, execução e velocidade
src/components/    diagrama SVG, painéis, editor, controles e tour
src/app/           páginas: simulador (/), /tour e /sobre
tests/core/        testes do motor
tests/components/  testes do diagrama, painéis e tour (renderizados com react-dom/server)
tests/store/       testes do histórico da simulação (voltar/avançar)
tests/docs/        coerência entre o relatório e o motor
tests/e2e/         fluxo ponta a ponta (Playwright)
scripts/           capturas do relatório e geração do PDF
docs/              relatório, decisões, rastreabilidade e roteiro do vídeo
```

## Stack

Next.js (App Router, build estático) · TypeScript strict · Tailwind CSS · zustand · framer-motion · Vitest · Playwright.
