const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/medicaoFotos-DmWi0tM7.js","assets/index-C5VnQKw8.js","assets/react-BAfsePbU.js","assets/radix-CcLZJacK.js","assets/index-DgQFtD1_.css","assets/obraFotos-DVG01sT1.js","assets/finUtil-j7UVIKjB.js","assets/relatorioFotograficoExport-CLs5f3Yn.js","assets/modelosRfStore-CaSWOwF1.js"])))=>i.map(i=>d[i]);
import{_ as G,w as Q,y as X,Y as Z,b1 as tt,a$ as H,V as st,b0 as et}from"./index-C5VnQKw8.js";import{M as lt,d as ot}from"./modelosPlanilhaQuery-DQC2N8rB.js";import{c as at,i as dt}from"./modelosRfStore-CaSWOwF1.js";import"./react-BAfsePbU.js";import"./radix-CcLZJacK.js";function rt(e){return{hdrPrincipal:`#${e.cores.hdr_principal}`,hdrSub:`#${e.cores.hdr_sub}`,hdrCabec:`#${e.cores.hdr_cabec}`,hdrDirBg:`#${e.cores.hdr_topo}`,thBase:`#${e.cores.th_base}`,thMed:`#${e.cores.th_medicao}`,trGrupo:`#${e.cores.linha_grupo}`,trTotal:`#${e.cores.linha_total}`,extensoBg:`#${e.cores.extenso_bg}`,extensoBdr:`#${e.cores.extenso_borda}`,memTitulo:`#${e.cores.mem_titulo}`,memSub:`#${e.cores.hdr_sub}`,memGrupo:`#${e.cores.mem_grupo}`,memGrupoFnt:`#${e.cores.mem_titulo}`,memMiniHdr:`#${e.cores.mem_minihdr}`,memMiniHdrFnt:`#${e.cores.mem_minihdr_fnt}`,memApagar:`#${e.cores.mem_apagar}`,memPago:`#${e.cores.mem_pago}`,memTotAc:`#${e.cores.mem_tot_acum}`,memTotAnt:`#${e.cores.mem_tot_ant}`,memTotMes:`#${e.cores.mem_tot_mes}`,thMem:`#${e.cores.mem_titulo}`,faixaTopo:`#${e.cores.hdr_topo}`,linhaPeriodo:`#${e.cores.linha_periodo}`,linha100pct:`#${e.cores.linha_100pct}`,linhaPar:`#${e.cores.linha_par}`,linhaImpar:`#${e.cores.linha_impar}`,empresaBg:`#${e.cores.empresa_bg}`}}async function ft(e,p,r,i,w,o,_,h,m,a="completo",d=!1){const f=m??(e.tipo==="PREFEITURA"?lt:ot),y=f.base==="PREFEITURA",l=rt(f),g=[];a!=="memoria"&&g.push(`<div class="pw">${it(e,p,r,i,w,o,h,l,y)}</div>`),a!=="planilha"&&g.push(`<div class="pw">${nt(e,p,r,i,w,l,y,d)}</div>`);const x=g.join('<div class="page-break"></div>'),n=ct(p,r,x,l,a),s=new Blob([n],{type:"text/html; charset=utf-8"}),u=URL.createObjectURL(s),A=window.open(u,"_blank");A&&A.addEventListener("load",()=>setTimeout(()=>{A.print(),URL.revokeObjectURL(u)},800)),a!=="memoria"&&_&&_.length>0&&await mt(e,p,r,_)}function ct(e,p,r,i,w="completo"){const o=w==="planilha"?" (Planilha)":w==="memoria"?" (Memória de Cálculo)":"";return`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"/>
<title>${e.nome_obra} — ${p.numero_extenso} Medição${o}</title>
<style>
@page{size:A4 landscape;margin:4mm}
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:289mm;max-width:289mm;overflow-x:hidden;font-family:Arial,Helvetica,sans-serif;font-size:5pt;color:#111;background:#fff}
.pw{width:289mm;max-width:289mm;overflow:hidden}
.page-break{page-break-after:always}

/* PREF cabeçalho */
.pf-cab{width:100%;border-collapse:collapse;border:0.6px solid #000;margin-bottom:0.8mm;font-size:5pt;table-layout:auto}
.pf-cab td{padding:0.4mm 0.7mm;vertical-align:middle;border:0.3px solid #000}
.pf-lbl{color:#555;font-size:4.5pt;white-space:nowrap}
.pf-val{font-weight:bold;font-size:5pt}
.pf-hl{background:${i.hdrCabec};font-weight:bold;text-align:right;font-size:5pt}
.pf-hl-val{font-weight:bold;text-align:right;font-size:5.5pt}
.pf-verde{background:${i.linhaPeriodo};font-weight:bold;text-align:right;font-size:5.5pt}
.pf-logo-cell{width:28mm;text-align:center;vertical-align:middle;border-right:0.6px solid #000}
.pf-logo-cell img{max-width:26mm;max-height:18mm;object-fit:contain}
.pf-empresa{font-size:4.5pt;line-height:1.35;vertical-align:top;text-align:left;padding:0.8mm;width:28mm}

/* ESTADO cabeçalho */
.est-cab{display:flex;border:1px solid ${i.hdrPrincipal};margin-bottom:1mm}
.est-logo{width:20mm;min-width:20mm;display:flex;align-items:center;justify-content:center;border-right:0.6px solid ${i.hdrPrincipal};padding:0.8mm;background:#fff}
.est-logo img{max-height:10mm;max-width:18mm;object-fit:contain}
.est-logo span{font-size:5pt;color:#555;text-align:center}
.est-centro{flex:1;display:flex;flex-direction:column;min-width:0}
.est-orgao{background:${i.hdrPrincipal};color:#fff;font-weight:bold;font-size:6.5pt;text-align:center;padding:0.8mm}
.est-sub{background:${i.hdrSub};color:#fff;font-size:5.5pt;text-align:center;padding:0.5mm}
.est-obra{background:${i.hdrCabec};font-size:5pt;text-align:center;padding:0.5mm;font-weight:bold;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.est-ctr{background:${i.hdrCabec};font-size:4.5pt;text-align:center;padding:0.3mm}
.est-dir{width:22mm;min-width:22mm;display:flex;flex-direction:column;border-left:0.6px solid ${i.hdrPrincipal}}
.est-dir-num{background:${i.hdrDirBg};color:#fff;font-weight:bold;font-size:8pt;text-align:center;padding:0.8mm;flex:1;display:flex;align-items:center;justify-content:center}
.est-dir-info{background:${i.hdrCabec};font-size:4pt;text-align:center;padding:0.4mm;border-top:0.4px solid ${i.hdrPrincipal}}

/* Tabela medição */
.t-med{width:100%;border-collapse:collapse;font-size:4.5pt;table-layout:fixed}
.t-med th,.t-med td{border:0.3px solid #000;padding:0.2mm 0.35mm;vertical-align:middle;overflow:hidden;text-overflow:ellipsis}
.th-b{color:#fff;font-weight:bold;text-align:center;font-size:4pt;line-height:1.15;white-space:normal;word-break:break-word}
.th-m{color:#fff;font-weight:bold;text-align:center;font-size:4pt;line-height:1.15;white-space:normal;word-break:break-word}
.tr-par{background:${i.linhaPar}} .tr-imp{background:${i.linhaImpar}}
.td-desc{text-align:left!important;white-space:normal!important;word-break:break-word;line-height:1.15;max-width:0}
.td-per{background:${i.linhaPeriodo};font-weight:bold}
.td-100{background:${i.linha100pct};color:#fff}
.num{text-align:right;white-space:nowrap} .ctr{text-align:center;white-space:nowrap}

/* Extenso / Demo */
.extenso{padding:0.8mm 1.5mm;margin:0.8mm 0;font-weight:bold;font-size:5.5pt;border-width:0.8px;border-style:solid}
.demo-titulo{color:#fff;font-weight:bold;font-size:6pt;padding:0.8mm;margin-top:1mm}
.demo-t{width:68mm;border-collapse:collapse;margin-top:0.6mm}
.demo-t td{border:0.3px solid #000;padding:0.5mm 1mm;font-size:5pt}
.d-par{background:#F5F5F5} .d-imp{background:#fff}
.d-val{font-weight:bold;text-align:right;width:24mm}

/* Memória */
.mem-tit{font-size:7pt;font-weight:bold;margin-bottom:0.8mm;padding:0.8mm 1.5mm;border-left-width:3px;border-left-style:solid}
.t-mem{width:100%;border-collapse:collapse;margin-top:0.8mm;font-size:4.5pt;table-layout:fixed}
.t-mem th,.t-mem td{border:0.3px solid #000;padding:0.2mm 0.4mm;vertical-align:middle;overflow:hidden;text-overflow:ellipsis}
.th-mem{color:#fff;font-weight:bold;text-align:center;font-size:4.5pt;white-space:nowrap}
.tr-srv{font-weight:bold}
.tr-mhdr .mh{font-weight:bold;text-align:center;font-size:4.5pt;white-space:nowrap}
.tr-tam{font-weight:bold} .tr-tan{font-weight:bold} .tr-tme{font-weight:bold}

thead{display:table-header-group} tbody{display:table-row-group} tr{page-break-inside:avoid}
/* Anti-órfão: serviço e mini-cabeçalho nunca fecham a página sozinhos (andam com a 1ª sub-memória) */
.tr-srv,.tr-mhdr{page-break-after:avoid;break-after:avoid}
@media print{
  body{-webkit-print-color-adjust:exact;print-color-adjust:exact}
  html,body{width:289mm;max-width:289mm}
  .page-break{page-break-after:always}
  @page{size:A4 landscape;margin:4mm}
  thead{display:table-header-group} tr{page-break-inside:avoid}
}
</style></head><body>
${r}
</body></html>`}function it(e,p,r,i,w,o,_,h,m){var N,U,V,j;const a=(t,c=2)=>t.toLocaleString("pt-BR",{minimumFractionDigits:c,maximumFractionDigits:c}),d=t=>`R$ ${a(t)}`,f=r.data_medicao?new Date(r.data_medicao+"T00:00:00").toLocaleDateString("pt-BR"):"—",y=r.periodo_referencia||f,l=X(i,w,r),g=r.desconto_percentual;let x="";if(m){const t=Q.getState().empresa,c=O=>O.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"),$=c(((N=t==null?void 0:t.cnpj)==null?void 0:N.trim())||""),L=[(U=t==null?void 0:t.nome)!=null&&U.trim()?`<strong>${c(t.nome.trim().toUpperCase())}</strong>`:"",$?`CNPJ: ${$}`:"",c(((V=t==null?void 0:t.email_contato)==null?void 0:V.trim())||""),c(((j=t==null?void 0:t.telefone)==null?void 0:j.trim())||"")].filter(Boolean).join("<br/>");x=`<table class="pf-cab">
  <tr>${o?`<td class="pf-logo-cell" rowspan="9"><img src="${o}" alt="Logo"/></td>`:`<td class="pf-logo-cell" rowspan="9" style="font-weight:bold;font-size:6pt;color:${h.hdrPrincipal}">${c(dt((t==null?void 0:t.nome)||""))}</td>`}<td class="pf-lbl">CONCEDENTE</td><td class="pf-lbl">Data emissão BM</td><td class="pf-lbl">Período ref.</td><td class="pf-hl" colspan="2">VALOR DO CONTRATO</td>
    <td class="pf-empresa" rowspan="9">${L}</td></tr>
  <tr><td class="pf-val">${e.orgao_nome||""}</td><td class="pf-val">${f}</td><td class="pf-val">${y}</td><td class="pf-hl-val" colspan="2">${d(l.totalOrcamento)}</td></tr>
  <tr><td class="pf-lbl">CONVENENTE</td><td colspan="2" class="pf-lbl">OBJETIVO DA O.S.</td><td class="pf-lbl" colspan="2">VALOR O.S. ${e.numero_contrato||""}</td></tr>
  <tr><td class="pf-val">${e.orgao_nome||""}</td><td colspan="2" class="pf-val">${p.nome_obra||""}</td><td class="pf-hl-val" colspan="2">${d(l.totalOrcamento)}</td></tr>
  <tr><td class="pf-lbl">PROC. LICITATÓRIO</td><td colspan="2" class="pf-val">${p.numero_contrato||""}</td><td class="pf-hl" colspan="2">VALOR ACUMULADO</td></tr>
  <tr><td class="pf-lbl">EMPRESA</td><td class="pf-lbl">CNPJ</td><td></td><td class="pf-hl-val" colspan="2">${d(l.valorAcumulado)}</td></tr>
  <tr><td class="pf-val">${e.empresa_executora||""}</td><td class="pf-val">${$}</td><td></td><td class="pf-hl" colspan="2">SALDO CONTRATO</td></tr>
  <tr><td colspan="3"></td><td class="pf-hl-val" colspan="2">${d(l.valorSaldo)}</td></tr>
  <tr><td class="pf-val">BM N° ${r.numero}</td><td class="pf-lbl">EMISSÃO: <strong>${f}</strong></td><td class="pf-lbl">VALOR MEDIDO:</td><td class="pf-verde" colspan="2">${d(l.valorPeriodo)}</td></tr>
</table>`}else x=`<div class="est-cab">
  <div class="est-logo">${o?`<img src="${o}" alt="Logo"/>`:`<span>${e.empresa_executora}</span>`}</div>
  <div class="est-centro">
    <div class="est-orgao">${e.orgao_nome}</div>
    <div class="est-sub">${e.orgao_subdivisao||""}</div>
    <div class="est-obra">OBRA: ${p.nome_obra} | LOCAL: ${p.local_obra}</div>
    <div class="est-ctr">Contrato: ${p.numero_contrato||"—"} | Empresa: ${e.empresa_executora}</div>
  </div>
  <div class="est-dir">
    <div class="est-dir-num">${r.numero_extenso} MED.</div>
    <div class="est-dir-info">Data: ${f}</div>
    <div class="est-dir-info">Período: ${y}</div>
    <div class="est-dir-info">Desc: ${(g*100).toFixed(2)}% | BDI: ${(r.bdi_percentual*100).toFixed(2)}%</div>
  </div>
</div>`;const n=`background:${h.thBase}`,s=`background:${h.thMed}`;let u="";m?u=`<colgroup>
  <col style="width:2.5%"/><col style="width:5%"/><col style="width:18%"/><col style="width:3.5%"/><col style="width:2.5%"/><col style="width:4.5%"/>
  <col style="width:4.5%"/><col style="width:4.5%"/><col style="width:5%"/>
  <col style="width:4.5%"/><col style="width:4.5%"/><col style="width:3.5%"/><col style="width:5%"/><col style="width:4.5%"/>
  <col style="width:5.5%"/><col style="width:5.5%"/><col style="width:5%"/><col style="width:3.5%"/>
</colgroup><thead>
  <tr><th class="th-b" style="${n}" rowspan="2">ITEM</th><th class="th-b" style="${n}" rowspan="2">CÓDIGO</th><th class="th-b" style="${n}" rowspan="2">DESCRIÇÃO</th>
    <th class="th-b" style="${n}" rowspan="2">FONTE</th><th class="th-b" style="${n}" rowspan="2">UN</th><th class="th-b" style="${n}" rowspan="2">QTD</th>
    <th class="th-b" style="${n}" colspan="2">P.UNIT. R$</th><th class="th-b" style="${n}">P.TOTAL R$</th>
    <th class="th-m" style="${s}" colspan="9">PLANILHA DE MEDIÇÃO</th></tr>
  <tr><th class="th-b" style="${n}">S/BDI</th><th class="th-b" style="${n}">C/BDI</th><th class="th-b" style="${n}">DESC.${(g*100).toFixed(0)}%</th>
    <th class="th-m" style="${s}">AC.ANT</th><th class="th-m" style="${s}">MED.PER</th><th class="th-m" style="${s}">%</th>
    <th class="th-m" style="${s}">AC.UND</th><th class="th-m" style="${s}">SALDO</th>
    <th class="th-m" style="${s}">MED.R$</th><th class="th-m" style="${s}">AC.R$</th><th class="th-m" style="${s}">SALD.R$</th><th class="th-m" style="${s}">%</th></tr>
</thead>`:u=`<colgroup>
  <col style="width:2%"/><col style="width:3.5%"/><col style="width:4%"/><col style="width:17%"/><col style="width:2.5%"/><col style="width:4%"/>
  <col style="width:4.2%"/><col style="width:4.2%"/><col style="width:5%"/><col style="width:2.8%"/>
  <col style="width:4%"/><col style="width:4%"/><col style="width:4%"/><col style="width:4%"/><col style="width:4%"/>
  <col style="width:4%"/><col style="width:4.8%"/><col style="width:4.8%"/><col style="width:4.8%"/><col style="width:4.8%"/><col style="width:3%"/>
</colgroup><thead>
  <tr><th class="th-b" style="${n}" colspan="10">PLANILHA BASE</th><th class="th-m" style="${s}" colspan="11">PLANILHA DE MEDIÇÃO</th></tr>
  <tr><th class="th-b" style="${n}">ITEM</th><th class="th-b" style="${n}">FONTE</th><th class="th-b" style="${n}">CÓD</th><th class="th-b" style="${n}">DESCRIÇÃO</th>
    <th class="th-b" style="${n}">UN</th><th class="th-b" style="${n}">QTD</th><th class="th-b" style="${n}">PU R$</th><th class="th-b" style="${n}">PU c/ BDI</th>
    <th class="th-b" style="${n}">TOTAL</th><th class="th-b" style="${n}">PESO%</th>
    <th class="th-m" style="${s}">PREV</th><th class="th-m" style="${s}">ANT.AC</th><th class="th-m" style="${s}">PERÍODO</th><th class="th-m" style="${s}">ACUM</th><th class="th-m" style="${s}">SALDO</th>
    <th class="th-m" style="${s}">UNIT</th><th class="th-m" style="${s}">ANT.R$</th><th class="th-m" style="${s}">AC.R$</th>
    <th class="th-m" style="${s}">PER.R$</th><th class="th-m" style="${s}">SALD.R$</th><th class="th-m" style="${s}">%</th></tr>
</thead>`;let A="",F=0;const z=`background:${h.trGrupo}`,J=t=>i.filter(c=>!c.is_grupo&&c.item.startsWith(t+".")).reduce((c,$)=>c+H($,r.bdi_percentual,g),0);for(const t of[...i].sort((c,$)=>c.ordem-$.ordem)){const c=Z(t,r.bdi_percentual);tt(t,r.bdi_percentual);const $=H(t,r.bdi_percentual,g);if(t.is_grupo){const v=J(t.item);A+=m?`<tr style="${z};font-weight:bold"><td class="ctr">${t.item}</td><td></td><td class="td-desc">${t.descricao}</td><td></td><td></td><td></td><td></td><td></td><td class="num">${d(v)}</td><td colspan="9"></td></tr>`:`<tr style="${z};font-weight:bold"><td class="ctr">${t.item}</td><td colspan="3" class="td-desc">${t.descricao}</td><td colspan="4"></td><td class="num">${d(v)}</td><td colspan="12"></td></tr>`;continue}const L=w.get(t.id)||[],{qtdAnterior:T,qtdPeriodo:O,qtdAcumulada:E,qtdSaldo:C}=st(t,L),q=F%2===0?"tr-par":"tr-imp",P=t.quantidade>0?E/t.quantidade:0,D=P>=1&&t.quantidade>0,R=t.preco_total_fixo!=null&&t.preco_total_fixo>0?1:1-g,b=v=>Math.round(v*100+1e-10)/100;if(m){const v=O>0?" td-per":"",k=P>=1?" td-100":"",M=D&&T===0?$:D?$-b(b(T*c)*R):b(b(O*c)*R),S=D?$:b(b(E*c)*R),I=D?0:b(b(C*c)*R);A+=`<tr class="${q}"><td class="ctr">${t.item}</td><td class="ctr">${t.codigo}</td><td class="td-desc">${t.descricao}</td><td class="ctr">${t.fonte}</td><td class="ctr">${t.unidade}</td><td class="num">${a(t.quantidade)}</td><td class="num">${d(t.preco_unitario)}</td><td class="num">${d(c)}</td><td class="num">${d($)}</td><td class="num${T>0?" td-per":""}">${a(T)}</td><td class="num${v}">${a(O)}</td><td class="num${v}">${a(P*100,2)}%</td><td class="num">${a(E)}</td><td class="num">${a(C)}</td><td class="num${v}">${d(M)}</td><td class="num">${d(S)}</td><td class="num">${d(I)}</td><td class="num${k}">${a(P*100,2)}%</td></tr>`}else{const v=" td-per",k=b(b(T*c)*R),M=D?$:b(b(E*c)*R),S=D&&T===0?$:D?$-k:b(b(O*c)*R),I=D?0:$-M;A+=`<tr class="${q}"><td class="ctr">${t.item}</td><td class="ctr">${t.fonte}</td><td class="ctr">${t.codigo}</td><td class="td-desc">${t.descricao}</td><td class="ctr">${t.unidade}</td><td class="num">${a(t.quantidade)}</td><td class="num">${d(t.preco_unitario)}</td><td class="num">${d(c)}</td><td class="num">${d($)}</td><td class="ctr">—</td><td class="num">${a(t.quantidade)}</td><td class="num">${a(T)}</td><td class="num${v}">${a(O)}</td><td class="num">${a(E)}</td><td class="num">${a(C)}</td><td class="num">${d(c)}</td><td class="num">${d(k)}</td><td class="num">${d(M)}</td><td class="num${v}">${d(S)}</td><td class="num">${d(I)}</td><td class="num">${a((1-P)*100,2)}%</td></tr>`}F++}const B=`background:${h.trTotal};color:#fff`,K=m?`<tr style="${B}"><td colspan="8" style="text-align:center;font-size:5.5pt">TOTAIS GERAIS</td><td class="num">${a(l.totalOrcamento*(1-g))}</td><td colspan="4"></td><td></td><td class="num">${a(l.valorPeriodo)}</td><td class="num">${a(l.valorAcumulado)}</td><td class="num">${a(l.valorSaldo)}</td><td></td></tr>`:`<tr style="${B}"><td colspan="8" style="text-align:center;font-size:5.5pt">TOTAIS GERAIS</td><td class="num">${a(l.totalOrcamento)}</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td class="num">${a(l.valorAcumulado)}</td><td class="num">${a(l.valorPeriodo)}</td><td class="num">${a(l.valorSaldo)}</td><td></td></tr>`,Y=(_||[]).map((t,c)=>`<tr class="${c%2===0?"d-par":"d-imp"}"><td>${t.numero_extenso} Med. (Anterior)</td><td class="d-val">${d(t.valorPeriodo)}</td></tr>`).join(""),W=[`<tr class="d-par"><td><strong>Valor Total Orçamento</strong></td><td class="d-val">${d(l.totalOrcamento)}</td></tr>`,Y,l.valorAcumulado-l.valorPeriodo>0?`<tr class="d-imp"><td><strong>Total Fat. Anterior</strong></td><td class="d-val">${d(l.valorAcumulado-l.valorPeriodo)}</td></tr>`:"",`<tr style="background:${h.linhaPeriodo}"><td><strong>${r.numero_extenso} Med. — Período</strong></td><td class="d-val" style="color:${h.hdrPrincipal}">${d(l.valorPeriodo)}</td></tr>`,`<tr class="d-par"><td>% da Medição</td><td class="d-val">${a(l.percentualPeriodo*100)}%</td></tr>`,`<tr class="d-imp"><td><strong>Faturado Acumulado</strong></td><td class="d-val">${d(l.valorAcumulado)}</td></tr>`,`<tr class="d-par"><td>% Acumulado</td><td class="d-val">${a(l.percentualAcumulado*100)}%</td></tr>`,`<tr style="background:${h.trGrupo}"><td><strong>Saldo do Contrato</strong></td><td class="d-val" style="color:${h.hdrPrincipal}">${d(l.valorSaldo)}</td></tr>`,`<tr class="d-imp"><td>% do Saldo</td><td class="d-val">${a(l.percentualSaldo*100)}%</td></tr>`].join("");return`${x}
<table class="t-med">${u}<tbody>${A}${K}</tbody></table>
<div class="extenso" style="background:${h.extensoBg};border-color:${h.extensoBdr}">A presente medição importa o valor de: ${et(l.valorPeriodo).toUpperCase()} — ${new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(l.valorPeriodo)}</div>
<div class="demo-titulo" style="background:${m?h.hdrPrincipal:h.memTitulo}">DEMONSTRATIVO FINANCEIRO</div>
<table class="demo-t"><tbody>${W}</tbody></table>`}function nt(e,p,r,i,w,o,_,h=!1){const m=(y,l=2)=>y==null?"—":y.toLocaleString("pt-BR",{minimumFractionDigits:l,maximumFractionDigits:l}),a=r.data_medicao?new Date(r.data_medicao+"T00:00:00").toLocaleDateString("pt-BR"):"—",d=r.periodo_referencia||a;let f="";for(const y of i.filter(l=>!l.is_grupo).sort((l,g)=>l.ordem-g.ordem)){const l=(w.get(y.id)||[]).sort((s,u)=>s.sub_item.localeCompare(u.sub_item));if(!l.length)continue;const g=h?l.filter(s=>s.status!=="Pago"):l;if(!g.length)continue;f+=`<tr class="tr-srv" style="background:${o.memGrupo};color:${o.memGrupoFnt}"><td class="ctr">${y.item}</td><td colspan="13" style="text-align:left">${y.descricao} — ${y.unidade}</td></tr>`,f+=`<tr class="tr-mhdr" style="background:${o.memMiniHdr};color:${o.memMiniHdrFnt}"><td></td><td></td><td class="mh">Larg.</td><td class="mh">Comp.</td><td class="mh">Alt.</td><td class="mh">Perim.</td><td class="mh">Área</td><td class="mh">Vol.</td><td class="mh">Kg</td><td class="mh">Outros</td><td class="mh">Desc.</td><td class="mh">Qtde</td><td class="mh">TOTAL</td><td class="mh">STATUS</td></tr>`;for(const s of g){const u=s.status==="A pagar"?o.memApagar:s.status==="Pago"?o.memPago:"#FCE4D6";f+=`<tr style="background:${u}"><td class="ctr">${s.sub_item}</td><td style="font-size:4.5pt;text-align:left;white-space:normal;word-break:break-word">${s.descricao_calculo}</td><td class="num">${m(s.largura)}</td><td class="num">${m(s.comprimento)}</td><td class="num">${m(s.altura)}</td><td class="num">${m(s.perimetro)}</td><td class="num">${m(s.area)}</td><td class="num">${m(s.volume)}</td><td class="num">${m(s.kg)}</td><td class="num">${m(s.outros)}</td><td class="num">${m(s.desconto_dim)}</td><td class="num">${m(s.quantidade)}</td><td class="num" style="font-weight:bold">${m(s.total)}</td><td class="ctr" style="font-size:4pt">${s.status}</td></tr>`}const x=l.filter(s=>s.status==="Pago").reduce((s,u)=>s+u.total,0),n=l.filter(s=>s.status==="A pagar").reduce((s,u)=>s+u.total,0);f+=`<tr class="tr-tam" style="background:${o.memTotAc}"><td colspan="12" style="text-align:right">TOTAL ACUMULADO:</td><td class="num">${m(x+n)}</td><td></td></tr>
      <tr class="tr-tan" style="background:${o.memTotAnt}"><td colspan="12" style="text-align:right">TOTAL ACUM. ANTERIOR:</td><td class="num">${m(x)}</td><td></td></tr>
      <tr class="tr-tme" style="background:${o.memTotMes}"><td colspan="12" style="text-align:right">TOTAL MÊS (A PAGAR):</td><td class="num">${m(n)}</td><td></td></tr>
      <tr><td colspan="14" style="height:1mm"></td></tr>`}return`<div class="mem-tit" style="background:${o.memGrupo};color:${o.memTitulo};border-color:${o.memTitulo}">MEMÓRIA DE CÁLCULO &nbsp;|&nbsp; ${p.nome_obra} &nbsp;|&nbsp; ${r.numero_extenso} MEDIÇÃO &nbsp;|&nbsp; ${d}</div>
<table class="t-mem"><colgroup><col style="width:4%"/><col style="width:22%"/><col style="width:5.5%"/><col style="width:5.5%"/><col style="width:5.5%"/><col style="width:5.5%"/><col style="width:5.5%"/><col style="width:5.5%"/><col style="width:5.5%"/><col style="width:5.5%"/><col style="width:5.5%"/><col style="width:5.5%"/><col style="width:7%"/><col style="width:7%"/></colgroup>
  <thead><tr><th class="th-mem" style="background:${o.thMem}">ITEM</th><th class="th-mem" style="background:${o.thMem}">DESCRIÇÃO</th><th class="th-mem" style="background:${o.thMem}">Larg.</th><th class="th-mem" style="background:${o.thMem}">Comp.</th><th class="th-mem" style="background:${o.thMem}">Alt.</th><th class="th-mem" style="background:${o.thMem}">Perim.</th><th class="th-mem" style="background:${o.thMem}">Área</th><th class="th-mem" style="background:${o.thMem}">Vol.</th><th class="th-mem" style="background:${o.thMem}">Kg</th><th class="th-mem" style="background:${o.thMem}">Outros</th><th class="th-mem" style="background:${o.thMem}">Desc.</th><th class="th-mem" style="background:${o.thMem}">Qtde</th><th class="th-mem" style="background:${o.thMem}">TOTAL</th><th class="th-mem" style="background:${o.thMem}">STATUS</th></tr></thead>
  <tbody>${f}</tbody></table>`}async function mt(e,p,r,i){const[{comDataUrl:w},{gerarRelatorioFotograficoPDF:o}]=await Promise.all([G(()=>import("./medicaoFotos-DmWi0tM7.js"),__vite__mapDeps([0,1,2,3,4,5,6])),G(()=>import("./relatorioFotograficoExport-CLs5f3Yn.js"),__vite__mapDeps([7,1,2,3,4,8]))]),_=await w(i),h=r.data_medicao?new Date(r.data_medicao.slice(0,10)+"T00:00:00").toLocaleDateString("pt-BR"):"—";await o(at(Q.getState().empresa),{obra:p.nome_obra||e.nome_obra||"",local:p.local_obra||e.local_obra||"",medicao:`${r.numero_extenso} Medição`,data:h,empresaExecutora:e.empresa_executora||""},_.map(m=>({src:m.base64||"",legenda:m.legenda||""})),{saida:"abrir"})}export{mt as gerarFotosPDF,ft as gerarMedicaoPDF};
