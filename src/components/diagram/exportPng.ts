// Exporta o diagrama como PNG (para o relatório): o SVG é copiado com os
// estilos calculados embutidos, desenhado em um canvas e baixado.

const STYLE_PROPERTIES = [
  "fill",
  "fill-opacity",
  "stroke",
  "stroke-width",
  "stroke-dasharray",
  "stroke-linecap",
  "stroke-opacity",
  "opacity",
  "font-family",
  "font-size",
  "font-weight",
  "letter-spacing",
  "text-anchor",
  "text-transform",
  "transform",
];

export async function exportDiagramPng(svg: SVGSVGElement, fileName: string, scale = 2): Promise<void> {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  const sources = [svg, ...svg.querySelectorAll("*")];
  const targets = [clone, ...clone.querySelectorAll("*")];
  sources.forEach((source, i) => {
    const computed = getComputedStyle(source);
    const target = targets[i] as SVGElement;
    target.removeAttribute("class");
    for (const property of STYLE_PROPERTIES) {
      const value = computed.getPropertyValue(property);
      if (value && !(property === "transform" && value === "none")) {
        target.style.setProperty(property, value);
      }
    }
  });

  const { width, height } = svg.viewBox.baseVal;
  clone.setAttribute("width", String(width));
  clone.setAttribute("height", String(height));
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");

  const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)], { type: "image/svg+xml" }));
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = width * scale;
    canvas.height = height * scale;
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Canvas 2D indisponível neste navegador.");
    }
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const link = document.createElement("a");
    link.download = fileName;
    link.href = canvas.toDataURL("image/png");
    link.click();
  } finally {
    URL.revokeObjectURL(url);
  }
}
