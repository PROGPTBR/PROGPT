'use client';

import { useEffect, useRef } from 'react';
import 'leaflet/dist/leaflet.css';
import type { Map as LMap, LayerGroup } from 'leaflet';
import { corDaCategoria, type FornecedorMapa, type Plano } from '@/lib/mapa-fornecedores/tipos';

// Mapa interativo dos fornecedores (Leaflet + OpenStreetMap, sem chave).
// Leaflet mexe em `window`, então é carregado só no navegador, dentro do
// useEffect. O conteúdo do balão é montado com textContent: nome, endereço e
// site vêm de busca na internet e nunca entram como HTML.

type Props = {
  fornecedores: FornecedorMapa[];
  plano: Plano | null;
  /** Categoria em destaque (as outras ficam esmaecidas); null = todas. */
  categoria: string | null;
  centro?: { lat: number; lng: number };
  alturaClasse?: string;
};

function el<K extends keyof HTMLElementTagNameMap>(tag: K, texto?: string | null, className?: string) {
  const e = document.createElement(tag);
  if (texto) e.textContent = texto;
  if (className) e.className = className;
  return e;
}

function balao(f: FornecedorMapa, cor: string): HTMLElement {
  const box = el('div', null, 'mapa-balao');
  box.style.minWidth = '200px';
  const t = el('div', f.nome);
  t.style.fontWeight = '600';
  t.style.marginBottom = '2px';
  const cat = el('div', f.categoria);
  cat.style.color = cor;
  cat.style.fontSize = '11px';
  cat.style.marginBottom = '6px';
  box.append(t, cat);
  if (f.oQueVende) box.append(el('div', f.oQueVende));
  const end = [f.endereco, f.bairro, f.cidade && f.uf ? `${f.cidade}/${f.uf}` : f.cidade, f.cep].filter(Boolean).join(', ');
  if (end) {
    const e = el('div', end);
    e.style.color = '#555';
    e.style.marginTop = '4px';
    box.append(e);
  }
  if (f.precisao === 'cidade') {
    const a = el('div', 'Local aproximado (centro da cidade)');
    a.style.color = '#b45309';
    a.style.fontSize = '11px';
    box.append(a);
  }
  if (f.telefone) box.append(el('div', `Tel.: ${f.telefone}`));
  if (f.site) {
    const a = document.createElement('a');
    a.href = f.site;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.textContent = f.site.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');
    box.append(a);
  }
  return box;
}

function rotulo(f: FornecedorMapa, cor: string, apagado: boolean): string {
  const nome = f.nome.length > 22 ? `${f.nome.slice(0, 21)}…` : f.nome;
  const seguro = nome.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
  const borda = f.precisao === 'cidade' ? 'dashed' : 'solid';
  return `<div style="display:flex;align-items:center;gap:4px;transform:translate(-7px,-7px);opacity:${apagado ? 0.25 : 1}">
    <span style="width:14px;height:14px;border-radius:50%;background:${cor};border:2px ${borda} #fff;box-shadow:0 1px 3px rgba(0,0,0,.4);flex:none"></span>
    <span style="background:rgba(255,255,255,.92);color:#111;border-radius:999px;padding:1px 7px;font:500 11px/16px system-ui,sans-serif;white-space:nowrap;box-shadow:0 1px 2px rgba(0,0,0,.25)">${seguro}</span>
  </div>`;
}

export function MapaLeaflet({ fornecedores, plano, categoria, centro, alturaClasse = 'h-[480px]' }: Props) {
  const div = useRef<HTMLDivElement>(null);
  const mapa = useRef<LMap | null>(null);
  const camada = useRef<LayerGroup | null>(null);
  const L = useRef<typeof import('leaflet') | null>(null);
  const enquadrado = useRef(0);

  useEffect(() => {
    let vivo = true;
    void import('leaflet').then((mod) => {
      if (!vivo || !div.current || mapa.current) return;
      const leaflet = (mod as { default?: typeof import('leaflet') }).default ?? mod;
      L.current = leaflet;
      const m = leaflet.map(div.current, { scrollWheelZoom: false }).setView(
        [centro?.lat ?? -15.78, centro?.lng ?? -47.93],
        centro ? 11 : 4,
      );
      leaflet
        .tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '&copy; colaboradores do <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        })
        .addTo(m);
      camada.current = leaflet.layerGroup().addTo(m);
      mapa.current = m;
      desenhar();
    });
    return () => {
      vivo = false;
      mapa.current?.remove();
      mapa.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function desenhar() {
    const leaflet = L.current;
    const m = mapa.current;
    const g = camada.current;
    if (!leaflet || !m || !g) return;
    g.clearLayers();
    const pontos = fornecedores.filter((f) => f.lat != null && f.lng != null);
    for (const f of pontos) {
      const cor = corDaCategoria(plano, f.categoria);
      const apagado = categoria !== null && f.categoria !== categoria;
      leaflet
        .marker([f.lat!, f.lng!], {
          icon: leaflet.divIcon({ className: '', html: rotulo(f, cor, apagado), iconSize: [0, 0] }),
          zIndexOffset: apagado ? -100 : 0,
          title: f.nome,
        })
        .bindPopup(balao(f, cor))
        .addTo(g);
    }
    // Enquadra quando chegam pontos novos (não a cada filtro, para não pular).
    if (pontos.length > 0 && pontos.length !== enquadrado.current) {
      enquadrado.current = pontos.length;
      m.fitBounds(leaflet.latLngBounds(pontos.map((f) => [f.lat!, f.lng!] as [number, number])), {
        padding: [40, 40],
        maxZoom: 14,
      });
    }
  }

  useEffect(() => {
    desenhar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fornecedores, categoria, plano]);

  return (
    <div className="relative overflow-hidden rounded-2xl border">
      <div ref={div} className={`${alturaClasse} w-full bg-muted`} role="region" aria-label="Mapa dos fornecedores" />
      <button
        type="button"
        onClick={() => mapa.current?.scrollWheelZoom.enabled() ? mapa.current.scrollWheelZoom.disable() : mapa.current?.scrollWheelZoom.enable()}
        className="absolute bottom-2 left-2 z-[400] rounded-md bg-background/90 px-2 py-1 text-[11px] text-muted-foreground shadow"
      >
        Zoom com a rolagem: liga/desliga
      </button>
    </div>
  );
}
