'use client';

import { useState, type SVGProps } from 'react';
import styles from './atualizacoes.module.css';

type IconName = 'check' | 'close' | 'search';

const iconPaths: Record<IconName, string> = {
  search: 'M21 21l-5-5M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0',
  close: 'm6 6 12 12M18 6 6 18',
  check: 'm5 12 4 4L19 6',
};

function Icon({
  name = 'search',
  size = 18,
  ...props
}: SVGProps<SVGSVGElement> & { name?: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d={iconPaths[name]} />
    </svg>
  );
}

type UpdateType = 'Novo recurso' | 'Melhoria' | 'Correção';

type Update = {
  id: string;
  date: string;
  week: string;
  month: string;
  type: UpdateType;
  title: string;
  text: string;
  bullets: string[];
  video?: string;
  poster?: string;
  caption?: string;
};

const updates: Update[] = [
  {
    id: 'favoritos',
    date: '30 OUT 2026',
    week: '26 a 30 de outubro',
    month: '10',
    type: 'Novo recurso',
    title: 'Encontre seus assistentes com mais facilidade',
    text: 'Agora você pode buscar assistentes diretamente no menu lateral da área de chat. Abra Assistentes e digite o nome do assistente que deseja encontrar para acessá-lo mais rapidamente.',
    bullets: ['Confira no vídeo abaixo, a nova atualização'],
    // Coloque o arquivo em: public/atualizacoes/busca-assistentes.mp4
    video: '/atualizacoes/busca-assistentes.mp4',
    // Opcional: imagem de capa exibida antes do play (public/atualizacoes/busca-assistentes.jpg)
    // poster: '/atualizacoes/busca-assistentes.jpg',
    caption: 'Busca de assistentes • demonstração em vídeo',
  },
];

const filters: Array<'Todas' | UpdateType> = [
  'Todas',
  'Novo recurso',
  'Melhoria',
  'Correção',
];

const filterLabels = {
  Todas: 'Todas',
  'Novo recurso': 'Novos recursos',
  Melhoria: 'Melhorias',
  Correção: 'Correções',
};

export default function UpdatesPage() {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<(typeof filters)[number]>('Todas');
  const month = '10';

  const normalizedQuery = query.toLocaleLowerCase('pt-BR');
  const items = updates.filter(
    (update) =>
      (filter === 'Todas' || update.type === filter) &&
      update.month === month &&
      `${update.title} ${update.text} ${update.type}`
        .toLocaleLowerCase('pt-BR')
        .includes(normalizedQuery),
  );

  return (
    <div className={styles.app}>
      <div className={styles.mainShell}>
        <header className={styles.topbar}>
          <a
            className={styles.headerLogo}
            href="#atualizacoes"
            aria-label="PROGPT — Atualizações"
          >
            <img
              src="/atualizacoes/progpt-logo.png"
              alt="PROGPT"
              width="241"
              height="57"
            />
          </a>
          <span className={styles.topInfo}>
            <span className={styles.smallDot} /> Novidades do sistema
          </span>
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
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar atualização"
                aria-label="Buscar atualização"
              />
              {query && (
                <button
                  className={styles.iconButton}
                  aria-label="Limpar busca"
                  onClick={() => setQuery('')}
                  type="button"
                >
                  <Icon name="close" size={15} />
                </button>
              )}
            </label>
            <span className={styles.monthLabel}>Outubro de 2026</span>
          </section>

          <div className={styles.filters} aria-label="Tipo de atualização">
            {filters.map((item) => (
              <button
                key={item}
                aria-pressed={filter === item}
                className={filter === item ? styles.active : undefined}
                onClick={() => setFilter(item)}
                type="button"
              >
                {filterLabels[item]}
              </button>
            ))}
            <span className={styles.resultCount} aria-live="polite">
              {items.length} {items.length === 1 ? 'publicação' : 'publicações'}
            </span>
          </div>

          <div className={styles.updates}>
            {items.map((update, index) => (
              <article className={styles.update} key={update.id}>
                <div className={styles.dateColumn}>
                  <div className={styles.timelineDot} />
                  <time>{update.date}</time>
                  <span>
                    Semana de
                    <br />
                    {update.week}
                  </span>
                  {index === 0 && filter === 'Todas' && !query && (
                    <span className={styles.latest}>Mais recente</span>
                  )}
                </div>
                <div className={styles.updateContent}>
                  <span
                    className={`${styles.badge} ${
                      update.type === 'Novo recurso'
                        ? styles.new
                        : update.type === 'Melhoria'
                          ? styles.improvement
                          : styles.fix
                    }`}
                  >
                    {update.type === 'Correção' && <Icon name="check" size={12} />}{' '}
                    {update.type}
                  </span>
                  <h2>{update.title}</h2>
                  <p>{update.text}</p>
                  <ul>
                    {update.bullets.map((bullet) => (
                      <li key={bullet}>{bullet}</li>
                    ))}
                  </ul>
                  {update.video && (
                    <figure>
                      <video
                        className={styles.video}
                        controls
                        playsInline
                        preload="metadata"
                        poster={update.poster}
                        aria-label={update.title}
                      >
                        <source src={update.video} type="video/mp4" />
                        Seu navegador não suporta a reprodução de vídeo.
                      </video>
                      <figcaption>{update.caption}</figcaption>
                    </figure>
                  )}
                </div>
              </article>
            ))}
          </div>

          {!items.length && (
            <div className={styles.empty}>
              <Icon name="search" size={25} />
              <h2>Nenhuma atualização encontrada</h2>
              <p>Tente outro termo ou selecione um período diferente.</p>
              <button
                onClick={() => {
                  setQuery('');
                  setFilter('Todas');
                }}
                type="button"
              >
                Limpar filtros
              </button>
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
