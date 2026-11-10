'use client';

import { useState, type SVGProps } from 'react';
import Image from 'next/image';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { ProductUpdate, UpdateCategory } from '@/lib/updates/types';
import { UPDATE_CATEGORY_LABELS } from '@/lib/updates/types';
import styles from './atualizacoes.module.css';

type IconName = 'check' | 'close' | 'search';

const iconPaths: Record<IconName, string> = {
  search: 'M21 21l-5-5M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0',
  close: 'm6 6 12 12M18 6 6 18',
  check: 'm5 12 4 4L19 6',
};

function Icon({ name = 'search', size = 18, ...props }: SVGProps<SVGSVGElement> & { name?: IconName; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d={iconPaths[name]} />
    </svg>
  );
}

type Filter = 'all' | UpdateCategory;
const filters: Filter[] = ['all', 'new_feature', 'improvement', 'fix'];
const filterLabels: Record<Filter, string> = {
  all: 'Todas',
  new_feature: 'Novos recursos',
  improvement: 'Melhorias',
  fix: 'Correções',
};

const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  timeZone: 'America/Sao_Paulo',
});
const monthFormatter = new Intl.DateTimeFormat('pt-BR', {
  month: 'long',
  year: 'numeric',
  timeZone: 'America/Sao_Paulo',
});
const weekFormatter = new Intl.DateTimeFormat('pt-BR', {
  day: 'numeric',
  month: 'long',
  timeZone: 'America/Sao_Paulo',
});

function publicationDate(iso: string) {
  return dateFormatter.format(new Date(iso)).replace('.', '').toLocaleUpperCase('pt-BR');
}

function publicationWeek(iso: string) {
  const date = new Date(iso);
  const local = new Date(date.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  const weekday = local.getDay();
  const monday = new Date(local);
  monday.setDate(monday.getDate() + (weekday === 0 ? -6 : 1 - weekday));
  const friday = new Date(monday);
  friday.setDate(friday.getDate() + 4);
  const start = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', timeZone: 'America/Sao_Paulo' }).format(monday);
  return `${start} a ${weekFormatter.format(friday)}`;
}

export default function UpdatesPage({ updates, loadError = false }: { updates: ProductUpdate[]; loadError?: boolean }) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const normalizedQuery = query.trim().toLocaleLowerCase('pt-BR');
  const items = updates.filter((update) =>
    (filter === 'all' || update.category === filter) &&
    `${update.title} ${update.summary} ${update.content_md} ${UPDATE_CATEGORY_LABELS[update.category]}`
      .toLocaleLowerCase('pt-BR')
      .includes(normalizedQuery),
  );
  const periodLabel = updates[0]
    ? monthFormatter.format(new Date(updates[0].published_at)).replace(/^./, (letter) => letter.toLocaleUpperCase('pt-BR'))
    : 'Publicações';

  return (
    <div className={styles.app}>
      <div className={styles.mainShell}>
        <header className={styles.topbar}>
          <a className={styles.headerLogo} href="#atualizacoes" aria-label="PROGPT — Atualizações">
            <Image src="/atualizacoes/progpt-logo.png" alt="PROGPT" width={241} height={57} priority />
          </a>
          <span className={styles.topInfo}><span className={styles.smallDot} /> Novidades do sistema</span>
        </header>

        <main id="atualizacoes" className={styles.content}>
          <div className={styles.pageHeading}>
            <div>
              <div className={styles.eyebrow}>PROGPT EM EVOLUÇÃO</div>
              <h1>Atualizações do sistema</h1>
            </div>
            <span className={styles.weekly}>Atualizações semanais</span>
          </div>

          <section className={styles.toolbar} aria-label="Filtrar atualizações">
            <label className={styles.search}>
              <Icon name="search" size={17} />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar atualização" aria-label="Buscar atualização" />
              {query && <button className={styles.iconButton} aria-label="Limpar busca" onClick={() => setQuery('')} type="button"><Icon name="close" size={15} /></button>}
            </label>
            <span className={styles.monthLabel}>{periodLabel}</span>
          </section>

          <div className={styles.filters} aria-label="Tipo de atualização">
            {filters.map((item) => (
              <button key={item} aria-pressed={filter === item} className={filter === item ? styles.active : undefined} onClick={() => setFilter(item)} type="button">
                {filterLabels[item]}
              </button>
            ))}
            <span className={styles.resultCount} aria-live="polite">{items.length} {items.length === 1 ? 'publicação' : 'publicações'}</span>
          </div>

          <div className={styles.updates}>
            {items.map((update, index) => (
              <article className={styles.update} key={update.id} id={update.slug}>
                <div className={styles.dateColumn}>
                  <div className={styles.timelineDot} />
                  <time dateTime={update.published_at}>{publicationDate(update.published_at)}</time>
                  <span>Semana de<br />{publicationWeek(update.published_at)}</span>
                  {index === 0 && filter === 'all' && !query && <span className={styles.latest}>Mais recente</span>}
                </div>
                <div className={styles.updateContent}>
                  <span className={`${styles.badge} ${update.category === 'new_feature' ? styles.new : update.category === 'improvement' ? styles.improvement : styles.fix}`}>
                    {update.category === 'fix' && <Icon name="check" size={12} />} {UPDATE_CATEGORY_LABELS[update.category]}
                  </span>
                  <h2>{update.title}</h2>
                  <p className={styles.summary}>{update.summary}</p>
                  {update.content_md && <div className={styles.markdown}><ReactMarkdown remarkPlugins={[remarkGfm]}>{update.content_md}</ReactMarkdown></div>}
                  {update.image_url && !update.video_url && (
                    <figure>
                      {/* URL administrável: <img> aceita qualquer origem https sem
                          exigir uma allowlist de hosts no build do Next.js. */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img className={styles.mediaImage} src={update.image_url} alt={update.media_caption || update.title} />
                      {update.media_caption && <figcaption>{update.media_caption}</figcaption>}
                    </figure>
                  )}
                  {update.video_url && (
                    <figure>
                      <video className={styles.video} controls playsInline preload="metadata" poster={update.image_url ?? undefined} aria-label={update.title}>
                        <source src={update.video_url} />
                        Seu navegador não suporta a reprodução de vídeo.
                      </video>
                      {update.media_caption && <figcaption>{update.media_caption}</figcaption>}
                    </figure>
                  )}
                </div>
              </article>
            ))}
          </div>

          {(loadError || !items.length) && (
            <div className={styles.empty} role={loadError ? 'alert' : undefined}>
              <Icon name="search" size={25} />
              <h2>{loadError ? 'Não foi possível carregar as atualizações' : 'Nenhuma atualização encontrada'}</h2>
              <p>{loadError ? 'Tente recarregar a página em alguns instantes.' : 'Tente outro termo ou selecione um filtro diferente.'}</p>
              {loadError ? (
                <button onClick={() => window.location.reload()} type="button">Tentar novamente</button>
              ) : updates.length > 0 ? (
                <button onClick={() => { setQuery(''); setFilter('all'); }} type="button">Limpar filtros</button>
              ) : null}
            </div>
          )}

          <footer className={styles.footer}>
            <span>Você está em dia com as atualizações deste período.</span>
            <span>PROGPT · Feito para simplificar.</span>
          </footer>
        </main>
      </div>
    </div>
  );
}
