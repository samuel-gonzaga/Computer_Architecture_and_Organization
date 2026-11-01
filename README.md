# NeoCore Computer Lab

Simulador web didático da arquitetura interna de um computador. Ele mostra, microetapa por microetapa, como a CPU **busca, decodifica e executa** instruções e como os dados trafegam entre CPU, cache, memória, armazenamento e dispositivos de E/S pelos barramentos de dados, endereços e controle.

Trabalho final da disciplina **Computer Architecture and Organization** (UniFECAF), como prova de conceito para a empresa fictícia NeoCore Tech.

> **Status:** Fase 5 (painéis, controles e editor) concluída. O simulador já pode ser usado: rode `npm run dev`. Faltam o tour, a página "Sobre", a documentação final e o deploy.

## Links

- **Aplicação (Vercel):** _a definir na Fase 8_
- **Vídeo pitch (YouTube, não listado):** _a definir_

## Stack

Next.js (App Router, build estático) · TypeScript strict · Tailwind CSS · zustand · framer-motion · Vitest · Playwright.

## Como rodar

Pré-requisito: Node.js 22.12 ou superior (exigência do Vitest 5; desenvolvido com Node 24).

```bash
npm install
npx playwright install chromium   # apenas para os testes E2E

npm run dev        # desenvolvimento em http://localhost:3000
npm test           # testes do motor e da interface (Vitest)
npm run test:coverage  # o mesmo, com cobertura do motor (mínimo 90%)
npm run test:e2e   # fluxo ponta a ponta (Playwright, porta 3100)
npm run lint       # ESLint
npm run build      # build estático em out/
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

Os programas podem ser salvos e reabertos como arquivos **`.neocore.json`** (botões Exportar/Importar no editor). O diagrama pode ser exportado como PNG.

## Estrutura

```
src/core/        motor da arquitetura (TypeScript puro, sem React)
src/store/       estado da simulação (zustand)
src/components/  diagrama SVG, painéis, editor e controles
src/app/         páginas: simulador, /sobre e /tour
tests/core/      testes unitários do motor
tests/components/ testes do diagrama e dos painéis (renderizados com react-dom/server)
tests/store/     testes do histórico da simulação (voltar/avançar)
tests/e2e/       teste ponta a ponta
docs/            decisões de arquitetura, rastreabilidade, relatório e roteiro do vídeo
```

A especificação completa do projeto está em [`CLAUDE.md`](CLAUDE.md). As justificativas técnicas estão em [`docs/decisoes-arquitetura.md`](docs/decisoes-arquitetura.md).
