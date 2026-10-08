// PDF do relatório da busca, desenhado no navegador. jsPDF é carregado só
// quando a pessoa clica em baixar (não pesa no carregamento da tela).
import type { RelatorioBusca } from './relatorio-busca';

/** Monta o PDF (separado do download para poder testar). */
export async function gerarRelatorioPdf(rel: RelatorioBusca) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  const largura = doc.internal.pageSize.getWidth();
  const azul: [number, number, number] = [14, 141, 225];

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(11, 20, 36);
  doc.text('PROGPT', 40, 46);
  doc.setFontSize(13);
  doc.text(rel.titulo, 40, 68);

  autoTable(doc, {
    startY: 84,
    body: rel.resumo,
    theme: 'plain',
    styles: { fontSize: 10, cellPadding: 3, textColor: [40, 50, 70] },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 140 } },
    margin: { left: 40, right: 40 },
  });

  for (const secao of rel.secoes) {
    const y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 22;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(11, 20, 36);
    doc.text(`${secao.titulo} (${secao.linhas.length})`, 40, y);
    autoTable(doc, {
      startY: y + 8,
      head: [secao.colunas],
      body: secao.linhas.length ? secao.linhas : [[`Nenhum resultado.`, ...secao.colunas.slice(1).map(() => '')]],
      styles: { fontSize: 8, cellPadding: 4, overflow: 'linebreak', valign: 'top' },
      headStyles: { fillColor: azul, textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [244, 247, 251] },
      margin: { left: 40, right: 40 },
    });
  }

  const paginas = doc.getNumberOfPages();
  for (let i = 1; i <= paginas; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(120, 130, 150);
    doc.text(`PROGPT · 2B Supply · gerado em ${rel.geradoEm}`, 40, doc.internal.pageSize.getHeight() - 20);
    doc.text(`Página ${i} de ${paginas}`, largura - 40, doc.internal.pageSize.getHeight() - 20, { align: 'right' });
  }
  return doc;
}

export async function baixarRelatorioPdf(rel: RelatorioBusca, nomeArquivo: string): Promise<void> {
  const doc = await gerarRelatorioPdf(rel);
  doc.save(`${nomeArquivo}.pdf`);
}
