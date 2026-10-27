import{i5 as E,ej as O,i6 as T}from"./index-BuxG1fEY.js";import{p as k}from"./executantePrincipal-Bj5e1S1E.js";const v="Obras & Materiais PROGPT",y="America/Recife";function D(t){return new Date(t+"T00:00:00").toLocaleDateString("pt-BR")}function C(t){if(!t)return"";const n=t.replace(/[\\/:*?"<>|]+/g," ").replace(/\s+/g," ").trim();return n?`-${n}`:""}function A(t,n){const e=document.createElement("iframe");e.style.cssText="position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;border:none;opacity:0",document.body.appendChild(e);const o=e.contentDocument??e.contentWindow?.document;if(!o){document.body.removeChild(e);return}o.open(),o.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${n}</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{background:#fff;color:#111;-webkit-print-color-adjust:exact;print-color-adjust:exact}@page{size:A4;margin:10mm 0}img{display:block}</style>
</head><body>${t}</body></html>`),o.close();let d=!1;function i(){if(d)return;d=!0;const r=document.title;document.title=n;try{e.contentWindow?.focus(),e.contentWindow?.print()}finally{setTimeout(()=>{document.title=r;try{document.body.removeChild(e)}catch{}},2500)}}e.onload=i,setTimeout(i,800)}function I(t,n,e){const o=E(n,t.respostas),d=O(o,t.respostas??{}),i=T(o,t.respostas??{}),r=d.filter(s=>t.respostas?.[s.id]?.resposta==="SIM").length,c=d.filter(s=>t.respostas?.[s.id]?.resposta==="NAO").length,l=d.filter(s=>t.respostas?.[s.id]?.resposta!=null).length,f=new Date().toLocaleString("pt-BR",{timeZone:y}),a=k(t),x=o.secoes.map(s=>{const $=s.perguntas.map((m,u)=>{const p=t.respostas?.[m.id],b=p?.resposta??"—",w=b==="SIM"?"#166534":b==="NAO"?"#b91c1c":"#64748b",z=(p?.evidencias??[]).filter(g=>g.foto_url).map(g=>`<img src="${g.foto_url}" style="max-width:80mm;max-height:50mm;object-fit:cover;border-radius:4px;border:1px solid #cbd5e1;margin-top:2px;" />`).join("");return`<div style="padding:4px 0;border-bottom:${u<s.perguntas.length-1?"1px dashed #cbd5e1":"none"};">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
          <span style="font-size:8.5pt;font-weight:600;">${u+1}. ${m.texto}${m.evidencia==="FOTO"?' <span style="font-size:7pt;color:#ea580c">[F]</span>':""}</span>
          <span style="color:${w};font-weight:700;font-size:8pt;white-space:nowrap;">${b}</span>
        </div>
        ${p?.obs?`<div style="font-size:7.5pt;color:#475569;">Obs: ${p.obs}</div>`:""}
        ${z}
      </div>`}).join("");return`<div style="margin-bottom:4mm;border:1px solid #e2e8f0;border-radius:6px;overflow:hidden;page-break-inside:avoid;">
      <div style="background:#f8fafc;border-bottom:1px solid #e2e8f0;padding:5px 8px;font-size:9pt;font-weight:700;">${s.nome}</div>
      <div style="padding:4px 8px;">${$}</div>
    </div>`}).join(""),h=`<div style="width:210mm;margin:0 auto;padding:0 14mm;font-family:'Segoe UI',Arial,sans-serif;font-size:10pt;color:#0f172a;background:#fff;line-height:1.45;box-sizing:border-box;">
    <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #1e40af;padding-bottom:5mm;margin-bottom:5mm;">
      <div>
        <div style="font-size:13pt;font-weight:700;color:#1e293b;">${v}</div>
        <div style="font-size:8pt;color:#64748b;">Checklist de Vistoria — ${o.nome}</div>
      </div>
      <div style="text-align:right;">
        <div style="font-size:9pt;font-weight:700;color:#0f766e;border:2px solid #0f766e;border-radius:6px;padding:3px 8px;">RELATÓRIO DE VISTORIA</div>
        <div style="font-size:7pt;color:#94a3b8;margin-top:3px;">Emitido: ${f}</div>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 14px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:7px 10px;margin-bottom:4mm;font-size:8.5pt;">
      <div><b style="color:#475569;">Unidade:</b> ${e}</div>
      <div><b style="color:#475569;">Etapa:</b> ${o.nome}</div>
      <div><b style="color:#475569;">Encarregado:</b> ${t.autor_nome??"—"}</div>
      <div><b style="color:#475569;">Executante:</b> ${a.executantes||"—"}</div>
      <div><b style="color:#475569;">Data início:</b> ${t.dados_lote?.data_inicio?D(t.dados_lote.data_inicio):"—"}</div>
      <div><b style="color:#475569;">Status:</b> ${t.status==="CONCLUIDO"?"Concluído":"Em andamento"}</div>
      ${a.ajudantes?`<div><b style="color:#475569;">Ajudantes:</b> ${a.ajudantes}</div>`:""}
      ${t.dados_lote?.observacao?`<div style="grid-column:span 2"><b style="color:#475569;">Obs.:</b> ${t.dados_lote.observacao}</div>`:""}
    </div>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:5px;margin-bottom:5mm;">
      <div style="border:1px solid #bae6fd;border-radius:6px;padding:5px;background:#f0f9ff;"><div style="font-size:7pt;color:#0c4a6e;font-weight:700;">NOTA</div><div style="font-size:12pt;font-weight:800;color:#0c4a6e;">${i.toFixed(1)}%</div></div>
      <div style="border:1px solid #bbf7d0;border-radius:6px;padding:5px;background:#f0fdf4;"><div style="font-size:7pt;color:#14532d;font-weight:700;">SIM</div><div style="font-size:12pt;font-weight:800;color:#14532d;">${r}</div></div>
      <div style="border:1px solid #fecaca;border-radius:6px;padding:5px;background:#fef2f2;"><div style="font-size:7pt;color:#7f1d1d;font-weight:700;">NÃO</div><div style="font-size:12pt;font-weight:800;color:#7f1d1d;">${c}</div></div>
      <div style="border:1px solid #e2e8f0;border-radius:6px;padding:5px;background:#fff;"><div style="font-size:7pt;color:#0f172a;font-weight:700;">RESPONDIDOS</div><div style="font-size:12pt;font-weight:800;color:#0f172a;">${l}/${d.length}</div></div>
    </div>
    ${x}
    <div style="margin-top:3mm;text-align:center;font-size:7pt;color:#94a3b8;">${v} · Relatório gerado em ${new Date().toLocaleDateString("pt-BR",{timeZone:y})}</div>
  </div>`;A(h,`checklist-${e}-${new Date().toISOString().slice(0,10)}${C(o.nome)}`)}function R(t){return t.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}function P(t,n,e){const o=document.getElementById(t);if(!o)return!1;const d=o.innerHTML;if(d.replace(/\s/g,"").length<80)return!1;const i=document.createElement("iframe");i.style.cssText="position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;border:none;opacity:0",document.body.appendChild(i);const r=i.contentDocument??i.contentWindow?.document;if(!r)return document.body.removeChild(i),!1;const c=e?.landscape?"@page { size: A4 landscape; margin: 10mm 0; }":"@page { size: A4; margin: 10mm 0; }";r.open(),r.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${R(n)}</title>
  <base href="${window.location.origin}/">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #fff; color: #111; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    ${c}
    img { display: block; }
  </style>
</head>
<body>${d}</body>
</html>`),r.close();let l=!1;const f=document.title;function a(){if(!l){l=!0,document.title=n;try{i.contentWindow?.focus(),i.contentWindow?.print()}finally{setTimeout(()=>{document.title=f;try{document.body.removeChild(i)}catch{}},2500)}}}return i.onload=a,setTimeout(a,800),!0}export{A as a,I as b,P as p,C as r};
