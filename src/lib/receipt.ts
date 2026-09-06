import { jsPDF } from 'jspdf';
import { formatCurrency, formatPhone } from './utils';
import { PAYMENT_METHODS } from '../constants';

export interface ServiceReceiptData {
  clientName: string;
  clientPhone: string;
  service: string;
  staffName: string;
  price: number;
  paymentMethod?: string;
  date: Date;
  notes?: string;
  receiptCode: string;
}

function paymentLabel(method?: string) {
  if (!method) return 'Não informado';
  return PAYMENT_METHODS.find((pm) => pm.value === method)?.label || method;
}

// Gera a "Nota de Serviço" em PDF (usada tanto para imprimir quanto para
// mandar uma cópia pro cliente pelo WhatsApp). Layout enxuto, pensado pra
// caber bem tanto numa folha A4 comum quanto numa impressora térmica de
// recibo (a largura é fixa em 80mm — o conteúdo cresce verticalmente).
export function buildServiceReceiptPdf(data: ServiceReceiptData): jsPDF {
  const pageWidth = 80; // mm — padrão de bobina térmica; imprime normal em A4 também.
  const margin = 5;
  const contentWidth = pageWidth - margin * 2;

  const doc = new jsPDF({ unit: 'mm', format: [pageWidth, 200] });
  let y = 10;

  const pink: [number, number, number] = [227, 142, 160];
  const dark: [number, number, number] = [51, 65, 85];
  const gray: [number, number, number] = [148, 163, 184];

  const center = (text: string) => pageWidth / 2 - (doc.getTextWidth(text) / 2);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...pink);
  doc.text('Estúdio da Alê', center('Estúdio da Alê'), y);
  y += 5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...gray);
  const subtitle = 'Nota de Serviço';
  doc.text(subtitle, center(subtitle), y);
  y += 4;

  doc.setDrawColor(...pink);
  doc.setLineWidth(0.4);
  doc.line(margin, y, pageWidth - margin, y);
  y += 6;

  doc.setFontSize(8);
  doc.setTextColor(...gray);
  doc.text('CÓDIGO', margin, y);
  doc.setTextColor(...dark);
  doc.setFont('helvetica', 'bold');
  doc.text(data.receiptCode, pageWidth - margin, y, { align: 'right' });
  y += 5;

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...gray);
  doc.text('DATA', margin, y);
  doc.setTextColor(...dark);
  doc.text(
    data.date.toLocaleDateString('pt-BR'),
    pageWidth - margin,
    y,
    { align: 'right' }
  );
  y += 5;

  doc.setTextColor(...gray);
  doc.text('HORA', margin, y);
  doc.setTextColor(...dark);
  doc.text(
    data.date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    pageWidth - margin,
    y,
    { align: 'right' }
  );
  y += 7;

  doc.setDrawColor(230, 230, 230);
  doc.setLineWidth(0.2);
  doc.line(margin, y, pageWidth - margin, y);
  y += 6;

  const field = (label: string, value: string) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...gray);
    doc.text(label.toUpperCase(), margin, y);
    y += 4;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(...dark);
    const lines = doc.splitTextToSize(value || '-', contentWidth);
    doc.text(lines, margin, y);
    y += 4.5 * lines.length + 3;
  };

  field('Cliente', data.clientName);
  field('Telefone', formatPhone(data.clientPhone));
  field('Serviço realizado', data.service);
  field('Atendente', data.staffName);

  if (data.notes) {
    field('Observações', data.notes);
  }

  doc.setDrawColor(230, 230, 230);
  doc.line(margin, y, pageWidth - margin, y);
  y += 6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...gray);
  doc.text('FORMA DE PAGAMENTO', margin, y);
  y += 4;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(...dark);
  doc.text(paymentLabel(data.paymentMethod), margin, y);
  y += 9;

  doc.setFillColor(...pink);
  doc.roundedRect(margin, y - 5, contentWidth, 14, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text('VALOR TOTAL', margin + 4, y + 1);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(formatCurrency(data.price), pageWidth - margin - 4, y + 3.5, { align: 'right' });
  y += 16;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...gray);
  const thanks = 'Obrigada pela preferência!';
  doc.text(thanks, center(thanks), y);
  y += 4;
  const footer = 'Estúdio da Alê · Gestão Inteligente';
  doc.text(footer, center(footer), y);

  return doc;
}

export function receiptFileName(data: ServiceReceiptData) {
  const safeName = data.clientName.replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase();
  return `nota-servico-${safeName}-${data.receiptCode}.pdf`;
}

export function makeReceiptCode(appointmentId: string) {
  return appointmentId.slice(-6).toUpperCase();
}
