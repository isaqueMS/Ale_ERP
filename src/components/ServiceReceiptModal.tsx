import React, { useMemo, useState } from 'react';
import { X, Printer, Send, Loader2, CheckCircle2, FileText } from 'lucide-react';
import { Appointment, Client, Staff } from '../types';
import { formatCurrency, formatPhone } from '../lib/utils';
import { sendWhatsAppDocument, sendWhatsAppTemplate } from '../lib/whatsapp';
import { buildServiceReceiptPdf, receiptFileName, makeReceiptCode } from '../lib/receipt';
import { PAYMENT_METHODS } from '../constants';

interface ServiceReceiptModalProps {
  appointment: Appointment;
  client?: Client;
  staffMember?: Staff;
  onClose: () => void;
}

// Modal que aparece depois de concluir um atendimento (ou ao reabrir um já
// concluído): monta a Nota de Serviço em PDF e permite imprimir (abre o PDF
// numa aba nova pronto pra mandar pra qualquer impressora já instalada no
// computador) ou enviar uma cópia direto pro WhatsApp do cliente.
export default function ServiceReceiptModal({ appointment, client, staffMember, onClose }: ServiceReceiptModalProps) {
  const [sendState, setSendState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const receiptData = useMemo(() => ({
    clientName: client?.name || 'Cliente',
    clientPhone: client?.phone || '',
    service: appointment.service,
    staffName: staffMember?.name || 'Não informado',
    price: appointment.price,
    paymentMethod: appointment.paymentMethod,
    date: new Date(appointment.date),
    notes: appointment.notes,
    receiptCode: makeReceiptCode(appointment.id)
  }), [appointment, client, staffMember]);

  const paymentLabel = PAYMENT_METHODS.find(pm => pm.value === appointment.paymentMethod)?.label || 'Não informado';

  const handlePrint = () => {
    const doc = buildServiceReceiptPdf(receiptData);
    doc.autoPrint();
    const blobUrl = doc.output('bloburl');
    window.open(blobUrl as unknown as string, '_blank');
  };

  const handleSendToClient = async () => {
    if (!client?.phone) {
      setSendState('error');
      setErrorMsg('Este cliente não tem telefone cadastrado.');
      return;
    }
    setSendState('sending');
    setErrorMsg('');
    try {
      const doc = buildServiceReceiptPdf(receiptData);
      const dataUri = doc.output('datauristring');
      const base64Pdf = dataUri.split(',')[1] || '';
      const filename = receiptFileName(receiptData);
      const caption = `Olá, ${receiptData.clientName}! Segue a nota do seu atendimento (${receiptData.service}) no Estúdio da Alê. 💕`;

      try {
        await sendWhatsAppDocument(client.phone, filename, base64Pdf, caption);
      } catch (err: any) {
        if (err?.code === 'window_closed') {
          // Reabre a janela de 24h com o template de boas-vindas e tenta de novo.
          await sendWhatsAppTemplate(client.phone);
          await sendWhatsAppDocument(client.phone, filename, base64Pdf, caption);
        } else {
          throw err;
        }
      }
      setSendState('sent');
    } catch (err: any) {
      setSendState('error');
      setErrorMsg(err?.message || 'Falha ao enviar o PDF para o cliente.');
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md" onClick={onClose}>
      <div
        className="bg-white rounded-5xl w-full max-w-md p-6 sm:p-8 shadow-2xl border border-pink-50 animate-fade-up relative max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose} className="absolute top-5 right-5 sm:top-6 sm:right-6 text-slate-300 hover:text-slate-600 transition-all active:scale-90">
          <X className="w-6 h-6" />
        </button>

        <div className="flex items-center gap-3 mb-6 pr-8">
          <div className="w-11 h-11 rounded-2xl bg-pink-50 text-[#E38EA0] flex items-center justify-center shrink-0">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg sm:text-xl font-semibold text-slate-800 uppercase tracking-tight leading-none">Nota de Serviço</h3>
            <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest mt-2">Código {receiptData.receiptCode}</p>
          </div>
        </div>

        <div className="bg-[#FBF7F6] rounded-3xl p-5 sm:p-6 mb-6 space-y-3">
          <div className="flex justify-between gap-4">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Cliente</span>
            <span className="text-sm font-semibold text-slate-800 text-right">{receiptData.clientName}</span>
          </div>
          {receiptData.clientPhone && (
            <div className="flex justify-between gap-4">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Telefone</span>
              <span className="text-sm font-semibold text-slate-700 text-right">{formatPhone(receiptData.clientPhone)}</span>
            </div>
          )}
          <div className="flex justify-between gap-4">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Serviço</span>
            <span className="text-sm font-semibold text-slate-800 text-right">{receiptData.service}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Atendente</span>
            <span className="text-sm font-semibold text-slate-700 text-right">{receiptData.staffName}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Data / Hora</span>
            <span className="text-sm font-semibold text-slate-700 text-right">
              {receiptData.date.toLocaleDateString('pt-BR')} · {receiptData.date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Pagamento</span>
            <span className="text-sm font-semibold text-slate-700 text-right">{paymentLabel}</span>
          </div>
          <div className="h-px bg-pink-100" />
          <div className="flex justify-between gap-4 items-center">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Valor Total</span>
            <span className="text-lg font-semibold text-[#E38EA0] font-mono italic">{formatCurrency(receiptData.price)}</span>
          </div>
        </div>

        {sendState === 'error' && (
          <div role="alert" className="bg-red-50 text-red-500 text-xs font-semibold p-4 rounded-2xl border border-red-100 mb-4">
            {errorMsg}
          </div>
        )}
        {sendState === 'sent' && (
          <div className="bg-emerald-50 text-emerald-600 text-xs font-semibold p-4 rounded-2xl border border-emerald-100 mb-4 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" /> PDF enviado para o cliente no WhatsApp.
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={handlePrint}
            className="flex-1 text-[11px] font-semibold uppercase tracking-widest text-slate-600 hover:text-slate-800 px-4 py-3.5 rounded-2xl border border-slate-200 bg-white transition-all active:scale-95 flex items-center justify-center gap-2"
          >
            <Printer className="w-4 h-4" /> Imprimir
          </button>
          <button
            onClick={handleSendToClient}
            disabled={sendState === 'sending' || sendState === 'sent'}
            className="flex-[2] btn-primary h-14 rounded-2xl text-[11px] uppercase tracking-widest font-semibold shadow-xl transition-all active:scale-95 flex items-center justify-center gap-3 disabled:opacity-70"
          >
            {sendState === 'sending' ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Enviando...</>
            ) : sendState === 'sent' ? (
              <><CheckCircle2 className="w-4 h-4" /> Enviado</>
            ) : (
              <><Send className="w-4 h-4" /> Enviar PDF pro Cliente</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
